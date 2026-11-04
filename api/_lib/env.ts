// Read env without depending on Node typings, so this file type-checks anywhere.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const env: Record<string, string | undefined> = ((globalThis as any).process?.env ?? {}) as Record<string, string | undefined>;

/** Trim pasted values and strip accidental wrapping quotes; empty strings count as unset. */
function read(name: string): string | undefined {
  const v = env[name]?.trim().replace(/^["']|["']$/g, "").trim();
  return v ? v : undefined;
}

const aiBase = (read("AI_GATEWAY_BASE_URL") || "https://ai-gateway.vercel.sh/v1").replace(/\/+$/, "");
const usingVercelGateway = aiBase.includes("ai-gateway.vercel.sh");

export const ENV = {
  aiKey:
    read("AI_GATEWAY_API_KEY") ||
    read("CONCIERGE_API_KEY") ||
    read("GEMINI_API_KEY") ||
    // Vercel's built-in OIDC token only works with Vercel's own gateway.
    (usingVercelGateway ? read("VERCEL_OIDC_TOKEN") : undefined),
  aiBase,
  /** Swap models (e.g. a Muse or Gemini model) without touching code. */
  model: (read("CONCIERGE_MODEL") || (usingVercelGateway ? "anthropic/claude-opus-5" : "gemini-2.5-flash")).split(/[\s,]/)[0],
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
      baseUrl: ENV.aiBase,
      model: ENV.model,
    },
    GOOGLE_MAPS_API_KEY: has("GOOGLE_MAPS_API_KEY"),
    INSTACART_API_KEY: has("INSTACART_API_KEY"),
  };
}
