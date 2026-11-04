import { useMemo, useState } from "react";
import { BATTLES, eloUpdate, type Contender } from "@/data/battles";
import { useApp } from "@/lib/app-context";
import { PageHeader, Section } from "@/components/ui";

export type Ratings = Record<string, Record<string, number>>;
export type VoteCounts = Record<string, number>;

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
  const { notify, openDish } = useApp();
  const [battleId, setBattleId] = useState(BATTLES[0].id);
  const battle = BATTLES.find((b) => b.id === battleId)!;
  const [pair, setPair] = useState(() => pickPair(battle.contenders));
  const [lastDelta, setLastDelta] = useState<{ id: string; delta: number } | null>(null);

  const rating = (c: Contender) => ratings[battle.id]?.[c.id] ?? c.rating;
  const standings = useMemo(
    () => [...battle.contenders].sort((a, b) => rating(b) - rating(a)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [battle, ratings],
  );

  function switchBattle(id: string) {
    const next = BATTLES.find((b) => b.id === id)!;
    setBattleId(id);
    setPair(pickPair(next.contenders));
    setLastDelta(null);
  }

  function vote(winner: Contender, loser: Contender) {
    const r = eloUpdate(rating(winner), rating(loser));
    setRatings((prev) => ({
      ...prev,
      [battle.id]: { ...prev[battle.id], [winner.id]: r.winner, [loser.id]: r.loser },
    }));
    setVotes((v) => ({ ...v, [battle.id]: (v[battle.id] ?? 0) + 1 }));
    setLastDelta({ id: winner.id, delta: r.delta });
    notify(`Vote counted for ${winner.dish}`);
    setPair(pickPair(battle.contenders, [winner.id, loser.id]));
  }

  const [a, b] = pair;
  const myVotes = votes[battle.id] ?? 0;

  return (
    <div className="page">
      <PageHeader title="Battles" lede="Same base ingredients, different kitchens. Pick the one you'd cook and the standings update." />

      <div className="scroller" role="tablist" aria-label="Battles" style={{ marginBottom: 24 }}>
        {BATTLES.map((bt) => (
          <button key={bt.id} type="button" role="tab" aria-selected={bt.id === battleId} className="chip" onClick={() => switchBattle(bt.id)}>
            {bt.title}
          </button>
        ))}
      </div>

      <Section>
        <div className="versus">
          <h2 className="section__title" style={{ fontSize: "var(--fs-lg)" }}>{battle.question}</h2>
        </div>
        <div className="matchup">
          {[a, b].map((c, i) => (
            <button key={c.id} type="button" className="contender" onClick={() => vote(c, i === 0 ? b : a)}>
              <div>
                <p className="contender__dish">{c.dish}</p>
                <p className="contender__origin">{c.origin}</p>
              </div>
              <dl>
                {c.notes.map((n) => (
                  <div key={n.label}>
                    <dt>{n.label}</dt>
                    <dd>{n.value}</dd>
                  </div>
                ))}
              </dl>
              <span className="contender__cta">I'd cook this</span>
            </button>
          ))}
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12 }}>
          <span className="xs muted num">{myVotes ? `You've voted ${myVotes} ${myVotes === 1 ? "time" : "times"}` : "Base: " + battle.base.join(", ")}</span>
          <button type="button" className="link" onClick={() => setPair(pickPair(battle.contenders, [a.id, b.id]))}>
            Skip this pair
          </button>
        </div>
      </Section>

      <Section title="Standings" note="Elo ratings. Your votes are saved on this device.">
        <ol className="group">
          {standings.map((c, i) => (
            <li key={c.id} className="row">
              <span className={i === 0 ? "rank rank--first num" : "rank num"}>{i + 1}</span>
              <span className="row__body">
                <span className="row__title" style={{ display: "block" }}>{c.dish}</span>
                <span className="row__meta" style={{ display: "block" }}>{c.origin}</span>
              </span>
              <span className="row__trail" style={{ flexDirection: "column", alignItems: "flex-end", gap: 0 }}>
                <span className="rating num" style={{ color: "var(--ink)" }}>{rating(c)}</span>
                {lastDelta?.id === c.id && <span className="delta num">+{lastDelta.delta}</span>}
              </span>
              {c.dishId && (
                <button type="button" className="btn btn--secondary btn--sm" onClick={() => openDish(c.dishId!)}>
                  Recipe
                </button>
              )}
            </li>
          ))}
        </ol>
      </Section>
    </div>
  );
}
