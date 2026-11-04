import { useEffect, useId, useMemo, useRef, useState, type FormEvent, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from "react";
import { peopleById, type People } from "@/data/dishes";
import { Icon } from "@/components/Icon";
import { Plate, formatMinutes } from "@/components/ui";
import {
  DEFAULT_PROFILE,
  OTHER_TRADITIONS,
  dishesFromRoots,
  isPeopleId,
  peoplesByRegion,
  rootLabel,
  type Profile,
  type Spice,
  type TimePref,
} from "@/lib/profile";

type Step = 0 | 1 | 2 | 3;
const QUESTION_STEPS = 3;

/** Small chili glyph in the Icon.tsx style (24 grid, 1.75 stroke). */
function Chili({ filled }: { filled?: boolean }) {
  return (
    <svg
      width={20}
      height={20}
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M14.5 7.5c3 0 5 2.2 4.6 5.4C18.4 18 12 21 5 20.5c4.5-1.6 7.2-4.5 7.4-8.7.1-2.6.6-4.3 2.1-4.3z" />
      <path d="M14.5 7.5c0-1.8.8-3 2.5-3.5" fill="none" />
    </svg>
  );
}

const SPICE_OPTIONS: { value: Spice; title: string; text: string; heat: number }[] = [
  { value: "mild", title: "Mild", text: "Flavour first. Go easy on the scotch bonnet.", heat: 1 },
  { value: "medium", title: "Medium", text: "A warm kick you can still taste past.", heat: 2 },
  { value: "hot", title: "Hot", text: "Bring the pepper. Suya-with-extra-yaji hot.", heat: 3 },
];

const TIME_OPTIONS: { value: TimePref; title: string; text: string }[] = [
  { value: "quick", title: "Quick weeknights", text: "Show me dishes that are on the table in 45 minutes or less first." },
  { value: "any", title: "I have time", text: "Slow stews and overnight ferments are fine. Show me everything." },
];

export function Onboarding({
  onDone,
  onSkip,
  initial,
}: {
  onDone: (p: Profile) => void;
  onSkip: () => void;
  /** Pre-fill when re-running onboarding from settings. */
  initial?: Partial<Profile>;
}) {
  const [step, setStep] = useState<Step>(0);
  const [dir, setDir] = useState<"fwd" | "back">("fwd");
  const [roots, setRoots] = useState<string[]>(initial?.roots ?? []);
  const [spice, setSpice] = useState<Spice | null>(initial?.spice ?? null);
  const [time, setTime] = useState<TimePref | null>(initial?.time ?? null);
  const [custom, setCustom] = useState<string[]>(() =>
    (initial?.roots ?? []).filter((r) => !isPeopleId(r) && !OTHER_TRADITIONS.includes(r)),
  );
  const [draft, setDraft] = useState("");

  const rootRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const firstRender = useRef(true);
  const titleId = useId();
  const draftId = useId();

  // Lock page scroll, trap focus, restore focus on close.
  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    headingRef.current?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Tab" || !rootRef.current) return;
      const focusable = Array.from(
        rootRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'),
      ).filter((el) => el.offsetParent !== null || el.getClientRects().length > 0);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && (document.activeElement === first || document.activeElement === headingRef.current)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      previouslyFocused?.focus?.();
    };
  }, []);

  // Move focus to the new question so screen readers announce it.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    headingRef.current?.focus();
    rootRef.current?.querySelector(".ob__body")?.scrollTo({ top: 0 });
  }, [step]);

  const toggle = (id: string) => setRoots((r) => (r.includes(id) ? r.filter((x) => x !== id) : [...r, id]));

  const addCustom = (e: FormEvent) => {
    e.preventDefault();
    const name = draft.trim().replace(/\s+/g, " ");
    if (!name) return;
    const known = [...OTHER_TRADITIONS, ...custom].find((t) => t.toLowerCase() === name.toLowerCase());
    const label = known ?? name.charAt(0).toUpperCase() + name.slice(1);
    if (!known) setCustom((c) => [...c, label]);
    setRoots((r) => (r.includes(label) ? r : [...r, label]));
    setDraft("");
  };

  const goTo = (next: Step) => {
    setDir(next > step ? "fwd" : "back");
    setStep(next);
  };

  const profile: Profile = { roots, spice: spice ?? DEFAULT_PROFILE.spice, time: time ?? DEFAULT_PROFILE.time, done: true };
  const rootDishes = useMemo(() => dishesFromRoots(profile), [roots]); // eslint-disable-line react-hooks/exhaustive-deps

  const canContinue = step === 0 ? roots.length > 0 : step === 1 ? spice !== null : step === 2 ? time !== null : true;
  const groups = peoplesByRegion();

  const onEscape = (e: ReactKeyboardEvent) => {
    if (e.key === "Escape" && step > 0) {
      e.stopPropagation();
      goTo((step - 1) as Step);
    }
  };

  let title: ReactNode;
  let lede: ReactNode;
  let body: ReactNode;

  if (step === 0) {
    title = "Whose cooking did you grow up with?";
    lede = "Pick as many as you like. We'll put their dishes first when you have the ingredients.";
    body = (
      <div className="ob__groups">
        {(Object.keys(groups) as (keyof typeof groups)[]).map((region) => (
          <ChipGroup key={region} label={region}>
            {groups[region].map((p) => (
              <PeopleChip key={p.id} people={p} pressed={roots.includes(p.id)} onClick={() => toggle(p.id)} />
            ))}
          </ChipGroup>
        ))}
        <ChipGroup label="Other traditions">
          {[...OTHER_TRADITIONS, ...custom].map((t) => (
            <button key={t} type="button" className="ob-chip ob-chip--plain" aria-pressed={roots.includes(t)} onClick={() => toggle(t)}>
              <span className="ob-chip__name">{t}</span>
              <Tick />
            </button>
          ))}
        </ChipGroup>
        <form className="ob__add" onSubmit={addCustom}>
          <label htmlFor={draftId} className="ob__add-label">Not listed? Add your own</label>
          <div className="input-row">
            <input
              id={draftId}
              className="input"
              placeholder="For example, Ghanaian-British"
              value={draft}
              maxLength={40}
              autoComplete="off"
              onChange={(e) => setDraft(e.target.value)}
            />
            <button type="submit" className="btn btn--secondary" disabled={!draft.trim()}>Add</button>
          </div>
        </form>
      </div>
    );
  } else if (step === 1) {
    title = "How much heat do you like?";
    lede = "We'll lean towards dishes that suit you. You can always add or hold back the pepper.";
    body = (
      <CardChoice
        name="ob-spice"
        label="Spice level"
        value={spice}
        onChange={setSpice}
        options={SPICE_OPTIONS.map((o) => ({
          value: o.value,
          title: o.title,
          text: o.text,
          lead: (
            <span className="ob-heat" aria-hidden="true">
              {[1, 2, 3].map((n) => <Chili key={n} filled={n <= o.heat} />)}
            </span>
          ),
        }))}
      />
    );
  } else if (step === 2) {
    title = "How much time do you usually have?";
    lede = "This only changes the order. Long dishes never disappear.";
    body = (
      <CardChoice
        name="ob-time"
        label="Cooking time"
        value={time}
        onChange={setTime}
        options={TIME_OPTIONS.map((o) => ({
          value: o.value,
          title: o.title,
          text: o.text,
          lead: (
            <span className="ob-card__icon" aria-hidden="true">
              <Icon name="clock" size={22} />
            </span>
          ),
        }))}
      />
    );
  } else {
    const n = rootDishes.length;
    const onlyOthers = n === 0;
    title = onlyOthers ? "You're all set" : `${n} ${n === 1 ? "dish comes" : "dishes come"} from the cooking you grew up with`;
    lede = onlyOthers
      ? `We don't have curated ${listNames(roots)} recipes yet, so the concierge will lean on your roots when it suggests and writes dishes.`
      : "When two dishes need the same shopping, yours come first. Here's a taste.";
    body = (
      <div className="stack stack--lg">
        {!onlyOthers && (
          <ul className="group" aria-label="Dishes from your roots">
            {rootDishes.slice(0, 4).map((d) => (
              <li key={d.id} className="row">
                <Plate tone={d.tone} />
                <span className="row__body">
                  <span className="row__title">{d.name}</span>
                  <span className="row__meta" style={{ display: "block" }}>
                    {peopleById[d.peopleId]?.name}, {formatMinutes(d.minutes)}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
        <dl className="ob-recap">
          <div>
            <dt>Roots</dt>
            <dd>{roots.length ? listNames(roots) : "None picked"}</dd>
          </div>
          <div>
            <dt>Heat</dt>
            <dd>{SPICE_OPTIONS.find((o) => o.value === profile.spice)?.title}</dd>
          </div>
          <div>
            <dt>Time</dt>
            <dd>{TIME_OPTIONS.find((o) => o.value === profile.time)?.title}</dd>
          </div>
        </dl>
      </div>
    );
  }

  return (
    <div ref={rootRef} className="ob" role="dialog" aria-modal="true" aria-labelledby={titleId} onKeyDown={onEscape}>
      <div className="ob__bar">
        <div className="ob__bar-side">
          {step > 0 && (
            <button type="button" className="ob__back" onClick={() => goTo((step - 1) as Step)}>
              <Icon name="back" size={20} />
              Back
            </button>
          )}
        </div>
        <ol className="ob__dots" aria-label={step < QUESTION_STEPS ? `Question ${step + 1} of ${QUESTION_STEPS}` : "All questions answered"}>
          {Array.from({ length: QUESTION_STEPS }, (_, i) => (
            <li key={i} className="ob__dot" data-state={i < step ? "done" : i === step ? "current" : "todo"} />
          ))}
        </ol>
        <div className="ob__bar-side ob__bar-side--end">
          {step < QUESTION_STEPS && (
            <button type="button" className="ob__skip" onClick={onSkip}>
              Skip
            </button>
          )}
        </div>
      </div>

      <div className="ob__body">
        <div key={step} className="ob__step" data-dir={dir}>
          {step < QUESTION_STEPS && <p className="ob__count">Question {step + 1} of {QUESTION_STEPS}</p>}
          <h1 id={titleId} ref={headingRef} className="ob__title" tabIndex={-1}>
            {title}
          </h1>
          <p className="ob__lede">{lede}</p>
          {body}
        </div>
      </div>

      <div className="ob__foot">
        {step < QUESTION_STEPS ? (
          <>
            {step === 0 && (
              <p className="ob__hint" aria-live="polite">
                {roots.length === 0 ? "Pick at least one to continue" : `${roots.length} picked`}
              </p>
            )}
            <button type="button" className="btn btn--primary btn--block ob__cta" disabled={!canContinue} onClick={() => goTo((step + 1) as Step)}>
              Continue
            </button>
          </>
        ) : (
          <button type="button" className="btn btn--primary btn--block ob__cta" onClick={() => onDone(profile)}>
            Start cooking
          </button>
        )}
      </div>
    </div>
  );
}

function listNames(roots: string[]) {
  const names = roots.map(rootLabel);
  if (names.length <= 2) return names.join(" and ");
  return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

function Tick() {
  return (
    <span className="ob-chip__tick" aria-hidden="true">
      <Icon name="check" size={14} strokeWidth={2.5} />
    </span>
  );
}

function ChipGroup({ label, children }: { label: string; children: ReactNode }) {
  const id = useId();
  return (
    <section className="ob__group" aria-labelledby={id}>
      <h2 id={id} className="ob__group-title">{label}</h2>
      <div className="ob__chips" role="group" aria-labelledby={id}>
        {children}
      </div>
    </section>
  );
}

function PeopleChip({ people, pressed, onClick }: { people: People; pressed: boolean; onClick: () => void }) {
  return (
    <button type="button" className="ob-chip" aria-pressed={pressed} onClick={onClick}>
      <span className="ob-chip__text">
        <span className="ob-chip__name">{people.name}</span>
        <span className="ob-chip__area">{people.area}</span>
      </span>
      <Tick />
    </button>
  );
}

function CardChoice<T extends string>({
  name,
  label,
  value,
  onChange,
  options,
}: {
  name: string;
  label: string;
  value: T | null;
  onChange: (v: T) => void;
  options: { value: T; title: string; text: string; lead: ReactNode }[];
}) {
  return (
    <fieldset className="ob-cards">
      <legend className="visually-hidden">{label}</legend>
      {options.map((o) => (
        <label key={o.value} className="ob-card">
          <input
            type="radio"
            className="ob-card__input"
            name={name}
            value={o.value}
            checked={value === o.value}
            onChange={() => onChange(o.value)}
          />
          {o.lead}
          <span className="ob-card__body">
            <span className="ob-card__title">{o.title}</span>
            <span className="ob-card__text">{o.text}</span>
          </span>
          <span className="ob-card__radio" aria-hidden="true" />
        </label>
      ))}
    </fieldset>
  );
}
