import type { Card, ConciergeError, ConciergeRequest, ConciergeResponse } from "../src/lib/concierge-types.js";
import { ENV } from "./_lib/env.js";
import { DISH_NAMES, TOOL_DEFS, runTool, type ToolContext } from "./_lib/tools.js";

/**
 * POST /api/concierge — the Kitchen Concierge agent.
 * Runs a short tool loop against Vercel AI Gateway (OpenAI-compatible) and
 * returns the final text plus the cards the tools produced.
 */

const SYSTEM = `You are the PantryRoots Kitchen Concierge: a warm, practical cooking helper who knows food traditions by the people who cook them (Yoruba, Akan, Wolof, Amhara and many more), not just by country.

You help with three things:
1. Pantry scans. When the user sends a photo, call show_pantry_scan with what you see, then call match_dishes with those items as extra_items.
2. What to cook. Always call match_dishes first. The curated dishes are: ${DISH_NAMES}. If the user wants other cuisines or matches are weak, you may call suggest_ai_dish once or twice for dishes from other traditions.
3. Running out. When the user is out of an ingredient: call find_substitute; if found:false call show_substitute. Then call find_stores with the shop_type, then create_cart with the missing item(s).

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

type GatewayMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content?: string | null | { type: string; text?: string; image_url?: { url: string } }[];
  tool_calls?: { id: string; type: "function"; function: { name: string; arguments: string } }[];
  tool_call_id?: string;
};

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
  facts.push(req.location ? "Location: shared." : req.zip ? `ZIP: ${req.zip}.` : "Location: not shared yet.");
  out.splice(1, 0, { role: "system", content: facts.join(" ") });
  return out;
}

async function callGateway(messages: GatewayMessage[]) {
  const res = await fetch(`${ENV.aiBase}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${ENV.aiKey}` },
    body: JSON.stringify({ model: ENV.model, messages, tools: TOOL_DEFS, tool_choice: "auto", max_tokens: 1400, temperature: 0.4 }),
  });
  if (!res.ok) {
    const detail = (await res.text()).slice(0, 300);
    const err = new Error(`gateway ${res.status}: ${detail}`) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }
  const data = await res.json();
  return data.choices?.[0]?.message as GatewayMessage | undefined;
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

  try {
    for (let step = 0; step < 7; step++) {
      const msg = await callGateway(messages);
      if (!msg) break;
      messages.push({ role: "assistant", content: msg.content ?? null, tool_calls: msg.tool_calls });
      if (!msg.tool_calls?.length) {
        const text = typeof msg.content === "string" ? msg.content.trim() : "";
        return json({ text: text || (cards.length ? "Here's what I found." : "Sorry, I didn't catch that."), cards });
      }
      for (const call of msg.tool_calls) {
        let args = {};
        try {
          args = JSON.parse(call.function.arguments || "{}");
        } catch {
          /* model sent bad JSON — run with empty args */
        }
        const { result, card } = await runTool(call.function.name, args, ctx);
        if (card) cards.push(card);
        messages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify(result) });
      }
    }
    return json({ text: "Here's what I found.", cards });
  } catch (e) {
    const status = (e as { status?: number }).status;
    if (status === 401 || status === 402 || status === 403 || status === 429) {
      return json({ error: "ai_unavailable", message: "The AI service is unavailable right now (key or credits)." }, 503);
    }
    console.error("[concierge]", e);
    return json({ error: "server_error", message: "Something went wrong on our side." }, 500);
  }
}
