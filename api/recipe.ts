import { ENV } from "./_lib/env.js";
import { OutOfTime, callModel, parseJsonReply, type GatewayMessage } from "./_lib/llm.js";

/**
 * POST /api/recipe — Family Recipe Keeper.
 * Turns a recipe told in someone's own words ("you fry the pepper until the oil
 * comes up…") into a structured recipe card, keeping their voice.
 */

const TONES = ["red", "green", "gold", "brown", "cream", "orange"] as const;
type Tone = (typeof TONES)[number];

export type RecipeRequest = { text: string; title?: string; from?: string; origin?: string };
export type RecipeDish = {
  name: string;
  origin: string;
  summary: string;
  minutes: number;
  ingredients: string[];
  technique: string;
  steps: string[];
  tone: Tone;
};
export type RecipeResponse = { dish: RecipeDish; quote: string };
type RecipeError = { error: "bad_request" | "ai_unavailable" | "server_error" | "rate_limited"; message: string };

const MAX_TEXT = 6000;

const SYSTEM = `You turn a family recipe, told in someone's own words, into a clean recipe card. These recipes are precious: the cook is often a mother or grandmother, and the family wants her voice kept.

Return ONLY a JSON object with this exact shape:
{"dish":{"name":string,"origin":string,"summary":string,"minutes":number,"ingredients":string[],"technique":string,"steps":string[],"tone":"red"|"green"|"gold"|"brown"|"cream"|"orange"},"quote":string}

Rules:
- Be faithful. Do NOT invent ingredients or steps that the text doesn't state or clearly imply. If it says "season it", write "Season it"; don't name seasonings that weren't mentioned.
- If amounts or times are missing, do not make them up. Keep amounts only when the cook gave them, and keep them inside the step text.
- ingredients: lowercase plain grocery names with no amounts, e.g. "scotch bonnet", "palm oil", "onion". No duplicates.
- steps: clear, imperative sentences in order. Keep the cook's own phrasing where it's charming or carries know-how ("fry the pepper until the oil comes up"). Split run-on speech into separate steps.
- technique: one or two sentences on the thing that makes her version hers, taken from the text.
- summary: one or two warm, plain sentences describing the dish as told. Don't claim history the text doesn't give.
- minutes: your honest estimate of total cooking time from what's described; round to 5.
- origin: use the origin given if any; otherwise the people or place the text mentions; otherwise "Family recipe".
- tone: the dominant colour of the finished dish.
- quote: one short line (under 140 characters) copied word for word from the input, the most characterful thing the cook said. Never paraphrase it.
- If the text isn't a recipe at all, return {"error":"not_a_recipe"}.`;

const hits = new Map<string, number[]>();
function limited(ip: string) {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < 60_000);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > 12;
}

function json(body: RecipeResponse | RecipeError, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
}

const str = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");

function validateInput(body: unknown): RecipeRequest | null {
  const b = body as Record<string, unknown> | null;
  if (!b || typeof b !== "object" || typeof b.text !== "string") return null;
  const text = b.text.trim();
  if (text.length < 20 || text.length > MAX_TEXT) return null;
  for (const k of ["title", "from", "origin"]) if (b[k] !== undefined && b[k] !== null && typeof b[k] !== "string") return null;
  return { text, title: str(b.title, 80) || undefined, from: str(b.from, 60) || undefined, origin: str(b.origin, 80) || undefined };
}

/** Check the model's answer and clamp every field, so the client can trust the shape. */
export function cleanReply(raw: unknown, req: RecipeRequest): RecipeResponse | null {
  const r = raw as { dish?: Record<string, unknown>; quote?: unknown } | null;
  const d = r?.dish;
  if (!d || typeof d !== "object") return null;

  const name = req.title || str(d.name, 80);
  const ingredients = [
    ...new Set(
      (Array.isArray(d.ingredients) ? d.ingredients : [])
        .map((i) => str(i, 50).toLowerCase().replace(/[.;:]+$/, ""))
        .filter(Boolean),
    ),
  ].slice(0, 30);
  const steps = (Array.isArray(d.steps) ? d.steps : []).map((s) => str(s, 400)).filter(Boolean).slice(0, 20);
  if (!name || !steps.length) return null;

  const minutesRaw = typeof d.minutes === "number" ? d.minutes : Number(d.minutes);
  const minutes = Number.isFinite(minutesRaw) ? Math.min(600, Math.max(5, Math.round(minutesRaw / 5) * 5)) : 45;
  const tone = TONES.includes(d.tone as Tone) ? (d.tone as Tone) : "brown";

  // The quote must really be the cook's words: keep it only if it appears in the input.
  let quote = str(r?.quote, 160).replace(/^["“'‘]+|["”'’]+$/g, "");
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  if (quote && !norm(req.text).includes(norm(quote))) quote = "";

  return {
    dish: {
      name,
      origin: req.origin || str(d.origin, 80) || "Family recipe",
      summary: str(d.summary, 400),
      minutes,
      ingredients,
      technique: str(d.technique, 400),
      steps,
      tone,
    },
    quote,
  };
}

export async function POST(request: Request): Promise<Response> {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (limited(ip)) return json({ error: "rate_limited", message: "Too many requests. Wait a minute and try again." }, 429);

  let req: RecipeRequest | null = null;
  try {
    req = validateInput(await request.json());
  } catch {
    req = null;
  }
  if (!req) return json({ error: "bad_request", message: `Write or say the recipe in at least a sentence (up to ${MAX_TEXT} characters).` }, 400);
  if (!ENV.aiKey) return json({ error: "ai_unavailable", message: "The AI key isn't set up yet, so we can't shape the recipe right now." }, 503);

  const context = [
    req.title && `Dish name (use exactly): ${req.title}`,
    req.from && `Whose recipe: ${req.from}`,
    req.origin && `Origin: ${req.origin}`,
  ].filter(Boolean);
  const messages: GatewayMessage[] = [
    { role: "system", content: SYSTEM },
    { role: "user", content: `${context.length ? context.join("\n") + "\n\n" : ""}The recipe, in their words:\n"""\n${req.text}\n"""` },
  ];

  const deadline = Date.now() + 25_000;
  try {
    const msg = await callModel(messages, deadline, { json: true, maxTokens: 1600 });
    const parsed = parseJsonReply<Record<string, unknown>>(typeof msg?.content === "string" ? msg.content : null);
    if (parsed && parsed.error === "not_a_recipe") {
      return json({ error: "bad_request", message: "That doesn't read like a recipe yet. Say what goes in and what you do with it." }, 422);
    }
    const out = parsed && cleanReply(parsed, req);
    if (!out) return json({ error: "server_error", message: "The AI's answer didn't come back as a recipe. Try again, or save it as written." }, 502);
    return json(out);
  } catch (e) {
    if (e instanceof OutOfTime || (e as { status?: number }).status === 504) {
      return json({ error: "server_error", message: "The AI took too long to answer. Try again, or save it as written." }, 504);
    }
    const status = (e as { status?: number }).status;
    console.error("[recipe]", status, String((e as Error)?.message ?? e).slice(0, 200));
    if (status === 401 || status === 402 || status === 403 || status === 429) {
      return json({ error: "ai_unavailable", message: "The AI service isn't available right now. Save it as written and shape it later." }, 503);
    }
    return json({ error: "server_error", message: "Something went wrong shaping the recipe. Try again, or save it as written." }, 502);
  }
}
