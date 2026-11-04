import { useCallback, useEffect, useMemo, useRef } from "react";
import type { Dish } from "@/data/dishes";
import { matchDish, rankDishes, type Match } from "@/lib/pantry";
import { rankWithProfile, type Profile } from "@/lib/profile";
import { usePersistentState } from "@/lib/storage";

/**
 * Week plan: one dinner (or none) per day, Monday to Sunday of the current week.
 * Stored as { "2026-11-02": "jollof", ... } keyed by local ISO date, so a plan made last
 * week simply stops showing (and is pruned on the next change) instead of shifting days.
 */
export type PlanStore = Record<string, string>;

export type PlanDay = {
  /** Local date, YYYY-MM-DD. */
  date: string;
  /** 0 = Monday … 6 = Sunday. */
  index: number;
  dishId: string | null;
  isToday: boolean;
  isPast: boolean;
  /** "Mon" */
  short: string;
  /** "Monday" */
  long: string;
  /** Day of the month, "3". */
  dayOfMonth: string;
};

const SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const LONG = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

const pad = (n: number) => String(n).padStart(2, "0");

/** Local-time ISO date. toISOString() would use UTC and flip the day in the evening. */
export function isoDate(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function mondayOf(d: Date) {
  const m = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  m.setDate(m.getDate() - ((m.getDay() + 6) % 7));
  return m;
}

/** The 7 days of the week containing `now`, with the stored dinners filled in. */
export function weekDays(store: PlanStore, now = new Date()): PlanDay[] {
  const monday = mondayOf(now);
  const today = isoDate(now);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const date = isoDate(d);
    return {
      date,
      index: i,
      dishId: typeof store[date] === "string" ? store[date] : null,
      isToday: date === today,
      isPast: date < today,
      short: SHORT[i],
      long: LONG[i],
      dayOfMonth: String(d.getDate()),
    };
  });
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "3 to 9 Nov" or "29 Dec to 4 Jan". */
export function weekRangeLabel(days: PlanDay[]) {
  const [y1, m1, d1] = days[0].date.split("-").map(Number);
  const [, m2, d2] = days[6].date.split("-").map(Number);
  void y1;
  return m1 === m2 ? `${d1} to ${d2} ${MONTHS[m2 - 1]}` : `${d1} ${MONTHS[m1 - 1]} to ${d2} ${MONTHS[m2 - 1]}`;
}

/* ───────────────── What you need ───────────────── */

export type PlanNeed = {
  /** As written in the first dish that needs it. */
  name: string;
  /** How many planned dinners need it. */
  count: number;
  dishes: string[];
};

export type PlanMissing = {
  items: PlanNeed[];
  /** Upcoming (today onward) dinners that resolved to a dish. */
  dinners: number;
  /** Per-dish missing lists, for adding to the shopping list with the right dish names. */
  byDish: { dish: Dish; need: string[] }[];
};

/**
 * Merge missing ingredients across planned dinners from today onward. Past days are ignored
 * (you've cooked them or you haven't). A dish planned twice counts twice.
 */
export function missingForPlan(plan: PlanDay[], pantry: string[], getDish: (id: string) => Dish | undefined): PlanMissing {
  const map = new Map<string, PlanNeed>();
  const byDish: PlanMissing["byDish"] = [];
  let dinners = 0;
  for (const day of plan) {
    if (day.isPast || !day.dishId) continue;
    const dish = getDish(day.dishId);
    if (!dish) continue;
    dinners++;
    const { need } = matchDish(dish, pantry);
    byDish.push({ dish, need });
    for (const ing of need) {
      const k = ing.trim().toLowerCase();
      const cur = map.get(k);
      if (cur) {
        cur.count++;
        if (!cur.dishes.includes(dish.name)) cur.dishes.push(dish.name);
      } else {
        map.set(k, { name: ing, count: 1, dishes: [dish.name] });
      }
    }
  }
  const items = [...map.values()].sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  return { items, dinners, byDish };
}

/* ───────────────── Plan my week ───────────────── */

const WEEKNIGHT_MAX = 60;

/**
 * Fill empty days from today onward. Returns only the new assignments.
 *
 * Score (lower wins), per day:
 *  - tier: 0 if you can cook it now, 1 if one ingredient away, 2 if two, 3 otherwise (×100)
 *  - position in rankWithProfile order (0–n), so roots/spice/time preferences break ties
 *  - Mon–Thu: +60 if longer than 60 min, +30 if it needs time ahead (ferment/marinade)
 *  - Fri–Sun: +15 if it's a quick dish, so the longer cooks land on the weekend
 *  - +80 if its name shares a word with the day before ("Party Jollof" then "Ghana Jollof")
 *  - +1000 if it's from the same people as the day before (fallback only), +20 per earlier use
 *    of that people this week
 * A dish is never used twice in one week unless every dish is already used.
 */
