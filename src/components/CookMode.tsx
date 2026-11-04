import { useCallback, useEffect, useRef, useState } from "react";
import type { Dish } from "@/data/dishes";
import { cleanItem, matchDish } from "@/lib/pantry";
import { useApp } from "@/lib/app-context";
import { Icon } from "./Icon";
import { DishStory } from "./DishStory";
import { ShareButton } from "./ShareButton";

/* ───────────── Timers parsed from step text ───────────── */

const WORD_NUM: Record<string, number> = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, ten: 10 };

/** Finds the first cooking duration in a step, e.g. "Simmer 10–15 minutes" → 10 min, labelled "10–15 min". */
export function findDuration(step: string): { seconds: number; label: string } | null {
  const num = String.raw`(\d+(?:\.\d+)?½?|½|an?|one|two|three|four|five|ten)`;
  const re = new RegExp(String.raw`\b${num}(?:\s*(?:–|-|to)\s*(\d+(?:\.\d+)?½?))?\s*(?:more\s+)?(hours?|hrs?|minutes?|mins?)\b`, "i");
  const m = step.match(re);
  if (!m) return null;
  const parse = (s: string) => {
    const w = WORD_NUM[s.toLowerCase()];
    if (w) return w;
    return s.endsWith("½") ? (parseFloat(s) || 0) + 0.5 : parseFloat(s);
  };
  const low = parse(m[1]);
  if (!low || low <= 0) return null;
  const isHours = /^h/i.test(m[3]);
  const unit = isHours ? "hr" : "min";
  const seconds = Math.round(low * (isHours ? 3600 : 60));
  const label = m[2] ? `${m[1]}–${m[2]} ${unit}` : `${m[1].replace(/^an?$/i, "1")} ${unit}`;
  return { seconds, label };
}

type Timer = { id: number; label: string; step: number; endsAt: number; total: number; done: boolean };

function fmt(sec: number) {
  const s = Math.max(0, Math.ceil(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  return h ? `${h}:${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}` : `${m}:${String(r).padStart(2, "0")}`;
}

function chime() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    [0, 0.35, 0.7].forEach((t) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = 880;
      g.gain.setValueAtTime(0.0001, ctx.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + t + 0.3);
      o.connect(g).connect(ctx.destination);
      o.start(ctx.currentTime + t);
      o.stop(ctx.currentTime + t + 0.32);
    });
    setTimeout(() => ctx.close(), 1500);
  } catch {
    /* no audio available */
  }
  navigator.vibrate?.([300, 150, 300]);
}

/* ───────────── Screen wake lock ───────────── */

type WakeLockSentinelLike = { release: () => Promise<void> };

function useWakeLock() {
  const [on, setOn] = useState(false);
  useEffect(() => {
    let lock: WakeLockSentinelLike | null = null;
    let cancelled = false;
    const nav = navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<WakeLockSentinelLike> } };
    const acquire = async () => {
      if (!nav.wakeLock || document.visibilityState !== "visible") return;
      try {
        lock = await nav.wakeLock.request("screen");
        if (!cancelled) setOn(true);
      } catch {
        setOn(false);
      }
    };
    void acquire();
    const onVis = () => document.visibilityState === "visible" && void acquire();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVis);
      void lock?.release().catch(() => {});
    };
  }, []);
  return on;
}

/* ───────────── Cook mode ───────────── */

