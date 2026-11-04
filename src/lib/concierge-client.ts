import { SUBSTITUTES, substituteFor } from "../data/substitutes";
import { KNOWN_INGREDIENTS, cleanItem, rankDishes } from "./pantry";
import type { Dish } from "../data/dishes";
import {
  DELIVERY_ETA,
  instacartSearchUrl,
  mapsSearchUrl,
  type Card,
  type ChatTurn,
  type ScanItem,
  type ScanMode,
  type ConciergeError,
  type ConciergeRequest,
  type ConciergeResponse,
} from "./concierge-types";

/** Shrink a photo to ≤1600px JPEG so uploads stay small and fast. */
export async function resizeImage(file: File, max = 1600, quality = 0.82): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = url;
    });
    const scale = Math.min(1, max / Math.max(img.width, img.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", quality);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export type AskResult = { ok: true; data: ConciergeResponse } | { ok: false; error: ConciergeError };

export async function askConcierge(req: ConciergeRequest, signal?: AbortSignal): Promise<AskResult> {
  try {
    const res = await fetch("/api/concierge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req),
      signal,
    });
    const body = await res.json().catch(() => null);
    if (res.ok && body && "text" in body) return { ok: true, data: body as ConciergeResponse };
    return { ok: false, error: (body as ConciergeError) ?? { error: "server_error", message: `HTTP ${res.status}` } };
  } catch {
    return { ok: false, error: { error: "ai_unavailable", message: "Couldn't reach the concierge." } };
  }
}

/* ───────────── Built-in answers: demo mode and offline fallback ───────────── */

const DEMO_SCAN = [
  { name: "Plantain", confidence: "sure", useSoon: true, note: "very ripe" },
  { name: "Egusi", confidence: "check" },
  { name: "Crayfish", confidence: "sure" },
  { name: "Stockfish", confidence: "check" },
  { name: "Spinach", confidence: "sure", useSoon: true, note: "fresh greens" },
  { name: "Black-Eyed Beans", confidence: "sure" },
  { name: "Garden Eggs", confidence: "check", useSoon: true, note: "use within the week" },
  { name: "Ginger", confidence: "sure" },
] satisfies ScanItem[];

/** Sample inventory from a fridge sweep: more items than one photo, duplicates already merged. */
const DEMO_SWEEP = [
  { name: "Plantain", confidence: "sure", useSoon: true, note: "very ripe" },
  { name: "Chicken", confidence: "sure", useSoon: true, note: "raw, opened pack" },
  { name: "Spinach", confidence: "sure", useSoon: true, note: "fresh greens" },
  { name: "Tomato", confidence: "sure" },
  { name: "Onion", confidence: "sure" },
  { name: "Scotch Bonnet", confidence: "sure" },
  { name: "Red Bell Pepper", confidence: "sure", useSoon: true, note: "soft spots" },
  { name: "Palm Oil", confidence: "sure" },
  { name: "Tomato Paste", confidence: "check" },
  { name: "Ginger", confidence: "sure" },
  { name: "Garden Eggs", confidence: "check" },
  { name: "Eggs", confidence: "sure" },
] satisfies ScanItem[];

/** Sample receipt lines decoded into grocery names. The note keeps the line as printed. */
const DEMO_RECEIPT = [
  { name: "Plantain", confidence: "sure", useSoon: true, note: "from 'PLNTN RIPE 3CT'" },
  { name: "Palm Oil", confidence: "sure", note: "from 'RED PLM OIL 1L'" },
  { name: "Egusi", confidence: "sure", note: "from 'EGUSI GRND 8OZ'" },
  { name: "Crayfish", confidence: "check", note: "from 'CRYFSH DRD 4OZ'" },
  { name: "Tilapia", confidence: "sure", useSoon: true, note: "from 'TILAPIA WHL FRSH'" },
  { name: "Scotch Bonnet", confidence: "sure", useSoon: true, note: "from 'SCTCH BNT PPR'" },
  { name: "Spinach", confidence: "sure", useSoon: true, note: "from 'SPNCH BNCH'" },
  { name: "Black-Eyed Beans", confidence: "sure", note: "from 'BLK EYE PEAS 2LB'" },
  { name: "Rice", confidence: "sure", note: "from 'LG GRN RICE 5LB'" },
  { name: "Smoked Turkey", confidence: "check", note: "from 'SMKD TKY WNG'" },
] satisfies ScanItem[];

const DEMO_AI_DISH: Dish = {
  id: "ai-jamaican-rice-and-peas",
  name: "Jamaican Rice and Peas",
  peopleId: "ai",
  origin: "Jamaica",
  summary: "Rice simmered with kidney beans, coconut milk, thyme and a whole scotch bonnet. A Sunday-dinner staple.",
  minutes: 50,
  tone: "brown",
  ingredients: ["long grain rice", "kidney beans", "coconut milk", "scotch bonnet", "thyme", "garlic", "spring onion", "allspice"],
  technique: "Drop the scotch bonnet in whole so it perfumes the pot without bursting.",
  steps: [
    "Simmer the kidney beans (or drained canned beans) with garlic, thyme, spring onion and allspice.",
    "Add coconut milk, water and salt, then the washed rice.",
    "Lay the whole scotch bonnet on top, cover and cook on low for about 20 minutes until the liquid is absorbed.",
    "Remove the pepper and thyme stems, fluff and serve.",
  ],
  aiWritten: true,
};

const DEMO_STORES = [
  { name: "Sample: Adesua African Market", address: "Demo address", mapsUrl: mapsSearchUrl("African grocery near me"), openNow: true, closes: "9 PM", distanceMiles: 1.2, driveMinutes: 6 },
  { name: "Sample: Global Foods Mart", address: "Demo address", mapsUrl: mapsSearchUrl("international grocery near me"), openNow: true, closes: "10 PM", distanceMiles: 3.4, driveMinutes: 11 },
];

function findIngredient(text: string): string | null {
  const t = text.toLowerCase();
  const known = [...Object.keys(SUBSTITUTES), ...KNOWN_INGREDIENTS].sort((a, b) => b.length - a.length);
  const hit = known.find((k) => t.includes(k));
  if (hit) return hit;
  const m = t.match(/(?:out of|low on|more) ([a-z \-]+?)(?: for| and|[.?!,]|$)/);
  return m ? m[1].trim() : null;
}

export function localRespond(turns: ChatTurn[], pantry: string[], demo: boolean): ChatTurn {
  const last = turns[turns.length - 1];
  const note = demo ? "Demo mode: sample answers, no live data." : "AI is offline, so this is a built-in answer.";
  const text = last.text.toLowerCase();

  const imageCount = last.images?.length ?? last.imageCount ?? (last.image ? 1 : 0);
  if (imageCount > 0) {
    const mode: ScanMode = last.mode ?? (imageCount > 1 ? "sweep" : "photo");
    if (!demo) {
      const what = mode === "sweep" ? "Reading a fridge sweep" : mode === "receipt" ? "Reading a receipt" : "Photo scanning";
      return { role: "assistant", text: `${what} needs the AI connection. Try again in a moment, or turn on Demo mode below to see how it works.`, note };
    }
    const sample = mode === "sweep" ? DEMO_SWEEP : mode === "receipt" ? DEMO_RECEIPT : DEMO_SCAN;
    const items: ScanItem[] = sample.map((i) => ({ ...i }));
    const ranked = rankDishes([...pantry, ...items.map((i) => i.name)]).slice(0, 3);
    const text =
      mode === "sweep"
        ? `I went through ${imageCount} frames from your sweep and counted ${items.length} items, counting anything I saw twice only once. Untick anything I got wrong, then add the rest.`
        : mode === "receipt"
          ? `I decoded ${items.length} food lines from your receipt and skipped the bag, tax and total. Check the ones I wasn't sure about.`
          : "I can see a well-stocked West African shelf. Untick anything I got wrong, then add the rest.";
    return {
      role: "assistant",
      text,
      cards: [{ type: "scan", items, ...(mode === "photo" ? {} : { source: mode }) }, { type: "dishes", dishIds: ranked.map((m) => m.dish.id) }],
      note,
    };
  }

  if (/(out of|ran out|run out|running low|low on|need more|i need|don'?t have|no more|missing|need to buy|where.*(buy|get))/.test(text)) {
    const ing = findIngredient(text);
    if (!ing) return { role: "assistant", text: "Which ingredient are you out of?", note };
    const restock = /(running low|low on|need more|i need|where.*get)/.test(text);
    const s = substituteFor(ing);
    const hasSwap = ing in SUBSTITUTES;
    const shopQuery = /^(any )?supermarket$/i.test(s.shop) ? "grocery store" : s.shop;
    const cards: Card[] = [];
    if (hasSwap) {
      cards.push({
        type: "swap",
        ingredient: ing,
        cheapest: s.swap,
        authentic: s.essential ? `Get the real thing from ${/^[aeiou]/i.test(s.shop) ? "an" : "a"} ${s.shop}.${s.tip ? " " + s.tip : ""}` : `${s.swap}. ${s.tradeoff}`,
        fastest: `Use the swap tonight and get real ${ing} for next time.`,
        tradeoff: s.tradeoff,
        essential: s.essential,
        source: "pantryroots",
      });
    }
    cards.push(
      {
        type: "stores",
        ingredient: ing,
        stores: demo ? DEMO_STORES : [],
        searchUrl: mapsSearchUrl(`${shopQuery} near me`),
        source: demo ? "demo" : "link",
      },
      { type: "cart", items: [cleanItem(ing)], url: instacartSearchUrl(s.search || ing), source: "link", eta: DELIVERY_ETA },
    );
    const text2 = !hasSwap
      ? `${cleanItem(ing)} is an everyday staple, so the best fix is to restock. Here's where to get it.`
      : restock
        ? `Here's where to restock ${ing}, plus a stand-in if you run out first.`
        : s.essential
          ? `No good swap keeps ${ing} tasting right, so it's worth the trip. Here's a stand-in if you can't wait.`
          : `Easy one. Here's a swap from your kitchen, plus where to get the real thing.`;
    return { role: "assistant", text: text2, cards, note };
  }

  if (/(caribbean|jamaican|trinidad|haitian|other tradition|something different)/.test(text)) {
    if (!demo) return { role: "assistant", text: "Writing dishes from other traditions needs the AI connection. Try again in a moment, or turn on Demo mode below to see a sample.", note };
    return {
      role: "assistant",
      text: "Here's a Jamaican Sunday staple that uses your rice and pepper.",
      cards: [{ type: "aiDish", dish: DEMO_AI_DISH }],
      note,
    };
  }

  if (/(cook|make|tonight|dinner|lunch|recipe|what can|hungry|eat)/.test(text)) {
    const ranked = rankDishes(pantry).slice(0, 3);
    return {
      role: "assistant",
      text: ranked[0]?.need.length === 0 ? `You can make ${ranked[0].dish.name} right now.` : "These are closest to what you have.",
      cards: [{ type: "dishes", dishIds: ranked.map((m) => m.dish.id) }],
      note,
    };
  }

  return {
    role: "assistant",
    text: "I can scan a photo of your shelf, tell you what to cook, or help when you're out of something. Try one of the suggestions below.",
    note,
  };
}
