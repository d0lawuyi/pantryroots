import { useCallback, useEffect, useMemo } from "react";
import { usePersistentState } from "@/lib/storage";
import { useApp } from "@/lib/app-context";

/**
 * Grocery-store aisles for the pantry list.
 * Order here is the order aisles appear on screen (roughly how you walk a market).
 */
export const AISLES = ["Produce", "Grains & flour", "Spices & sauces", "Oils & fats", "Meat & fish", "Dried & canned", "Other"] as const;
export type Aisle = (typeof AISLES)[number];

export type AisleIcon = "leaf" | "grain" | "jar" | "drop" | "fish" | "can" | "box";

/**
 * Small visual identity per aisle. Colours live in src/styles/features/pantry.css,
 * keyed by `[data-aisle="<slug>"]`, so dark mode is handled with tokens.
 */
export const AISLE_META: Record<Aisle, { slug: string; icon: AisleIcon }> = {
  Produce: { slug: "produce", icon: "leaf" },
  "Grains & flour": { slug: "grains", icon: "grain" },
  "Spices & sauces": { slug: "spices", icon: "jar" },
  "Oils & fats": { slug: "oils", icon: "drop" },
  "Meat & fish": { slug: "meat", icon: "fish" },
  "Dried & canned": { slug: "dried", icon: "can" },
  Other: { slug: "other", icon: "box" },
};

const norm = (s: string) => s.toLowerCase().replace(/[^a-z\s-]/g, " ").replace(/\s+/g, " ").trim();

/** Exact names first: every ingredient in src/data/dishes.ts, plus names that keyword rules would get wrong. */
const EXACT: Record<string, Aisle> = {
  // Produce
  "garden eggs": "Produce",
  "green bananas": "Produce",
  matooke: "Produce",
  "jute leaves": "Produce",
  ewedu: "Produce",
  "bitter leaf": "Produce",
  uziza: "Produce",
  utazi: "Produce",
  "waakye leaves": "Produce",
  "pumpkin leaves": "Produce",
  "banana leaves": "Produce",
  "collard greens": "Produce",
  sukuma: "Produce",
  "scotch bonnet": "Produce",
  "red bell pepper": "Produce",
  cassava: "Produce",
  plantain: "Produce",
  yam: "Produce",
  avocado: "Produce",
  // Grains & flour
  "yam flour": "Grains & flour",
  "teff flour": "Grains & flour",
  "white cornmeal": "Grains & flour",
  cornmeal: "Grains & flour",
  "shiro powder": "Grains & flour",
  yeast: "Grains & flour",
  "baking powder": "Grains & flour",
  gari: "Grains & flour",
  semolina: "Grains & flour",
  // Spices & sauces
  iru: "Spices & sauces",
  dawadawa: "Spices & sauces",
  yaji: "Spices & sauces",
  suya: "Spices & sauces",
  berbere: "Spices & sauces",
  xawaash: "Spices & sauces",
  shito: "Spices & sauces",
  tamarind: "Spices & sauces",
  mustard: "Spices & sauces",
  "baobab leaf": "Spices & sauces",
  "stock cubes": "Spices & sauces",
  "bay leaf": "Spices & sauces",
  "bay leaves": "Spices & sauces",
  // Oils & fats
  "niter kibbeh": "Oils & fats",
  "peanut butter": "Dried & canned",
  "groundnut paste": "Dried & canned",
  // Meat & fish
  crayfish: "Meat & fish",
  stockfish: "Meat & fish",
  "dried fish": "Meat & fish",
  // Dried & canned
  egusi: "Dried & canned",
  "tomato paste": "Dried & canned",
  "coconut milk": "Dried & canned",
  maize: "Dried & canned",
  raisins: "Dried & canned",
  // Other
  honey: "Other",
  sugar: "Other",
  eggs: "Other",
  egg: "Other",
};

