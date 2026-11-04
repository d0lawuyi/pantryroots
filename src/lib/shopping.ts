import { useCallback, useEffect, useMemo, useRef } from "react";
import { usePersistentState } from "./storage";
import { cleanItem } from "./pantry";

export type ShoppingItem = {
  id: string;
  name: string;
  /** Dish names this item was added for, e.g. ["Jollof rice"]. */
  forDishes: string[];
  checked: boolean;
  /** ms since epoch */
  addedAt: number;
};

export type Aisle = "Produce" | "Grains & flour" | "Spices & sauces" | "Oils" | "Meat & fish" | "Dried & canned" | "Other";

/** Display order, roughly the walk through a store. */
export const AISLES: Aisle[] = ["Produce", "Meat & fish", "Grains & flour", "Dried & canned", "Spices & sauces", "Oils", "Other"];

/** Exact names from src/data/dishes.ts and src/data/substitutes.ts, plus common staples. */
const EXACT: Record<string, Aisle> = {
  // Produce
  avocado: "Produce", "banana leaves": "Produce", "bitter leaf": "Produce", cabbage: "Produce", carrot: "Produce",
  cassava: "Produce", "collard greens": "Produce", "garden eggs": "Produce", garlic: "Produce", ginger: "Produce",
  "green bananas": "Produce", matooke: "Produce", "jute leaves": "Produce", lemon: "Produce", lime: "Produce",
  maize: "Produce", corn: "Produce", onion: "Produce", parsley: "Produce", plantain: "Produce", potato: "Produce",
  "pumpkin leaves": "Produce", "red bell pepper": "Produce", "scotch bonnet": "Produce", habanero: "Produce",
  spinach: "Produce", tomato: "Produce", yam: "Produce", "waakye leaves": "Produce", sukuma: "Produce", kale: "Produce",
  // Meat & fish
  beef: "Meat & fish", chicken: "Meat & fish", "goat meat": "Meat & fish", fish: "Meat & fish", catfish: "Meat & fish",
  tilapia: "Meat & fish", "dried fish": "Meat & fish", stockfish: "Meat & fish", crayfish: "Meat & fish",
  // Grains & flour
  rice: "Grains & flour", "basmati rice": "Grains & flour", "broken rice": "Grains & flour",
  "long grain rice": "Grains & flour", "short grain rice": "Grains & flour", flour: "Grains & flour",
  cornmeal: "Grains & flour", "white cornmeal": "Grains & flour", "teff flour": "Grains & flour",
  "yam flour": "Grains & flour", yeast: "Grains & flour",
  // Dried & canned
  beans: "Dried & canned", "black-eyed beans": "Dried & canned", "coconut milk": "Dried & canned",
  egusi: "Dried & canned", peanuts: "Dried & canned", "peanut butter": "Dried & canned", raisins: "Dried & canned",
  "tomato paste": "Dried & canned", tamarind: "Dried & canned",
  // Spices & sauces
  "black pepper": "Spices & sauces",
  "bay leaf": "Spices & sauces", berbere: "Spices & sauces", cardamom: "Spices & sauces", cinnamon: "Spices & sauces",
  cloves: "Spices & sauces", cumin: "Spices & sauces", "curry powder": "Spices & sauces", dawadawa: "Spices & sauces",
  iru: "Spices & sauces", mustard: "Spices & sauces", "shiro powder": "Spices & sauces", shito: "Spices & sauces",
  thyme: "Spices & sauces", turmeric: "Spices & sauces", uziza: "Spices & sauces", utazi: "Spices & sauces",
  xawaash: "Spices & sauces", yaji: "Spices & sauces", "baobab leaf": "Spices & sauces", "stock cubes": "Spices & sauces",
  salt: "Spices & sauces", sugar: "Spices & sauces", honey: "Spices & sauces",
  // Oils
  "palm oil": "Oils", "vegetable oil": "Oils", "niter kibbeh": "Oils", butter: "Oils",
  // Other
  eggs: "Other", cream: "Other",
};

