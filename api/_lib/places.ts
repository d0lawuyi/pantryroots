import type { StoreInfo } from "../../src/lib/concierge-types.js";
import { ENV } from "./env.js";

type LatLng = { lat: number; lng: number };

type PlacesResponse = {
  places?: {
    displayName?: { text?: string };
    formattedAddress?: string;
    location?: { latitude: number; longitude: number };
    googleMapsUri?: string;
    currentOpeningHours?: { openNow?: boolean; nextCloseTime?: string };
  }[];
};

const MILES_PER_METER = 0.000621371;

function haversineMeters(a: LatLng, b: LatLng) {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function formatClose(iso: string | undefined, timeZone: string | undefined) {
  if (!iso) return undefined;
  try {
    return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: timeZone || "America/New_York" })
      .format(new Date(iso))
      .replace(":00", "");
  } catch {
    return undefined;
  }
}

/** Google Places API (New) text search, biased to the user's location. */
export async function searchStores(opts: {
  query: string;
  location?: LatLng;
  zip?: string;
  timeZone?: string;
}): Promise<StoreInfo[]> {
  if (!ENV.mapsKey) throw new Error("GOOGLE_MAPS_API_KEY is not set");
  const body: Record<string, unknown> = {
    textQuery: opts.location ? opts.query : `${opts.query} near ${opts.zip}`,
    pageSize: 6,
  };
  if (opts.location) {
    body.locationBias = { circle: { center: { latitude: opts.location.lat, longitude: opts.location.lng }, radius: 15000 } };
  }

  const res = await fetch(`${ENV.placesBase}/v1/places:searchText`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": ENV.mapsKey,
      "X-Goog-FieldMask":
        "places.displayName,places.formattedAddress,places.location,places.googleMapsUri,places.currentOpeningHours.openNow,places.currentOpeningHours.nextCloseTime",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`Places ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = (await res.json()) as PlacesResponse;

  const stores: (StoreInfo & { _loc?: LatLng })[] = (data.places ?? []).map((p) => {
    const loc = p.location ? { lat: p.location.latitude, lng: p.location.longitude } : undefined;
    return {
      name: p.displayName?.text ?? "Store",
      address: p.formattedAddress ?? "",
      mapsUrl: p.googleMapsUri ?? `https://www.google.com/maps/search/${encodeURIComponent(p.displayName?.text ?? opts.query)}`,
      openNow: p.currentOpeningHours?.openNow,
      closes: formatClose(p.currentOpeningHours?.nextCloseTime, opts.timeZone),
      distanceMiles: opts.location && loc ? Math.round(haversineMeters(opts.location, loc) * MILES_PER_METER * 10) / 10 : undefined,
      _loc: loc,
    };
  });

  // Open shops first, then nearest.
  stores.sort((a, b) => Number(b.openNow ?? false) - Number(a.openNow ?? false) || (a.distanceMiles ?? 99) - (b.distanceMiles ?? 99));
  const top = stores.slice(0, 3);

  if (opts.location) {
    try {
      const minutes = await driveMinutes(opts.location, top.map((s) => s._loc).filter((l): l is LatLng => !!l));
      let i = 0;
      for (const s of top) if (s._loc) s.driveMinutes = minutes[i++];
    } catch {
      /* drive time is a nice-to-have; distance is still shown */
    }
  }
  return top.map(({ _loc, ...s }) => s);
}

/** Google Routes API route matrix: one origin, several destinations. */
async function driveMinutes(origin: LatLng, destinations: LatLng[]): Promise<(number | undefined)[]> {
  if (!destinations.length || !ENV.mapsKey) return [];
  const wp = (l: LatLng) => ({ waypoint: { location: { latLng: { latitude: l.lat, longitude: l.lng } } } });
  const res = await fetch(`${ENV.routesBase}/distanceMatrix/v2:computeRouteMatrix`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": ENV.mapsKey,
      "X-Goog-FieldMask": "originIndex,destinationIndex,duration,condition",
    },
    body: JSON.stringify({ origins: [wp(origin)], destinations: destinations.map(wp), travelMode: "DRIVE" }),
    signal: AbortSignal.timeout(6000),
  });
  if (!res.ok) throw new Error(`Routes ${res.status}`);
  const rows = (await res.json()) as { destinationIndex?: number; duration?: string; condition?: string }[];
  const out: (number | undefined)[] = destinations.map(() => undefined);
  for (const r of rows) {
    if (r.destinationIndex === undefined || r.condition !== "ROUTE_EXISTS" || !r.duration) continue;
    out[r.destinationIndex] = Math.max(1, Math.round(parseInt(r.duration, 10) / 60));
  }
  return out;
}
