export type Dish = { name: string; story: string; keyIngredients: string[]; technique: string };
export type People = { region: "West Africa" | "East Africa" | "Diaspora" | "Indigenous"; people: string; modernArea: string; dishes: Dish[] };

export const PEOPLES: People[] = [
  { region: "West Africa", people: "Wolof", modernArea: "Senegal", dishes: [
    { name: "Thieboudienne (Ceebu Jën)", story: "The ORIGINAL Jollof. Broken rice cooked in rich tomato-fish broth.", keyIngredients: ["broken rice","fish","tomato","tamarind","cabbage"], technique: "One-pot tomato broth, fish stuffed with rof parsley mix" },
    { name: "Yassa", story: "Marinated chicken/fish in onion-lemon-mustard.", keyIngredients: ["onion","lemon","mustard","chicken"], technique: "Long onion marinade, char then braise" },
  ]},
  { region: "West Africa", people: "Yoruba", modernArea: "SW Nigeria / Benin", dishes: [
    { name: "Party Jollof (Yoruba Style)", story: "Smoky firewood long-grain Jollof, bay leaf heavy.", keyIngredients: ["long grain rice","tomato","scotch bonnet","bay leaf","smoke"], technique: "Fry pepper base in oil, steam rice, burn bottom for smoke" },
    { name: "Efo Riro", story: "Rich spinach stew with locust beans and assorted meat.", keyIngredients: ["spinach","palm oil","iru","scotch bonnet"], technique: "No water - peppers and oil emulsify" },
    { name: "Amala + Ewedu + Gbegiri", story: "Yam flour swallow with jute leaf and bean soup.", keyIngredients: ["yam flour","ewedu","beans","palm oil"], technique: "Whisk ewedu to draw, amala lump-free" },
  ]},
  { region: "West Africa", people: "Igbo", modernArea: "SE Nigeria", dishes: [
    { name: "Egusi Soup", story: "Ground melon seed soup, lumpy Igbo style with bitter leaf.", keyIngredients: ["egusi","palm oil","bitter leaf","stockfish"], technique: "Fry egusi paste into lumps, don't stir smooth" },
    { name: "Ofe Nsala", story: "White soup, no palm oil, yam thickened, uziza spice.", keyIngredients: ["yam","uziza","catfish","utazi"], technique: "Pounded yam as thickener" },
  ]},
  { region: "West Africa", people: "Hausa-Fulani", modernArea: "N Nigeria / Niger", dishes: [
    { name: "Suya", story: "Peanut-spice grilled meat, yaji spice is sacred.", keyIngredients: ["beef","yaji peanut spice","onion"], technique: "Dry peanut rub, high grill" },
    { name: "Tuwo Shinkafa", story: "Soft mashed rice swallow with Miyan Kuka baobab soup.", keyIngredients: ["short rice","baobab leaf","dawadawa"], technique: "Mash rice smooth, no lumps" },
  ]},
  { region: "West Africa", people: "Akan", modernArea: "Ghana", dishes: [
    { name: "Ghana Jollof", story: "Fragrant basmati, sweeter tomato, served with shito.", keyIngredients: ["basmati rice","tomato","ginger","shito"], technique: "Perfumed rice, separate shito black pepper sauce" },
    { name: "Waakye", story: "Rice and beans cooked with sorghum leaves for red color.", keyIngredients: ["rice","black eyed beans","waakye leaves"], technique: "Leaves give color and earthy flavor" },
    { name: "Fufu + Light Soup", story: "Pounded cassava+plantain, light tomato soup, no palm oil.", keyIngredients: ["cassava","plantain","tomato","garden eggs"], technique: "Pound fufu silky, soup stays light" },
  ]},
  { region: "East Africa", people: "Amhara / Tigray", modernArea: "Ethiopia / Eritrea", dishes: [
    { name: "Injera + Doro Wat", story: "Teff sourdough flatbread with berbere chicken stew and egg.", keyIngredients: ["teff","berbere","niter kibbeh","chicken","egg"], technique: "Ferment teff 3 days, slow onion base no oil first" },
    { name: "Shiro Wat", story: "Chickpea flour stew, fasting/vegan staple.", keyIngredients: ["shiro powder","berbere","onion"], technique: "Whisk shiro to avoid lumps" },
  ]},
  { region: "East Africa", people: "Oromo", modernArea: "Ethiopia", dishes: [
    { name: "Chechebsa", story: "Torn kita bread in spiced butter and berbere, breakfast.", keyIngredients: ["flatbread","niter kibbeh","berbere"], technique: "Shred hot bread into butter" },
  ]},
  { region: "East Africa", people: "Swahili Coast", modernArea: "Kenya / Tanzania / Zanzibar", dishes: [
    { name: "Swahili Pilau", story: "Coastal spiced rice with whole garam, coconut routes.", keyIngredients: ["basmati","cardamom","cloves","cumin","beef"], technique: "Brown onions dark, whole spices, no tomato" },
    { name: "Mchuzi wa Samaki", story: "Fish in coconut curry with tamarind and lime.", keyIngredients: ["fish","coconut milk","tamarind","turmeric"], technique: "Coconut + sour balance" },
  ]},
  { region: "East Africa", people: "Kikuyu", modernArea: "Kenya", dishes: [
    { name: "Githeri", story: "Beans and corn boiled together, avocado on side.", keyIngredients: ["beans","maize","avocado","potato"], technique: "One-pot boil, then fry with onion" },
    { name: "Mukimo", story: "Mashed potato, corn, beans, pumpkin leaves green mash.", keyIngredients: ["potato","corn","beans","greens"], technique: "Mash green, keep texture" },
  ]},
  { region: "East Africa", people: "Luo", modernArea: "Kenya / Uganda", dishes: [
    { name: "Ugali + Fried Tilapia", story: "Firm cornmeal with whole lake tilapia and osuga greens.", keyIngredients: ["cornmeal","tilapia","tomato","greens"], technique: "Ugali firm enough to slice, fish crispy" },
  ]},
  { region: "East Africa", people: "Baganda", modernArea: "Uganda", dishes: [
    { name: "Matooke + Luwombo", story: "Steamed green banana mash, meat steamed in banana leaf.", keyIngredients: ["matooke banana","groundnut","banana leaf"], technique: "Steam in leaf adds aroma" },
  ]},
  { region: "East Africa", people: "Somali", modernArea: "Somalia", dishes: [
    { name: "Bariis Iskukaris", story: "Spiced basmati with raisins, xawaash spice, fried onion top.", keyIngredients: ["basmati","xawaash","raisins","cardamom"], technique: "Separate spiced oil, steam rice" },
    { name: "Canjeero", story: "Fermented pancake, cousin to Injera but smaller/thicker.", keyIngredients: ["flour","corn flour"], technique: "Overnight ferment, one-side cook" },
  ]},
];

