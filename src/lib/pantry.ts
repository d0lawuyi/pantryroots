import { DISHES, type Dish } from "../data/dishes.js";
import { SUBSTITUTES } from "../data/substitutes.js";

const norm = (s: string) => s.toLowerCase().replace(/[^a-z\s-]/g, "").replace(/\s+/g, " ").trim();

/** Ingredients that are interchangeable for "do I have it" purposes. */
const EQUIVALENTS: string[][] = [
  ["scotch bonnet", "habanero", "chili", "hot pepper"],
  ["vegetable oil", "oil", "canola oil", "sunflower oil"],
  ["beans", "black-eyed beans", "black eyed peas", "kidney beans"],
  ["white cornmeal", "cornmeal", "maize flour", "corn flour"],
  ["maize", "corn"],
  ["eggs", "egg"],
  ["peanuts", "peanut", "groundnuts"],
  ["peanut butter", "groundnut paste"],
  ["green bananas", "matooke"],
  ["collard greens", "sukuma", "kale"],
  ["spinach", "greens"],
];

const words = (s: string) => new Set(norm(s).split(" "));

/**
 * Does a pantry item cover a recipe ingredient?
 * "rice" covers "basmati rice"; "palm oil" covers "oil"; equivalents cover each other.
 */
export function covers(pantryItem: string, ingredient: string) {
  const p = norm(pantryItem);
  const i = norm(ingredient);
  if (!p || !i) return false;
  if (p === i) return true;
  for (const group of EQUIVALENTS) {
    if (group.includes(p) && group.includes(i)) return true;
  }
  // Specialty ingredients need the real thing: plain "oil" doesn't cover "palm oil".
  if (i in SUBSTITUTES) return false;
  const pw = words(p);
  const iw = words(i);
  // Generic pantry word inside a specific ingredient: "rice" → "basmati rice".
  if (pw.size === 1 && iw.has(p)) return true;
  // Specific pantry item covers a generic ingredient: "palm oil" → "oil".
  if (iw.size === 1 && pw.has(i)) return true;
  return false;
}

export function have(pantry: string[], ingredient: string) {
  return pantry.some((p) => covers(p, ingredient));
}

export type Match = { dish: Dish; have: string[]; need: string[]; ratio: number };

export function matchDish(dish: Dish, pantry: string[]): Match {
  const haveList: string[] = [];
  const needList: string[] = [];
  for (const ing of dish.ingredients) (have(pantry, ing) ? haveList : needList).push(ing);
  return { dish, have: haveList, need: needList, ratio: haveList.length / dish.ingredients.length };
}

export function rankDishes(pantry: string[]): Match[] {
  return DISHES.map((d) => matchDish(d, pantry)).sort(
    (a, b) => a.need.length - b.need.length || b.ratio - a.ratio || a.dish.minutes - b.dish.minutes,
  );
}

const STAPLES = ["rice", "salt", "garlic", "ginger", "butter", "flour", "sugar", "lemon", "lime", "curry powder", "thyme", "stock cubes", "chicken", "beef", "goat meat", "fish", "plantain", "yam"];

/** Everything the app knows about, for autocomplete. */
export const KNOWN_INGREDIENTS: string[] = Array.from(
  new Set([...DISHES.flatMap((d) => d.ingredients), ...STAPLES].map(norm)),
).sort();

export function titleCase(s: string) {
  return s.replace(/\b([a-z])/g, (c) => c.toUpperCase());
}

export function cleanItem(raw: string) {
  return titleCase(norm(raw));
}
