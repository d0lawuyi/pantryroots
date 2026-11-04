import { useCallback, useEffect, useMemo, useRef } from "react";
import type { Dish } from "@/data/dishes";
import { usePersistentState } from "./storage";

/**
 * Diet & macros, with an honest MyFitnessPal bridge.
 * MyFitnessPal has had no public API since 2019, so we never connect to accounts:
 * people copy their daily targets from MFP's Goals screen, and copy a paste-ready
 * line back into MFP's Quick Add. Everything here is an estimate and stays on this device.
 */

export type MacroTargets = { calories: number; protein: number; carbs: number; fat: number };
export type Macros = { calories: number; protein: number; carbs: number; fat: number; fiber?: number };
export type MacroEstimate = Macros & { servingNote: string; confidence: "low" | "medium" };
export type LogEntry = { id: string; dishId: string; name: string; macros: Macros; servings: number; at: number };

export const MACRO_KEYS = ["calories", "protein", "carbs", "fat"] as const;
export type MacroKey = (typeof MACRO_KEYS)[number];

export const MACRO_LABEL: Record<MacroKey, string> = { calories: "Calories", protein: "Protein", carbs: "Carbs", fat: "Fat" };
export const MACRO_UNIT: Record<MacroKey, string> = { calories: "kcal", protein: "g", carbs: "g", fat: "g" };
/** Sensible bounds for daily targets typed by hand. */
export const TARGET_BOUNDS: Record<MacroKey, [number, number]> = {
  calories: [800, 6000],
  protein: [10, 400],
  carbs: [10, 900],
  fat: [10, 300],
};

export const TARGET_PRESETS: { id: string; label: string; note: string; targets: MacroTargets }[] = [
  { id: "balanced", label: "Balanced 2,000", note: "About 20% protein, 50% carbs, 30% fat", targets: { calories: 2000, protein: 100, carbs: 250, fat: 67 } },
  { id: "protein", label: "Higher protein 2,200", note: "About 30% protein, 40% carbs, 30% fat", targets: { calories: 2200, protein: 165, carbs: 220, fat: 75 } },
  { id: "lighter", label: "Lighter 1,700", note: "About 25% protein, 45% carbs, 30% fat", targets: { calories: 1700, protein: 110, carbs: 190, fat: 55 } },
];
export const PRESET_NOTE = "Use your own numbers from MyFitnessPal Goals if you have them.";
export const MFP_DIARY_URL = "https://www.myfitnesspal.com/food/diary";

export const fmt = (n: number) => Math.round(n).toLocaleString("en-US");
export const fmtServings = (s: number) => `${s % 1 ? s.toFixed(1) : s} ${s === 1 ? "serving" : "servings"}`;

export function scale(m: Macros, servings: number): Macros {
  return {
    calories: Math.round((m.calories * servings) / 10) * 10,
    protein: Math.round(m.protein * servings),
    carbs: Math.round(m.carbs * servings),
    fat: Math.round(m.fat * servings),
  };
}

/** Paste-ready line, e.g. "Party Jollof (PantryRoots, est.) — 1 serving: 620 kcal, P 18g, C 92g, F 20g". */
export function mfpText(name: string, macros: Macros, servings = 1) {
  const m = scale(macros, servings);
  return `${name} (PantryRoots, est.) — ${fmtServings(servings)}: ${fmt(m.calories)} kcal, P ${m.protein}g, C ${m.carbs}g, F ${m.fat}g`;
}

export function validTargets(t: Partial<Record<MacroKey, number>>): t is MacroTargets {
  return MACRO_KEYS.every((k) => {
    const v = t[k];
    return typeof v === "number" && Number.isFinite(v) && v >= TARGET_BOUNDS[k][0] && v <= TARGET_BOUNDS[k][1];
  });
}

// ─── Shared persistent state ───────────────────────────────────────────────
// usePersistentState is per-component. The dish sheet and the Cook screen are mounted
// at the same time, so broadcast writes to every other instance of the same key.

const EVENT = "pantryroots:macros-sync";
type SyncDetail = { key: string; value: unknown; source: symbol };

