import { MAX_IMAGES, MAX_IMAGE_CHARS, SCAN_MODES, type Card, type ConciergeError, type ConciergeRequest, type ConciergeResponse, type ScanItem, type ScanMode } from "../src/lib/concierge-types.js";
import { ENV, setupStatus } from "./_lib/env.js";
import { BUDGET_MS, OutOfTime, callModel, lastModelUsed, type GatewayMessage } from "./_lib/llm.js";
import { DISH_NAMES, TOOL_DEFS, runTool, type ToolContext } from "./_lib/tools.js";

/**
 * POST /api/concierge — the Kitchen Concierge agent.
 * Runs a short tool loop against Vercel AI Gateway (OpenAI-compatible) and
 * returns the final text plus the cards the tools produced.
 */

const SYSTEM = `You are the PantryRoots Kitchen Concierge, running on Meta's Muse models: a warm, practical cooking helper who knows food traditions by the people who cook them (Yoruba, Akan, Wolof, Amhara and many more), not just by country.

You help with three things:
1. Pantry scans. When the user sends a photo, call show_pantry_scan and match_dishes (with what you saw as extra_items) together in the same turn.
   - Fridge sweep: several frames from one short video of the same kitchen. Inventory across all frames and list each item once (the same jar seen in two frames is one item).
   - Receipt: decode store abbreviations into plain grocery names ("PLNTN RIPE 3CT" is Plantain, "RED PLM OIL 1L" is Palm Oil). Skip non-food lines (bags, tax, totals, discounts, deposits). Use confidence "check" when an abbreviation is ambiguous, use_soon for fresh produce, meat and fish, and put the printed line in note as from 'LINE'.
2. What to cook. Always call match_dishes first. The curated dishes are: ${DISH_NAMES}. If the user wants other cuisines or matches are weak, you may call suggest_ai_dish once or twice for dishes from other traditions.
3. Running out. When the user is out of an ingredient, call find_substitute, find_stores and create_cart TOGETHER in the same turn (parallel tool calls) to save time. Only if find_substitute returns found:false, follow up with show_substitute. Treat "running low on X" or "need more X" the same way, but lead with where to restock (find_stores, create_cart) and keep the swap brief.

Rules:
- Cards show the details. Keep your text short: 1–3 sentences, plain and friendly, no lists, no markdown headings.
- Never invent store names, addresses, distances, prices or delivery times. Only mention store facts a tool returned.
- If find_stores returns need_location, ask for their ZIP code in one short sentence.
- Respect authenticity: say plainly when a swap changes the dish.
- Stay on cooking, ingredients and shopping. Politely decline anything else.`;

// Very small in-memory rate limit (per warm instance). Enough to stop runaway loops in a demo.
const hits = new Map<string, number[]>();
function limited(ip: string) {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < 60_000);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > 20;
}

function json(body: ConciergeResponse | ConciergeError, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
}


/** All images on a message: the newer `images` list plus the older single `image`. */
function imagesOf(m: ConciergeRequest["messages"][number]): string[] {
  return [...(m.image ? [m.image] : []), ...(m.images ?? [])];
}

function modeOf(m: ConciergeRequest["messages"][number]): ScanMode {
  return m.mode ?? (imagesOf(m).length > 1 ? "sweep" : "photo");
}

/** Text that travels with the images so the model knows what it is looking at. */
function modeInstruction(mode: ScanMode, count: number) {
  if (mode === "sweep")
    return `These are ${count} frames, in order, from a short video sweep of my fridge or pantry. Inventory everything across all frames; merge duplicates (the same item seen in several frames is one item).`;
  if (mode === "receipt")
    return "This is a grocery receipt. Decode each food line into a plain grocery name, skip non-food lines (bags, tax, totals, discounts), and put the printed line in note as from 'LINE'.";
  return "This is a photo of my pantry, fridge or shelf.";
}

const SENT_LABEL: Record<ScanMode, string> = { photo: "[sent a photo] ", sweep: "[sent a fridge sweep video] ", receipt: "[sent a receipt photo] " };

