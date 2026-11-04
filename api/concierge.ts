import type { Card, ConciergeError, ConciergeRequest, ConciergeResponse } from "../src/lib/concierge-types.js";
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


function toGatewayMessages(req: ConciergeRequest): GatewayMessage[] {
  const out: GatewayMessage[] = [{ role: "system", content: SYSTEM }];
  const recent = req.messages.slice(-12);
  recent.forEach((m, i) => {
    const isLast = i === recent.length - 1;
    if (m.role === "user" && m.image && isLast) {
      out.push({
        role: "user",
        content: [
          { type: "text", text: m.text || "Here's my pantry. What do you see?" },
          { type: "image_url", image_url: { url: m.image } },
        ],
      });
    } else {
      out.push({ role: m.role, content: (m.image ? "[sent a photo] " : "") + m.text });
    }
  });
  const facts = [`Current pantry: ${req.pantry.join(", ") || "empty"}.`];
  if (req.profile) facts.push(`About the cook: ${req.profile.slice(0, 300)}. Favour dishes from their roots when choosing between similar matches, and use their traditions when writing AI dishes.`);
  facts.push(req.location ? "Location: shared." : req.zip ? `ZIP: ${req.zip}.` : "Location: not shared yet.");
  out.splice(1, 0, { role: "system", content: facts.join(" ") });
  return out;
}


function validate(body: unknown): ConciergeRequest | null {
  const b = body as ConciergeRequest;
  if (!b || !Array.isArray(b.messages) || !b.messages.length || !Array.isArray(b.pantry)) return null;
  if (b.messages.some((m) => typeof m?.text !== "string" || (m.role !== "user" && m.role !== "assistant"))) return null;
  const last = b.messages[b.messages.length - 1];
  if (last.image && (typeof last.image !== "string" || !last.image.startsWith("data:image/") || last.image.length > 4_000_000)) return null;
  if (b.zip && !/^\d{5}$/.test(b.zip)) b.zip = undefined;
  return b;
}

/** GET /api/concierge — setup check. Shows which settings exist, never their values. */
export async function GET(): Promise<Response> {
  return new Response(JSON.stringify(setupStatus(), null, 2), { headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
}

export async function POST(request: Request): Promise<Response> {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (limited(ip)) return json({ error: "rate_limited", message: "Too many requests. Wait a minute and try again." }, 429);

  let req: ConciergeRequest | null = null;
  try {
    req = validate(await request.json());
  } catch {
    /* fall through */
  }
  if (!req) return json({ error: "bad_request", message: "That request didn't look right." }, 400);
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
        msg.tool_calls.map((call) => {
          let args = {};
          try {
            args = JSON.parse(call.function.arguments || "{}");
          } catch {
            /* model sent bad JSON — run with empty args */
          }
          return runTool(call.function.name, args, ctx);
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