/** Same prefix as src/lib/storage.ts, so a write survives even if this component unmounts in the same tick. */
const STORAGE_PREFIX = "pantryroots:v2:";

function useSyncedState<T>(key: string, fallback: T) {
  const [value, setValue] = usePersistentState<T>(key, fallback);
  const source = useMemo(() => Symbol(key), [key]);
  const latest = useRef(value);
  latest.current = value;

  useEffect(() => {
    const onSync = (e: Event) => {
      const d = (e as CustomEvent<SyncDetail>).detail;
      if (d.key === key && d.source !== source) {
        latest.current = d.value as T;
        setValue(d.value as T);
      }
    };
    window.addEventListener(EVENT, onSync);
    return () => window.removeEventListener(EVENT, onSync);
  }, [key, source, setValue]);

  // Called from event handlers and promise callbacks only, never during render.
  const set = useCallback(
    (next: T | ((prev: T) => T)) => {
      const v = typeof next === "function" ? (next as (p: T) => T)(latest.current) : next;
      latest.current = v;
      setValue(v);
      try {
        localStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(v));
      } catch {
        /* private mode or storage full */
      }
      window.dispatchEvent(new CustomEvent<SyncDetail>(EVENT, { detail: { key, value: v, source } }));
    },
    [key, source, setValue],
  );
  return [value, set] as const;
}

// ─── Targets ───────────────────────────────────────────────────────────────

export function useMacroTargets() {
  const [targets, setTargets] = useSyncedState<MacroTargets | null>("macro-targets", null);
  const save = useCallback((t: MacroTargets) => setTargets(validTargets(t) ? t : null), [setTargets]);
  const clear = useCallback(() => setTargets(null), [setTargets]);
  return { targets: targets && validTargets(targets) ? targets : null, save, clear };
}

// ─── Estimates ─────────────────────────────────────────────────────────────

type CacheEntry = { sig: string; est: MacroEstimate; at: number };
type DishLike = Pick<Dish, "id" | "name" | "ingredients"> & Partial<Pick<Dish, "summary" | "minutes">>;

const MAX_CACHE = 80;
const inflight = new Map<string, Promise<MacroEstimate>>();
const sigOf = (d: DishLike) => `${d.name}|${d.ingredients.join(",")}`.toLowerCase();

export class MacroFetchError extends Error {}

function isEstimate(v: unknown): v is MacroEstimate {
  const e = v as MacroEstimate | null;
  return !!e && typeof e === "object" && [e.calories, e.protein, e.carbs, e.fat].every((n) => typeof n === "number" && Number.isFinite(n));
}

const SAMPLE_NOTE = "Sample estimate (Demo mode)";

function demoOn() {
  try {
    return localStorage.getItem("pantryroots:v2:demo") === "true";
  } catch {
    return false;
  }
}

/** Rough, clearly-labeled sample used only in Demo mode when the estimator can't be reached. */
function sampleEstimate(dish: DishLike): MacroEstimate {
  const ings = dish.ingredients.join(" ").toLowerCase();
  const count = (words: string[]) => words.filter((w) => ings.includes(w)).length;
  const starch = count(["rice", "flour", "yam", "cassava", "cornmeal", "plantain", "banana", "potato", "teff", "maize"]);
  const protein = count(["chicken", "beef", "fish", "goat", "egg", "beans", "catfish", "tilapia", "stockfish", "peanut", "shiro"]);
  const fat = count(["palm oil", "oil", "butter", "kibbeh", "peanut", "coconut", "egusi"]);
  const carbs = 35 + 28 * Math.min(starch, 2);
  const prot = 10 + 12 * Math.min(protein, 3);
  const f = 10 + 8 * Math.min(fat, 2);
  return {
    servingNote: SAMPLE_NOTE,
    calories: Math.round((carbs * 4 + prot * 4 + f * 9) / 10) * 10,
    protein: prot,
    carbs,
    fat: f,
    confidence: "low",
  };
}

async function fetchEstimate(dish: DishLike): Promise<MacroEstimate> {
  try {
    return await fetchEstimateLive(dish);
  } catch (e) {
    if (demoOn()) return sampleEstimate(dish);
    throw e;
  }
}