function toGatewayMessages(req: ConciergeRequest): GatewayMessage[] {
  const out: GatewayMessage[] = [{ role: "system", content: SYSTEM }];
  const recent = req.messages.slice(-12);
  recent.forEach((m, i) => {
    const isLast = i === recent.length - 1;
    const images = imagesOf(m);
    if (m.role === "user" && images.length && isLast) {
      const mode = modeOf(m);
      out.push({
        role: "user",
        content: [
          { type: "text", text: `${m.text || "Here's my pantry. What do you see?"}\n\n${modeInstruction(mode, images.length)}` },
          ...images.map((url) => ({ type: "image_url", image_url: { url } })),
        ],
      });
    } else {
      const sent = images.length || m.imageCount ? SENT_LABEL[modeOf(m)] : "";
      out.push({ role: m.role, content: sent + m.text });
    }
  });
  const facts = [`Current pantry: ${req.pantry.join(", ") || "empty"}.`];
  if (req.profile) facts.push(`About the cook: ${req.profile.slice(0, 300)}. Favour dishes from their roots when choosing between similar matches, and use their traditions when writing AI dishes.`);
  facts.push(req.location ? "Location: shared." : req.zip ? `ZIP: ${req.zip}.` : "Location: not shared yet.");
  out.splice(1, 0, { role: "system", content: facts.join(" ") });
  return out;
}


const DATA_IMAGE = /^data:image\/(jpeg|jpg|png|webp|gif|heic|heif);base64,[A-Za-z0-9+/=]+$/;

/** Returns the request, or a plain-language reason it was rejected. */
function validate(body: unknown): ConciergeRequest | string {
  const b = body as ConciergeRequest;
  if (!b || !Array.isArray(b.messages) || !b.messages.length || !Array.isArray(b.pantry)) return "That request didn't look right.";
  if (b.messages.some((m) => typeof m?.text !== "string" || (m.role !== "user" && m.role !== "assistant"))) return "That request didn't look right.";
  const lastIndex = b.messages.length - 1;
  for (const [i, m] of b.messages.entries()) {
    if (m.mode !== undefined && !SCAN_MODES.includes(m.mode)) m.mode = undefined;
    if (m.imageCount !== undefined && (typeof m.imageCount !== "number" || m.imageCount < 0 || m.imageCount > MAX_IMAGES)) m.imageCount = undefined;
    if (i !== lastIndex) {
      // Only the newest message may carry pictures; older ones are dropped, not rejected.
      if (m.image || m.images) m.imageCount = m.imageCount ?? ((m.images?.length ?? 0) + (m.image ? 1 : 0) || undefined);
      m.image = undefined;
      m.images = undefined;
    }
  }
  const last = b.messages[lastIndex];
  if (last.images !== undefined && !Array.isArray(last.images)) return "Those photos didn't come through. Try again.";
  if (last.image !== undefined && typeof last.image !== "string") return "That photo didn't come through. Try again.";
  const images = imagesOf(last);
  if (images.length > MAX_IMAGES) return `That's too many pictures. Send up to ${MAX_IMAGES} at once.`;
  if (images.some((u) => typeof u !== "string" || !DATA_IMAGE.test(u.slice(0, 64)) || u.length < 100)) return "That photo didn't come through. Try a JPEG or PNG.";
  if (images.reduce((n, u) => n + u.length, 0) > MAX_IMAGE_CHARS) return "Those pictures are too large to send. Try a shorter video or a single photo.";
  if (images.length && last.role !== "user") return "That request didn't look right.";
  if (b.zip && !/^\d{5}$/.test(b.zip)) b.zip = undefined;
  return b;
}

/**
 * Tidy a scan card the tools just made: merge duplicate items (a sweep often sees the
 * same jar twice), say where the items came from, and keep receipt lines the model
 * put in `note` (the shared tool only keeps notes for use-soon items).
 */
function tidyScanCard(card: Extract<Card, { type: "scan" }>, args: unknown, mode: ScanMode | null) {
  const raw = (Array.isArray((args as { items?: unknown })?.items) ? (args as { items: unknown[] }).items : [])
    .filter((i): i is { name: string; note?: unknown } => typeof (i as { name?: unknown })?.name === "string" && !!(i as { name: string }).name.trim())
    .slice(0, 40);
  const merged = new Map<string, ScanItem>();
  card.items.forEach((item, i) => {
    let next = item;
    const note = raw[i]?.note;
    if (mode === "receipt" && !item.note && typeof note === "string" && note.trim()) next = { ...item, note: note.trim().slice(0, 48) };
    const key = next.name.toLowerCase();
    const prev = merged.get(key);
    if (!prev) merged.set(key, next);
    else
      merged.set(key, {
        ...prev,
        confidence: prev.confidence === "sure" || next.confidence === "sure" ? "sure" : "check",
        ...(prev.useSoon || next.useSoon ? { useSoon: true, note: prev.useSoon ? prev.note : next.note } : {}),
      });
  });
  card.items = [...merged.values()];
  if (mode && mode !== "photo") card.source = mode;
}

