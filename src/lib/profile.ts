import { useMemo } from "react";
import { DISHES, PEOPLES, peopleById, type Dish } from "@/data/dishes";
import type { Match } from "@/lib/pantry";
import { usePersistentState } from "@/lib/storage";

export type Spice = "mild" | "medium" | "hot";
export type TimePref = "quick" | "any";

export type Profile = {
  /** People ids from PEOPLES (e.g. "yoruba") plus free-text traditions (e.g. "Jamaican"). */
  roots: string[];
  spice: Spice;
  time: TimePref;
  /** True once the person finished or skipped first-run onboarding. */
  done: boolean;
};

export const DEFAULT_PROFILE: Profile = { roots: [], spice: "medium", time: "any", done: false };

/** Suggested traditions outside our curated peoples. Free text — anything typed is kept too. */
export const OTHER_TRADITIONS = ["Jamaican", "Haitian", "Trinidadian", "Southern US", "Mexican", "Filipino"];

/**
 * Atlantic-diaspora kitchens with strong West African roots (rice-and-peas, okra, black-eyed peas,
 * scotch bonnet, one-pot rice). They get a small nudge toward West African dishes.
 */
const WEST_AFRICAN_DIASPORA = new Set(["jamaican", "haitian", "trinidadian", "southern us", "caribbean", "barbadian", "guyanese", "brazilian", "bahian", "gullah", "geechee", "creole", "cajun", "puerto rican", "dominican", "cuban"]);

/** Fixed default + migration guard: old or partial stored values never crash. */
function normalize(p: Partial<Profile> | null | undefined): Profile {
  const roots = Array.isArray(p?.roots) ? p!.roots.filter((r): r is string => typeof r === "string" && r.trim() !== "") : [];
  const spice: Spice = p?.spice === "mild" || p?.spice === "hot" ? p.spice : "medium";
  const time: TimePref = p?.time === "quick" ? "quick" : "any";
  return { roots, spice, time, done: p?.done === true };
}

export function useProfile() {
  const [raw, setRaw] = usePersistentState<Profile>("profile", DEFAULT_PROFILE);
  const profile = useMemo(() => normalize(raw), [raw]);
  return [profile, setRaw] as const;
}

export const isPeopleId = (root: string) => root in peopleById;

const HEAT = ["scotch bonnet", "yaji", "berbere", "mitmita", "pili pili", "chili", "habanero", "hot pepper", "shito"];

export function isSpicy(dish: Dish) {
  return dish.ingredients.some((i) => HEAT.some((h) => i.toLowerCase().includes(h)));
}

/** Dishes from the peoples the person picked (curated list only). */
export function dishesFromRoots(profile: Profile): Dish[] {
  const ids = new Set(profile.roots.filter(isPeopleId));
  return DISHES.filter((d) => ids.has(d.peopleId));
}

/**
 * Ranking bonus for a dish. Never decides ranking alone — rankWithProfile only uses it
 * to break ties between dishes that need the same number of ingredients.
 */
export function boostForProfile(dish: Dish, profile: Profile): number {
  let score = 0;
  const people = peopleById[dish.peopleId];
  const chosenIds = profile.roots.filter(isPeopleId);
  const others = profile.roots.filter((r) => !isPeopleId(r)).map((r) => r.trim().toLowerCase());

  if (chosenIds.includes(dish.peopleId)) score += 10;
  else if (people && chosenIds.some((id) => peopleById[id].region === people.region)) score += 3;

  // AI-written dishes carry a free-text origin instead of a people id.
  if (dish.origin && others.some((o) => dish.origin!.toLowerCase().includes(o))) score += 10;

  if (people?.region === "West Africa" && others.some((o) => WEST_AFRICAN_DIASPORA.has(o))) score += 1.5;

  if (profile.time === "quick" && dish.minutes <= 45) score += 2;
  if (profile.time === "quick" && dish.ahead) score -= 1;

  const spicy = isSpicy(dish);
  if (profile.spice === "hot" && spicy) score += 1;
  if (profile.spice === "mild" && spicy) score -= 1;

  return score;
}

/**
 * Re-sort rankDishes() output. Fewest missing ingredients stays the primary key, so the
 * profile never pushes a dish you can't cook above one you can. Within the same missing
 * count, the profile boost decides, then the original order (ratio, then time).
 */
export function rankWithProfile(matches: Match[], profile: Profile): Match[] {
  if (profile.roots.length === 0 && profile.time === "any" && profile.spice === "medium") return matches;
  const boost = new Map(matches.map((m) => [m.dish.id, boostForProfile(m.dish, profile)]));
  return matches
    .map((m, i) => ({ m, i }))
    .sort((a, b) => a.m.need.length - b.m.need.length || boost.get(b.m.dish.id)! - boost.get(a.m.dish.id)! || a.i - b.i)
    .map(({ m }) => m);
}

function listJoin(items: string[]) {
  if (items.length <= 1) return items.join("");
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

export function rootLabel(root: string) {
  return peopleById[root]?.name ?? root.trim();
}

/** One line for the concierge system prompt, e.g. "Grew up on Yoruba and Jamaican cooking; likes it hot; prefers quick meals". */
export function profileSummary(profile: Profile): string {
  const parts: string[] = [];
  if (profile.roots.length) parts.push(`Grew up on ${listJoin(profile.roots.map(rootLabel))} cooking`);
  parts.push(profile.spice === "hot" ? "likes it hot" : profile.spice === "mild" ? "prefers mild heat" : "likes medium heat");
  parts.push(profile.time === "quick" ? "prefers quick meals (45 minutes or less)" : "happy to cook long dishes");
  const line = parts.join("; ");
  return line.charAt(0).toUpperCase() + line.slice(1);
}

/** Peoples grouped for the onboarding picker. */
export function peoplesByRegion() {
  return {
    "West Africa": PEOPLES.filter((p) => p.region === "West Africa"),
    "East Africa": PEOPLES.filter((p) => p.region === "East Africa"),
  };
}
