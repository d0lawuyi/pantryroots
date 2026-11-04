import { useCallback, useEffect, useState } from "react";
import type { Dish } from "@/data/dishes";
import { useApp } from "@/lib/app-context";
import { Icon } from "@/components/Icon";
import { MacroTargetsSheet } from "@/components/MacroTargetsSheet";
import {
  MFP_DIARY_URL,
  fmt,
  fmtServings,
  mfpText,
  scale,
  useMacroEstimates,
  useMacroTargets,
  useTodayLog,
  type MacroEstimate,
} from "@/lib/macros";

function ExternalIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14 4h6v6" />
      <path d="M20 4l-9 9" />
      <path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
    </svg>
  );
}

function MinusIcon() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" aria-hidden="true">
      <path d="M5 12h14" />
    </svg>
  );
}

async function copyText(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Older browsers and some in-app webviews: fall back to a hidden textarea.
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      ta.remove();
      return ok;
    } catch {
      return false;
    }
  }
}

type Status = { state: "loading" } | { state: "ready"; est: MacroEstimate } | { state: "error"; message: string };

/**
 * "Estimated per serving" card for the dish sheet, with Log it and a copy-to-MyFitnessPal bridge.
 * Pass onSetTargets to open a shared targets sheet; otherwise this opens its own.
 */
