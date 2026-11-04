import { ENV } from "./_lib/env.js";
import { OutOfTime, callModel, parseJsonReply, type GatewayMessage } from "./_lib/llm.js";

/**
 * POST /api/macros — rough per-serving nutrition for a dish.
 * This is an estimate for a typical home serving, never a measurement. The client
 * labels it as such and lets people copy it into MyFitnessPal (which has no public API).
 */

export type MacrosRequest = { dish: { name: string; ingredients: string[]; summary?: string; minutes?: number } };
export type MacrosEstimate = {
  servingNote: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber?: number;
  confidence: "low" | "medium";
};
type MacrosError = { error: "bad_request" | "ai_unavailable" | "server_error" | "rate_limited"; message: string };

const SYSTEM = `You estimate nutrition for one typical home-cooked serving of a dish, as a supportive, neutral helper. Macros are information, never judgement.

Return ONLY a JSON object with this exact shape:
{"servingNote":string,"calories":number,"protein":number,"carbs":number,"fat":number,"fiber":number,"confidence":"low"|"medium"}

Rules:
- Assume a realistic home serving the way this dish is usually eaten (one plate or bowl, with its usual starch or side if that is how it's served). Describe it in servingNote in plain words, under 80 characters, e.g. "1 plate, about 1½ cups rice with sauce".
- Use realistic ranges for home cooking, including typical cooking oil. Don't low-ball oil or palm oil in stews.
- protein, carbs, fat and fiber are grams per serving. Round calories to the nearest 10 and grams to the nearest 1.
- Calories should roughly agree with 4 kcal/g protein, 4 kcal/g carbs and 9 kcal/g fat.
- Never claim precision. confidence is "medium" at most; use "low" when the ingredients or amounts are vague, unusual, or the serving size varies a lot.
- No words like healthy, unhealthy, good, bad, guilty, clean or cheat. No advice. Just the numbers and the serving note.`;

const LIMITS = {
  calories: [50, 2000],
  protein: [0, 200],
  carbs: [0, 300],
  fat: [0, 150],
  fiber: [0, 80],
} as const;

const hits = new Map<string, number[]>();
function limited(ip: string) {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < 60_000);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > 20;
}

function json(body: MacrosEstimate | MacrosError, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
}

const str = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");

export function validateInput(body: unknown): MacrosRequest | null {
  const d = (body as { dish?: Record<string, unknown> } | null)?.dish;
  if (!d || typeof d !== "object") return null;
  const name = str(d.name, 100);
  if (!name || !Array.isArray(d.ingredients)) return null;
  if (d.ingredients.length > 60) return null;
  const ingredients = [...new Set(d.ingredients.map((i) => str(i, 60)).filter(Boolean))].slice(0, 40);
  if (!ingredients.length) return null;
  if (d.summary !== undefined && d.summary !== null && typeof d.summary !== "string") return null;
  if (d.minutes !== undefined && d.minutes !== null && typeof d.minutes !== "number") return null;
  const minutes = typeof d.minutes === "number" && Number.isFinite(d.minutes) ? Math.min(1440, Math.max(1, Math.round(d.minutes))) : undefined;
  return { dish: { name, ingredients, summary: str(d.summary, 400) || undefined, minutes } };
}

function num(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v.replace(/[^\d.]/g, "")) : NaN;
  return Number.isFinite(n) ? n : null;
}
const clamp = (n: number, [lo, hi]: readonly [number, number]) => Math.min(hi, Math.max(lo, n));

/** Check and clamp the model's answer so the client can trust the shape and the ranges. */
export function cleanReply(raw: unknown): MacrosEstimate | null {
  const r = raw as Record<string, unknown> | null;
  if (!r || typeof r !== "object") return null;
  const p = num(r.protein);
  const c = num(r.carbs);
  const f = num(r.fat);
  let kcal = num(r.calories);
  if (p === null || c === null || f === null) return null;

  const protein = Math.round(clamp(p, LIMITS.protein));
  const carbs = Math.round(clamp(c, LIMITS.carbs));
  const fat = Math.round(clamp(f, LIMITS.fat));
  // If the stated calories disagree badly with the macros, trust the macros.
  const fromMacros = protein * 4 + carbs * 4 + fat * 9;
  if (kcal === null || (fromMacros > 0 && Math.abs(kcal - fromMacros) / fromMacros > 0.35)) kcal = fromMacros;
  const calories = Math.round(clamp(kcal, LIMITS.calories) / 10) * 10;

  const fib = num(r.fiber);
  const out: MacrosEstimate = {
    servingNote: str(r.servingNote, 100) || "1 typical home serving",
    calories,
    protein,
    carbs,
    fat,
    confidence: r.confidence === "medium" ? "medium" : "low",
  };
  if (fib !== null) out.fiber = Math.round(clamp(fib, LIMITS.fiber));
  return out;
}

export async function POST(request: Request): Promise<Response> {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (limited(ip)) return json({ error: "rate_limited", message: "Too many requests. Wait a minute and try again." }, 429);

  let req: MacrosRequest | null = null;
  try {
    const text = await request.text();
    req = text.length <= 20_000 ? validateInput(JSON.parse(text)) : null;
  } catch {
    req = null;
  }
  if (!req) return json({ error: "bad_request", message: "Send a dish with a name and at least one ingredient." }, 400);
  if (!ENV.aiKey) return json({ error: "ai_unavailable", message: "The AI key isn't set up yet, so we can't estimate macros right now." }, 503);

  const { dish } = req;
  const lines = [
    `Dish: ${dish.name}`,
    `Ingredients: ${dish.ingredients.join(", ")}`,
    dish.summary && `About it: ${dish.summary}`,
    dish.minutes && `Cooking time: ${dish.minutes} min`,
  ].filter(Boolean);
  const messages: GatewayMessage[] = [
    { role: "system", content: SYSTEM },
    { role: "user", content: lines.join("\n") },
  ];

  const deadline = Date.now() + 25_000;
  try {
    const msg = await callModel(messages, deadline, { json: true, maxTokens: 300 });
    const parsed = parseJsonReply<Record<string, unknown>>(typeof msg?.content === "string" ? msg.content : null);
    const out = parsed && cleanReply(parsed);
    if (!out) return json({ error: "server_error", message: "The estimate didn't come back in a usable form. Try again." }, 502);
    return json(out);
  } catch (e) {
    if (e instanceof OutOfTime || (e as { status?: number }).status === 504) {
      return json({ error: "server_error", message: "The AI took too long to answer. Try again." }, 504);
    }
    const status = (e as { status?: number }).status;
    console.error("[macros]", status, String((e as Error)?.message ?? e).slice(0, 200));
    if (status === 401 || status === 402 || status === 403 || status === 429) {
      return json({ error: "ai_unavailable", message: "The AI service isn't available right now. Try again later." }, 503);
    }
    return json({ error: "server_error", message: "Something went wrong estimating macros. Try again." }, 502);
  }
}
