// Read env without depending on Node typings, so this file type-checks anywhere.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const env: Record<string, string | undefined> = ((globalThis as any).process?.env ?? {}) as Record<string, string | undefined>;

export const ENV = {
  aiKey: env.AI_GATEWAY_API_KEY || env.VERCEL_OIDC_TOKEN,
  aiBase: env.AI_GATEWAY_BASE_URL || "https://ai-gateway.vercel.sh/v1",
  /** Swap models (e.g. a Muse model) without touching code. */
  model: env.CONCIERGE_MODEL || "anthropic/claude-opus-5",
  mapsKey: env.GOOGLE_MAPS_API_KEY,
  instacartKey: env.INSTACART_API_KEY,
  instacartHost: env.INSTACART_API_HOST || "https://connect.dev.instacart.tools",
  placesBase: env.GOOGLE_PLACES_BASE_URL || "https://places.googleapis.com",
  routesBase: env.GOOGLE_ROUTES_BASE_URL || "https://routes.googleapis.com",
};
