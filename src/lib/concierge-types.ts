/**
 * Contract between the concierge panel (browser) and /api/concierge (server).
 * Kept dependency-free so both sides can import it.
 */
import type { Dish } from "../data/dishes.js";

export type ScanItem = { name: string; confidence: "sure" | "check" };

export type StoreInfo = {
  name: string;
  address: string;
  mapsUrl: string;
  openNow?: boolean;
  /** Already formatted for the user's time zone, e.g. "10 PM". */
  closes?: string;
  distanceMiles?: number;
  driveMinutes?: number;
};

export type Card =
  | { type: "scan"; items: ScanItem[] }
  | { type: "dishes"; dishIds: string[] }
  | { type: "aiDish"; dish: Dish }
  | {
      type: "swap";
      ingredient: string;
      cheapest: string;
      authentic: string;
      fastest: string;
      tradeoff: string;
      essential: boolean;
      source: "pantryroots" | "ai";
    }
  | { type: "stores"; ingredient: string; stores: StoreInfo[]; searchUrl: string; source: "live" | "demo" | "link" }
  | { type: "cart"; items: string[]; url: string; source: "live" | "link"; eta: string };

export type ChatTurn = {
  role: "user" | "assistant";
  text: string;
  /** JPEG data URL. Only the newest user turn carries its image to the server. */
  image?: string;
  cards?: Card[];
  /** Shown under assistant turns produced without the AI (demo or offline). */
  note?: string;
};

export type ConciergeRequest = {
  messages: { role: "user" | "assistant"; text: string; image?: string }[];
  pantry: string[];
  location?: { lat: number; lng: number };
  zip?: string;
  timeZone?: string;
};

export type ConciergeResponse = { text: string; cards: Card[] };

export type ConciergeError = { error: "ai_unavailable" | "rate_limited" | "bad_request" | "server_error"; message: string };

export const DELIVERY_ETA = "Typically 1–2 hrs. Each service shows its exact delivery window at checkout.";

export function mapsSearchUrl(query: string) {
  return `https://www.google.com/maps/search/${encodeURIComponent(query)}`;
}

export function instacartSearchUrl(query: string) {
  return `https://www.instacart.com/store/s?k=${encodeURIComponent(query)}`;
}

export function walmartSearchUrl(query: string) {
  return `https://www.walmart.com/search?q=${encodeURIComponent(query)}`;
}

export function doordashSearchUrl(query: string) {
  return `https://www.doordash.com/search/store/${encodeURIComponent(query)}`;
}
