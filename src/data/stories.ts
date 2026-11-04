/**
 * "Say it right" + "Where it comes from" content for every curated dish.
 *
 * Editorial rules: only well-established facts, hedged where tradition varies,
 * no invented dates, numbers or legends. Respellings are a friendly guide for
 * English speakers (stressed syllable in caps), not a phonetic transcription —
 * several of these languages are tonal, so treat stress as approximate.
 */
export type DishWord = { term: string; meaning: string };

export type DishStory = {
  /** Respelling for English speakers, stressed syllable in caps. */
  say: string;
  /** BCP-47 tag to prefer for a native speech voice. */
  lang?: string;
  /** 2–3 sentences, under 60 words. */
  story: string;
  /** 1–3 food words from the name or ingredients. */
  words?: DishWord[];
};

export const STORIES: Record<string, DishStory> = {
  thieboudienne: {
    say: "chay-boo-JEN",
    lang: "wo-SN",
    story:
      "The name is Wolof for \"rice and fish\", and it is widely seen as Senegal's national dish, with deep roots in the coastal city of Saint-Louis. It is usually the big midday meal, served on one shared platter. Families often prize the crisp rice from the bottom of the pot.",
    words: [
      { term: "ceeb", meaning: "rice" },
      { term: "jën", meaning: "fish" },
      { term: "xoon", meaning: "the crisp rice stuck to the bottom of the pot" },
    ],
  },
  yassa: {
    say: "YAH-sah",
    lang: "wo-SN",
    story:
      "Yassa is usually traced to the Casamance, the green southern region of Senegal, and is now cooked across the country and its neighbours. It is a favourite for family gatherings and celebrations. The sauce is mostly onions, cooked down slowly until they turn soft, sweet and golden.",
    words: [{ term: "yassa ginaar", meaning: "chicken yassa, in Wolof" }],
  },
  "party-jollof": {
    say: "JOL-off",
    lang: "en",
    story:
      "Jollof takes its name from the old Wolof state of Jolof, and today it is cooked across West Africa. In Nigeria, party jollof is made in huge pots, often over firewood, for weddings and birthdays. The smoky, slightly burnt layer at the bottom is the part many guests hope to get.",
    words: [{ term: "jollof", meaning: "named after the Jolof state of the Wolof people" }],
  },
  "efo-riro": {
    say: "EH-faw REE-roh",
    lang: "yo-NG",
    story:
      "A Yoruba favourite from south-west Nigeria, eaten with a swallow such as pounded yam or eba, or with rice. The name is usually translated as \"stirred greens\". The funky, savoury depth comes from iru, fermented locust beans that are a cornerstone of Yoruba cooking.",
    words: [
      { term: "efo", meaning: "leafy greens" },
      { term: "iru", meaning: "fermented locust beans" },
    ],
  },
  amala: {
    say: "ah-MAH-lah, eh-WEH-doo, gbeh-GEE-ree",
    lang: "yo-NG",
    story:
      "This trio is most closely tied to Ibadan and the Oyo area of south-west Nigeria, where amala joints serve it all day. Amala turns brown because the yam is dried before it is milled into flour. Served together, the three are often nicknamed abula.",
    words: [
      { term: "amala", meaning: "a soft swallow made from yam flour" },
      { term: "ewedu", meaning: "jute leaves" },
      { term: "gbegiri", meaning: "bean soup" },
    ],
  },
  egusi: {
    say: "eh-GOO-see",
    lang: "ig-NG",
    story:
      "Egusi soup is cooked all over West Africa, and every region thickens it its own way. In many Igbo homes in south-east Nigeria it is a regular Sunday or party soup, eaten with pounded yam, fufu or garri. The seeds come from a melon grown for its seeds, not its flesh.",
    words: [
      { term: "egusi", meaning: "ground melon seeds" },
      { term: "onugbu", meaning: "bitter leaf, in Igbo" },
    ],
  },
  "ofe-nsala": {
    say: "OH-feh n-SAH-lah",
    lang: "ig-NG",
    story:
      "An Igbo soup from south-east Nigeria, often called white soup because it is made without palm oil. Fresh catfish is the classic choice, and it is commonly eaten with pounded yam. Uziza and utazi give it a peppery, slightly bitter edge.",
    words: [
      { term: "ofe", meaning: "soup" },
      { term: "uziza", meaning: "a peppery spice seed and leaf" },
      { term: "utazi", meaning: "a bitter, aromatic leaf" },
    ],
  },
  suya: {
    say: "SOO-yah",
    lang: "ha-NG",
    story:
      "Suya grew out of Hausa grilling traditions in northern Nigeria and is now street food across the country and beyond. It is mostly an evening food, sold from roadside grills. Vendors often wrap it in paper with raw onion and an extra dusting of yaji.",
    words: [
      { term: "yaji", meaning: "the ground peanut and chili spice blend" },
      { term: "mai suya", meaning: "the person who grills and sells suya" },
    ],
  },
  tuwo: {
    say: "TOO-woh shin-KAH-fah, MEE-yahn KOO-kah",
    lang: "ha-NG",
    story:
      "A home meal across Hausa-speaking northern Nigeria and Niger, often eaten in the evening. Baobab trees grow throughout this dry savanna, and their leaves are dried and ground to a powder. Whisked into the soup, the powder gives miyan kuka its slippery, drawn texture.",
    words: [
      { term: "tuwo", meaning: "a soft, thick swallow" },
      { term: "shinkafa", meaning: "rice" },
      { term: "miyan kuka", meaning: "baobab leaf soup" },
    ],
  },
  "ghana-jollof": {
    say: "JOL-off",
    lang: "en",
    story:
      "Ghana's take on jollof, and the other side of the friendly, long-running jollof rivalry with Nigeria. Many Ghanaian cooks prefer fragrant basmati or jasmine rice. It is a fixture at parties and Sunday lunches, usually with shito, a dark chili oil made with dried fish or shrimp.",
    words: [{ term: "shito", meaning: "black chili sauce with dried fish or shrimp" }],
  },
  waakye: {
    say: "WAH-chay",
    lang: "ak-GH",
    story:
      "Waakye came from the Hausa-speaking communities of northern Ghana, and the name comes from the Hausa word for beans. It is now one of Ghana's best-loved breakfast and lunch foods. Street sellers often serve it on a leaf with a pile of toppings, from shito to gari.",
    words: [
      { term: "waakye", meaning: "from the Hausa word for beans" },
      { term: "gari", meaning: "toasted cassava granules" },
    ],
  },
  "fufu-light-soup": {
    say: "FOO-foo",
    lang: "ak-GH",
    story:
      "Fufu is central to Akan cooking in Ghana and is often the Sunday meal. It is pounded in a tall wooden mortar, traditionally by two people: one pounds while the other turns the dough between strokes. Light soup is the clear, peppery partner that the fufu sits in.",
    words: [
      { term: "fufu", meaning: "pounded cassava and plantain" },
      { term: "nkrakra", meaning: "light soup, in Twi" },
    ],
  },
  "doro-wat": {
    say: "DOH-roh WOT, in-JEH-rah",
    lang: "am-ET",
    story:
      "Doro wat is the festive stew of Ethiopia and Eritrea, cooked for holidays such as Christmas and Easter, when many Orthodox Christians end their fasts. It takes hours of patient onion cooking. Everyone eats from one shared injera, tearing off pieces with the right hand.",
    words: [
      { term: "doro", meaning: "chicken" },
      { term: "wat", meaning: "stew" },
      { term: "berbere", meaning: "red chili spice blend" },
    ],
  },
  shiro: {
    say: "SHEE-roh WOT",
    lang: "am-ET",
    story:
      "Shiro is everyday food across Ethiopia and Eritrea, cheap, quick and filling. Because it has no meat or dairy, it is a staple on the many fasting days kept by Orthodox Christians. It is usually served bubbling in a small clay pot, with injera for scooping.",
    words: [
      { term: "shiro", meaning: "spiced chickpea or bean flour" },
      { term: "wat", meaning: "stew" },
    ],
  },
  chechebsa: {
    say: "cheh-CHEB-sah",
    lang: "om-ET",
    story:
      "A breakfast dish from Ethiopia, also known as kita firfir. Fresh flatbread is torn into small pieces and tossed with spiced butter and berbere while still hot. It is often finished with honey or yogurt, with coffee alongside.",
    words: [
      { term: "kita", meaning: "a thick flatbread" },
      { term: "niter kibbeh", meaning: "spiced clarified butter" },
    ],
  },
  pilau: {
    say: "pee-LAU",
    lang: "sw-KE",
    story:
      "Pilau is a centrepiece of Swahili coast cooking in Kenya, Tanzania and Zanzibar. Its cardamom, cloves and cinnamon reflect centuries of Indian Ocean trade, and Zanzibar is still known for growing cloves. It is the dish for weddings, Eid and big family meals, often with kachumbari on the side.",
    words: [
      { term: "pilau", meaning: "spiced rice" },
      { term: "kachumbari", meaning: "fresh tomato and onion salad" },
    ],
  },
  mchuzi: {
    say: "m-CHOO-zee wah sah-MAH-kee",
    lang: "sw-KE",
    story:
      "A coastal curry from the Swahili coast, where fishing and coconut palms shape everyday cooking. Coconut milk is often made fresh by grating the flesh and squeezing it through cloth. It is usually eaten with rice, chapati or ugali.",
    words: [
      { term: "mchuzi", meaning: "curry or stew" },
      { term: "samaki", meaning: "fish" },
      { term: "nazi", meaning: "coconut" },
    ],
  },
  githeri: {
    say: "gee-THEH-ree",
    lang: "en",
    story:
      "Githeri comes from the Kikuyu of central Kenya and is now everyday food across the country. Maize and beans grow side by side on many family farms, so they end up side by side in the pot. Plain boiled githeri is a familiar school and workday lunch.",
    words: [{ term: "githeri", meaning: "maize and beans cooked together" }],
  },
  mukimo: {
    say: "moo-KEE-moh",
    lang: "en",
    story:
      "Mukimo is a Kikuyu dish from central Kenya, where potatoes, maize and greens grow in the cool highlands. It is often served at celebrations and family gatherings, alongside stew or roasted meat. The greens are what turn the mash its bright green colour.",
  },
  "ugali-tilapia": {
    say: "oo-GAH-lee",
    lang: "sw-KE",
    story:
      "For the Luo people around Lake Victoria, fish and ugali are an everyday pairing. Ugali is eaten with the right hand: pinch off a piece, roll it into a ball, press a dent with your thumb and use it to scoop. Tilapia is usually fried whole.",
    words: [
      { term: "ugali", meaning: "stiff maize porridge, in Swahili" },
      { term: "kuon", meaning: "ugali, in Dholuo" },
      { term: "rech", meaning: "fish, in Dholuo" },
    ],
  },
  matooke: {
    say: "mah-TOH-keh, loo-WOHM-boh",
    story:
      "Matooke, green cooking bananas, is a daily staple in Buganda in central Uganda. Luwombo, meat or groundnut sauce steamed in banana leaf parcels, is a dish for special occasions and is said to have begun in the royal kitchens of Buganda. The leaves keep everything moist and add a gentle aroma.",
    words: [
      { term: "matooke", meaning: "green cooking bananas" },
      { term: "luwombo", meaning: "a stew steamed in a banana leaf parcel" },
    ],
  },
  bariis: {
    say: "bah-REES is-koo-KAH-ris",
    lang: "so-SO",
    story:
      "A Somali celebration rice, served at weddings, Eid and family gatherings. The warm spice mix xawaash shows Somalia's long place in Indian Ocean trade. Many Somalis eat a banana alongside their rice, a habit that surprises newcomers and wins many of them over.",
    words: [
      { term: "bariis", meaning: "rice" },
      { term: "xawaash", meaning: "Somali spice blend, said \"ha-WAHSH\"" },
    ],
  },
  canjeero: {
    say: "ahn-JEER-oh",
    lang: "so-SO",
    story:
      "Canjeero is the classic Somali breakfast, also known as laxoox. It is commonly eaten with ghee and sugar, or with a little stew, alongside sweet spiced tea. The batter is spread in a spiral and cooked on one side only, so the top stays soft and full of holes.",
    words: [
      { term: "canjeero", meaning: "fermented pancake" },
      { term: "laxoox", meaning: "another name for it, said \"la-HOH\"" },
    ],
  },
};

export function storyFor(dishId: string): DishStory | undefined {
  return STORIES[dishId];
}