/** Keyword fallback for anything typed by hand. First match wins, so specific rules come first. */
const KEYWORDS: [RegExp, Aisle][] = [
  [/\b(oil|ghee|kibbeh|butter|lard|margarine)\b/, "Oils"],
  [/\b(flour|rice|cornmeal|semolina|couscous|oats?|pasta|spaghetti|noodles?|bread|teff|millet|sorghum|fonio|garri|gari|yeast|grains?)\b/, "Grains & flour"],
  [/\b(paste|canned|tinned|can|milk powder|coconut milk|beans?|lentils?|peas|chickpeas|peanuts?|groundnuts?|egusi|raisins|dates|tamarind|dried)\b/, "Dried & canned"],
  [/\b(beef|chicken|goat|lamb|mutton|pork|turkey|meat|fish|tilapia|catfish|mackerel|sardines?|shrimps?|prawns?|crayfish|stockfish|snail|liver|tripe|sausage)\b/, "Meat & fish"],
  [/\b(spice|powder|seasoning|pepper soup|curry|cumin|cloves|cinnamon|cardamom|nutmeg|thyme|bay|paprika|salt|sugar|honey|sauce|ketchup|mustard|vinegar|stock|bouillon|cubes?|berbere|suya|yaji|iru|dawadawa|shito|uziza|utazi|xawaash)\b/, "Spices & sauces"],
  [/\b(tomato(es)?|onions?|garlic|ginger|peppers?|chil(l)?i(es)?|scotch bonnet|habanero|leaf|leaves|greens|spinach|kale|cabbage|carrots?|potato(es)?|yams?|plantains?|bananas?|cassava|okra|eggplant|garden eggs|avocado|lemons?|limes?|oranges?|mango|parsley|cilantro|coriander|herbs?|lettuce|cucumber|corn|maize|pumpkin|squash|apples?|fruit|vegetables?)\b/, "Produce"],
];

const key = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

export function aisleFor(name: string): Aisle {
  const k = key(name);
  if (EXACT[k]) return EXACT[k];
  for (const [re, aisle] of KEYWORDS) if (re.test(k)) return aisle;
  return "Other";
}

/** Unchecked items grouped by aisle, in AISLES order, empty aisles left out. */
export function groupByAisle(items: ShoppingItem[]): { aisle: Aisle; items: ShoppingItem[] }[] {
  const map = new Map<Aisle, ShoppingItem[]>();
  for (const it of items) {
    const a = aisleFor(it.name);
    map.set(a, [...(map.get(a) ?? []), it]);
  }
  return AISLES.filter((a) => map.has(a)).map((a) => ({ aisle: a, items: map.get(a)!.sort((x, y) => x.name.localeCompare(y.name)) }));
}

/** Plain-text list grouped by aisle, for the clipboard. */
export function listAsText(items: ShoppingItem[]): string {
  const open = items.filter((i) => !i.checked);
  return [
    "Shopping list",
    ...groupByAisle(open).map((g) => `\n${g.aisle}\n` + g.items.map((i) => `- ${i.name}`).join("\n")),
  ].join("\n");
}

/* ── Keeping every useShoppingList() instance in sync ──
   usePersistentState holds its own copy per component, so the sidebar badge, the sheet and
   every AddToListButton would drift apart. Each change is broadcast in-page (custom event)
   and across tabs (the storage event fires there). */
const EVENT = "pantryroots:shopping";
const STORAGE_KEY = "pantryroots:v2:shopping";

let seq = 0;
const newId = () => `s${Date.now().toString(36)}${(seq++).toString(36)}`;

export function useShoppingList() {
  const [items, setItems] = usePersistentState<ShoppingItem[]>("shopping", []);
  const latest = useRef(items);
  latest.current = items;

  useEffect(() => {
    const onLocal = (e: Event) => {
      const next = (e as CustomEvent<ShoppingItem[]>).detail;
      if (next !== latest.current) setItems(next);
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key !== STORAGE_KEY || !e.newValue) return;
      try {
        setItems(JSON.parse(e.newValue) as ShoppingItem[]);
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
  }, [setItems]);

  const commit = useCallback(
    (next: ShoppingItem[]) => {
      latest.current = next;
      setItems(next);
      window.dispatchEvent(new CustomEvent(EVENT, { detail: next }));
    },
    [setItems],
  );

  /** Adds names (merging case-insensitively). Returns how many were new to the list. */
  const add = useCallback(
    (names: string[], dishName?: string) => {
      const next = [...latest.current];
      let added = 0;
      for (const raw of names) {
        const name = cleanItem(raw);
        if (!name) continue;
        const i = next.findIndex((it) => it.name.toLowerCase() === name.toLowerCase());
        if (i >= 0) {
          const it = next[i];
          const forDishes = dishName && !it.forDishes.includes(dishName) ? [...it.forDishes, dishName] : it.forDishes;
          // Asking for it again means you need it again.
          next[i] = { ...it, forDishes, checked: false };
        } else {
          next.push({ id: newId(), name, forDishes: dishName ? [dishName] : [], checked: false, addedAt: Date.now() });
          added++;
        }
      }
      commit(next);
      return added;
    },
    [commit],
  );

  const toggle = useCallback(
    (id: string) => commit(latest.current.map((it) => (it.id === id ? { ...it, checked: !it.checked } : it))),
    [commit],
  );

  const remove = useCallback((id: string) => commit(latest.current.filter((it) => it.id !== id)), [commit]);

  const clearChecked = useCallback(() => commit(latest.current.filter((it) => !it.checked)), [commit]);

  const count = useMemo(() => items.filter((i) => !i.checked).length, [items]);

  return { items, add, toggle, remove, clearChecked, count };
}
