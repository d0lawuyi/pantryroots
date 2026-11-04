export type Region = "West Africa" | "East Africa";

/** Dominant colour of the finished dish — drives the small swatch shown next to it. */
export type Tone = "red" | "green" | "gold" | "brown" | "cream" | "orange";

export type People = {
  id: string;
  name: string;
  area: string;
  region: Region;
};

export type Dish = {
  id: string;
  name: string;
  peopleId: string;
  summary: string;
  /** Total hands-on + cooking time in minutes, excluding overnight ferments/marinades. */
  minutes: number;
  /** Extra waiting time that happens before you cook (fermenting, marinating). */
  ahead?: string;
  tone: Tone;
  ingredients: string[];
  technique: string;
  steps: string[];
};

export const PEOPLES: People[] = [
  { id: "wolof", name: "Wolof", area: "Senegal", region: "West Africa" },
  { id: "yoruba", name: "Yoruba", area: "South-west Nigeria, Benin", region: "West Africa" },
  { id: "igbo", name: "Igbo", area: "South-east Nigeria", region: "West Africa" },
  { id: "hausa", name: "Hausa-Fulani", area: "Northern Nigeria, Niger", region: "West Africa" },
  { id: "akan", name: "Akan", area: "Ghana", region: "West Africa" },
  { id: "habesha", name: "Amhara & Tigray", area: "Ethiopia, Eritrea", region: "East Africa" },
  { id: "oromo", name: "Oromo", area: "Ethiopia", region: "East Africa" },
  { id: "swahili", name: "Swahili Coast", area: "Kenya, Tanzania, Zanzibar", region: "East Africa" },
  { id: "kikuyu", name: "Kikuyu", area: "Kenya", region: "East Africa" },
  { id: "luo", name: "Luo", area: "Kenya, Uganda", region: "East Africa" },
  { id: "baganda", name: "Baganda", area: "Uganda", region: "East Africa" },
  { id: "somali", name: "Somali", area: "Somalia", region: "East Africa" },
];

