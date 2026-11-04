import { useEffect, useMemo, useRef, useState } from "react";
import { peopleById, type Dish } from "@/data/dishes";
import { useApp } from "@/lib/app-context";
import { matchDish, rankDishes } from "@/lib/pantry";
import { rankWithProfile } from "@/lib/profile";
import { missingForPlan, usePlan, weekRangeLabel, type PlanDay } from "@/lib/plan";
import { useShoppingList } from "@/lib/shopping";
import { Icon } from "./Icon";
import { PlateArt } from "./PlateArt";
import { Meter, Sheet, formatMinutes } from "./ui";

const plural = (n: number, one: string, many = one + "s") => `${n} ${n === 1 ? one : many}`;

function listJoin(items: string[]) {
  if (items.length <= 1) return items.join("");
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

/** Calendar glyph in the Icon.tsx style. */
export function CalendarIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3.5" y="5" width="17" height="15.5" rx="2.5" />
      <path d="M3.5 10h17M8 3v4M16 3v4" />
      <path d="M8 14h2M14 14h2M8 17h2" />
    </svg>
  );
}

function SparkIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3.5l1.9 5.1 5.1 1.9-5.1 1.9L12 17.5l-1.9-5.1L5 10.5l5.1-1.9z" />
      <path d="M18.5 16v4M16.5 18h4" />
    </svg>
  );
}

export function WeekPlanSheet({ onClose }: { onClose: () => void }) {
  const { pantry, profile, getDish, startCooking, notify } = useApp();
  const { plan, today, set, clear, clearWeek, suggest } = usePlan();
  const shopping = useShoppingList();
  const [openDay, setOpenDay] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  const missing = useMemo(() => missingForPlan(plan, pantry, getDish), [plan, pantry, getDish]);
  const plannedCount = plan.filter((d) => d.dishId && getDish(d.dishId)).length;
  const emptyUpcoming = plan.filter((d) => !d.isPast && !d.dishId).length;
  const todayDish = today.dishId ? getDish(today.dishId) : undefined;

  useEffect(() => {
    if (!confirmClear) return;
    const t = setTimeout(() => setConfirmClear(false), 3500);
    return () => clearTimeout(t);
  }, [confirmClear]);

  const onSuggest = () => {
    const n = suggest(pantry, profile);
    setOpenDay(null);
    notify(n ? `Planned ${plural(n, "dinner")}` : "Every day already has a dinner");
  };

  const onClear = () => {
    if (!confirmClear) return setConfirmClear(true);
    clearWeek();
    setConfirmClear(false);
    setOpenDay(null);
    notify("Cleared this week's plan");
  };

  const onAddAll = () => {
    let added = 0;
    for (const { dish, need } of missing.byDish) if (need.length) added += shopping.add(need, dish.name);
    notify(added ? `Added ${plural(added, "item")} to your shopping list` : "Already on your shopping list");
  };

  const summary =
    missing.dinners === 0
      ? "Pick a dinner for any day, or let us plan the rest of the week."
      : missing.items.length === 0
        ? `You have everything for ${plural(missing.dinners, "dinner")}`
        : `You need ${plural(missing.items.length, "item")} for ${plural(missing.dinners, "dinner")}`;

  return (
    <Sheet
      title="This week's dinners"
      onClose={onClose}
      footer={
        <div className="plan-foot">
          <p className="plan-foot__summary" aria-live="polite">{summary}</p>
          {missing.items.length > 0 && (
            <button type="button" className="btn btn--primary btn--block" onClick={onAddAll}>
              <Icon name="bag" size={18} />
              Add all to shopping list
            </button>
          )}
          {todayDish && (
            <button
              type="button"
              className="link plan-foot__link"
              onClick={() => {
                onClose();
                startCooking(todayDish.id);
              }}
            >
              Start tonight's dinner: {todayDish.name}
            </button>
          )}
        </div>
      }
    >
      <p className="plan-lede">
        {weekRangeLabel(plan)}. {plannedCount ? `${plural(plannedCount, "dinner")} planned.` : "Nothing planned yet."}
      </p>

      <div className="plan-actions">
        <button type="button" className="btn btn--tinted" onClick={onSuggest} disabled={emptyUpcoming === 0}>
          <SparkIcon />
          Plan my week for me
        </button>
        <button
          type="button"
          className={confirmClear ? "btn btn--secondary plan-actions__danger" : "btn btn--secondary"}
          onClick={onClear}
          onBlur={() => setConfirmClear(false)}
          disabled={plannedCount === 0}
        >
          {confirmClear ? `Clear ${plural(plannedCount, "dinner")}?` : "Clear week"}
        </button>
      </div>

      <ol className="group plan-days" aria-label="Dinners by day">
        {plan.map((day) => (
          <DayRow
            key={day.date}
            day={day}
            open={openDay === day.date}
            onToggle={() => setOpenDay((d) => (d === day.date ? null : day.date))}
            onPick={(id) => {
              set(day.date, id);
              setOpenDay(null);
            }}
            onRemove={() => {
              clear(day.date);
              setOpenDay(null);
            }}
            plan={plan}
          />
        ))}
      </ol>

      {missing.items.length > 0 && (
        <section className="plan-need" aria-labelledby="plan-need-title">
          <h3 id="plan-need-title" className="plan-need__title">
            What you need <span className="num">{missing.items.length}</span>
          </h3>
          <ul className="group">
            {missing.items.map((it) => (
              <li key={it.name} className="row plan-need__row">
                <span className="row__body">
                  <span className="row__title plan-block">{it.name.charAt(0).toUpperCase() + it.name.slice(1)}</span>
                  <span className="row__meta plan-block">For {listJoin(it.dishes)}</span>
                </span>
                {it.count > 1 && <span className="pill pill--neutral">{plural(it.count, "dinner")}</span>}
              </li>
            ))}
          </ul>
          <p className="section__note">Upcoming dinners only. Anything already in your pantry is left out.</p>
        </section>
      )}
    </Sheet>
  );
}