export const JOLLOF_BATTLE = {
  id: "jollof-wars",
  title: "JOLLOF WARS",
  baseIngredients: ["rice","tomato","onion","scotch bonnet","oil"],
  contenders: [
    { people: "Wolof - Senegal", dish: "Thieboudienne", elo: 1765, rice: "Broken rice", tomatoBase: "Rich fish tomato broth", smoke: "Low", secret: "Tamarind + stuffed fish", technique: "One-pot, fish first" },
    { people: "Yoruba - Nigeria", dish: "Party Jollof", elo: 1842, rice: "Long grain parboiled", tomatoBase: "Fried pepper mix, bay leaf", smoke: "HIGH - party smoke", secret: "Burnt bottom + bay leaf", technique: "Fry base, steam, smoke" },
    { people: "Akan - Ghana", dish: "Ghana Jollof", elo: 1791, rice: "Basmati", tomatoBase: "Sweeter, ginger forward", smoke: "Medium", secret: "Shito on side", technique: "Fragrant, perfume rice" },
    { people: "Cameroon", dish: "Cameroon Jollof", elo: 1690, rice: "Long grain", tomatoBase: "Tomato + curry + carrot/peas", smoke: "Medium", secret: "Mixed veg + curry", technique: "Veg folded in" },
    { people: "Sierra Leone", dish: "Sierra Leone Jollof", elo: 1620, rice: "Long grain", tomatoBase: "Groundnut hint + tomato", smoke: "Medium", secret: "Peanut undertone", technique: "Rich, nutty base" },
  ]
};

