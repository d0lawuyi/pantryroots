import { useEffect, useRef, useState, type FormEvent } from "react";
import type { ChatTurn } from "@/lib/concierge-types";
import { askConcierge, localRespond, resizeImage } from "@/lib/concierge-client";
import { useSpeech } from "@/lib/use-speech";
import { profileSummary } from "@/lib/profile";
import { usePersistentState } from "@/lib/storage";
import { useApp } from "@/lib/app-context";
import { ConciergeCard } from "./ConciergeCards";
import { Icon } from "./Icon";

const ACTIONS = [
  { icon: "camera", title: "Scan my shelf", sub: "Photo of your pantry or fridge", kind: "photo" },
  { icon: "cook", title: "What can I cook tonight?", sub: "Ranked by what you have", kind: "ask" },
  { icon: "swap", title: "I'm out of palm oil", sub: "Swap, nearest shop, delivery", kind: "ask" },
  { icon: "explore", title: "Something Caribbean with what I have", sub: "AI-written, from other traditions", kind: "ask" },
] as const;
const NEEDS_LOCATION = /(out of|ran out|run out|running low|low on|need more|don'?t have|buy|store|shop|near|order|deliver)/i;

type Loc = { lat: number; lng: number };

function getLocation(): Promise<Loc | null> {
  if (!("geolocation" in navigator)) return Promise.resolve(null);
  return new Promise((resolve) =>
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => resolve(null),
      { timeout: 8000, maximumAge: 600_000 },
    ),
  );
}

