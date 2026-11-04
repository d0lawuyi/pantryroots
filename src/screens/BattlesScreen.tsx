import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { BATTLES, eloUpdate, type Battle, type Contender } from "@/data/battles";
import { ShareButton } from "@/components/ShareButton";
import { useApp } from "@/lib/app-context";
import { usePersistentState } from "@/lib/storage";
import { PageHeader, Section } from "@/components/ui";

export type Ratings = Record<string, Record<string, number>>;
export type VoteCounts = Record<string, number>;

/** battleId -> contenderId -> times the user picked it. */
type Picks = Record<string, Record<string, number>>;

type Result = {
  pick: Contender;
  other: Contender;
  /** Expected share for the pick, from ratings before this vote (0–1). */
  share: number;
  delta: number;
};

const CHOSEN_MS = 720;

function pickPair(contenders: Contender[], avoid?: [string, string]): [Contender, Contender] {
  // Pick two different contenders, avoiding an immediate repeat of the last pair.
  for (let tries = 0; tries < 12; tries++) {
    const a = contenders[Math.floor(Math.random() * contenders.length)];
    let b = contenders[Math.floor(Math.random() * contenders.length)];
    while (b.id === a.id) b = contenders[Math.floor(Math.random() * contenders.length)];
    const same = avoid && [a.id, b.id].sort().join() === [...avoid].sort().join();
    if (!same || contenders.length === 2) return [a, b];
  }
  return [contenders[0], contenders[1]];
}

function expectedScore(a: number, b: number) {
  return 1 / (1 + 10 ** ((b - a) / 400));
}

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

/* ───────────── "Your taste" ───────────── */

/** First word of a note value, lowercased: "Long-grain parboiled" -> "long-grain", "High — burnt bottom" -> "high". */
function noteKey(value: string) {
  return value.trim().split(/[\s,]+/)[0].toLowerCase();
}

/** Turn a dominant note into a short phrase. Unknown labels fall back to "<value> <label>". */
function phrase(label: string, key: string): string | null {
  const l = label.toLowerCase();
  if (l === "smoke") return key === "high" ? "smoky" : `${key} smoke`;
  if (l === "rice") return `${key} rice`;
  if (l === "texture") return `${key} textures`;
  if (l === "grain") return `${key} batters`;
  if (l === "character") return `${key} breads`;
  if (l === "style") return `${key} stews`;
  if (l === "signature" || l === "made from") return null; // unique per dish, says nothing about a lean
  return `${key} ${l}`;
}

function describeTaste(battle: Battle, picks: Record<string, number>): { line: string; total: number } | null {
  const total = Object.values(picks).reduce((s, n) => s + n, 0);
  if (total < 3) return null;

  const labels = [...new Set(battle.contenders.flatMap((c) => c.notes.map((n) => n.label)))];
  const traits: { text: string; strength: number }[] = [];
  for (const label of labels) {
    const counts = new Map<string, number>();
    const everyone = new Set<string>();
    for (const c of battle.contenders) {
      const note = c.notes.find((n) => n.label === label);
      if (!note) continue;
      const k = noteKey(note.value);
      everyone.add(k);
      counts.set(k, (counts.get(k) ?? 0) + (picks[c.id] ?? 0));
    }
    if (everyone.size < 2) continue; // every contender shares it, so it tells us nothing
    const [key, n] = [...counts.entries()].sort((x, y) => y[1] - x[1])[0] ?? ["", 0];
    if (n >= 2 && n / total > 0.5) {
      const text = phrase(label, key);
      if (text) traits.push({ text, strength: n / total });
    }
  }
  traits.sort((x, y) => y.strength - x.strength);
  if (traits.length) {
    return { line: `You lean ${traits.slice(0, 2).map((t) => t.text).join(" and ")}`, total };
  }
  const [favId, favN] = Object.entries(picks).sort((x, y) => y[1] - x[1])[0];
  const fav = battle.contenders.find((c) => c.id === favId);
  if (fav && favN / total >= 0.5) return { line: `You keep coming back to ${fav.dish}`, total };
  return { line: "Your picks are spread out, no clear lean yet", total };
}