export const OTHER_BATTLES = [
  { id: "swallow", title: "Swallow Battle: Fufu vs Ugali vs Sadza", items: ["Akan Fufu (cassava+plantain pounded)","Luo Ugali (firm cornmeal)","Shona Sadza (white corn, smooth)"], base: ["cassava/corn","water"] },
  { id: "groundnut", title: "Groundnut Stew Battle", items: ["Wolof Mafé (Senegal)","Akan Groundnut Stew (Ghana)","Baganda Groundnut Sauce (Uganda)"], base: ["peanut","tomato","meat"] },
  { id: "fermented-bread", title: "Fermented Bread Battle", items: ["Amhara Injera (teff, large, sour)","Somali Canjeero (small, spongy)","South Asian Dosa (rice/lentil, crispy)"], base: ["fermented batter"] },
];

export const SACRED_NO_SUB: Record<string, {storeType: string; stores: string[]; tip: string}> = {
  "palm oil": { storeType: "African Market", stores: ["African grocery","Caribbean market"], tip: "Ask for red palm oil, not palm kernel oil." },
  "berbere": { storeType: "Habesha / Ethiopian Market", stores: ["Ethiopian market","Eritrean market","Middle Eastern grocery"], tip: "Real berbere should be brick-red and aromatic." },
  "egusi": { storeType: "African Market", stores: ["African grocery","Nigerian market"], tip: "Ask for ground egusi / melon seeds." },
  "broken rice": { storeType: "Asian / African Market", stores: ["Asian market","African grocery"], tip: "For Thieboudienne, broken jasmine is closest." },
  "teff": { storeType: "Habesha / Health Store", stores: ["Ethiopian market","health food store"], tip: "Ivory teff is milder, brown is nuttier." },
  "plantain": { storeType: "African / Latino / Caribbean Market", stores: ["African grocery","Mercado Latino","Caribbean market"], tip: "Yellow-black skin = sweet ripe." },
  "coconut milk": { storeType: "Asian / Swahili / Halal Market", stores: ["Asian market","H Mart","Halal grocery"], tip: "Full-fat canned, not carton drink." },
};

export function getSOS(item: string, mode: "BROKE"|"AUTHENTIC"|"FASTEST", pantry: string[]) {
  const key = item.toLowerCase();
  const sacred = SACRED_NO_SUB[key];
  if (mode === "AUTHENTIC" && sacred) {
    return { type: "STORE" as const, worthTrip: 9, title: `No authentic sub for ${item}`, body: `For this tribe's dish, don't fake it. Go to a ${sacred.storeType}. ${sacred.tip}`, stores: sacred.stores, probability: 88 };
  }
  if (mode === "BROKE") {
    return { type: "SUB" as const, worthTrip: 3, title: `Broke Mode sub for ${item}`, body: pantry.length ? `Use what you have: ${pantry.slice(0,3).join(", ")}. Add acid (lemon/vinegar) + fat (oil/butter) to mimic richness.` : "Use water + oil + pinch sugar/salt as base sub.", stores: [], probability: 0 };
  }
  return { type: "BOTH" as const, worthTrip: 6, title: `Fastest fix for ${item}`, body: "Use pantry sub now to keep cooking, order real item for next time.", stores: sacred?.stores ?? ["Walmart","Kroger","Target","Asian market"], probability: sacred ? 85 : 95 };
}

export function applyVote(eloWinner: number, eloLoser: number) {
  return { winner: eloWinner + 12, loser: Math.max(1000, eloLoser - 6) };
}