export function MacrosPanel({ dish, onSetTargets }: { dish: Dish; onSetTargets?: () => void }) {
  const { notify } = useApp();
  const { get, getOrFetch } = useMacroEstimates();
  const { targets } = useMacroTargets();
  const log = useTodayLog();
  const cached = get(dish);
  const [status, setStatus] = useState<Status>(() => (cached ? { state: "ready", est: cached } : { state: "loading" }));
  const [servings, setServings] = useState(1);
  const [editing, setEditing] = useState(false);
  const [manualCopy, setManualCopy] = useState<string | null>(null);

  const load = useCallback(() => {
    let live = true;
    setStatus((s) => (s.state === "ready" ? s : { state: "loading" }));
    getOrFetch(dish)
      .then((est) => live && setStatus({ state: "ready", est }))
      .catch((e: Error) => live && setStatus({ state: "error", message: e.message }));
    return () => {
      live = false;
    };
    // Re-estimate only when the dish itself changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dish.id, dish.name, dish.ingredients.join("|")]);

  useEffect(() => load(), [load]);

  const openTargets = () => (onSetTargets ? onSetTargets() : setEditing(true));

  return (
    <section className="macros" aria-labelledby={`macros-${dish.id}`}>
      <div className="macros__head">
        <h3 id={`macros-${dish.id}`} className="section__title macros__title">
          Estimated per serving
        </h3>
        <span className="macros__badge">AI estimate</span>
      </div>

      {status.state === "loading" && (
        <div className="macros__card" aria-busy="true" aria-label="Estimating macros">
          <div className="macros__skeleton">
            <span className="skeleton__line" style={{ width: "40%", height: 22 }} />
            <span className="skeleton__line" style={{ width: "70%" }} />
            <span className="skeleton__line" style={{ width: "100%" }} />
            <span className="skeleton__line" style={{ width: "100%" }} />
            <span className="skeleton__line" style={{ width: "100%" }} />
          </div>
        </div>
      )}

      {status.state === "error" && (
        <div className="macros__card macros__error" role="status">
          <p className="macros__error-title">Couldn't estimate right now</p>
          <p className="small muted">{status.message === "Couldn't estimate right now." ? "" : status.message + " "}You can still look the dish up in MyFitnessPal's food search, or turn on Demo mode in the concierge for sample numbers.</p>
          <div className="macros__actions">
            <button type="button" className="btn btn--secondary btn--sm" onClick={() => load()}>
              Retry
            </button>
            <a className="link macros__mfp-link" href={MFP_DIARY_URL} target="_blank" rel="noopener noreferrer">
              Open MyFitnessPal diary
              <ExternalIcon />
              <span className="visually-hidden-macros"> (opens in a new tab)</span>
            </a>
          </div>
        </div>
      )}

      {status.state === "ready" && (
        <Ready
          est={status.est}
          dish={dish}
          servings={servings}
          setServings={setServings}
          targets={targets}
          consumed={log.totals.calories}
          onLog={() => {
            log.add({ dishId: dish.id, name: dish.name, macros: status.est, servings });
            notify(`Logged ${fmtServings(servings)} of ${dish.name} for today`);
          }}
          onCopy={async () => {
            const text = mfpText(dish.name, status.est, servings);
            if (await copyText(text)) {
              setManualCopy(null);
              notify("Copied. Paste it into MyFitnessPal's Quick Add or a custom food");
            } else {
              setManualCopy(text);
            }
          }}
          onSetTargets={openTargets}
        />
      )}

      {manualCopy && (
        <div className="macros__manual">
          <label className="small muted" htmlFor={`mfp-${dish.id}`}>
            Copying isn't allowed here. Select this line and copy it yourself:
          </label>
          <input id={`mfp-${dish.id}`} className="input" readOnly value={manualCopy} onFocus={(e) => e.currentTarget.select()} />
        </div>
      )}

      {editing && <MacroTargetsSheet onClose={() => setEditing(false)} />}
    </section>
  );
}

function Ready({
  est,
  dish,
  servings,
  setServings,
  targets,
  consumed,
  onLog,
  onCopy,
  onSetTargets,
}: {
  est: MacroEstimate;
  dish: Dish;
  servings: number;
  setServings: (n: number) => void;
  targets: ReturnType<typeof useMacroTargets>["targets"];
  consumed: number;
  onLog: () => void;
  onCopy: () => void;
  onSetTargets: () => void;
}) {
  const m = scale(est, servings);
  const kcalFromMacros = est.protein * 4 + est.carbs * 4 + est.fat * 9 || 1;
  const bars = [
    { key: "protein", label: "Protein", g: est.protein, kcal: est.protein * 4 },
    { key: "carbs", label: "Carbs", g: est.carbs, kcal: est.carbs * 4 },
    { key: "fat", label: "Fat", g: est.fat, kcal: est.fat * 9 },
  ] as const;

  let fit: string | null = null;
  if (targets) {
    const left = targets.calories - consumed - m.calories;
    const what = servings === 1 ? "this serving" : fmtServings(servings);
    fit = left >= 0 ? `Leaves ${fmt(left)} kcal for today with ${what}` : `About ${fmt(-left)} kcal past today's target with ${what}`;
  }

  return (
    <div className="macros__card">
      <div className="macros__kcal">
        <span className="macros__kcal-num num">{fmt(est.calories)}</span>
        <span className="macros__kcal-unit">kcal</span>
      </div>
      <p className="small muted macros__serving">{est.servingNote}</p>

      <ul className="macros__bars" aria-label={targets ? "Per serving, as a share of your daily target" : "Per serving, as a share of its calories"}>
        {bars.map((b) => {
          const share = targets ? b.g / targets[b.key] : b.kcal / kcalFromMacros;
          const pct = Math.max(0, Math.min(100, Math.round(share * 100)));
          return (
            <li key={b.key} className="macros__bar" data-macro={b.key}>
              <span className="macros__bar-label">{b.label}</span>
              <span className="macros__bar-track" aria-hidden="true">
                <span className="macros__bar-fill" style={{ width: `${pct}%` }} />
              </span>
              <span className="macros__bar-val num">
                {b.g} g<span className="macros__bar-pct"> {pct}%</span>
              </span>
            </li>
          );
        })}
      </ul>
      <p className="xs muted macros__caption">
        {targets ? "Percent of your daily target." : "Percent of this dish's calories."}{" "}
        {est.confidence === "low" ? "Rough estimate: amounts vary a lot by cook." : "Estimate for a typical home serving."}
      </p>

      {fit ? (
        <p className="macros__fit">{fit}</p>
      ) : (
        <button type="button" className="link macros__set" onClick={onSetTargets}>
          Set your daily targets
        </button>
      )}

      <div className="macros__log">
        <span className="small macros__log-label" id={`srv-${dish.id}`}>
          Servings
        </span>
        <div className="macros__stepper" role="group" aria-labelledby={`srv-${dish.id}`}>
          <button
            type="button"
            className="icon-btn"
            aria-label="Fewer servings"
            disabled={servings <= 0.5}
            onClick={() => setServings(Math.max(0.5, servings - 0.5))}
          >
            <MinusIcon />
          </button>
          <output className="macros__stepper-val num" aria-live="polite">
            {servings % 1 ? servings.toFixed(1) : servings}
          </output>
          <button
            type="button"
            className="icon-btn"
            aria-label="More servings"
            disabled={servings >= 3}
            onClick={() => setServings(Math.min(3, servings + 0.5))}
          >
            <Icon name="plus" size={18} />
          </button>
        </div>
        <span className="small muted num macros__log-kcal">{fmt(m.calories)} kcal</span>
      </div>

      <div className="btn-row macros__btns">
        <button type="button" className="btn btn--primary" onClick={onLog}>
          <Icon name="check" size={18} />
          Log it
        </button>
        <button type="button" className="btn btn--tinted" onClick={onCopy}>
          <Icon name="copy" size={18} />
          Copy for MyFitnessPal
        </button>
      </div>
      <a className="link macros__mfp-link" href={MFP_DIARY_URL} target="_blank" rel="noopener noreferrer">
        Open MyFitnessPal diary
        <ExternalIcon />
        <span className="visually-hidden-macros"> (opens in a new tab)</span>
      </a>
    </div>
  );
}
