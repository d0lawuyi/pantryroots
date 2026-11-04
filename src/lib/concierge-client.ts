import { SUBSTITUTES, substituteFor } from "../data/substitutes";
import { KNOWN_INGREDIENTS, cleanItem, rankDishes } from "./pantry";
import {
  DELIVERY_ETA,
  instacartSearchUrl,
  mapsSearchUrl,
  type Card,
  type ChatTurn,
  type ScanItem,
  type ConciergeError,
  type ConciergeRequest,
  type ConciergeResponse,
} from "./concierge-types";

/** Shrink a photo to ≤1600px JPEG so uploads stay small and fast. */
export async function resizeImage(file: File, max = 1600): Promise<string> {
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
    return canvas.toDataURL("image/jpeg", 0.82);
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

  if (last.image) {
    if (!demo) return { role: "assistant", text: "Photo scanning needs the AI connection. You can tick items off on the Pantry tab meanwhile.", note };
    const items = DEMO_SCAN.map((i) => ({ ...i }));
    const ranked = rankDishes([...pantry, ...items.map((i) => i.name)]).slice(0, 3);
    return {
      role: "assistant",
      text: "I can see a well-stocked West African shelf. Untick anything I got wrong, then add the rest.",
      cards: [{ type: "scan", items }, { type: "dishes", dishIds: ranked.map((m) => m.dish.id) }],
      note,
    };
  }

  if (/(out of|ran out|run out|running low|low on|need more|don'?t have|no more|missing|need to buy|where.*buy)/.test(text)) {
    const ing = findIngredient(text);
    if (!ing) return { role: "assistant", text: "Which ingredient are you out of?", note };
    const s = substituteFor(ing);
    const shopQuery = /^(any )?supermarket$/i.test(s.shop) ? "grocery store" : s.shop;
    const cards: Card[] = [
      {
        type: "swap",
        ingredient: ing,
        cheapest: s.swap,
        authentic: s.essential ? `Get the real thing from ${/^[aeiou]/i.test(s.shop) ? "an" : "a"} ${s.shop}.${s.tip ? " " + s.tip : ""}` : `${s.swap}. ${s.tradeoff}`,
        fastest: `Use the swap tonight and order real ${ing} for next time.`,
        tradeoff: s.tradeoff,
        essential: s.essential,
        source: "pantryroots",
      },
      {
        type: "stores",
        ingredient: ing,
        stores: demo ? DEMO_STORES : [],
        searchUrl: mapsSearchUrl(`${shopQuery} near me`),
        source: demo ? "demo" : "link",
      },
      { type: "cart", items: [cleanItem(ing)], url: instacartSearchUrl(s.search || ing), source: "link", eta: DELIVERY_ETA },
    ];
    return {
      role: "assistant",
      text: s.essential
        ? `No good swap keeps ${ing} tasting right, so it's worth the trip. Here's a stand-in if you can't wait.`
        : `Easy one. Here's a swap from your kitchen, plus where to get the real thing.`,
      cards,
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