async function fetchEstimateLive(dish: DishLike): Promise<MacroEstimate> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 30_000);
  try {
    const res = await fetch("/api/macros", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        dish: { name: dish.name, ingredients: dish.ingredients.slice(0, 40), summary: dish.summary?.slice(0, 400), minutes: dish.minutes },
      }),
      signal: ctrl.signal,
    });
    const body = await res.json().catch(() => null);
    if (!res.ok || !isEstimate(body)) throw new MacroFetchError((body as { message?: string } | null)?.message || "Couldn't estimate right now.");
    return {
      servingNote: typeof body.servingNote === "string" ? body.servingNote : "1 typical home serving",
      calories: body.calories,
      protein: body.protein,
      carbs: body.carbs,
      fat: body.fat,
      fiber: typeof body.fiber === "number" ? body.fiber : undefined,
      confidence: body.confidence === "medium" ? "medium" : "low",
    };
  } catch (e) {
    throw e instanceof MacroFetchError ? e : new MacroFetchError("Couldn't reach the estimator. Check your connection.");
  } finally {
    clearTimeout(timer);
  }
}

export function useMacroEstimates() {
  const [cache, setCache] = useSyncedState<Record<string, CacheEntry>>("macro-cache", {});

  const get = useCallback(
    (dish: DishLike): MacroEstimate | null => {
      const hit = cache[dish.id];
      return hit && hit.sig === sigOf(dish) && isEstimate(hit.est) ? hit.est : null;
    },
    [cache],
  );

  const getOrFetch = useCallback(
    async (dish: DishLike): Promise<MacroEstimate> => {
      const cached = get(dish);
      if (cached && !(cached.servingNote === SAMPLE_NOTE && !demoOn())) return cached;
      const sig = sigOf(dish);
      const k = `${dish.id}|${sig}`;
      let p = inflight.get(k);
      if (!p) {
        p = fetchEstimate(dish).finally(() => inflight.delete(k));
        inflight.set(k, p);
      }
      const est = await p;
      if (est.servingNote === SAMPLE_NOTE) return est; // never cache sample numbers
      setCache((prev) => {
        const next = { ...prev, [dish.id]: { sig, est, at: Date.now() } };
        const ids = Object.keys(next);
        if (ids.length > MAX_CACHE) {
          ids.sort((a, b) => next[a].at - next[b].at).slice(0, ids.length - MAX_CACHE).forEach((id) => delete next[id]);
        }
        return next;
      });
      return est;
    },
    [get, setCache],
  );

  return { get, getOrFetch };
}

// ─── Today's log ───────────────────────────────────────────────────────────

type DayLog = { date: string; entries: LogEntry[] };

export function localDate(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function useTodayLog() {
  const [log, setLog] = useSyncedState<DayLog>("macro-log", { date: localDate(), entries: [] });
  const today = localDate();
  const entries = useMemo(() => (log.date === today && Array.isArray(log.entries) ? log.entries : []), [log, today]);

  const add = useCallback(
    ({ dishId, name, macros, servings }: { dishId: string; name: string; macros: Macros; servings: number }) => {
      const s = Math.min(3, Math.max(0.5, Math.round(servings * 2) / 2));
      const entry: LogEntry = {
        id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
        dishId,
        name,
        macros: { calories: macros.calories, protein: macros.protein, carbs: macros.carbs, fat: macros.fat },
        servings: s,
        at: Date.now(),
      };
      setLog((prev) => {
        const d = localDate();
        return { date: d, entries: [...(prev.date === d ? prev.entries : []), entry].slice(-50) };
      });
    },
    [setLog],
  );

  const remove = useCallback(
    (id: string) => setLog((prev) => ({ date: prev.date, entries: prev.entries.filter((e) => e.id !== id) })),
    [setLog],
  );

  const totals = useMemo<MacroTargets>(() => {
    const t = { calories: 0, protein: 0, carbs: 0, fat: 0 };
    for (const e of entries) for (const k of MACRO_KEYS) t[k] += e.macros[k] * e.servings;
    return { calories: Math.round(t.calories), protein: Math.round(t.protein), carbs: Math.round(t.carbs), fat: Math.round(t.fat) };
  }, [entries]);

  return { entries, add, remove, totals };
}