export function CookMode({ dish, onClose }: { dish: Dish; onClose: () => void }) {
  const { pantry, notify } = useApp();
  // -1 = get ready (ingredients), 0..n-1 = steps, n = finished
  const [index, setIndex] = useState(dish.ingredients.length ? -1 : 0);
  const [timers, setTimers] = useState<Timer[]>([]);
  const [, setTick] = useState(0);
  const awake = useWakeLock();
  const touchX = useRef<number | null>(null);
  const n = dish.steps.length;
  const match = matchDish(dish, pantry);

  const next = useCallback(() => setIndex((i) => Math.min(n, i + 1)), [n]);
  const first = dish.ingredients.length ? -1 : 0;
  const prev = useCallback(() => setIndex((i) => Math.max(first, i - 1)), [first]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight" || (e.key === " " && !(e.target instanceof HTMLElement && e.target.closest("button, a, input, textarea")))) {
        e.preventDefault();
        next();
      } else if (e.key === "ArrowLeft") prev();
    };
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [next, prev, onClose]);

  // Tick running timers and fire when they finish.
  useEffect(() => {
    if (!timers.some((t) => !t.done)) return;
    const id = setInterval(() => {
      const now = Date.now();
      setTimers((ts) => {
        let changed = false;
        const out = ts.map((t) => {
          if (!t.done && now >= t.endsAt) {
            changed = true;
            chime();
            notify(`Timer done: step ${t.step + 1}`);
            return { ...t, done: true };
          }
          return t;
        });
        return changed ? out : ts;
      });
      setTick((x) => x + 1);
    }, 500);
    return () => clearInterval(id);
  }, [timers, notify]);

  function startTimer(step: number, seconds: number, label: string) {
    setTimers((ts) => [...ts.filter((t) => t.step !== step), { id: Date.now(), label, step, total: seconds, endsAt: Date.now() + seconds * 1000, done: false }]);
  }

  const stepText = index >= 0 && index < n ? dish.steps[index] : null;
  const duration = stepText ? findDuration(stepText) : null;
  const stepTimer = timers.find((t) => t.step === index);

  return (
    <div
      className="cook"
      role="dialog"
      aria-modal="true"
      aria-label={`Cooking ${dish.name}`}
      onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
      onTouchEnd={(e) => {
        if (touchX.current === null) return;
        const dx = e.changedTouches[0].clientX - touchX.current;
        if (dx < -60) next();
        if (dx > 60) prev();
        touchX.current = null;
      }}
    >
      <header className="cook__head">
        <button type="button" className="icon-btn" onClick={onClose} aria-label="Exit cook mode">
          <Icon name="close" size={22} />
        </button>
        <div className="cook__title">
          <p className="row__title">{dish.name}</p>
          <p className="xs muted">
            {index < 0 ? "Get ready" : index >= n ? "Done" : `Step ${index + 1} of ${n}`}
            {awake ? ", screen stays on" : ""}
          </p>
        </div>
        <span style={{ width: 36 }} />
      </header>

      <div className="cook__progress" aria-hidden="true">
        {Array.from({ length: n }, (_, i) => (
          <span key={i} className={i <= index ? "cook__seg cook__seg--on" : "cook__seg"} />
        ))}
      </div>

      {timers.length > 0 && (
        <div className="cook__timers" aria-live="polite">
          {timers.map((t) => (
            <button
              key={t.id}
              type="button"
              className={t.done ? "timer timer--done" : "timer"}
              onClick={() => (t.done ? setTimers((ts) => ts.filter((x) => x.id !== t.id)) : setIndex(t.step))}
              aria-label={t.done ? `Step ${t.step + 1} timer finished. Dismiss` : `Step ${t.step + 1} timer, ${fmt((t.endsAt - Date.now()) / 1000)} left`}
            >
              <Icon name="clock" size={16} />
              <span className="num">{t.done ? "Done" : fmt((t.endsAt - Date.now()) / 1000)}</span>
              <span className="timer__step">Step {t.step + 1}</span>
              {t.done && <Icon name="close" size={14} />}
            </button>
          ))}
        </div>
      )}

      <main className="cook__body">
        {index < 0 && (
          <div className="cook__ready">
            <h2 className="cook__step">Get everything out first.</h2>
            <ul className="cook__ings">
              {dish.ingredients.map((ing) => {
                const has = match.have.includes(ing);
                return (
                  <li key={ing}>
                    <span className={has ? "cook__dot cook__dot--have" : "cook__dot"} aria-hidden="true" />
                    {cleanItem(ing)}
                    {!has && <span className="status status--need">not in pantry</span>}
                  </li>
                );
              })}
            </ul>
            <p className="small muted" style={{ marginTop: 16 }}>{dish.technique}</p>
          </div>
        )}

        {stepText && (
          <div className="cook__current" key={index}>
            <p className="cook__step">{stepText}</p>
            {duration && (
              <div style={{ marginTop: 28 }}>
                {stepTimer && !stepTimer.done ? (
                  <div className="cook__bigtimer">
                    <span className="num">{fmt((stepTimer.endsAt - Date.now()) / 1000)}</span>
                    <button type="button" className="btn btn--secondary btn--sm" onClick={() => setTimers((ts) => ts.filter((t) => t.id !== stepTimer.id))}>
                      Cancel timer
                    </button>
                  </div>
                ) : (
                  <button type="button" className="btn btn--tinted" onClick={() => startTimer(index, duration.seconds, duration.label)}>
                    <Icon name="clock" size={18} />
                    Start {duration.label} timer
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {index >= n && (
          <div className="cook__current">
            <p className="cook__step">Enjoy your {dish.name}.</p>
            <p className="muted" style={{ marginTop: 12 }}>Tap Finish to go back to your kitchen.</p>
            <div style={{ marginTop: 24 }}>
              <ShareButton kind="dish" dish={dish} cooked label="Share what you cooked" />
            </div>
            <DishStory dishId={dish.id} name={dish.name} />
          </div>
        )}
      </main>

      <footer className="cook__foot">
        <button type="button" className="btn btn--secondary cook__nav" onClick={prev} disabled={index < (dish.ingredients.length ? 0 : 1)}>
          <Icon name="back" size={20} />
          Back
        </button>
        {index >= n ? (
          <button type="button" className="btn btn--primary cook__nav" onClick={onClose}>
            Finish
          </button>
        ) : (
          <button type="button" className="btn btn--primary cook__nav" onClick={next}>
            {index < 0 ? "Start" : index === n - 1 ? "Done cooking" : "Next step"}
            <Icon name="chevron" size={20} />
          </button>
        )}
      </footer>
    </div>
  );
}