export const DISHES: Dish[] = [
  {
    id: "thieboudienne", name: "Thieboudienne", peopleId: "wolof", minutes: 120, tone: "orange",
    summary: "Senegal's national dish: fish and vegetables braised in tomato broth, with broken rice cooked in what's left. Many cooks call it the ancestor of jollof.",
    ingredients: ["broken rice", "fish", "tomato paste", "onion", "tamarind", "cabbage", "carrot", "parsley"],
    technique: "Stuff the fish with rof (pounded parsley, garlic, chili) and cook the rice last, in the broth, so it drinks up everything.",
    steps: [
      "Pound parsley, garlic, chili and a little onion into rof. Cut slits in the fish and pack them with it.",
      "Brown the fish in oil and set it aside. In the same oil, fry sliced onion and tomato paste until dark red.",
      "Add water, tamarind, the fish and the vegetables. Simmer until the vegetables are tender, then lift everything out.",
      "Wash the broken rice and cook it in the broth, covered, until it has absorbed it. Let the bottom crisp — that's the xoon.",
      "Serve the rice with the fish and vegetables on top, and lime on the side.",
    ],
  },
  {
    id: "yassa", name: "Yassa", peopleId: "wolof", minutes: 90, ahead: "Marinate overnight", tone: "gold",
    summary: "Chicken or fish in a sharp, sweet sauce of slow-cooked onions, lemon and mustard.",
    ingredients: ["chicken", "onion", "lemon", "mustard", "garlic", "scotch bonnet"],
    technique: "Use far more onion than seems right, and char the meat before it goes back into the sauce.",
    steps: [
      "Marinate the chicken overnight with sliced onions, lemon juice, mustard, garlic and chili.",
      "Lift the chicken out and grill or pan-char it until it has colour.",
      "Cook the marinated onions slowly until soft and golden, then add the marinade liquid.",
      "Return the chicken and braise for 20–30 minutes. Serve over white rice.",
    ],
  },
  {
    id: "party-jollof", name: "Party Jollof", peopleId: "yoruba", minutes: 75, tone: "red",
    summary: "Long-grain rice steamed in a fried pepper base, heavy on bay leaf, with the smoky bottom that makes it party food.",
    ingredients: ["long grain rice", "tomato", "red bell pepper", "scotch bonnet", "onion", "tomato paste", "bay leaf", "vegetable oil"],
    technique: "Reduce the pepper base before the rice goes in, then steam under foil with very little liquid.",
    steps: [
      "Blend tomatoes, red bell pepper, scotch bonnet and onion. Boil the blend down until thick.",
      "Fry sliced onion and tomato paste in oil, add the reduced base, then thyme, curry powder, bay leaf and stock.",
      "Stir in washed parboiled rice with just enough stock to cover. Seal with foil and a lid and steam on low.",
      "For the last few minutes turn the heat up and let the bottom catch. Don't stir it in — serve it on the side.",
    ],
  },
  {
    id: "efo-riro", name: "Efo Riro", peopleId: "yoruba", minutes: 45, tone: "green",
    summary: "A rich spinach stew built on palm oil, peppers and iru (fermented locust beans).",
    ingredients: ["spinach", "palm oil", "iru", "scotch bonnet", "red bell pepper", "onion", "crayfish"],
    technique: "Almost no water — the pepper and palm oil fry together until the oil rises to the top.",
    steps: [
      "Blanch the spinach, then squeeze out as much water as you can.",
      "Blend the peppers and onion coarsely and boil the mix down until thick.",
      "Fry onion and iru in palm oil, add the pepper mix, crayfish and any cooked meat or fish. Fry until the oil separates.",
      "Fold in the spinach and cook for 2–3 minutes only.",
    ],
  },
  {
    id: "amala", name: "Amala, Ewedu & Gbegiri", peopleId: "yoruba", minutes: 75, tone: "brown",
    summary: "Yam-flour swallow served with jute-leaf soup and a smooth bean soup — the Ibadan classic.",
    ingredients: ["yam flour", "jute leaves", "black-eyed beans", "palm oil", "iru"],
    technique: "Whisk the ewedu until it stretches, and turn the amala hard so there are no lumps.",
    steps: [
      "Gbegiri: cook peeled beans until very soft, mash smooth, then simmer with palm oil, pepper and iru.",
      "Ewedu: boil jute leaves with iru and a little potash, then whisk until the soup turns silky and stretchy.",
      "Amala: take boiling water off the heat, whisk in yam flour, and turn it hard until smooth. Cover and steam for 2 minutes.",
      "Serve together, ideally with a pepper stew.",
    ],
  },
  {
    id: "egusi", name: "Egusi Soup", peopleId: "igbo", minutes: 60, tone: "gold",
    summary: "Ground melon-seed soup, cooked Igbo-style so the egusi sets in lumps, finished with bitter leaf.",
    ingredients: ["egusi", "palm oil", "bitter leaf", "stockfish", "onion", "crayfish", "scotch bonnet"],
    technique: "Drop the egusi paste into the hot oil and leave it alone so it sets into curds before stirring.",
    steps: [
      "Mix the ground egusi with a little water and chopped onion into a thick paste.",
      "Heat palm oil, fry onion, then drop the paste in by the spoonful. Let it set into lumps before you stir.",
      "Add stock, stockfish, meat, pepper and crayfish. Simmer for 15 minutes.",
      "Add washed bitter leaf and simmer for 5 more minutes.",
    ],
  },
  {
    id: "ofe-nsala", name: "Ofe Nsala", peopleId: "igbo", minutes: 50, tone: "cream",
    summary: "\"White soup\": no palm oil, thickened with pounded yam and perfumed with uziza.",
    ingredients: ["yam", "catfish", "uziza", "utazi", "crayfish", "scotch bonnet"],
    technique: "The yam is the thickener, so pound it smooth before it goes in.",
    steps: [
      "Boil the yam until soft, then pound it smooth.",
      "Simmer the catfish in stock with crayfish, pepper and ground uziza seed.",
      "Add the pounded yam in small lumps and stir until it dissolves and thickens the soup.",
      "Finish with sliced utazi leaves.",
    ],
  },
  {
    id: "suya", name: "Suya", peopleId: "hausa", minutes: 40, tone: "brown",
    summary: "Thin beef skewers crusted in yaji, a peanut and chili spice blend, grilled hot.",
    ingredients: ["beef", "yaji", "peanuts", "onion", "tomato"],
    technique: "A dry rub, a hot grill and a second dusting of yaji once it's off the fire.",
    steps: [
      "Slice the beef thin and thread it onto skewers.",
      "Rub with a little oil and salt, then press yaji onto every side.",
      "Grill hot and fast, turning once. Dust with more yaji as it comes off.",
      "Serve with raw sliced onion and tomato.",
    ],
  },
  {
    id: "tuwo", name: "Tuwo Shinkafa & Miyan Kuka", peopleId: "hausa", minutes: 60, tone: "green",
    summary: "Soft rice swallow with a soup of baobab leaf and dawadawa.",
    ingredients: ["short grain rice", "baobab leaf", "dawadawa", "dried fish", "scotch bonnet"],
    technique: "Overcook the rice on purpose, then beat it smooth.",
    steps: [
      "Boil short-grain rice in extra water until very soft.",
      "Mash and turn with a wooden spoon until smooth, then shape into balls.",
      "For the soup, simmer stock with dawadawa, pepper and dried fish.",
      "Take it off the boil and whisk in the baobab leaf powder.",
    ],
  },
  {
    id: "ghana-jollof", name: "Ghana Jollof", peopleId: "akan", minutes: 60, tone: "red",
    summary: "Fragrant basmati in a sweeter, ginger-forward tomato base, served with shito.",
    ingredients: ["basmati rice", "tomato", "tomato paste", "onion", "ginger", "garlic", "shito"],
    technique: "Perfumed rice, cooked through but separate — the heat comes from shito on the side.",
    steps: [
      "Fry onion, ginger and garlic in oil. Add tomato paste and blended tomatoes and cook down.",
      "Season with stock, curry powder and thyme.",
      "Add washed basmati and just enough liquid to cover. Cover and steam on low until fluffy.",
      "Serve with shito.",
    ],
  },
  {
    id: "waakye", name: "Waakye", peopleId: "akan", minutes: 70, ahead: "Soak beans overnight", tone: "brown",
    summary: "Rice and beans cooked with dried sorghum leaves, which turn it red-brown.",
    ingredients: ["rice", "black-eyed beans", "waakye leaves", "shito"],
    technique: "The leaves give the colour and an earthy flavour. Pull them out before serving.",
    steps: [
      "Boil the soaked beans with waakye leaves and a pinch of baking soda until nearly soft.",
      "Add the rice and enough water to cook it. Cover and cook until the rice is done.",
      "Remove the leaves. Serve with shito, gari, boiled egg and spaghetti.",
    ],
  },
  {
    id: "fufu-light-soup", name: "Fufu & Light Soup", peopleId: "akan", minutes: 90, tone: "orange",
    summary: "Pounded cassava and plantain with a light, peppery tomato soup — no palm oil.",
    ingredients: ["cassava", "plantain", "tomato", "garden eggs", "goat meat", "ginger", "onion"],
    technique: "The soup is blended and strained so it stays thin and clear.",
    steps: [
      "Steam the meat with onion, ginger and pepper in its own juices.",
      "Add water, whole tomatoes, garden eggs and peppers. Boil until soft, then blend and strain back into the pot.",
      "Simmer for 20 minutes.",
      "Boil cassava and plantain, then pound until smooth and stretchy (or use fufu flour).",
    ],
  },
  {
    id: "doro-wat", name: "Doro Wat & Injera", peopleId: "habesha", minutes: 180, ahead: "Ferment teff 2–3 days", tone: "red",
    summary: "Chicken stew built on a mountain of slow-cooked onions, berbere and spiced butter, eaten with sour teff flatbread.",
    ingredients: ["teff flour", "onion", "berbere", "niter kibbeh", "chicken", "eggs"],
    technique: "Cook the onions dry first, slowly, until deep brown — before any fat goes in.",
    steps: [
      "Injera: mix teff flour and water, ferment for 2–3 days, then cook thin on a hot pan, covered, on one side only.",
      "Cook a lot of finely chopped onion in a dry pot over low heat until deep brown.",
      "Add niter kibbeh and berbere, then the chicken. Add water and simmer until tender.",
      "Add peeled hard-boiled eggs, scored so the sauce gets in.",
    ],
  },
  {
    id: "shiro", name: "Shiro Wat", peopleId: "habesha", minutes: 30, tone: "orange",
    summary: "Smooth chickpea-flour stew — the everyday and fasting-day staple.",
    ingredients: ["shiro powder", "berbere", "onion", "garlic", "vegetable oil"],
    technique: "Whisk the shiro in gradually so it doesn't lump.",
    steps: [
      "Sweat chopped onion, then add oil, garlic and berbere.",
      "Add water and bring it to the boil.",
      "Whisk in the shiro powder a little at a time. Simmer 10–15 minutes until it coats a spoon.",
    ],
  },
  {
    id: "chechebsa", name: "Chechebsa", peopleId: "oromo", minutes: 25, tone: "gold",
    summary: "Torn flatbread tossed in warm spiced butter and berbere — a breakfast dish.",
    ingredients: ["flour", "niter kibbeh", "berbere", "honey"],
    technique: "Tear the bread while it's hot so it soaks up the butter.",
    steps: [
      "Cook a thick flatbread (kita) in a dry pan.",
      "Tear it into small pieces.",
      "Toss in warm niter kibbeh and berbere.",
      "Serve with yogurt and honey.",
    ],
  },
  {
    id: "pilau", name: "Swahili Pilau", peopleId: "swahili", minutes: 75, tone: "brown",
    summary: "Coastal spiced rice with whole spices from the Indian Ocean trade routes. No tomato.",
    ingredients: ["basmati rice", "beef", "onion", "cardamom", "cloves", "cumin", "cinnamon"],
    technique: "Take the onions to deep brown — that's where the colour comes from.",
    steps: [
      "Fry sliced onions until deep brown.",
      "Add garlic, ginger and whole cumin, cardamom, cloves, cinnamon and black pepper.",
      "Brown the beef, add water and simmer until tender.",
      "Add basmati and cook covered on low until it has absorbed the stock.",
    ],
  },
  {
    id: "mchuzi", name: "Mchuzi wa Samaki", peopleId: "swahili", minutes: 40, tone: "gold",
    summary: "Fish in coconut curry, balanced with tamarind and lime.",
    ingredients: ["fish", "coconut milk", "tamarind", "turmeric", "tomato", "onion", "lime"],
    technique: "Balance creamy and sour: coconut milk against tamarind.",
    steps: [
      "Season the fish with lime, salt and turmeric, and fry it lightly.",
      "Fry onion, garlic, tomato and curry spices.",
      "Add coconut milk and tamarind, simmer, then add the fish for 10 minutes.",
    ],
  },
  {
    id: "githeri", name: "Githeri", peopleId: "kikuyu", minutes: 60, tone: "gold",
    summary: "Maize and beans boiled together, then fried with onion and tomato.",
    ingredients: ["maize", "beans", "potato", "onion", "tomato", "avocado"],
    technique: "One pot to boil, then a second fry for flavour.",
    steps: [
      "Boil dried maize and beans together until tender (or start from canned).",
      "Fry onion and tomato, then add potatoes.",
      "Stir in the githeri, season and simmer briefly.",
      "Serve with sliced avocado.",
    ],
  },
  {
    id: "mukimo", name: "Mukimo", peopleId: "kikuyu", minutes: 45, tone: "green",
    summary: "Potatoes mashed with pumpkin leaves until green, with maize and beans folded through.",
    ingredients: ["potato", "pumpkin leaves", "maize", "beans"],
    technique: "Mash until green, but leave the maize and beans whole.",
    steps: [
      "Boil the potatoes. Cook the pumpkin leaves (or spinach) separately.",
      "Mash the potatoes with the greens until evenly green.",
      "Fold in boiled maize and beans.",
    ],
  },
  {
    id: "ugali-tilapia", name: "Ugali & Fried Tilapia", peopleId: "luo", minutes: 45, tone: "cream",
    summary: "Firm cornmeal ugali with whole crisp-fried lake tilapia and greens.",
    ingredients: ["white cornmeal", "tilapia", "tomato", "onion", "collard greens"],
    technique: "Ugali should be firm enough to slice, and the fish crisp to the bone.",
    steps: [
      "Score and season the tilapia, then fry until crisp.",
      "Fry onion and tomato for a quick stew. Simmer the fish in it briefly if you like.",
      "Stir cornmeal into boiling water and keep stirring until it pulls away from the pot. Turn it out into a dome.",
      "Serve with sautéed greens.",
    ],
  },
  {
    id: "matooke", name: "Matooke & Luwombo", peopleId: "baganda", minutes: 120, tone: "gold",
    summary: "Steamed and mashed green bananas, with meat steamed in a banana-leaf parcel.",
    ingredients: ["green bananas", "peanut butter", "banana leaves", "chicken", "onion", "tomato"],
    technique: "Everything steams inside banana leaves, which give it its aroma.",
    steps: [
      "Peel the matooke, wrap in banana leaves and steam for about an hour. Mash inside the leaves.",
      "Season chicken or beef with a groundnut sauce.",
      "Wrap in softened banana leaves and steam for about 1½ hours.",
    ],
  },
  {
    id: "bariis", name: "Bariis Iskukaris", peopleId: "somali", minutes: 60, tone: "brown",
    summary: "Spiced basmati with xawaash, topped with fried onion and raisins.",
    ingredients: ["basmati rice", "xawaash", "onion", "raisins", "cardamom", "tomato"],
    technique: "Build the spiced oil first, then steam the rice in it.",
    steps: [
      "Fry onion, then add xawaash, cardamom, garlic and tomato.",
      "Add the meat, cook it through, then add water.",
      "Add soaked basmati and cook covered.",
      "Top with fried onion and raisins.",
    ],
  },
  {
    id: "canjeero", name: "Canjeero", peopleId: "somali", minutes: 30, ahead: "Ferment overnight", tone: "cream",
    summary: "Spongy fermented pancakes, a smaller and thicker cousin of injera.",
    ingredients: ["flour", "cornmeal", "yeast"],
    technique: "Ferment overnight and cook one side only, covered.",
    steps: [
      "Mix flour, cornmeal, yeast and water into a thin batter. Leave it to ferment overnight.",
      "Ladle onto a hot pan and spread it outward in a spiral.",
      "Cover and cook on one side only until the top is set and full of holes.",
    ],
  },
];

export const peopleById = Object.fromEntries(PEOPLES.map((p) => [p.id, p])) as Record<string, People>;
export const dishById = Object.fromEntries(DISHES.map((d) => [d.id, d])) as Record<string, Dish>;
