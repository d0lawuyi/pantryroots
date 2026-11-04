import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useApp } from "@/lib/app-context";
import { Sheet } from "@/components/ui";
import {
  MACRO_KEYS,
  MACRO_LABEL,
  MACRO_UNIT,
  PRESET_NOTE,
  TARGET_BOUNDS,
  TARGET_PRESETS,
  fmt,
  useMacroTargets,
  validTargets,
  type MacroKey,
  type MacroTargets,
} from "@/lib/macros";

type Draft = Record<MacroKey, string>;
const toDraft = (t: MacroTargets | null): Draft =>
  t ? { calories: String(t.calories), protein: String(t.protein), carbs: String(t.carbs), fat: String(t.fat) } : { calories: "", protein: "", carbs: "", fat: "" };

function parse(d: Draft): Partial<Record<MacroKey, number>> {
  const out: Partial<Record<MacroKey, number>> = {};
  for (const k of MACRO_KEYS) {
    const n = Number(d[k].replace(/[,\s]/g, ""));
    if (d[k].trim() && Number.isFinite(n)) out[k] = Math.round(n);
  }
  return out;
}

/**
 * Daily calorie and macro targets. Rendered in a portal so it can open on top of the
 * dish sheet; Escape closes only this sheet, not the one underneath.
 */
export function MacroTargetsSheet({ onClose: onCloseProp }: { onClose: () => void }) {
  // Sheet re-focuses itself whenever onClose changes identity; keep it stable so typing isn't interrupted.
  const closeRef = useRef(onCloseProp);
  closeRef.current = onCloseProp;
  const onClose = useCallback(() => closeRef.current(), []);
  const { notify } = useApp();
  const { targets, save, clear } = useMacroTargets();
  const [draft, setDraft] = useState<Draft>(() => toDraft(targets));
  const [touched, setTouched] = useState(false);
  const formId = useId();

  // The sheet below also listens for Escape on document; catch it first and stop it there.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      onClose();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  const parsed = parse(draft);
  const ok = validTargets(parsed);
  const activePreset = TARGET_PRESETS.find((p) => MACRO_KEYS.every((k) => parsed[k] === p.targets[k]))?.id;
  const fieldError = (k: MacroKey) => {
    const v = parsed[k];
    const [lo, hi] = TARGET_BOUNDS[k];
    if (v === undefined) return draft[k].trim() ? "Enter a number" : touched ? "Required" : "";
    if (v < lo || v > hi) return `Between ${fmt(lo)} and ${fmt(hi)}`;
    return "";
  };
  const kcalFromMacros = ok ? parsed.protein * 4 + parsed.carbs * 4 + parsed.fat * 9 : 0;

  const onSave = () => {
    setTouched(true);
    if (!validTargets(parsed)) return;
    save(parsed);
    notify("Daily targets saved");
    onClose();
  };

  const onClear = () => {
    clear();
    notify("Daily targets cleared");
    onClose();
  };

  return createPortal(
    <Sheet
      title="Daily targets"
      onClose={onClose}
      footer={
        <div className="btn-row">
          {targets && (
            <button type="button" className="btn btn--secondary" onClick={onClear}>
              Clear targets
            </button>
          )}
          <button type="submit" form={formId} className="btn btn--primary">
            Save targets
          </button>
        </div>
      }
    >
      <p className="muted macro-sheet__lede">
        Set what you aim for in a day. We use it to show how a dish fits. It stays on this device and you can change it any time.
      </p>

      <div className="callout macro-sheet__where">
        <p className="callout__title">Where to find these</p>
        <p className="small">MyFitnessPal, then More, then Goals. Copy the calorie, protein, carbs and fat numbers here. We can't connect to your account because MyFitnessPal doesn't offer a public API.</p>
      </div>

      <h3 className="macro-sheet__h">Start from a preset</h3>
      <div className="macro-presets" role="group" aria-label="Presets">
        {TARGET_PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            className="macro-preset"
            aria-pressed={activePreset === p.id}
            onClick={() => setDraft(toDraft(p.targets))}
          >
            <span className="macro-preset__title">{p.label}</span>
            <span className="macro-preset__note">{p.note}</span>
          </button>
        ))}
      </div>
      <p className="small muted macro-sheet__note">{PRESET_NOTE}</p>

      <h3 className="macro-sheet__h">Your numbers</h3>
      <form
        id={formId}
        className="macro-fields"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          onSave();
        }}
      >
        {MACRO_KEYS.map((k) => {
          const err = fieldError(k);
          const id = `${formId}-${k}`;
          return (
            <div key={k} className="macro-field" data-macro={k}>
              <label className="label" htmlFor={id}>
                {MACRO_LABEL[k]}
              </label>
              <div className="macro-field__wrap">
                <input
                  id={id}
                  className="input num"
                  inputMode="numeric"
                  autoComplete="off"
                  value={draft[k]}
                  placeholder={k === "calories" ? "2000" : k === "protein" ? "100" : k === "carbs" ? "250" : "67"}
                  aria-invalid={!!err}
                  aria-describedby={err ? `${id}-err` : undefined}
                  onChange={(e) => setDraft({ ...draft, [k]: e.target.value.replace(/[^\d,]/g, "").slice(0, 6) })}
                />
                <span className="macro-field__unit" aria-hidden="true">{MACRO_UNIT[k]}</span>
              </div>
              {err && (
                <p id={`${id}-err`} className="macro-field__err">
                  {err}
                </p>
              )}
            </div>
          );
        })}
      </form>
      {ok && Math.abs(kcalFromMacros - parsed.calories) > parsed.calories * 0.15 && (
        <p className="small muted macro-sheet__note">
          Your macros add up to about {fmt(kcalFromMacros)} kcal. That's fine to save; it's just worth a second look.
        </p>
      )}
    </Sheet>,
    document.body,
  );
}
