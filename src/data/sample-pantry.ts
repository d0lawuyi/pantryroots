/** Optional demo ingredients; never assumed to be in a new user's kitchen. */
export const SAMPLE_PANTRY = ["Rice", "Tomato", "Tomato Paste", "Onion", "Scotch Bonnet", "Palm Oil", "Garlic", "Ginger", "Vegetable Oil", "Red Bell Pepper", "Bay Leaf"];

export function matchesSamplePantry(pantry: string[]) {
  const names = new Set(pantry.map((item) => item.trim().toLowerCase()));
  return names.size === SAMPLE_PANTRY.length && SAMPLE_PANTRY.every((item) => names.has(item.toLowerCase()));
}