export function Concierge({ open, onClose, pending }: { open: boolean; onClose: () => void; pending: { text: string; image?: string; nonce: number } | null }) {
  const { pantry, registerDish, profile } = useApp();
  const [turns, setTurns] = usePersistentState<ChatTurn[]>("concierge", []);
  const [demo, setDemo] = usePersistentState<boolean>("demo", false);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [busyKind, setBusyKind] = useState<"photo" | "shop" | "chat">("chat");
  const speech = useSpeech(
    (interim) => setDraft(interim),
    (final) => {
      setDraft("");
      void send(final);
    },
  );
  const [loc, setLoc] = useState<Loc | null | undefined>(undefined);
  const [zip, setZip] = useUsableZip();
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const handled = useRef(0);

  // Re-register AI-written dishes from a restored conversation so their cards still open.
  useEffect(() => {
    for (const t of turns) for (const c of t.cards ?? []) if (c.type === "aiDish") registerDish(c.dish);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const last = list.lastElementChild as HTMLElement | null;
    // While thinking, follow the bottom; when an answer lands, show its start so the first card is in view.
    if (!busy && last?.classList.contains("reply") && turns.length > 1) {
      list.scrollTo({ top: Math.max(0, last.offsetTop - list.offsetTop - 12), behavior: "smooth" });
    } else {
      list.scrollTo({ top: list.scrollHeight, behavior: "smooth" });
    }
  }, [turns, busy]);

  useEffect(() => {
    if (pending && pending.nonce !== handled.current) {
      handled.current = pending.nonce;
      void send(pending.text, pending.image);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pending]);

  useEffect(() => {
    if (open && window.matchMedia("(min-width: 720px)").matches) inputRef.current?.focus();
    if (!open || window.matchMedia("(min-width: 1280px)").matches) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !document.querySelector(".scrim, .cook, .ob")) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  async function send(text: string, image?: string) {
    const clean = text.trim();
    if ((!clean && !image) || busy) return;
    const userTurn: ChatTurn = { role: "user", text: clean, image };
    const history = [...turns, userTurn];
    setTurns(history);
    setDraft("");

    const zipInText = clean.match(/\b\d{5}\b/)?.[0];
    if (zipInText) setZip(zipInText);

    setBusyKind(image ? "photo" : NEEDS_LOCATION.test(clean) ? "shop" : "chat");
    setBusy(image ? "Looking at your photo…" : NEEDS_LOCATION.test(clean) ? "Checking shops near you…" : "Thinking…");

    let reply: ChatTurn;
    if (demo) {
      await new Promise((r) => setTimeout(r, 900));
      reply = localRespond(history, pantry, true);
    } else {
      let location = loc;
      if (location === undefined && NEEDS_LOCATION.test(clean) && !zip && !zipInText) {
        location = await getLocation();
        setLoc(location);
      }
      const res = await askConcierge({
        messages: history.map((t, i) => ({ role: t.role, text: t.text, image: i === history.length - 1 ? t.image : undefined })),
        pantry,
        profile: profile.roots.length ? profileSummary(profile) : undefined,
        location: location ?? undefined,
        zip: zipInText ?? zip ?? undefined,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
      if (res.ok) {
        reply = { role: "assistant", text: res.data.text, cards: res.data.cards, model: res.data.model };
      } else if (res.error.error === "rate_limited" || res.error.error === "bad_request") {
        reply = { role: "assistant", text: res.error.message };
      } else {
        reply = localRespond(history, pantry, false);
      }
    }

    for (const c of reply.cards ?? []) if (c.type === "aiDish") registerDish(c.dish);
    // Don't keep full photos in storage — keep a marker so the history still reads right.
    setTurns([...history.map((t) => (t.image ? { ...t, image: undefined, text: t.text || "Sent a photo" } : t)), reply]);
    setBusy(null);
  }

  async function onPhoto(file: File | undefined) {
    if (!file) return;
    try {
      const data = await resizeImage(file);
      await send("Scan my pantry", data);
    } catch {
      setTurns((t) => [...t, { role: "assistant", text: "I couldn't read that photo. Try a JPEG or PNG." }]);
    }
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    void send(draft);
  }

  return (
    <aside className="concierge" data-open={open} aria-label="Kitchen concierge">
      <header className="concierge__head">
        <div>
          <h2 className="concierge__title">Concierge</h2>
          <p className="xs muted">Scan, cook, and get what you're missing. Powered by Meta Muse.</p>
        </div>
        <div className="concierge__actions">
          {turns.length > 0 && (
            <button type="button" className="btn btn--secondary btn--sm" onClick={() => setTurns([])} disabled={!!busy}>
              New chat
            </button>
          )}
          <button type="button" className="icon-btn concierge__close" onClick={onClose} aria-label="Close concierge">
            <Icon name="close" size={20} />
          </button>
        </div>
      </header>

      <div className="concierge__list" ref={listRef} aria-live="polite">
        {turns.length === 0 && (
          <div className="concierge__empty">
            <p className="concierge__hello">What are we cooking?</p>
            <p className="small muted" style={{ marginTop: 4 }}>
              {speech.supported ? "Tap a starter, type, or tap the mic and talk." : "Tap a starter or type a message."}
            </p>
            <div className="tiles">
              {ACTIONS.map((a) => (
                <button
                  key={a.title}
                  type="button"
                  className="tile"
                  onClick={() => (a.kind === "photo" ? fileRef.current?.click() : void send(a.title))}
                >
                  <span className="tile__icon"><Icon name={a.icon} size={20} /></span>
                  <span className="row__body">
                    <span className="tile__title">{a.title}</span>
                    <span className="tile__sub">{a.sub}</span>
                  </span>
                  <Icon name="chevron" size={16} />
                </button>
              ))}
            </div>
          </div>
        )}

        {turns.map((t, i) =>
          t.role === "user" ? (
            <div key={i} className="bubble bubble--user">
              {t.image && <img src={t.image} alt="Your photo" className="bubble__img" />}
              {t.text}
            </div>
          ) : (
            <div key={i} className="reply">
              {t.text && <p className="reply__text">{t.text}</p>}
              {t.cards?.map((c, j) => <ConciergeCard key={j} card={c} />)}
              {t.note && <p className="reply__note">{t.note}</p>}
              {!t.note && t.model && <p className="reply__note">Answered by {modelLabel(t.model)}</p>}
            </div>
          ),
        )}

        {busy && (
          <div className="reply">
            <p className="typing">
              <span className="typing__dots" aria-hidden="true"><i /><i /><i /></span>
              {busy}
            </p>
            {Array.from({ length: busyKind === "shop" ? 3 : 1 }, (_, k) => (
              <div key={k} className="skeleton" aria-hidden="true">
                <span className="skeleton__line" style={{ width: "40%" }} />
                <span className="skeleton__line" style={{ width: "85%" }} />
                <span className="skeleton__line" style={{ width: busyKind === "photo" ? "70%" : "60%" }} />
                {busyKind === "photo" && <span className="skeleton__line" style={{ width: "55%" }} />}
              </div>
            ))}
          </div>
        )}
      </div>

      <form className="concierge__composer" onSubmit={submit}>
        <button type="button" className="icon-btn" aria-label="Send a photo of your pantry" onClick={() => fileRef.current?.click()} disabled={!!busy}>
          <Icon name="camera" size={20} />
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="visually-hidden"
          onChange={(e) => {
            void onPhoto(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
        <label htmlFor="concierge-input" className="visually-hidden">Message the concierge</label>
        <input
          id="concierge-input"
          ref={inputRef}
          className="input"
          placeholder={speech.listening ? "Listening…" : "I'm out of…"}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          autoComplete="off"
          enterKeyHint="send"
        />
        {speech.supported && (
          <button
            type="button"
            className={speech.listening ? "icon-btn mic mic--on" : "icon-btn mic"}
            aria-label={speech.listening ? "Stop listening" : "Speak your message"}
            aria-pressed={speech.listening}
            onClick={() => (speech.listening ? speech.stop() : speech.start())}
            disabled={!!busy}
          >
            <Icon name="mic" size={20} />
          </button>
        )}
        <button type="submit" className="btn btn--primary concierge__send" disabled={!draft.trim() || !!busy} aria-label="Send">
          <Icon name="send" size={18} />
        </button>
      </form>
      {speech.error && <p className="concierge__voice-error" role="alert">{speech.error}</p>}
      <label className="concierge__demo">
        <input type="checkbox" checked={demo} onChange={(e) => setDemo(e.target.checked)} />
        Demo mode (sample answers, works offline)
      </label>
    </aside>
  );
}

function useUsableZip() {
  return usePersistentState<string | null>("zip", null);
}

/** Friendly model name for the credit line, e.g. "muse-spark-1.3" -> "Meta Muse Spark 1.3". */
function modelLabel(model: string) {
  const m = model.replace(/^meta\//, "");
  const muse = m.match(/^muse-([a-z]+)-?([\d.]+)?/i);
  if (muse) return `Meta Muse ${muse[1][0].toUpperCase()}${muse[1].slice(1)}${muse[2] ? " " + muse[2] : ""}`;
  return m;
}
