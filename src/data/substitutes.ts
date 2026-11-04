export type SubMode = "cheapest" | "authentic" | "fastest";

export type Substitute = {
  /** What to use instead, from a typical kitchen. */
  swap: string;
  /** How much the swap changes the dish. */
  tradeoff: string;
  /** True when the dish isn't really itself without the real thing. */
  essential: boolean;
  /** The kind of shop that reliably stocks it. */
  shop: string;
  /** Search phrase that works on Maps and delivery apps. */
  search: string;
  tip?: string;
};

export const SUBSTITUTES: Record<string, Substitute> = {
  "palm oil": {
    swap: "Vegetable oil with 1 tsp paprika per ¼ cup",
    tradeoff: "Gets the colour, not the flavour. Egusi and efo riro will taste flatter.",
    essential: true, shop: "African grocery", search: "red palm oil",
    tip: "Ask for red palm oil, not palm kernel oil.",
  },
  "berbere": {
    swap: "Paprika, cayenne, a pinch each of fenugreek, cardamom and clove",
    tradeoff: "Close in heat and colour, missing the dried-chili depth.",
    essential: true, shop: "Ethiopian market", search: "berbere spice",
    tip: "Good berbere is brick-red and smells sweet as well as hot.",
  },
  "egusi": {
    swap: "Ground pumpkin seeds (pepitas)",
    tradeoff: "Similar richness. Won't set into curds quite the same way.",
    essential: true, shop: "African grocery", search: "ground egusi",
    tip: "Buy it ground, or grind whole seeds in a spice grinder.",
  },
  "broken rice": {
    swap: "Jasmine rice, pulsed briefly in a blender",
    tradeoff: "Works well — broken jasmine is what many Senegalese cooks use abroad.",
    essential: false, shop: "Asian market", search: "broken jasmine rice",
  },
  "teff flour": {
    swap: "Half teff, half self-raising flour — or all wheat in a pinch",
    tradeoff: "Without teff, injera loses its sourness and colour.",
    essential: true, shop: "Ethiopian market", search: "teff flour",
    tip: "Ivory teff is milder, brown teff is nuttier.",
  },
  "plantain": {
    swap: "Firm sweet potato",
    tradeoff: "Different texture. Fine in soups, not for frying.",
    essential: false, shop: "Latin or Caribbean market", search: "plantain",
    tip: "Black-skinned = ripe and sweet. Green = starchy, for boiling.",
  },
  "coconut milk": {
    swap: "Whole milk or cream with a squeeze of lime",
    tradeoff: "Rich but not coconutty. Thinner sauce.",
    essential: false, shop: "Any supermarket", search: "full fat coconut milk",
    tip: "Full-fat canned, not the carton drink.",
  },
  "scotch bonnet": {
    swap: "Habanero, or ½ tsp cayenne",
    tradeoff: "Habanero is almost identical. Cayenne lacks the fruitiness.",
    essential: false, shop: "Any supermarket", search: "habanero pepper",
  },
  "iru": {
    swap: "1 tsp miso or a few drops of fish sauce",
    tradeoff: "Adds the savoury depth, not the funk.",
    essential: true, shop: "African grocery", search: "iru locust beans",
  },
  "dawadawa": {
    swap: "1 tsp miso or a few drops of fish sauce",
    tradeoff: "Adds the savoury depth, not the funk.",
    essential: true, shop: "African grocery", search: "dawadawa",
  },
  "niter kibbeh": {
    swap: "Butter warmed with garlic, ginger, cardamom and fenugreek, then strained",
    tradeoff: "A good homemade version — this is how many people make it anyway.",
    essential: false, shop: "Ethiopian market", search: "niter kibbeh",
  },
  "xawaash": {
    swap: "Cumin, coriander, black pepper, cardamom and cinnamon, toasted and ground",
    tradeoff: "This is the blend — make it at home.",
    essential: false, shop: "Somali or halal grocery", search: "xawaash spice",
  },
  "shito": {
    swap: "Chili crisp with a little dried shrimp",
    tradeoff: "Same idea, different accent.",
    essential: false, shop: "African grocery", search: "shito pepper sauce",
  },
  "bitter leaf": {
    swap: "Kale or spinach",
    tradeoff: "Loses the bitterness that defines the soup.",
    essential: true, shop: "African grocery", search: "dried bitter leaf",
  },
  "stockfish": {
    swap: "Smoked mackerel or anchovies",
    tradeoff: "Gives smokiness and salt, not the chewy texture.",
    essential: false, shop: "African grocery", search: "stockfish",
  },
  "crayfish": {
    swap: "Dried shrimp, ground",
    tradeoff: "Very close.",
    essential: false, shop: "Asian or African grocery", search: "ground crayfish",
  },
  "uziza": {
    swap: "Cracked black pepper and a little allspice",
    tradeoff: "Similar warmth, less perfume.",
    essential: true, shop: "African grocery", search: "uziza seeds",
  },
  "tamarind": {
    swap: "Lime juice with a little brown sugar",
    tradeoff: "Sour enough, less fruity.",
    essential: false, shop: "Asian or Latin market", search: "tamarind paste",
  },
  "yam flour": {
    swap: "None that behaves the same",
    tradeoff: "Amala needs elubo. Try a different swallow tonight.",
    essential: true, shop: "African grocery", search: "elubo yam flour",
  },
  "shiro powder": {
    swap: "Chickpea flour with berbere",
    tradeoff: "Close, missing the spice mix ground into real shiro.",
    essential: false, shop: "Ethiopian market", search: "shiro powder",
  },
  "waakye leaves": {
    swap: "A pinch of baking soda alone",
    tradeoff: "Gets some colour, no earthiness.",
    essential: true, shop: "African grocery", search: "waakye leaves",
  },
};

const GENERIC: Substitute = {
  swap: "No common swap",
  tradeoff: "Buy it, or pick a dish that doesn't need it.",
  essential: false, shop: "Supermarket", search: "",
};

export function substituteFor(ingredient: string): Substitute {
  const key = ingredient.toLowerCase().trim();
  return SUBSTITUTES[key] ?? { ...GENERIC, search: key };
}

export function mapsUrl(search: string) {
  return `https://www.google.com/maps/search/${encodeURIComponent(search + " near me")}`;
}

export function instacartUrl(search: string) {
  return `https://www.instacart.com/store/s?k=${encodeURIComponent(search)}`;
}