export function suggestWeek(plan: PlanDay[], pantry: string[], profile: Profile): PlanStore {
  const ranked: Match[] = rankWithProfile(rankDishes(pantry), profile);
  const used = new Set(plan.map((d) => d.dishId).filter((x): x is string => !!x));
  const peopleOf = new Map(ranked.map((m) => [m.dish.id, m.dish.peopleId]));
  const peopleCount = new Map<string, number>();
  for (const d of plan) {
    const p = d.dishId ? peopleOf.get(d.dishId) : undefined;
    if (p) peopleCount.set(p, (peopleCount.get(p) ?? 0) + 1);
  }

  const out: PlanStore = {};
  let prevPeople: string | undefined;
  let prevWords = new Set<string>();
  const dishOf = new Map(ranked.map((m) => [m.dish.id, m.dish]));
  const nameWords = (id?: string) => new Set((dishOf.get(id ?? "")?.name ?? "").toLowerCase().split(/[^a-z]+/).filter((w) => w.length >= 4));

  for (const day of plan) {
    const current = day.dishId ?? out[day.date];
    if (current || day.isPast) {
      prevPeople = current ? peopleOf.get(current) : undefined;
      prevWords = nameWords(current ?? undefined);
      continue;
    }

    const weeknight = day.index <= 3;
    const pool = ranked.filter((m) => !used.has(m.dish.id));
    const candidates = pool.length ? pool : ranked;
    let best: Match | undefined;
    let bestScore = Infinity;

    candidates.forEach((m) => {
      const d = m.dish;
      const tier = Math.min(m.need.length, 3);
      let score = tier * 100 + ranked.indexOf(m);
      if (weeknight) {
        if (d.minutes > WEEKNIGHT_MAX) score += 60;
        if (d.ahead) score += 30;
      } else if (d.minutes <= 45) {
        score += 15;
      }
      if (prevPeople && d.peopleId === prevPeople) score += 1000;
      // Two jollofs in a row reads as a repeat even across peoples.
      if (d.name.toLowerCase().split(/[^a-z]+/).some((w) => prevWords.has(w))) score += 80;
      score += (peopleCount.get(d.peopleId) ?? 0) * 20;
      if (score < bestScore) {
        bestScore = score;
        best = m;
      }
    });

    if (!best) continue;
    out[day.date] = best.dish.id;
    used.add(best.dish.id);
    peopleCount.set(best.dish.peopleId, (peopleCount.get(best.dish.peopleId) ?? 0) + 1);
    prevPeople = best.dish.peopleId;
    prevWords = nameWords(best.dish.id);
  }
  return out;
}

/* ───────────────── Hook ───────────────── */

/* Every usePlan() instance (the Cook row, the sheet) stays in sync, like useShoppingList. */
const EVENT = "pantryroots:week-plan";
const STORAGE_KEY = "pantryroots:v2:week-plan";

export function usePlan() {
  const [store, setStore] = usePersistentState<PlanStore>("week-plan", {});
  const latest = useRef(store);
  latest.current = store;

  useEffect(() => {
    const onLocal = (e: Event) => {
      const next = (e as CustomEvent<PlanStore>).detail;
      if (next !== latest.current) setStore(next);
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY || !e.newValue) return;
      try {
        setStore(JSON.parse(e.newValue) as PlanStore);
      } catch {
        /* ignore malformed values from other tabs */
      }
    };
    window.addEventListener(EVENT, onLocal);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(EVENT, onLocal);
      window.removeEventListener("storage", onStorage);
    };
  }, [setStore]);

  /** Writes, keeping only this week's days so old plans don't pile up. */
  const commit = useCallback(
    (update: (prev: PlanStore) => PlanStore) => {
      const firstDay = isoDate(mondayOf(new Date()));
      const merged = update(latest.current && typeof latest.current === "object" ? latest.current : {});
      const next: PlanStore = {};
      for (const [k, v] of Object.entries(merged)) if (k >= firstDay && typeof v === "string") next[k] = v;
      latest.current = next;
      setStore(next);
      window.dispatchEvent(new CustomEvent(EVENT, { detail: next }));
    },
    [setStore],
  );

  const safeStore = store && typeof store === "object" ? store : {};
  const today = isoDate(new Date());
  const plan = useMemo(() => weekDays(safeStore), [safeStore, today]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = useCallback((day: string, dishId: string) => commit((p) => ({ ...p, [day]: dishId })), [commit]);
  const clear = useCallback(
    (day: string) =>
      commit((p) => {
        const { [day]: _drop, ...rest } = p;
        void _drop;
        return rest;
      }),
    [commit],
  );
  const clearWeek = useCallback(() => commit(() => ({})), [commit]);
  /** Fills empty days from today onward. Returns how many dinners were added. */
  const suggest = useCallback(
    (pantry: string[], profile: Profile) => {
      const picks = suggestWeek(weekDays(latest.current ?? {}), pantry, profile);
      commit((p) => ({ ...p, ...picks }));
      return Object.keys(picks).length;
    },
    [commit],
  );

  const todayDay = plan.find((d) => d.isToday)!;

  return { plan, today: todayDay, set, clear, clearWeek, suggest };
}