function DayRow({
  day,
  open,
  onToggle,
  onPick,
  onRemove,
  plan,
}: {
  day: PlanDay;
  open: boolean;
  onToggle: () => void;
  onPick: (id: string) => void;
  onRemove: () => void;
  plan: PlanDay[];
}) {
  const { pantry, getDish } = useApp();
  const dish = day.dishId ? getDish(day.dishId) : undefined;
  const match = dish ? matchDish(dish, pantry) : undefined;
  const pickerId = `plan-picker-${day.date}`;
  const dayName = day.isToday ? "Today" : day.long;

  return (
    <li className="plan-day" data-today={day.isToday || undefined} data-past={day.isPast || undefined} data-open={open || undefined}>
      <div className="plan-day__main">
        <span className="plan-day__date" aria-hidden="true">
          <span className="plan-day__dow">{day.isToday ? "Today" : day.short}</span>
          <span className="plan-day__num num">{day.dayOfMonth}</span>
        </span>

        {dish && match ? (
          <button
            type="button"
            className="plan-day__dish"
            onClick={onToggle}
            aria-expanded={open}
            aria-controls={open ? pickerId : undefined}
            aria-label={`${dayName}: ${dish.name}. ${day.isPast ? "Past day." : "Change dinner."}`}
            disabled={day.isPast}
          >
            <PlateArt dish={dish} size={40} />
            <span className="row__body">
              <span className="row__title plan-block">{dish.name}</span>
              <span className="plan-day__meta">
                <span className="plan-day__time">
                  <Icon name="clock" size={14} />
                  {formatMinutes(dish.minutes)}
                </span>
                <Meter have={match.have.length} total={dish.ingredients.length} />
              </span>
            </span>
            {!day.isPast && (
              <span className="row__trail">
                <Icon name="chevron" size={18} />
              </span>
            )}
          </button>
        ) : day.dishId && !dish ? (
          <span className="plan-day__empty">
            <span className="muted small">That dish isn't available any more.</span>
            {!day.isPast && (
              <button type="button" className="btn btn--secondary btn--sm plan-day__swap" onClick={onToggle} aria-expanded={open} aria-controls={open ? pickerId : undefined}>
                Choose another
              </button>
            )}
          </span>
        ) : day.isPast ? (
          <span className="plan-day__empty muted small">No dinner planned</span>
        ) : (
          <button type="button" className="plan-day__add" onClick={onToggle} aria-expanded={open} aria-controls={open ? pickerId : undefined} aria-label={`Add dinner for ${dayName}`}>
            <Icon name="plus" size={18} />
            Add dinner
          </button>
        )}
      </div>

      {open && <DishPicker id={pickerId} day={day} dayName={dayName} plan={plan} onPick={onPick} onRemove={day.dishId ? onRemove : undefined} onCancel={onToggle} />}
    </li>
  );
}

