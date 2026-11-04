// Read env without depending on Node typings, so this file type-checks anywhere.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const env: Record<string, string | undefined> = ((globalThis as any).process?.env ?? {}) as Record<string, string | undefined>;

/** Trim pasted values and strip accidental wrapping quotes; empty strings count as unset. */
function read(name: string): string | undefined {
  const v = env[name]?.trim().replace(/^["']|["']$/g, "").trim();
  return v ? v : undefined;
}

const GOOGLE_OPENAI_BASE = "https://generativelanguage.googleapis.com/v1beta/openai";
const VERCEL_GATEWAY_BASE = "https://ai-gateway.vercel.sh/v1";
const isUrl = (v?: string) => !!v && /^https:\/\/[a-z0-9.-]+\.[a-z]{2,}(\/|$)/i.test(v);
const looksLikeGoogleKey = (v?: string) => !!v && /^(AIza|AQ\.)/.test(v);

const baseSetting = read("AI_GATEWAY_BASE_URL");
const geminiKey = read("GEMINI_API_KEY");
let aiKey = read("AI_GATEWAY_API_KEY") || read("CONCIERGE_API_KEY") || geminiKey;
// Forgiving setup: a key pasted into the base-URL box still works.
if (!aiKey && !isUrl(baseSetting) && baseSetting && /^[A-Za-z0-9._-]{20,}$/.test(baseSetting)) aiKey = baseSetting;

// Where to send requests: a valid base URL wins; otherwise Google keys go to Google, everything else to Vercel.
const aiBase = (isUrl(baseSetting) ? baseSetting! : geminiKey || looksLikeGoogleKey(aiKey) ? GOOGLE_OPENAI_BASE : VERCEL_GATEWAY_BASE).replace(/\/+$/, "");
const usingVercelGateway = aiBase.includes("ai-gateway.vercel.sh");
if (!aiKey && usingVercelGateway) aiKey = read("VERCEL_OIDC_TOKEN");

export const ENV = {
  aiKey,
  aiBase,
  /** Swap models (e.g. a Muse or Gemini model) without touching code. */
  model: (read("CONCIERGE_MODEL") || (usingVercelGateway ? "anthropic/claude-opus-5" : "gemini-3.8-flash")).split(/[\s,]/)[0],
  /** Tried in order when the main model is busy or unavailable. Comma-separated in CONCIERGE_FALLBACK_MODELS. */
  fallbackModels: (read("CONCIERGE_FALLBACK_MODELS")?.split(",").map((m) => m.trim()).filter(Boolean)) ??
    (usingVercelGateway ? ["anthropic/claude-sonnet-5", "google/gemini-3.8-flash"] : ["gemini-flash-latest", "gemini-flash-lite-latest"]),
  mapsKey: read("GOOGLE_MAPS_API_KEY"),
  instacartKey: read("INSTACART_API_KEY"),
  instacartHost: read("INSTACART_API_HOST") || "https://connect.dev.instacart.tools",
  placesBase: read("GOOGLE_PLACES_BASE_URL") || "https://places.googleapis.com",
  routesBase: read("GOOGLE_ROUTES_BASE_URL") || "https://routes.googleapis.com",
};

/** Safe-to-show setup status: which settings exist, never their values. */
export function setupStatus() {
  const has = (n: string) => Boolean(read(n));
  return {
    deployment: { environment: env.VERCEL_ENV ?? "unknown", commit: (env.VERCEL_GIT_COMMIT_SHA ?? "").slice(0, 7) || "unknown" },
    ai: {
      keyFound: Boolean(ENV.aiKey),
      AI_GATEWAY_API_KEY: has("AI_GATEWAY_API_KEY"),
      GEMINI_API_KEY: has("GEMINI_API_KEY"),
      // Only echo it when it's really a URL — never risk printing a pasted key.
      baseUrl: /^https:\/\/[a-z0-9.-]+\.[a-z]{2,}(\/|$)/i.test(ENV.aiBase) ? ENV.aiBase : "NOT A URL — this setting holds something else (check AI_GATEWAY_BASE_URL)",
      model: ENV.model,
    },
    GOOGLE_MAPS_API_KEY: has("GOOGLE_MAPS_API_KEY"),
    INSTACART_API_KEY: has("INSTACART_API_KEY"),
  };
}
