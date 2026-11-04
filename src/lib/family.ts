import { useCallback, useEffect, useRef } from "react";
import type { Dish, Tone } from "@/data/dishes";
import { usePersistentState } from "@/lib/storage";

/**
 * Family recipes: dishes told in someone's own words, shaped into a recipe card
 * by AI (or kept exactly as written), and saved on this device.
 */
export type FamilyRecipe = Dish & {
  /** Whose recipe this is, e.g. "Grandma Bisi". */
  from?: string;
  /** One short line in the cook's own words. */
  quote?: string;
  createdAt: number;
  /** The text exactly as the user typed or dictated it, so nothing is ever lost. */
  original: string;
};

/** Shape returned by POST /api/recipe. */
export type RecipeReply = {
  dish: Pick<Dish, "name" | "summary" | "minutes" | "ingredients" | "technique" | "steps" | "tone"> & { origin: string };
  quote: string;
};

export const FAMILY_PEOPLE_ID = "family";

export function isFamilyRecipe(d: Dish | undefined | null): d is FamilyRecipe {
  return !!d && d.id.startsWith("fam-") && typeof (d as FamilyRecipe).original === "string";
}

const slug = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32) || "recipe";

export function familyId(name: string) {
  return `fam-${slug(name)}-${Math.random().toString(36).slice(2, 7)}`;
}

/** Build a saved recipe from the AI's structured reply. */
export function fromReply(reply: RecipeReply, original: string, from?: string): FamilyRecipe {
  const d = reply.dish;
  return {
    id: familyId(d.name),
    name: d.name,
    peopleId: FAMILY_PEOPLE_ID,
    origin: d.origin,
    summary: d.summary,
    minutes: d.minutes,
    tone: d.tone,
    ingredients: d.ingredients,
    technique: d.technique,
    steps: d.steps,
    aiWritten: true,
    from: from?.trim() || undefined,
    quote: reply.quote || undefined,
    createdAt: Date.now(),
    original,
  };
}

/** Fallback when the AI is unavailable: keep the words exactly as written, as a single step. */
export function asWritten(text: string, name?: string, from?: string): FamilyRecipe {
  const who = from?.trim();
  const title = name?.trim() || (who ? `${who}'s recipe` : "Family recipe");
  return {
    id: familyId(title),
    name: title,
    peopleId: FAMILY_PEOPLE_ID,
    origin: "Family recipe",
    summary: who ? `Saved exactly as ${who} taught it.` : "Saved exactly as it was told.",
    minutes: 45,
    tone: "brown" as Tone,
    ingredients: [],
    technique: "Written in the cook's own words. Follow it the way they would.",
    steps: [text.trim()],
    from: who || undefined,
    createdAt: Date.now(),
    original: text,
  };
}

const KEY = "family-recipes";
/** Same versioned key usePersistentState uses (see src/lib/storage.ts). */
const STORAGE_KEY = "pantryroots:v2:" + KEY;
const SYNC_EVENT = "pantryroots:family-recipes";

/**
 * Saved family recipes. Every component that calls this hook stays in sync:
 * a change in one (e.g. the add sheet) is broadcast to the others (e.g. the Cook list).
 * Changes are computed and written straight away, so they survive the calling
 * component unmounting in the same tick (the sheet closes right after saving).
 */
export function useFamilyRecipes() {
  const [list, setList] = usePersistentState<FamilyRecipe[]>(KEY, []);
  const latest = useRef(list);
  latest.current = list;

  useEffect(() => {
    const onSync = (e: Event) => {
      latest.current = (e as CustomEvent<FamilyRecipe[]>).detail;
      setList(latest.current);
    };
    window.addEventListener(SYNC_EVENT, onSync);
    return () => window.removeEventListener(SYNC_EVENT, onSync);
  }, [setList]);

  const update = useCallback(
    (fn: (l: FamilyRecipe[]) => FamilyRecipe[]) => {
      const next = fn(latest.current);
      latest.current = next;
      setList(next);
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        /* private mode or storage full: still kept for this session */
      }
      window.dispatchEvent(new CustomEvent(SYNC_EVENT, { detail: next }));
    },
    [setList],
  );

  const add = useCallback((r: FamilyRecipe) => update((l) => [r, ...l.filter((x) => x.id !== r.id)]), [update]);
  const remove = useCallback((id: string) => update((l) => l.filter((x) => x.id !== id)), [update]);

  return { list, add, remove };
}
