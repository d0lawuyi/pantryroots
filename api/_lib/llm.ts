import { ENV } from "./env.js";

/**
 * Shared model caller for every /api function: OpenAI-compatible chat completions
 * (Vercel AI Gateway, Gemini, or any compatible provider) with retries, model
 * fallback and a per-request time budget.
 */

export type GatewayMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content?: string | null | { type: string; text?: string; image_url?: { url: string } }[];
  tool_calls?: { id: string; type: "function"; function: { name: string; arguments: string } }[];
  tool_call_id?: string;
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
/** Temporary provider trouble worth retrying or switching models for. */
const TRANSIENT = new Set([429, 500, 502, 503, 504]);

// Once a model works in this warm instance, keep using it for later steps of the same conversation.
let workingModel: string | null = null;
// Set if the provider rejects the reasoning_effort hint, so we stop sending it.
let skipReasoningHint = false;
// Set if the provider rejects response_format, so structured helpers fall back to prompt-only JSON.
let skipJsonMode = false;

/** Whole-request budget. Vercel's limit is 60s (vercel.json); stay well under it and return what we have. */
export const BUDGET_MS = 45_000;
export class OutOfTime extends Error {}

export type CallOptions = {
  /** OpenAI-format tool definitions; omit for plain completions. */
  tools?: readonly unknown[];
  maxTokens?: number;
  /** Ask for a JSON object response (used by structured helpers). */
  json?: boolean;
};

export async function callModel(messages: GatewayMessage[], deadline: number, opts: CallOptions = {}) {
  const models = [...new Set([workingModel ?? ENV.model, ENV.model, ...ENV.fallbackModels])];
  let lastErr: (Error & { status?: number }) | null = null;

  for (const model of models) {
    for (let attempt = 0; attempt < 2; attempt++) {
      const left = deadline - Date.now();
      if (left < 4000) throw new OutOfTime("time budget used up");
      const body: Record<string, unknown> = { model, messages, max_tokens: opts.maxTokens ?? 1400, temperature: 0.4 };
      if (opts.tools?.length) {
        body.tools = opts.tools;
        body.tool_choice = "auto";
      }
      if (opts.json && !skipJsonMode) body.response_format = { type: "json_object" };
      // Gemini "thinks" before answering by default; keep it short so the demo stays snappy.
      if (!skipReasoningHint && ENV.aiBase.includes("googleapis.com")) body.reasoning_effort = "low";
      let res: Response;
      try {
        res = await fetch(`${ENV.aiBase}/chat/completions`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${ENV.aiKey}` },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(Math.min(25_000, left - 2000)),
        });
      } catch (e) {
        // Our own per-call timeout: treat like a busy model and move on.
        lastErr = Object.assign(new Error(`gateway timeout: ${String(e).slice(0, 80)}`), { status: 504 });
        console.warn("[concierge] model", model, "timed out");
        break;
      }
      if (res.ok) {
        workingModel = model;
        const data = await res.json();
        return data.choices?.[0]?.message as GatewayMessage | undefined;
      }
      const detail = (await res.text()).slice(0, 300);
      if (res.status === 400 && opts.json && !skipJsonMode && /response_format|json/i.test(detail)) {
        // Provider doesn't support JSON mode; the prompt still asks for JSON and parseJsonReply copes.
        skipJsonMode = true;
        attempt--;
        continue;
      }
      if (res.status === 400 && body.reasoning_effort && /reasoning/i.test(detail)) {
        skipReasoningHint = true;
        attempt--;
        continue;
      }
      lastErr = Object.assign(new Error(`gateway ${res.status}: ${detail}`), { status: res.status });
      console.warn("[concierge] model", model, "attempt", attempt + 1, "->", res.status);
      // Auth problems won't fix themselves — stop immediately.
      if (res.status === 401 || res.status === 403) throw lastErr;
      // Busy: wait briefly and retry once; unknown model: go straight to the next one.
      if (TRANSIENT.has(res.status) && attempt === 0 && deadline - Date.now() > 8000) {
        await sleep(1200);
        continue;
      }
      break;
    }
    if (workingModel === model) workingModel = null;
  }
  throw lastErr ?? new Error("gateway: no model available");
}

/** Pull the first JSON object out of a model reply (tolerates code fences and stray prose). */
export function parseJsonReply<T>(text: string | null | undefined): T | null {
  if (!text) return null;
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1)) as T;
  } catch {
    return null;
  }
}
