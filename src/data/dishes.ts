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
  /** Suggested recipe yield and amounts; ingredient names remain the matching keys. */
  servings?: number;
  amounts?: Record<string, string>;
  /** Optional serving extras are displayed but excluded from pantry and shopping matches. */
  optionalIngredients?: Record<string, string>;
  /** Water is a preparation note, never a pantry requirement. */
  water?: string;
  /** Preparation guidance that does not require an overnight ferment or marinade. */
  prepNote?: string;
  technique: string;
  steps: string[];
  /** Set on dishes the concierge wrote with AI rather than ones from our curated list. */
  aiWritten?: boolean;
  /** Free-text origin for AI-written dishes (curated dishes use peopleId). */
  origin?: string;
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
    ingredients: ["broken rice","fish","tomato paste","onion","tamarind","cabbage","carrot","parsley","garlic","scotch bonnet","vegetable oil","salt"],
    servings: 4,
    amounts: {
      "broken rice": "500 g",
      "fish": "1 kg, cleaned",
      "tomato paste": "3 tbsp",
      "onion": "2 medium",
      "tamarind": "2 tbsp pulp",
      "cabbage": "1/2 small head",
      "carrot": "2 medium",
      "parsley": "1 small bunch",
      "garlic": "4 cloves",
      "scotch bonnet": "1, or less to taste",
      "vegetable oil": "80 ml",
      "salt": "1 tsp, then adjust to taste"
    },
    optionalIngredients: {"lime":"1, cut into wedges"},
    water: "About 1.5 litres for the broth; adjust the liquid left for the rice.",
    technique: "Stuff the fish with rof (pounded parsley, garlic, chili) and cook the rice last, in the broth, so it drinks up everything.",
    steps: [
      "Pound parsley, garlic, chili and a little onion into rof. Cut slits in the fish and pack them with it.",
      "Brown the fish in oil and set it aside. In the same oil, fry sliced onion and tomato paste until dark red.",
      "Add water, tamarind, the fish and the vegetables. Simmer until the vegetables are tender, then lift everything out.",
      "Season the broth with salt. Wash the broken rice and cook it in the broth, covered, until tender and the liquid has been absorbed. Let the bottom crisp; that's the xoon.",
      "Serve the fish and vegetables over the rice; lime wedges are optional.",
    ],
  },
  {
    id: "yassa", name: "Yassa", peopleId: "wolof", minutes: 90, ahead: "Marinate overnight", tone: "gold",
    summary: "Chicken or fish in a sharp, sweet sauce of slow-cooked onions, lemon and mustard.",
    ingredients: ["chicken","onion","lemon","mustard","garlic","scotch bonnet","vegetable oil","salt"],
    servings: 4,
    amounts: {
      "chicken": "1 kg bone-in pieces",
      "onion": "4 large",
      "lemon": "3, juiced",
      "mustard": "3 tbsp",
      "garlic": "4 cloves",
      "scotch bonnet": "1, or less to taste",
      "vegetable oil": "3 tbsp",
      "salt": "1 tsp, then adjust to taste"
    },
    optionalIngredients: {"rice":"300 g dry, cooked separately for serving"},
    water: "250 ml for braising; add a splash more if the sauce dries out.",
    technique: "Use far more onion than seems right, and char the meat before it goes back into the sauce.",
    steps: [
      "Marinate the chicken in the refrigerator overnight with sliced onions, lemon juice, mustard, garlic, scotch bonnet and salt.",
      "Lift out the chicken and brown it in half the vegetable oil. Reserve the marinade to cook in the sauce.",
      "Cook the marinated onions in the remaining oil until soft and golden. Add the marinade liquid and 250 ml water and bring to a boil.",
      "Return the chicken and braise for 20–30 minutes, or until fully cooked. Cook rice separately if you want it as an optional side.",
    ],
  },
  {
    id: "party-jollof", name: "Party Jollof", peopleId: "yoruba", minutes: 75, tone: "red",
    summary: "Long-grain rice steamed in a fried pepper base, heavy on bay leaf, with the smoky bottom that makes it party food.",
    ingredients: ["long grain rice", "tomato", "red bell pepper", "scotch bonnet", "onion", "tomato paste", "bay leaf", "vegetable oil", "thyme", "curry powder", "stock"],
    servings: 4,
    amounts: {
      "long grain rice": "400 g",
      tomato: "4 medium",
      "red bell pepper": "2 medium",
      "scotch bonnet": "1, or less to taste",
      onion: "2 medium",
      "tomato paste": "3 tbsp",
      "bay leaf": "2 leaves",
      "vegetable oil": "80 ml",
      thyme: "1 tsp dried",
      "curry powder": "1 tsp",
      stock: "600 ml hot, added gradually",
    },
    technique: "Reduce the pepper base before the rice goes in, then steam under foil with very little liquid.",
    steps: [
      "Blend the tomatoes, red bell peppers, scotch bonnet and one onion. Boil the blend down until thick, about 15–20 minutes.",
      "Slice the remaining onion and fry in the vegetable oil. Add tomato paste and fry for 5 minutes, then add the reduced pepper base, thyme, curry powder and bay leaves. Fry for 10 minutes, stirring.",
      "Stir in the rinsed long-grain parboiled rice and 500 ml hot stock. Seal with foil and a lid and steam on low for 25–30 minutes. If the rice is still firm and the pot is dry, add the reserved stock a little at a time and keep steaming until tender.",
      "For the last 2 minutes turn the heat up slightly and let the bottom catch, watching closely so it doesn't burn. Rest off the heat, covered, for 5 minutes. Fluff the rice without stirring in the smoky bottom; serve that on the side.",
    ],
  },
  {
    id: "efo-riro", name: "Efo Riro", peopleId: "yoruba", minutes: 45, tone: "green",
    summary: "A rich spinach stew built on palm oil, peppers and iru (fermented locust beans).",
    ingredients: ["spinach","palm oil","iru","scotch bonnet","red bell pepper","onion","crayfish","salt"],
    servings: 4,
    amounts: {
      "spinach": "500 g",
      "palm oil": "80 ml",
      "iru": "1 tbsp",
      "scotch bonnet": "1, or less to taste",
      "red bell pepper": "2 medium",
      "onion": "1 large",
      "crayfish": "2 tbsp ground",
      "salt": "1/2 tsp, then adjust to taste"
    },
    optionalIngredients: {"cooked meat or fish":"250 g, deboned and ready to eat"},
    technique: "Almost no water: the pepper and palm oil fry together until the oil rises to the top.",
    steps: [
      "Blanch the spinach, then squeeze out as much water as you can.",
      "Blend the peppers and onion coarsely and boil the mix down until thick.",
      "Fry onion and iru in palm oil, then add the pepper mix and crayfish. Fry until the oil separates. Add cooked meat or fish only if using the optional extra.",
      "Fold in the spinach, season with salt and cook for 2–3 minutes. Heat any added cooked meat or fish through.",
    ],
  },
  {
    id: "amala", name: "Amala, Ewedu & Gbegiri", peopleId: "yoruba", minutes: 75, tone: "brown",
    summary: "Yam-flour swallow served with jute-leaf soup and a smooth bean soup, the Ibadan classic.",
    ingredients: ["yam flour","jute leaves","black-eyed beans","palm oil","iru","scotch bonnet","salt"],
    servings: 4,
    amounts: {
      "yam flour": "400 g",
      "jute leaves": "300 g",
      "black-eyed beans": "250 g dry, peeled",
      "palm oil": "3 tbsp",
      "iru": "1 tbsp",
      "scotch bonnet": "1, or less to taste",
      "salt": "1/2 tsp, then adjust to taste"
    },
    optionalIngredients: {"pepper stew":"Prepared separately, to serve"},
    water: "Start with 1 litre for the beans, 300 ml for the leaves and 1 litre for the amala; adjust each pot as needed.",
    technique: "Whisk the ewedu until it stretches, and turn the amala hard so there are no lumps.",
    steps: [
      "Gbegiri: cook the peeled beans in water until very soft. Mash smooth, then simmer with palm oil, scotch bonnet, half the iru and some of the salt.",
      "Ewedu: simmer the jute leaves in water with the remaining iru until tender. Whisk or briefly blend until silky, then season with the remaining salt.",
      "Amala: take boiling water off the heat, whisk in yam flour, and turn it hard until smooth. Cover and steam for 2 minutes.",
      "Serve the amala with ewedu and gbegiri. A separately prepared pepper stew is an optional extra.",
    ],
  },
  {
    id: "egusi", name: "Egusi Soup", peopleId: "igbo", minutes: 60, tone: "gold",
    summary: "Ground melon-seed soup, cooked Igbo-style so the egusi sets in lumps, finished with bitter leaf.",
    ingredients: ["egusi","palm oil","bitter leaf","stockfish","onion","crayfish","scotch bonnet","stock","beef","salt"],
    servings: 4,
    amounts: {
      "egusi": "250 g ground",
      "palm oil": "80 ml",
      "bitter leaf": "200 g, washed",
      "stockfish": "100 g, already softened and deboned",
      "onion": "1 medium",
      "crayfish": "2 tbsp ground",
      "scotch bonnet": "1, or less to taste",
      "stock": "750 ml",
      "beef": "400 g, already cooked until tender",
      "salt": "1/2 tsp, or less if the stock is salty"
    },
    water: "A few tablespoons to mix the egusi paste; more if needed to loosen the soup.",
    prepNote: "Cook beef and soften stockfish before starting the soup steps.",
    technique: "Drop the egusi paste into the hot oil and leave it alone so it sets into curds before stirring.",
    steps: [
      "Mix the ground egusi with a little water and chopped onion into a thick paste.",
      "Heat palm oil, fry onion, then drop the paste in by the spoonful. Let it set into lumps before you stir.",
      "Add stock, the softened and deboned stockfish, cooked tender beef, scotch bonnet and crayfish. Simmer for 15 minutes.",
      "Add washed bitter leaf, season with salt and simmer until the leaves are tender and the beef and fish are heated through.",
    ],
  },
  {
    id: "ofe-nsala", name: "Ofe Nsala", peopleId: "igbo", minutes: 50, tone: "cream",
    summary: "\"White soup\": no palm oil, thickened with pounded yam and perfumed with uziza.",
    ingredients: ["yam","catfish","uziza","utazi","crayfish","scotch bonnet","stock","salt"],
    servings: 4,
    amounts: {
      "yam": "300 g, peeled",
      "catfish": "800 g, cleaned and cut into steaks",
      "uziza": "1 tsp ground seed",
      "utazi": "2–3 leaves, finely sliced",
      "crayfish": "2 tbsp ground",
      "scotch bonnet": "1, or less to taste",
      "stock": "1 litre",
      "salt": "1/2 tsp, or less if the stock is salty"
    },
    water: "Enough to boil the yam separately; drain before pounding.",
    technique: "The yam is the thickener, so pound it smooth before it goes in.",
    steps: [
      "Boil the yam until soft, then pound it smooth.",
      "Simmer the catfish in stock with crayfish, scotch bonnet, ground uziza seed and salt until the fish is cooked through.",
      "Add the pounded yam in small lumps and stir until it dissolves and thickens the soup.",
      "Finish with sliced utazi leaves.",
    ],
  },
  {
    id: "suya", name: "Suya", peopleId: "hausa", minutes: 40, tone: "brown",
    summary: "Thin beef skewers crusted in yaji, a peanut and chili spice blend, grilled hot.",
    ingredients: ["beef","yaji","onion","tomato","vegetable oil","salt"],
    servings: 4,
    amounts: {
      "beef": "600 g, sliced thin",
      "yaji": "3 tbsp, then more to taste",
      "onion": "1 medium",
      "tomato": "2 medium",
      "vegetable oil": "2 tbsp",
      "salt": "1/4 tsp, adjusted to the salt in your yaji"
    },
    optionalIngredients: {"peanuts":"2 tbsp roasted, crushed for serving"},
    technique: "A dry rub, a hot grill and a second dusting of yaji once it's off the fire.",
    steps: [
      "Slice the beef thin and thread it onto skewers.",
      "Rub with a little oil and salt, then press yaji onto every side.",
      "Grill hot and fast, turning once. Dust with more yaji as it comes off.",
      "Serve with raw sliced onion and tomato. Add roasted peanuts only if you want the optional garnish.",
    ],
  },
  {
    id: "tuwo", name: "Tuwo Shinkafa & Miyan Kuka", peopleId: "hausa", minutes: 60, tone: "green",
    summary: "Soft rice swallow with a soup of baobab leaf and dawadawa.",
    ingredients: ["short grain rice","baobab leaf","dawadawa","dried fish","scotch bonnet","stock","palm oil","onion","crayfish","salt"],
    servings: 4,
    amounts: {
      "short grain rice": "400 g",
      "baobab leaf": "3 tbsp powder",
      "dawadawa": "1 tbsp crushed",
      "dried fish": "100 g, soaked until soft and deboned",
      "scotch bonnet": "1, or less to taste",
      "stock": "750 ml",
      "palm oil": "2 tbsp",
      "onion": "1 small",
      "crayfish": "1 tbsp ground",
      "salt": "1/2 tsp, or less if the stock is salty"
    },
    water: "About 1.2 litres for the rice, adding more until the grains are soft enough to mash.",
    technique: "Overcook the rice on purpose, then beat it smooth.",
    steps: [
      "Boil short-grain rice in extra water until very soft.",
      "Mash and turn with a wooden spoon until smooth, then shape into balls.",
      "For the soup, simmer stock with dawadawa, chopped onion, palm oil, crayfish, scotch bonnet and the soaked, deboned dried fish until tender.",
      "Take the soup off the boil and whisk in the baobab leaf powder until smooth. Return to low heat for 5 minutes, stirring, and season with salt.",
    ],
  },
  {
    id: "ghana-jollof", name: "Ghana Jollof", peopleId: "akan", minutes: 60, tone: "red",
    summary: "Fragrant basmati in a sweeter, ginger-forward tomato base, served with shito.",
    ingredients: ["basmati rice","tomato","tomato paste","onion","ginger","garlic","shito","vegetable oil","stock","curry powder","thyme"],
    servings: 4,
    amounts: {
      "basmati rice": "400 g",
      "tomato": "4 medium",
      "tomato paste": "3 tbsp",
      "onion": "2 medium",
      "ginger": "20 g",
      "garlic": "4 cloves",
      "shito": "3 tbsp, to serve",
      "vegetable oil": "80 ml",
      "stock": "600 ml hot, added gradually",
      "curry powder": "1 tsp",
      "thyme": "1 tsp dried"
    },
    technique: "Perfumed rice, cooked through but separate, with the heat coming from shito on the side.",
    steps: [
      "Fry onion, ginger and garlic in the vegetable oil. Add tomato paste and blended tomatoes and cook down to a thick sauce.",
      "Add curry powder, thyme and 500 ml of the hot stock, reserving the rest.",
      "Add rinsed basmati, cover tightly and steam on low until tender. Add the reserved stock a splash at a time only if the rice is still firm and the pot is dry.",
      "Serve with shito.",
    ],
  },
  {
    id: "waakye", name: "Waakye", peopleId: "akan", minutes: 70, ahead: "Soak beans overnight", tone: "brown",
    summary: "Rice and beans cooked with dried sorghum leaves, which turn it red-brown.",
    ingredients: ["rice","black-eyed beans","waakye leaves","shito","salt"],
    servings: 4,
    amounts: {
      "rice": "250 g",
      "black-eyed beans": "250 g dry",
      "waakye leaves": "5 dried sorghum leaves, rinsed",
      "shito": "2 tbsp, to serve",
      "salt": "1/2 tsp, then adjust to taste"
    },
    optionalIngredients: {"baking soda":"1/8 tsp, for the beans","gari":"4 tbsp, to serve","eggs":"4, hard-boiled separately","spaghetti":"100 g dry, cooked separately"},
    water: "Start with 1.5 litres for the beans; top up before adding the rice so it can finish cooking.",
    technique: "The leaves give the colour and an earthy flavour. Pull them out before serving.",
    steps: [
      "Boil the soaked beans with the waakye leaves until nearly soft. The listed baking soda is optional.",
      "Add the rice and enough water to cook it. Cover and cook until the rice is done.",
      "Remove the leaves and season with salt. Serve with shito; gari, hard-boiled eggs and cooked spaghetti are optional extras.",
    ],
  },
  {
    id: "fufu-light-soup", name: "Fufu & Light Soup", peopleId: "akan", minutes: 90, tone: "orange",
    summary: "Pounded cassava and plantain with a light, peppery tomato soup and no palm oil.",
    ingredients: ["cassava","plantain","tomato","garden eggs","goat meat","ginger","onion","scotch bonnet","salt"],
    servings: 4,
    amounts: {
      "cassava": "600 g, peeled",
      "plantain": "400 g, peeled",
      "tomato": "4 medium",
      "garden eggs": "3 small",
      "goat meat": "600 g",
      "ginger": "20 g",
      "onion": "1 large",
      "scotch bonnet": "1, or less to taste",
      "salt": "1 tsp, then adjust to taste"
    },
    water: "About 1.2 litres for the soup, plus a separate pot for boiling cassava and plantain.",
    technique: "The soup is blended and strained so it stays thin and clear.",
    steps: [
      "Steam the goat meat with onion, ginger, scotch bonnet and salt in its own juices, adding a little water if needed.",
      "Add the soup water, tomatoes and garden eggs. When the vegetables are soft, lift them out, blend and strain them back into the pot. Keep cooking the goat until tender.",
      "Simmer for 20 minutes.",
      "Boil cassava and plantain, then pound until smooth and stretchy (or use fufu flour).",
    ],
  },
  {
    id: "doro-wat", name: "Doro Wat & Injera", peopleId: "habesha", minutes: 180, ahead: "Ferment teff 2–3 days", tone: "red",
    summary: "Chicken stew built on a mountain of slow-cooked onions, berbere and spiced butter, eaten with sour teff flatbread.",
    ingredients: ["teff flour","onion","berbere","niter kibbeh","chicken","eggs","salt"],
    servings: 4,
    amounts: {
      "teff flour": "300 g",
      "onion": "4 large, finely chopped",
      "berbere": "3 tbsp, or less to taste",
      "niter kibbeh": "80 g",
      "chicken": "1 kg bone-in pieces",
      "eggs": "4, hard-boiled",
      "salt": "1 tsp, then adjust to taste"
    },
    water: "About 600 ml for the injera batter, plus 250 ml for the stew; adjust the batter to a pourable consistency.",
    technique: "Cook the onions dry first, slowly, until deep brown, before any fat goes in.",
    steps: [
      "Injera: mix teff flour and water, ferment for 2–3 days, then cook thin on a hot pan, covered, on one side only.",
      "Cook a lot of finely chopped onion in a dry pot over low heat until deep brown.",
      "Add niter kibbeh, berbere, salt and the chicken. Add 250 ml water and simmer gently until the chicken is fully cooked and tender.",
      "Add peeled hard-boiled eggs, scored so the sauce gets in.",
    ],
  },
  {
    id: "shiro", name: "Shiro Wat", peopleId: "habesha", minutes: 30, tone: "orange",
    summary: "Smooth chickpea-flour stew, the everyday and fasting-day staple.",
    ingredients: ["shiro powder","berbere","onion","garlic","vegetable oil","salt"],
    servings: 4,
    amounts: {
      "shiro powder": "120 g",
      "berbere": "1 tsp, or less if the shiro is already spiced",
      "onion": "1 medium",
      "garlic": "3 cloves",
      "vegetable oil": "3 tbsp",
      "salt": "1/2 tsp, then adjust to taste"
    },
    optionalIngredients: {"injera":"4 pieces, to serve"},
    water: "600 ml to start; add more gradually for a smooth, spoonable stew.",
    technique: "Whisk the shiro in gradually so it doesn't lump.",
    steps: [
      "Sweat chopped onion, then add oil, garlic and berbere.",
      "Add water and bring it to the boil.",
      "Whisk in the shiro powder gradually. Simmer for 10–15 minutes until smooth and spoonable, adding water if needed. Season with salt; injera is an optional accompaniment.",
    ],
  },
  {
    id: "chechebsa", name: "Chechebsa", peopleId: "oromo", minutes: 25, tone: "gold",
    summary: "Torn flatbread tossed in warm spiced butter and berbere, eaten for breakfast.",
    ingredients: ["flour","niter kibbeh","berbere","salt"],
    servings: 4,
    amounts: {
      "flour": "300 g",
      "niter kibbeh": "60 g",
      "berbere": "2 tsp, or less to taste",
      "salt": "1/2 tsp"
    },
    optionalIngredients: {"honey":"2 tbsp, to serve","yogurt":"150 g, to serve"},
    water: "About 300 ml, enough to make a thick, spreadable batter.",
    technique: "Tear the bread while it's hot so it soaks up the butter.",
    steps: [
      "Mix the flour and salt with enough water to make a thick, spreadable batter. Spread in a dry non-stick pan and cook the flatbread on both sides until no raw batter remains.",
      "Tear it into small pieces.",
      "Toss in warm niter kibbeh and berbere.",
      "Serve warm. Yogurt and honey are optional extras.",
    ],
  },
  {
    id: "pilau", name: "Swahili Pilau", peopleId: "swahili", minutes: 75, tone: "brown",
    summary: "Coastal spiced rice with whole spices from the Indian Ocean trade routes. No tomato.",
    ingredients: ["basmati rice","beef","onion","cardamom","cloves","cumin","cinnamon","vegetable oil","garlic","ginger","black pepper","salt"],
    servings: 4,
    amounts: {
      "basmati rice": "400 g",
      "beef": "600 g, cubed",
      "onion": "2 large",
      "cardamom": "6 pods",
      "cloves": "6 whole",
      "cumin": "1 tsp seeds",
      "cinnamon": "1 small stick",
      "vegetable oil": "3 tbsp",
      "garlic": "4 cloves",
      "ginger": "20 g",
      "black pepper": "1/2 tsp",
      "salt": "1 tsp, then adjust to taste"
    },
    water: "About 1 litre to simmer the beef; retain 750–800 ml of the resulting broth for the rice, topping up if needed.",
    technique: "Take the onions to deep brown. That's where the colour comes from.",
    steps: [
      "Fry sliced onions in vegetable oil until deep brown, stirring so they do not burn.",
      "Add garlic, ginger and whole cumin, cardamom, cloves, cinnamon and black pepper.",
      "Brown the beef with the spices and salt. Add water to cover and simmer until tender, topping up as needed.",
      "Measure the beef broth left in the pot and top up to about 750–800 ml with water. Stir in rinsed basmati, cover tightly and steam on low until tender.",
    ],
  },
  {
    id: "mchuzi", name: "Mchuzi wa Samaki", peopleId: "swahili", minutes: 40, tone: "gold",
    summary: "Fish in coconut curry, balanced with tamarind and lime.",
    ingredients: ["fish","coconut milk","tamarind","turmeric","tomato","onion","lime","vegetable oil","salt","garlic","curry powder"],
    servings: 4,
    amounts: {
      "fish": "800 g, cleaned",
      "coconut milk": "400 ml",
      "tamarind": "1 tbsp pulp",
      "turmeric": "1/2 tsp",
      "tomato": "3 medium",
      "onion": "1 medium",
      "lime": "1, juiced",
      "vegetable oil": "3 tbsp",
      "salt": "1/2 tsp, then adjust to taste",
      "garlic": "3 cloves",
      "curry powder": "1 tsp"
    },
    water: "Up to 150 ml to loosen the sauce if needed.",
    technique: "Balance creamy and sour: coconut milk against tamarind.",
    steps: [
      "Season the fish with lime juice, salt and turmeric. Lightly fry in half the vegetable oil, then set aside.",
      "Fry onion and garlic in the remaining oil, then stir in tomato and curry powder and cook until softened.",
      "Add coconut milk and tamarind, loosening with water if needed. Return the fish and simmer gently for about 10 minutes, until it is cooked through.",
    ],
  },
  {
    id: "githeri", name: "Githeri", peopleId: "kikuyu", minutes: 60, tone: "gold",
    summary: "Maize and beans boiled together, then fried with onion and tomato.",
    ingredients: ["maize","beans","potato","onion","tomato","vegetable oil","salt"],
    servings: 4,
    amounts: {
      "maize": "400 g, already cooked and drained",
      "beans": "400 g, already cooked and drained",
      "potato": "300 g, diced",
      "onion": "1 medium",
      "tomato": "3 medium",
      "vegetable oil": "2 tbsp",
      "salt": "1/2 tsp, then adjust to taste"
    },
    optionalIngredients: {"avocado":"1, sliced for serving"},
    water: "250 ml to simmer the potatoes; add a splash more if needed.",
    prepNote: "Use already cooked maize and beans, or canned. Cooking dried ones is additional preparation time.",
    technique: "One pot to boil, then a second fry for flavour.",
    steps: [
      "Start with already cooked, drained maize and beans, or drain and rinse canned ones. If starting from dried, soak and cook them separately ahead of time until tender.",
      "Fry onion and tomato in vegetable oil, then add diced potatoes and 250 ml water. Cover and simmer until the potatoes are tender.",
      "Stir in the cooked maize and beans, season with salt and simmer for 10 minutes until heated through.",
      "Serve hot, with sliced avocado as an optional extra.",
    ],
  },
  {
    id: "mukimo", name: "Mukimo", peopleId: "kikuyu", minutes: 45, tone: "green",
    summary: "Potatoes mashed with pumpkin leaves until green, with maize and beans folded through.",
    ingredients: ["potato","pumpkin leaves","maize","beans","salt"],
    servings: 4,
    amounts: {
      "potato": "1 kg, peeled",
      "pumpkin leaves": "200 g, tender leaves only",
      "maize": "200 g, already cooked and drained",
      "beans": "200 g, already cooked and drained",
      "salt": "1/2 tsp, then adjust to taste"
    },
    water: "Enough to boil the potatoes and greens separately; drain before mashing.",
    technique: "Mash until green, but leave the maize and beans whole.",
    steps: [
      "Boil the potatoes. Cook the pumpkin leaves (or spinach) separately.",
      "Mash the potatoes with the greens until evenly green.",
      "Fold in the already cooked maize and beans, season with salt and heat through.",
    ],
  },
  {
    id: "ugali-tilapia", name: "Ugali & Fried Tilapia", peopleId: "luo", minutes: 45, tone: "cream",
    summary: "Firm cornmeal ugali with whole crisp-fried lake tilapia and greens.",
    ingredients: ["white cornmeal","tilapia","tomato","onion","collard greens","vegetable oil","salt"],
    servings: 4,
    amounts: {
      "white cornmeal": "300 g",
      "tilapia": "2 medium whole fish, about 1 kg total, cleaned",
      "tomato": "3 medium",
      "onion": "1 medium",
      "collard greens": "300 g, sliced",
      "vegetable oil": "150 ml for shallow frying and vegetables, divided",
      "salt": "1 tsp, then adjust to taste"
    },
    water: "Start with 900 ml for the ugali; adjust for your cornmeal and preferred firmness.",
    technique: "Ugali should be firm enough to slice, and the fish crisp to the bone.",
    steps: [
      "Score the tilapia and season with some of the salt. Shallow-fry in most of the vegetable oil until crisp and cooked through. Reserve a little clean oil for the vegetables.",
      "Fry onion and tomato in a little of the reserved oil for a quick stew. Season with salt and briefly simmer the cooked fish in it if you like.",
      "Stir cornmeal into boiling water and keep stirring until it pulls away from the pot. Turn it out into a dome.",
      "Sauté the collard greens in the remaining reserved oil with the remaining salt, then serve with the fish and ugali.",
    ],
  },
  {
    id: "matooke", name: "Matooke & Luwombo", peopleId: "baganda", minutes: 120, tone: "gold",
    summary: "Steamed and mashed green bananas, with meat steamed in a banana-leaf parcel.",
    ingredients: ["green bananas","peanut butter","banana leaves","chicken","onion","tomato","salt"],
    servings: 4,
    amounts: {
      "green bananas": "1 kg, peeled",
      "peanut butter": "200 g, unsweetened",
      "banana leaves": "4 large, cleaned and softened",
      "chicken": "800 g, cut into pieces",
      "onion": "1 medium",
      "tomato": "2 medium",
      "salt": "1 tsp, then adjust to taste"
    },
    water: "250 ml for the peanut sauce, plus enough in the steamer to maintain steam without touching the parcels.",
    technique: "Everything steams inside banana leaves, which give it its aroma.",
    steps: [
      "Peel the matooke, wrap in banana leaves and steam for about an hour. Mash inside the leaves.",
      "Mix the peanut butter with 250 ml water, finely chopped onion, tomato and salt to make the sauce. Coat the chicken pieces in it.",
      "Divide the chicken and sauce between softened banana leaves and tie closed. Steam above the water for about 1½ hours, topping up the steamer as needed, until the chicken is fully cooked and tender.",
    ],
  },
  {
    id: "bariis", name: "Bariis Iskukaris", peopleId: "somali", minutes: 60, tone: "brown",
    summary: "Spiced basmati with xawaash, topped with fried onion and raisins.",
    ingredients: ["basmati rice","xawaash","onion","raisins","cardamom","tomato","vegetable oil","garlic","beef","salt"],
    servings: 4,
    amounts: {
      "basmati rice": "400 g",
      "xawaash": "2 tsp",
      "onion": "2 medium",
      "raisins": "50 g",
      "cardamom": "4 pods",
      "tomato": "2 medium",
      "vegetable oil": "3 tbsp",
      "garlic": "4 cloves",
      "beef": "500 g, cubed",
      "salt": "1 tsp, then adjust to taste"
    },
    water: "Enough to simmer the beef; before adding the rice, adjust the liquid left in the pot to about 750–800 ml.",
    technique: "Build the spiced oil first, then steam the rice in it.",
    steps: [
      "Fry one sliced onion in half the vegetable oil, then add xawaash, cardamom, garlic and tomato.",
      "Add the cubed beef and salt, brown it, then add water and simmer until tender.",
      "Adjust the liquid left in the pot to about 750–800 ml. Add soaked and drained basmati and cook covered on low until tender.",
      "Fry the remaining sliced onion in the remaining oil until golden, stir in the raisins briefly, then spoon over the rice.",
    ],
  },
  {
    id: "canjeero", name: "Canjeero", peopleId: "somali", minutes: 30, ahead: "Ferment overnight", tone: "cream",
    summary: "Spongy fermented pancakes, a smaller and thicker cousin of injera.",
    ingredients: ["flour","cornmeal","yeast","salt"],
    servings: 4,
    amounts: {
      "flour": "300 g",
      "cornmeal": "75 g, finely ground",
      "yeast": "1/2 tsp instant dry",
      "salt": "1/4 tsp"
    },
    optionalIngredients: {"vegetable oil":"1 tsp, to wipe the pan if needed","honey":"To serve"},
    water: "About 600 ml lukewarm, added gradually to make a thin, pourable batter.",
    technique: "Ferment overnight and cook one side only, covered.",
    steps: [
      "Mix flour, finely ground cornmeal, yeast, salt and lukewarm water into a smooth, thin batter. Cover and leave to ferment overnight.",
      "Ladle onto a hot pan and spread it outward in a spiral.",
      "Cover and cook on one side only until the top is set and full of holes.",
    ],
  },
];

export const peopleById = Object.fromEntries(PEOPLES.map((p) => [p.id, p])) as Record<string, People>;
export const dishById = Object.fromEntries(DISHES.map((d) => [d.id, d])) as Record<string, Dish>;
