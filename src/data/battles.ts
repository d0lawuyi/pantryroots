export type Contender = {
  id: string;
  dish: string;
  origin: string;
  /** Short facts shown on the contender card. */
  notes: { label: string; value: string }[];
  /** Links to a full recipe in DISHES when we have one. */
  dishId?: string;
  rating: number;
};

export type Battle = {
  id: string;
  title: string;
  question: string;
  base: string[];
  contenders: Contender[];
};

export const BATTLES: Battle[] = [
  {
    id: "jollof",
    title: "Jollof",
    question: "Same base, five kitchens. Which jollof do you cook?",
    base: ["rice", "tomato", "onion", "scotch bonnet", "oil"],
    contenders: [
      {
        id: "nigeria", dish: "Party Jollof", origin: "Yoruba, Nigeria", dishId: "party-jollof", rating: 1542,
        notes: [{ label: "Rice", value: "Long-grain parboiled" }, { label: "Smoke", value: "High, burnt bottom" }, { label: "Signature", value: "Fried pepper base, bay leaf" }],
      },
      {
        id: "ghana", dish: "Ghana Jollof", origin: "Akan, Ghana", dishId: "ghana-jollof", rating: 1531,
        notes: [{ label: "Rice", value: "Basmati" }, { label: "Smoke", value: "Medium" }, { label: "Signature", value: "Ginger-forward, shito on the side" }],
      },
      {
        id: "senegal", dish: "Thieboudienne", origin: "Wolof, Senegal", dishId: "thieboudienne", rating: 1518,
        notes: [{ label: "Rice", value: "Broken rice" }, { label: "Smoke", value: "Low" }, { label: "Signature", value: "Fish-tomato broth, tamarind" }],
      },
      {
        id: "cameroon", dish: "Cameroon Jollof", origin: "Cameroon", rating: 1476,
        notes: [{ label: "Rice", value: "Long-grain" }, { label: "Smoke", value: "Medium" }, { label: "Signature", value: "Curry, carrots and peas folded in" }],
      },
      {
        id: "sierra-leone", dish: "Sierra Leone Jollof", origin: "Sierra Leone", rating: 1463,
        notes: [{ label: "Rice", value: "Long-grain" }, { label: "Smoke", value: "Medium" }, { label: "Signature", value: "Groundnut undertone" }],
      },
    ],
  },
  {
    id: "swallow",
    title: "Swallow",
    question: "Starch, water and a strong arm. Which swallow wins?",
    base: ["starch", "water"],
    contenders: [
      { id: "fufu", dish: "Fufu", origin: "Akan, Ghana", dishId: "fufu-light-soup", rating: 1520, notes: [{ label: "Made from", value: "Cassava and plantain, pounded" }, { label: "Texture", value: "Soft, stretchy" }] },
      { id: "ugali", dish: "Ugali", origin: "Luo, Kenya", dishId: "ugali-tilapia", rating: 1505, notes: [{ label: "Made from", value: "White cornmeal" }, { label: "Texture", value: "Firm enough to slice" }] },
      { id: "sadza", dish: "Sadza", origin: "Shona, Zimbabwe", rating: 1490, notes: [{ label: "Made from", value: "White maize meal" }, { label: "Texture", value: "Smooth, dense" }] },
      { id: "amala", dish: "Amala", origin: "Yoruba, Nigeria", dishId: "amala", rating: 1485, notes: [{ label: "Made from", value: "Yam flour" }, { label: "Texture", value: "Soft, earthy, dark" }] },
    ],
  },
  {
    id: "groundnut",
    title: "Groundnut stew",
    question: "Peanut, tomato, meat. Whose groundnut stew?",
    base: ["peanut", "tomato", "meat"],
    contenders: [
      { id: "mafe", dish: "Mafé", origin: "Wolof, Senegal", rating: 1515, notes: [{ label: "Style", value: "Thick, with root vegetables" }] },
      { id: "nkate", dish: "Nkatenkwan", origin: "Akan, Ghana", rating: 1500, notes: [{ label: "Style", value: "Thinner soup, eaten with fufu" }] },
      { id: "luwombo", dish: "Groundnut Luwombo", origin: "Baganda, Uganda", dishId: "matooke", rating: 1485, notes: [{ label: "Style", value: "Steamed in banana leaf" }] },
    ],
  },
  {
    id: "fermented-bread",
    title: "Fermented flatbread",
    question: "A sour batter and a hot pan. Which bread?",
    base: ["fermented batter"],
    contenders: [
      { id: "injera", dish: "Injera", origin: "Amhara & Tigray", dishId: "doro-wat", rating: 1525, notes: [{ label: "Grain", value: "Teff" }, { label: "Character", value: "Large, thin, very sour" }] },
      { id: "canjeero", dish: "Canjeero", origin: "Somali", dishId: "canjeero", rating: 1495, notes: [{ label: "Grain", value: "Wheat and corn" }, { label: "Character", value: "Small, thick, spongy" }] },
      { id: "dosa", dish: "Dosa", origin: "South India", rating: 1480, notes: [{ label: "Grain", value: "Rice and lentil" }, { label: "Character", value: "Thin and crisp" }] },
    ],
  },
];

/** Standard Elo update. K = 24 keeps single votes meaningful without letting one person swing the table. */
export function eloUpdate(winner: number, loser: number, k = 24) {
  const expected = 1 / (1 + 10 ** ((loser - winner) / 400));
  const delta = Math.round(k * (1 - expected));
  return { winner: winner + delta, loser: loser - delta, delta };
}
