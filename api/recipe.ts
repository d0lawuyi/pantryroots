import { ENV } from "./_lib/env.js";
import { OutOfTime, callModel, parseJsonReply, type GatewayMessage } from "./_lib/llm.js";

/**
 * POST /api/recipe — Family Recipe Keeper.
 * Turns a recipe told in someone's own words ("you fry the pepper until the oil
 * comes up…") into a structured recipe card, keeping their voice.
 * Also reads a photo of a handwritten recipe card, notebook or cookbook page
 * (Muse vision): `image` is a data:image/... URL; the reply then adds `transcript`.
 */

const TONES = ["red", "green", "gold", "brown", "cream", "orange"] as const;
type Tone = (typeof TONES)[number];

export type RecipeRequest = { text: string; title?: string; from?: string; origin?: string; image?: string };
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
export type RecipeResponse = { dish: RecipeDish; quote: string; transcript?: string };
type RecipeError = { error: "bad_request" | "ai_unavailable" | "server_error" | "rate_limited"; message: string };

const MAX_TEXT = 6000;
/** Longest accepted image data URL (about 2.6 MB of JPEG). The client downsizes to 1600px first. */
export const MAX_IMAGE = 3_500_000;
const MAX_TRANSCRIPT = 4000;
const IMAGE_URL = /^data:image\/(png|jpe?g|webp|gif|heic|heif);base64,[A-Za-z0-9+/=]+$/;

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

const SYSTEM_IMAGE = `You read a photo of a family recipe: a handwritten recipe card, a notebook page, or a cookbook page. These are precious, often written by a mother or grandmother, and the family wants her words kept exactly.

First transcribe the page, then turn it into a clean recipe card.

Return ONLY a JSON object with this exact shape:
{"transcript":string,"dish":{"name":string,"origin":string,"summary":string,"minutes":number,"ingredients":string[],"technique":string,"steps":string[],"tone":"red"|"green"|"gold"|"brown"|"cream"|"orange"},"quote":string}

Rules:
- transcript: everything written on the page, line by line (use \\n between lines), exactly as written, including handwriting. Keep the cook's own spelling, grammar, abbreviations and phrasing. Do not correct or tidy it. Leave out words that are crossed out. If you can't read a word, write your best reading followed by "(unclear)", e.g. "iru (unclear)"; never silently guess. Up to 4000 characters.
- Be faithful. Never invent ingredients, amounts, times or steps that aren't on the page. If it says "season it", write "Season it".
- name: the dish name if it's written on the page; otherwise a short plain name for what the page describes.
- ingredients: every ingredient mentioned on the page, as lowercase plain grocery names with no amounts, e.g. "scotch bonnet", "palm oil", "onion". No duplicates.
- steps: clear sentences in the page's order. Keep amounts only where the page gives them, inside the step text. Keep the cook's own words where they are charming or carry know-how ("fry it well well till the oil float"). Carry "(unclear)" markers into steps where they matter.
- technique: one or two sentences on what makes this version hers, taken from the page.
- summary: one or two warm, plain sentences describing the dish as written. Don't claim history the page doesn't give.
- minutes: your honest estimate of total cooking time from the page; round to 5.
- origin: use the origin given if any; otherwise the people or place the page mentions; otherwise "Family recipe".
- tone: the dominant colour of the finished dish.
- quote: one short line (under 140 characters) copied word for word from your transcript, the most characterful thing the cook wrote. Never paraphrase it.
- If the photo isn't a recipe or you can't read any of it, return {"error":"not_a_recipe"}.`;

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

/** Photo requests: an image data URL, plus optional notes in `text`. Returns a plain error message when invalid. */
function validateImageInput(b: Record<string, unknown>): RecipeRequest | string {
  const image = b.image;
  if (typeof image !== "string") return "Send the photo as an image.";
  if (image.length > MAX_IMAGE) return "That photo is too large. Try a smaller photo, or take it a little further away.";
  if (!IMAGE_URL.test(image)) return "That file isn't a photo we can read. Use a JPEG or PNG picture of the recipe.";
  if (b.text !== undefined && b.text !== null && (typeof b.text !== "string" || b.text.length > MAX_TEXT)) return "Notes with the photo must be text, up to 6000 characters.";
  for (const k of ["title", "from", "origin"]) if (b[k] !== undefined && b[k] !== null && typeof b[k] !== "string") return "Check the recipe details and try again.";
  return {
    image,
    text: typeof b.text === "string" ? b.text.trim() : "",
    title: str(b.title, 80) || undefined,
    from: str(b.from, 60) || undefined,
    origin: str(b.origin, 80) || undefined,
  };
}