function DishPicker({
  id,
  day,
  dayName,
  plan,
  onPick,
  onRemove,
  onCancel,
}: {
  id: string;
  day: PlanDay;
  dayName: string;
  plan: PlanDay[];
  onPick: (id: string) => void;
  onRemove?: () => void;
  onCancel: () => void;
}) {
  const { pantry, profile } = useApp();
  const [q, setQ] = useState("");
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    input.current?.focus({ preventScroll: true });
    input.current?.closest(".plan-day")?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, []);

  const ranked = useMemo(() => rankWithProfile(rankDishes(pantry), profile), [pantry, profile]);
  const plannedOn = useMemo(() => {
    const m = new Map<string, string>();
    for (const d of plan) if (d.dishId && d.date !== day.date && !m.has(d.dishId)) m.set(d.dishId, d.isToday ? "Today" : d.short);
    return m;
  }, [plan, day.date]);

  const query = q.trim().toLowerCase();
  const results = useMemo(() => {
    const list = query
      ? ranked.filter(({ dish }) => {
          const p = peopleById[dish.peopleId];
          return [dish.name, p?.name, p?.area, dish.origin].some((s) => s?.toLowerCase().includes(query));
        })
      : ranked.filter((m) => m.dish.id !== day.dishId);
    return list.slice(0, query ? 10 : 6);
  }, [ranked, query, day.dishId]);

  return (
    <div className="plan-picker" id={id} role="region" aria-label={`Choose a dinner for ${dayName}`}>
      <label className="search">
        <Icon name="search" size={18} />
        <span className="visually-hidden">Search dishes</span>
        <input
          ref={input}
          className="input"
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape" && q) {
              e.stopPropagation();
              e.nativeEvent.stopImmediatePropagation();
              setQ("");
            }
          }}
          placeholder="Search dishes or peoples"
          autoComplete="off"
        />
      </label>

      <p className="plan-picker__hint">{query ? `${plural(results.length, "match", "matches")}` : "Best matches for your pantry"}</p>

      {results.length > 0 ? (
        <ul className="plan-picker__list">
          {results.map((m) => (
            <li key={m.dish.id}>
              <PickRow dish={m.dish} have={m.have.length} need={m.need} on={plannedOn.get(m.dish.id)} onPick={() => onPick(m.dish.id)} />
            </li>
          ))}
        </ul>
      ) : (
        <p className="plan-picker__empty small muted">No dishes match "{q.trim()}".</p>
      )}

      <div className="plan-picker__foot">
        {onRemove && (
          <button type="button" className="btn btn--secondary btn--sm plan-picker__remove" onClick={onRemove}>
            <Icon name="trash" size={16} />
            Remove dinner
          </button>
        )}
        <button type="button" className="btn btn--secondary btn--sm" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}

function PickRow({ dish, have, need, on, onPick }: { dish: Dish; have: number; need: string[]; on?: string; onPick: () => void }) {
  const people = peopleById[dish.peopleId];
  return (
    <button type="button" className="plan-pick" onClick={onPick}>
      <PlateArt dish={dish} size={40} />
      <span className="row__body">
        <span className="row__title plan-block">{dish.name}</span>
        <span className="row__meta plan-block">
          {people?.name ?? dish.origin}, {formatMinutes(dish.minutes)}
        </span>
        <span className="plan-pick__match">
          <Meter have={have} total={dish.ingredients.length} />
          {need.length === 0 ? (
            <span className="status status--have">You have everything</span>
          ) : (
            <span className="status status--need">Need {plural(need.length, "item")}</span>
          )}
        </span>
      </span>
      {on && <span className="pill pill--neutral">Also {on}</span>}
    </button>
  );
}