/** Keyword rules, checked in order; the first aisle with a matching word or phrase wins. */
const RULES: [Aisle, string[]][] = [
  ["Grains & flour", ["flour", "rice", "cornmeal", "semolina", "oats", "pasta", "spaghetti", "noodles", "couscous", "bread", "teff", "millet", "sorghum", "fonio", "quinoa", "bulgur", "barley", "garri", "starch", "yeast"]],
  ["Oils & fats", ["oil", "butter", "ghee", "margarine", "lard", "shea", "kibbeh", "shortening"]],
  ["Meat & fish", ["chicken", "beef", "goat", "lamb", "mutton", "pork", "turkey", "fish", "tilapia", "catfish", "mackerel", "sardine", "sardines", "salmon", "tuna", "prawn", "prawns", "shrimp", "crab", "snail", "snails", "meat", "sausage", "liver", "tripe", "oxtail", "suya", "ponmo", "kpomo", "crayfish", "stockfish"]],
  ["Dried & canned", ["beans", "lentils", "chickpeas", "peas", "peanuts", "peanut", "groundnuts", "groundnut", "cashews", "almonds", "nuts", "seeds", "egusi", "canned", "tinned", "tin", "can", "paste", "milk", "raisins", "dates", "dried", "powdered", "maize", "corn"]],
  ["Spices & sauces", ["salt", "pepper", "peppercorns", "cumin", "cardamom", "cloves", "cinnamon", "turmeric", "paprika", "curry", "thyme", "nutmeg", "coriander", "ginger powder", "garlic powder", "spice", "spices", "seasoning", "bouillon", "stock", "cubes", "maggi", "knorr", "sauce", "ketchup", "vinegar", "mustard", "mayonnaise", "chutney", "harissa", "berbere", "mitmita", "suya spice", "masala", "vanilla"]],
  ["Produce", ["onion", "onions", "tomato", "tomatoes", "garlic", "ginger", "lemon", "lime", "orange", "banana", "bananas", "plantain", "yam", "cassava", "potato", "potatoes", "sweet potato", "cocoyam", "taro", "carrot", "carrots", "cabbage", "spinach", "kale", "greens", "lettuce", "okra", "eggplant", "aubergine", "garden egg", "pumpkin", "squash", "cucumber", "parsley", "cilantro", "basil", "mint", "leaf", "leaves", "chili", "chilli", "habanero", "bell pepper", "scallion", "spring onion", "leek", "celery", "mango", "pineapple", "avocado", "apple", "pawpaw", "papaya", "coconut", "mushroom", "mushrooms", "beetroot", "zucchini", "courgette"]],
  ["Other", ["egg", "eggs", "honey", "sugar", "cheese", "yogurt", "yoghurt", "cream", "tea", "coffee", "cocoa", "water"]],
];

function hasPhrase(name: string, phrase: string) {
  return (` ${name} `).includes(` ${phrase} `);
}

/** Which aisle an ingredient lives in. Case and punctuation don't matter. */
export function aisleOf(name: string): Aisle {
  const n = norm(name);
  if (!n) return "Other";
  if (EXACT[n]) return EXACT[n];
  // Spice blends named after a vegetable ("garlic powder", "chili flakes") are spices.
  if (/\b(stock|bouillon|cubes?|sauce)\b/.test(n)) return "Spices & sauces";
  if (/\b(powder|flakes|seasoning|spice|blend)\b/.test(n) && !/\b(milk|baking|custard|cocoa)\b/.test(n)) return "Spices & sauces";
  for (const [aisle, keys] of RULES) {
    if (keys.some((k) => hasPhrase(n, k))) return aisle;
  }
  // Plural fallback: "carrots" → "carrot".
  const singular = n.replace(/(es|s)$/, "");
  if (singular !== n) {
    if (EXACT[singular]) return EXACT[singular];
    for (const [aisle, keys] of RULES) {
      if (keys.some((k) => hasPhrase(singular, k))) return aisle;
    }
  }
  return "Other";
}

/* ───────────────── Running low ───────────────── */

/** localStorage key (via usePersistentState): pantryroots:v2:pantry-low — an array of lowercased item names. */
export const PANTRY_LOW_KEY = "pantry-low";
const SYNC_EVENT = "pantryroots:pantry-low";

const lowKey = (item: string) => item.trim().toLowerCase();

/**
 * Shared "running low" set. Any component can call this; all instances stay in sync
 * within the tab (custom event) and across tabs (storage event).
 *
 * - `low`: pantry items currently marked running low (original casing, pantry order)
 * - `isLow(item)`, `setLow(item, bool)`, `toggleLow(item)`
 * - `lowKeys`: the raw stored set (lowercased), including items no longer in the pantry
 */
export function usePantryLow() {
  const { pantry } = useApp();
  const [stored, setStored] = usePersistentState<string[]>(PANTRY_LOW_KEY, []);

  useEffect(() => {
    const onSync = (e: Event) => setStored((e as CustomEvent<string[]>).detail);
    const onStorage = (e: StorageEvent) => {
      if (!e.key?.endsWith(":" + PANTRY_LOW_KEY)) return;
      try {
        setStored(e.newValue ? (JSON.parse(e.newValue) as string[]) : []);
      } catch {
        /* ignore malformed values */
      }
    };
    window.addEventListener(SYNC_EVENT, onSync);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(SYNC_EVENT, onSync);
      window.removeEventListener("storage", onStorage);
    };
  }, [setStored]);

  const lowKeys = useMemo(() => new Set(stored), [stored]);

  const update = useCallback(
    (fn: (prev: Set<string>) => Set<string>) => {
      const next = [...fn(new Set(lowKeys))];
      setStored(next);
      // Defer so other instances don't update during this render pass.
      queueMicrotask(() => window.dispatchEvent(new CustomEvent(SYNC_EVENT, { detail: next })));
    },
    [lowKeys, setStored],
  );

  const isLow = useCallback((item: string) => lowKeys.has(lowKey(item)), [lowKeys]);

  const setLow = useCallback(
    (item: string, value: boolean) =>
      update((s) => {
        if (value) s.add(lowKey(item));
        else s.delete(lowKey(item));
        return s;
      }),
    [update],
  );

  const toggleLow = useCallback((item: string) => setLow(item, !isLow(item)), [isLow, setLow]);

  const low = useMemo(() => pantry.filter((p) => lowKeys.has(lowKey(p))), [pantry, lowKeys]);

  return { low, lowKeys, isLow, setLow, toggleLow };
}