/* ───────────── Icons (local, Icon.tsx style) ───────────── */

function Arrow({ dir }: { dir: "up" | "down" }) {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {dir === "up" ? <path d="M12 19V5M6 11l6-6 6 6" /> : <path d="M12 5v14M6 13l6 6 6-6" />}
    </svg>
  );
}

/* ───────────── Screen ───────────── */

export function BattlesScreen({
  ratings,
  setRatings,
  votes,
  setVotes,
}: {
  ratings: Ratings;
  setRatings: (fn: (r: Ratings) => Ratings) => void;
  votes: VoteCounts;
  setVotes: (fn: (v: VoteCounts) => VoteCounts) => void;
}) {
  const { openDish } = useApp();
  const [battleId, setBattleId] = useState(BATTLES[0].id);
  const battle = BATTLES.find((b) => b.id === battleId)!;
  const [pair, setPair] = useState(() => pickPair(battle.contenders));
  const [round, setRound] = useState(0);
  const [chosen, setChosen] = useState<{ id: string; delta: number } | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [picks, setPicks] = usePersistentState<Picks>("battle-picks", {});
  const timer = useRef<number | undefined>(undefined);
  const cardRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const rating = (c: Contender) => ratings[battle.id]?.[c.id] ?? c.rating;
  const standings = useMemo(
    () => [...battle.contenders].sort((a, b) => rating(b) - rating(a)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [battle, ratings],
  );

  // Ranks as they were when this battle was first shown in this session.
  const initialRanks = useRef<Record<string, Record<string, number>>>({});
  if (!initialRanks.current[battle.id]) {
    initialRanks.current[battle.id] = Object.fromEntries(standings.map((c, i) => [c.id, i]));
  }

  useEffect(() => () => window.clearTimeout(timer.current), []);

  function nextPair(contenders: Contender[], avoid?: [string, string]) {
    setPair(pickPair(contenders, avoid));
    setRound((r) => r + 1);
    setChosen(null);
  }

  function switchBattle(id: string) {
    if (id === battleId) return;
    window.clearTimeout(timer.current);
    const next = BATTLES.find((b) => b.id === id)!;
    setBattleId(id);
    setResult(null);
    nextPair(next.contenders);
  }

  function vote(index: 0 | 1) {
    if (chosen) return; // mid-animation
    const winner = pair[index];
    const loser = pair[index === 0 ? 1 : 0];
    const before = { w: rating(winner), l: rating(loser) };
    const r = eloUpdate(before.w, before.l);

    setRatings((prev) => ({
      ...prev,
      [battle.id]: { ...prev[battle.id], [winner.id]: r.winner, [loser.id]: r.loser },
    }));
    setVotes((v) => ({ ...v, [battle.id]: (v[battle.id] ?? 0) + 1 }));
    setPicks((p) => ({
      ...p,
      [battle.id]: { ...p[battle.id], [winner.id]: (p[battle.id]?.[winner.id] ?? 0) + 1 },
    }));
    setResult({ pick: winner, other: loser, share: expectedScore(before.w, before.l), delta: r.delta });

    const contenders = battle.contenders;
    const avoid: [string, string] = [winner.id, loser.id];
    if (prefersReducedMotion()) {
      nextPair(contenders, avoid);
      return;
    }
    setChosen({ id: winner.id, delta: r.delta });
    timer.current = window.setTimeout(() => nextPair(contenders, avoid), CHOSEN_MS);
  }

  // Left / Right arrows choose a card. Ignored while typing or when a dialog is open.
  const keyHandler = useRef<(e: KeyboardEvent) => void>(() => {});
  keyHandler.current = (e) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey || e.defaultPrevented) return;
    const t = e.target as HTMLElement | null;
    if (t?.closest("input, textarea, select, [contenteditable='true'], [role='dialog'], [role='tablist']")) return;
    if (document.querySelector("[role='dialog']")) return;
    e.preventDefault();
    const i = e.key === "ArrowLeft" ? 0 : 1;
    vote(i);
    if (t && cardRefs.current.includes(t as HTMLButtonElement)) cardRefs.current[i]?.focus();
  };
  useEffect(() => {
    const on = (e: KeyboardEvent) => keyHandler.current(e);
    window.addEventListener("keydown", on);
    return () => window.removeEventListener("keydown", on);
  }, []);

  const myVotes = votes[battle.id] ?? 0;
  const taste = describeTaste(battle, picks[battle.id] ?? {});
  const leader = rating(standings[0]);
  const floor = Math.min(...standings.map(rating)) - 60;
  const [a, b] = pair;

  return (
    <div className="page battles">
      <PageHeader title="Battles" lede="Same base ingredients, different kitchens. Pick the one you'd cook and the standings update." />

      <div className="scroller bt-chips" role="tablist" aria-label="Battles">
        {BATTLES.map((bt) => {
          const n = votes[bt.id] ?? 0;
          return (
            <button key={bt.id} type="button" role="tab" aria-selected={bt.id === battleId} className="chip bt-chip" onClick={() => switchBattle(bt.id)}>
              {bt.title}
              {n > 0 && (
                <span className="bt-chip__count num" aria-label={`${n} ${n === 1 ? "vote" : "votes"}`}>
                  {n}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {taste && (
        <p className="bt-taste" aria-live="polite">
          <span className="bt-taste__line">{taste.line}</span>
          <span className="bt-taste__from num">From your {taste.total} picks in {battle.title.toLowerCase()}</span>
        </p>
      )}
      {myVotesShareable(votes, battle.id) && (
        <div style={{ margin: "0 0 16px" }}>
          <ShareButton kind="battle" small battleTitle={battle.title} picks={standings.slice(0, 3)} tasteLine={taste?.line} label="Share my ranking" />
        </div>
      )}

      <Section>
        <h2 className="bt-question">{battle.question}</h2>

        <div className={`bt-matchup${chosen ? " is-deciding" : ""}`} data-round={round % 2}>
          {[a, b].map((c, i) => {
            const state = chosen ? (chosen.id === c.id ? "won" : "lost") : "idle";
            return (
              <button
                key={i}
                ref={(el) => (cardRefs.current[i] = el)}
                type="button"
                className="contender bt-card"
                data-state={state}
                data-side={i === 0 ? "left" : "right"}
                aria-label={`Pick ${c.dish}, ${c.origin}`}
                aria-keyshortcuts={i === 0 ? "ArrowLeft" : "ArrowRight"}
                onClick={() => vote(i as 0 | 1)}
              >
                {state === "won" && (
                  <span className="bt-card__delta num" aria-hidden="true">
                    +{chosen!.delta}
                  </span>
                )}
                <span className="bt-card__head">
                  <span className="contender__dish">{c.dish}</span>
                  <span className="contender__origin">{c.origin}</span>
                </span>
                <dl>
                  {c.notes.map((n) => (
                    <div key={n.label}>
                      <dt>{n.label}</dt>
                      <dd>{n.value}</dd>
                    </div>
                  ))}
                </dl>
                <span className="contender__cta bt-card__cta">
                  I'd cook this
                  <kbd className="bt-kbd" aria-hidden="true">{i === 0 ? "Left" : "Right"}</kbd>
                </span>
              </button>
            );
          })}
          <span className="bt-vs" aria-hidden="true">vs</span>
        </div>

        <div className="bt-foot">
          <span className="xs muted num">
            {myVotes ? `You've voted ${myVotes} ${myVotes === 1 ? "time" : "times"}` : `Base: ${battle.base.join(", ")}`}
          </span>
          <button type="button" className="link bt-skip" onClick={() => { window.clearTimeout(timer.current); nextPair(battle.contenders, [a.id, b.id]); }}>
            Skip this pair
          </button>
        </div>

        <div aria-live="polite">
          {result && <ResultStrip key={`${result.pick.id}-${result.other.id}-${myVotes}`} result={result} />}
        </div>
      </Section>

      <Section title="Standings" note="Elo ratings. Arrows show movement since you opened this page. Your votes are saved on this device.">
        <ol className="group bt-standings">
          {standings.map((c, i) => {
            const r = rating(c);
            const start = initialRanks.current[battle.id][c.id] ?? i;
            const moved = start - i;
            const width = Math.max(4, ((r - floor) / (leader - floor)) * 100);
            return (
              <li key={c.id} className="row bt-row">
                <span className={i === 0 ? "rank rank--first num" : "rank num"}>{i + 1}</span>
                <span className="row__body">
                  <span className="row__title bt-row__title">{c.dish}</span>
                  <span className="row__meta bt-row__meta">{c.origin}</span>
                  <span
                    className={i === 0 ? "bt-bar bt-bar--lead" : "bt-bar"}
                    role="img"
                    aria-label={i === 0 ? "Leader" : `${leader - r} points behind the leader`}
                  >
                    <span className="bt-bar__fill" style={{ "--w": `${width}%` } as CSSProperties} />
                  </span>
                </span>
                <span className="bt-row__score">
                  <span className="rating num">{r}</span>
                  {moved !== 0 ? (
                    <span className={moved > 0 ? "bt-move bt-move--up num" : "bt-move bt-move--down num"}>
                      <Arrow dir={moved > 0 ? "up" : "down"} />
                      {Math.abs(moved)}
                      <span className="visually-hidden">{moved > 0 ? " places up" : " places down"} since you opened this page</span>
                    </span>
                  ) : null}
                </span>
                <span className="bt-row__action">
                  {c.dishId && (
                    <button type="button" className="btn btn--secondary btn--sm bt-recipe" onClick={() => openDish(c.dishId!)} aria-label={`Recipe for ${c.dish}`}>
                      Recipe
                    </button>
                  )}
                </span>
              </li>
            );
          })}
        </ol>
      </Section>
    </div>
  );
}

function ResultStrip({ result }: { result: Result }) {
  const pickPct = Math.round(result.share * 100);
  const otherPct = 100 - pickPct;
  const verdict =
    pickPct >= 55
      ? `You're with the crowd on ${result.pick.dish}`
      : pickPct <= 45
        ? `Underdog pick: ${result.pick.dish} moved up ${result.delta}`
        : `Close call, and you tipped it to ${result.pick.dish}`;
  return (
    <div className="bt-result">
      <div className="bt-result__head">
        <h3 className="bt-result__title">Your pick vs the crowd</h3>
        <span className="bt-result__src">Based on ratings</span>
      </div>
      <p className="bt-result__verdict">{verdict}</p>
      <ul className="bt-result__bars">
        {[
          { c: result.pick, pct: pickPct, mine: true },
          { c: result.other, pct: otherPct, mine: false },
        ].map(({ c, pct, mine }) => (
          <li key={c.id} className={mine ? "bt-share bt-share--mine" : "bt-share"}>
            <span className="bt-share__name">
              {c.dish}
              {mine && <span className="bt-share__tag">Your pick</span>}
            </span>
            <span className="bt-share__track" aria-hidden="true">
              <span className="bt-share__fill" style={{ "--w": `${pct}%` } as CSSProperties} />
            </span>
            <span className="bt-share__pct num">{pct}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Only offer sharing once the person has voted in this battle. */
function myVotesShareable(votes: VoteCounts, battleId: string) {
  return (votes[battleId] ?? 0) > 0;
}
