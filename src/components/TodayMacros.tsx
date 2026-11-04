import { useState } from "react";
import { useApp } from "@/lib/app-context";
import { Icon } from "@/components/Icon";
import { MacroTargetsSheet } from "@/components/MacroTargetsSheet";
import { MACRO_KEYS, MACRO_LABEL, MACRO_UNIT, MFP_DIARY_URL, fmt, fmtServings, useMacroTargets, useTodayLog, type MacroKey } from "@/lib/macros";

const R = 22;
const C = 2 * Math.PI * R;

function Ring({ k, value, target }: { k: MacroKey; value: number; target: number }) {
  const share = target > 0 ? value / target : 0;
  const shown = Math.min(1, share);
  const unit = MACRO_UNIT[k];
  return (
    <li className="today-ring" data-macro={k}>
      <svg viewBox="0 0 56 56" width="56" height="56" role="img" aria-label={`${MACRO_LABEL[k]}: ${fmt(value)} of ${fmt(target)} ${unit === "g" ? "grams" : unit}`}>
        <circle className="today-ring__track" cx="28" cy="28" r={R} />
        <circle
          className="today-ring__fill"
          cx="28"
          cy="28"
          r={R}
          strokeDasharray={C}
          strokeDashoffset={C * (1 - shown)}
          transform="rotate(-90 28 28)"
          opacity={value > 0 ? 1 : 0}
        />
        <text x="28" y="28" className="today-ring__pct" textAnchor="middle" dominantBaseline="central">
          {Math.round(share * 100)}%
        </text>
      </svg>
      <span className="today-ring__label">{MACRO_LABEL[k]}</span>
      <span className="today-ring__val num">
        {fmt(value)}
        {unit === "g" ? " g" : ""}
        <span className="today-ring__of">of {fmt(target)}{unit === "g" ? " g" : ""}</span>
      </span>
    </li>
  );
}

/**
 * Compact "Today" card for the Cook screen: consumed vs target rings and the meals logged today.
 * Pass onSetTargets to open a shared targets sheet; otherwise this opens its own.
 */
export function TodayMacros({ onSetTargets }: { onSetTargets?: () => void }) {
  const { notify } = useApp();
  const { targets } = useMacroTargets();
  const { entries, remove, totals } = useTodayLog();
  const [editing, setEditing] = useState(false);
  const openTargets = () => (onSetTargets ? onSetTargets() : setEditing(true));

  const sheet = editing && <MacroTargetsSheet onClose={() => setEditing(false)} />;

  if (!targets && entries.length === 0) {
    return (
      <section className="today today--empty" aria-labelledby="today-macros-title">
        <div className="today__intro">
          <h2 id="today-macros-title" className="today__title">Today's macros</h2>
          <p className="small muted">
            Optional. Add your daily calories, protein, carbs and fat, then log dishes as you cook them. Numbers are estimates and stay on this device.
          </p>
        </div>
        <button type="button" className="btn btn--tinted btn--sm today__cta" onClick={openTargets}>
          Set daily targets
        </button>
        {sheet}
      </section>
    );
  }

  const left = targets ? targets.calories - totals.calories : null;

  return (
    <section className="today" aria-labelledby="today-macros-title">
      <div className="today__head">
        <h2 id="today-macros-title" className="today__title">Today's macros</h2>
        <button type="button" className="link" onClick={openTargets}>
          {targets ? "Edit targets" : "Set targets"}
        </button>
      </div>

      {targets ? (
        <>
          <ul className="today__rings">
            {MACRO_KEYS.map((k) => (
              <Ring key={k} k={k} value={totals[k]} target={targets[k]} />
            ))}
          </ul>
          {left !== null && (
            <p className="small today__left">
              {left >= 0 ? `${fmt(left)} kcal left for today` : `${fmt(-left)} kcal past today's target`}
            </p>
          )}
        </>
      ) : (
        <p className="small today__left">
          {fmt(totals.calories)} kcal so far. P {totals.protein} g, C {totals.carbs} g, F {totals.fat} g.
        </p>
      )}

      {entries.length > 0 ? (
        <ul className="today__list">
          {entries.map((e) => (
            <li key={e.id} className="today__item">
              <span className="today__item-body">
                <span className="today__item-name">{e.name}</span>
                <span className="xs muted">{fmtServings(e.servings)}</span>
              </span>
              <span className="small num today__item-kcal">{fmt(e.macros.calories * e.servings)} kcal</span>
              <button
                type="button"
                className="icon-btn"
                aria-label={`Remove ${e.name} from today`}
                onClick={() => {
                  remove(e.id);
                  notify(`Removed ${e.name} from today`);
                }}
              >
                <Icon name="trash" size={18} />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="small muted today__none">Nothing logged yet today. Open a dish and choose Log it.</p>
      )}

      <p className="xs muted today__foot">
        AI estimates, not measurements. Use Copy for MyFitnessPal on a dish to add it to your{" "}
        <a className="link today__mfp" href={MFP_DIARY_URL} target="_blank" rel="noopener noreferrer">
          MyFitnessPal diary<span className="visually-hidden-macros"> (opens in a new tab)</span>
        </a>
        .
      </p>
      {sheet}
    </section>
  );
}
