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
  /** The text exactly as the user typed or dictated it, so nothing is ever lost. For scans, the transcript. */
  original: string;
  /** Scanned recipes: what Muse read on the page, line by line, so the cook can check it. */
  transcript?: string;
  /** Scanned recipes: a small JPEG data URL (about 320px, under 40 KB) of the original card. */
  sourceImage?: string;
  /** Set when the reading is the built-in Demo mode sample, never a real reading. */
  sample?: boolean;
};

/** Shape returned by POST /api/recipe. */
export type RecipeReply = {
  dish: Pick<Dish, "name" | "summary" | "minutes" | "ingredients" | "technique" | "steps" | "tone"> & { origin: string };
  quote: string;
  /** Present when the recipe was read from a photo. */
  transcript?: string;
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
export function fromReply(
  reply: RecipeReply,
  original: string,
  from?: string,
  scan?: { sourceImage?: string; sample?: boolean },
): FamilyRecipe {
  const d = reply.dish;
  const r: FamilyRecipe = {
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
  if (reply.transcript) r.transcript = reply.transcript;
  if (scan?.sourceImage) r.sourceImage = scan.sourceImage;
  if (scan?.sample) r.sample = true;
  return r;
}

/** Fallback when the AI is unavailable: keep the words exactly as written, as a single step. */
/** Split free text into steps: by line breaks, else by sentences grouped ~2 at a time. */
function splitSteps(text: string): string[] {
  const lines = text.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  if (lines.length > 1) return lines.slice(0, 20);
  const sentences = text.trim().match(/[^.!?]+[.!?]+|[^.!?]+$/g)?.map((x) => x.trim()).filter(Boolean) ?? [text.trim()];
  if (sentences.length <= 2) return [text.trim()];
  const steps: string[] = [];
  for (let i = 0; i < sentences.length; i += 2) steps.push(sentences.slice(i, i + 2).join(" "));
  return steps.slice(0, 20);
}

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
    steps: splitSteps(text),
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

/* ───────────── Scanned recipe cards ───────────── */

const THUMB_LIMIT = 40_000;

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = () => reject(new Error("image"));
    i.src = src;
  });
}

/**
 * A small JPEG of the original card for keeping with the recipe (localStorage is small):
 * about 320px on the long edge and under 40 KB, stepping quality and size down until it fits.
 */
export async function makeThumbnail(src: string): Promise<string | undefined> {
  try {
    const img = await loadImage(src);
    for (const edge of [320, 260, 200]) {
      const scale = Math.min(1, edge / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(img.width * scale));
      canvas.height = Math.max(1, Math.round(img.height * scale));
      const ctx = canvas.getContext("2d");
      if (!ctx) return undefined;
      ctx.fillStyle = "#fff"; // transparent PNGs would turn black as JPEG
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      for (const q of [0.72, 0.6, 0.48]) {
        const url = canvas.toDataURL("image/jpeg", q);
        if (url.length <= THUMB_LIMIT) return url;
      }
    }
  } catch {
    /* thumbnail is a nice-to-have */
  }
  return undefined;
}

/** True when the app-wide Demo mode switch is on (sample answers, no live data). */
export function demoModeOn() {
  try {
    return localStorage.getItem("pantryroots:v2:demo") === "true";
  } catch {
    return false;
  }
}

/** Demo mode only: a clearly labelled sample reading of a handwritten card. Never shown as a real reading. */
export const SAMPLE_TRANSCRIPT = [
  "Mama's Efo Riro",
  "(for Tolu. Make it Sunday, not in a hurry)",
  "",
  "2 big bunch spinach (or tete if you see it)",
  "4 tatashe, 2 rodo, 1 big onion",
  "palm oil, 1 cooking spoon and half",
  "iru, 1 small spoon",
  "smoked fish and ponmo",
  "crayfish (ground), stock cube, salt",
  "",
  "Blend the pepper rough, not smooth smooth. Boil it till the water dry.",
  "Heat the palm oil but dont let it bleach. Onion in, then iru.",
  "Pour the pepper and fry it well well till the oil float on top.",
  "Fish, ponmo, crayfish, stock cube. Taste for salt.",
  "Spinach go in LAST. Stir 2 minute and off the fire, if it cook too long it go soft (unclear).",
  "The pepper is the soup. Take your time with it.",
].join("\n");

export const SAMPLE_REPLY: RecipeReply = {
  dish: {
    name: "Mama's Efo Riro",
    origin: "Yoruba",
    summary: "A Sunday spinach stew built on a slow-fried pepper base, with smoked fish, ponmo and iru, written for Tolu.",
    minutes: 60,
    tone: "green",
    ingredients: ["spinach", "tatashe", "rodo", "onion", "palm oil", "iru", "smoked fish", "ponmo", "crayfish", "stock cube", "salt"],
    technique: "The pepper is fried well well until the oil floats on top, and the spinach goes in last for just 2 minutes.",
    steps: [
      "Blend the tatashe and rodo rough, not smooth smooth. Boil it till the water dry.",
      "Heat 1 cooking spoon and half of palm oil, but don't let it bleach. Onion in, then 1 small spoon of iru.",
      "Pour the pepper and fry it well well till the oil float on top.",
      "Add the smoked fish, ponmo, ground crayfish and stock cube. Taste for salt.",
      "Spinach go in last. Stir 2 minutes and take it off the fire; if it cooks too long it goes soft (unclear).",
    ],
  },
  quote: "The pepper is the soup. Take your time with it.",
  transcript: SAMPLE_TRANSCRIPT,
};