/** GET /api/concierge — setup check. Shows which settings exist, never their values. */
export async function GET(): Promise<Response> {
  return new Response(JSON.stringify(setupStatus(), null, 2), { headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
}

export async function POST(request: Request): Promise<Response> {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (limited(ip)) return json({ error: "rate_limited", message: "Too many requests. Wait a minute and try again." }, 429);

  let checked: ConciergeRequest | string = "That request didn't look right.";
  try {
    checked = validate(await request.json());
  } catch {
    /* fall through */
  }
  if (typeof checked === "string") return json({ error: "bad_request", message: checked }, 400);
  const req = checked;
  const lastMsg = req.messages[req.messages.length - 1];
  const scanMode: ScanMode | null = imagesOf(lastMsg).length ? modeOf(lastMsg) : null;
  if (!ENV.aiKey) return json({ error: "ai_unavailable", message: "The AI key isn't set up yet." }, 503);

  const messages = toGatewayMessages(req);
  const cards: Card[] = [];
  const ctx: ToolContext = { req, extraPantry: [] };
  const deadline = Date.now() + BUDGET_MS;

  try {
    for (let step = 0; step < 5; step++) {
      // Running low on time but already have cards? Show them rather than risk a timeout.
      if (cards.length && deadline - Date.now() < 10_000) break;
      const msg = await callModel(messages, deadline, { tools: TOOL_DEFS });
      if (!msg) break;
      messages.push({ role: "assistant", content: msg.content ?? null, tool_calls: msg.tool_calls });
      if (!msg.tool_calls?.length) {
        const text = typeof msg.content === "string" ? msg.content.trim() : "";
        return json({ text: text || (cards.length ? "Here's what I found." : "Sorry, I didn't catch that."), cards, model: lastModelUsed() ?? undefined });
      }
      // Run this turn's tools in parallel (e.g. stores + cart at once), keep their order for the cards.
      const results = await Promise.all(
        msg.tool_calls.map(async (call) => {
          let args = {};
          try {
            args = JSON.parse(call.function.arguments || "{}");
          } catch {
            /* model sent bad JSON — run with empty args */
          }
          const out = await runTool(call.function.name, args, ctx);
          if (out.card?.type === "scan") tidyScanCard(out.card, args, scanMode);
          return out;
        }),
      );
      msg.tool_calls.forEach((call, i) => {
        const { result, card } = results[i];
        if (card) cards.push(card);
        messages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify(result) });
      });
    }
    return json({ text: cards.length ? "Here's what I found." : "That took too long. Try again.", cards, model: lastModelUsed() ?? undefined });
  } catch (e) {
    if (e instanceof OutOfTime || ((e as { status?: number }).status === 504 && cards.length)) {
      if (cards.length) return json({ text: "Here's what I found so far.", cards, model: lastModelUsed() ?? undefined });
      return json({ error: "server_error", message: "The AI took too long to answer. Try again." }, 504);
    }
    const status = (e as { status?: number }).status;
    // The gateway's own reason (e.g. "insufficient credits", "invalid API key", "model not found").
    const detail = String((e as Error).message ?? "").replace(/^gateway \d+: /, "").slice(0, 240);
    console.error("[concierge]", status, detail);
    if (status === 401 || status === 402 || status === 403 || status === 429) {
      return json({ error: "ai_unavailable", message: `AI Gateway refused the request (HTTP ${status}, model ${ENV.model}): ${detail}` }, 503);
    }
    if (status) {
      return json({ error: "server_error", message: `AI Gateway error (HTTP ${status}, model ${ENV.model}): ${detail}` }, 502);
    }
    return json({ error: "server_error", message: "Something went wrong on our side." }, 500);
  }
}