/** Keep transcript line breaks, but tidy spaces and cap the length. */
function cleanTranscript(v: unknown) {
  if (typeof v !== "string") return "";
  return v
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((l) => l.replace(/[ \t]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, MAX_TRANSCRIPT);
}

/** Check the model's answer and clamp every field, so the client can trust the shape. */
export function cleanReply(raw: unknown, req: RecipeRequest): RecipeResponse | null {
  const r = raw as { dish?: Record<string, unknown>; quote?: unknown; transcript?: unknown } | null;
  const d = r?.dish;
  if (!d || typeof d !== "object") return null;
  // For photos, the transcript is the source of truth: the quote must come from it.
  const transcript = req.image ? cleanTranscript(r?.transcript) : undefined;
  if (req.image && !transcript) return null;
  const source = transcript ?? req.text;

  const name = req.title || str(d.name, 80);
  const ingredients = [
    ...new Set(
      (Array.isArray(d.ingredients) ? d.ingredients : [])
        .map((i) => str(i, 50).toLowerCase().replace(/[.;:]+$/, ""))
        .filter(Boolean),
    ),
  ].slice(0, 30);
  const steps = (Array.isArray(d.steps) ? d.steps : []).map((s) => str(s, 400)).filter(Boolean).slice(0, 20);
  // Photos: an ingredient must be on the page. Match on word stems so "tomato" still finds "tomatoes".
  const onPage = (name: string) => {
    if (!transcript) return true;
    const page = " " + transcript.toLowerCase().replace(/[^a-z0-9]+/g, " ");
    const words = name.split(/[^a-z0-9]+/).filter((w) => w.length >= 3);
    return !words.length || words.some((w) => page.includes(" " + w.slice(0, 5)));
  };
  const kept = ingredients.filter(onPage);
  if (!name || !steps.length) return null;

  const minutesRaw = typeof d.minutes === "number" ? d.minutes : Number(d.minutes);
  const minutes = Number.isFinite(minutesRaw) ? Math.min(600, Math.max(5, Math.round(minutesRaw / 5) * 5)) : 45;
  const tone = TONES.includes(d.tone as Tone) ? (d.tone as Tone) : "brown";

  // The quote must really be the cook's words: keep it only if it appears in the input.
  let quote = str(r?.quote, 160).replace(/^["“'‘]+|["”'’]+$/g, "");
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  if (quote && !norm(source).includes(norm(quote))) quote = "";

  const out: RecipeResponse = {
    dish: {
      name,
      origin: req.origin || str(d.origin, 80) || "Family recipe",
      summary: str(d.summary, 400),
      minutes,
      ingredients: kept,
      technique: str(d.technique, 400),
      steps,
      tone,
    },
    quote,
  };
  if (transcript !== undefined) out.transcript = transcript;
  return out;
}

export async function POST(request: Request): Promise<Response> {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (limited(ip)) return json({ error: "rate_limited", message: "Too many requests. Wait a minute and try again." }, 429);

  let req: RecipeRequest | null = null;
  let imageProblem = "";
  try {
    const body = (await request.json()) as Record<string, unknown> | null;
    if (body && typeof body === "object" && body.image !== undefined && body.image !== null) {
      const v = validateImageInput(body);
      if (typeof v === "string") imageProblem = v;
      else req = v;
    } else {
      req = validateInput(body);
    }
  } catch {
    req = null;
  }
  if (imageProblem) return json({ error: "bad_request", message: imageProblem }, 400);
  if (!req) return json({ error: "bad_request", message: `Write or say the recipe in at least a sentence (up to ${MAX_TEXT} characters).` }, 400);
  if (!ENV.aiKey) return json({ error: "ai_unavailable", message: "The AI key isn't set up yet, so we can't shape the recipe right now." }, 503);

  const context = [
    req.title && `Dish name (use exactly): ${req.title}`,
    req.from && `Whose recipe: ${req.from}`,
    req.origin && `Origin: ${req.origin}`,
  ].filter(Boolean);
  const messages: GatewayMessage[] = req.image
    ? [
        { role: "system", content: SYSTEM_IMAGE },
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `${context.length ? context.join("\n") + "\n\n" : ""}${req.text ? `Notes from the family (not on the page):\n"""\n${req.text}\n"""\n\n` : ""}Read this recipe page and return the JSON.`,
            },
            { type: "image_url", image_url: { url: req.image } },
          ],
        },
      ]
    : [
        { role: "system", content: SYSTEM },
        { role: "user", content: `${context.length ? context.join("\n") + "\n\n" : ""}The recipe, in their words:\n"""\n${req.text}\n"""` },
      ];

  // Reading handwriting takes the vision model a little longer.
  const deadline = Date.now() + (req.image ? 30_000 : 25_000);
  const instead = req.image ? "type it in instead" : "save it as written";
  try {
    const msg = await callModel(messages, deadline, { json: true, maxTokens: req.image ? 3000 : 1600 });
    const parsed = parseJsonReply<Record<string, unknown>>(typeof msg?.content === "string" ? msg.content : null);
    if (parsed && parsed.error === "not_a_recipe") {
      const message = req.image
        ? "We couldn't find a recipe we could read in that photo. Try a closer, brighter photo of the page."
        : "That doesn't read like a recipe yet. Say what goes in and what you do with it.";
      return json({ error: "bad_request", message }, 422);
    }
    const out = parsed && cleanReply(parsed, req);
    if (!out) return json({ error: "server_error", message: `The AI's answer didn't come back as a recipe. Try again, or ${instead}.` }, 502);
    return json(out);
  } catch (e) {
    if (e instanceof OutOfTime || (e as { status?: number }).status === 504) {
      return json({ error: "server_error", message: `The AI took too long to answer. Try again, or ${instead}.` }, 504);
    }
    const status = (e as { status?: number }).status;
    console.error("[recipe]", status, String((e as Error)?.message ?? e).slice(0, 200));
    if (status === 401 || status === 402 || status === 403 || status === 429) {
      return json({ error: "ai_unavailable", message: req.image ? "The AI service isn't available right now. Try again later, or type it in instead." : "The AI service isn't available right now. Save it as written and shape it later." }, 503);
    }
    return json({ error: "server_error", message: `Something went wrong ${req.image ? "reading the photo" : "shaping the recipe"}. Try again, or ${instead}.` }, 502);
  }
}
