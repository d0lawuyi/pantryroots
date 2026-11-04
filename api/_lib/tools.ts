import { DISHES, type Dish } from "../../src/data/dishes.js";
import { SUBSTITUTES, substituteFor } from "../../src/data/substitutes.js";
import { rankDishes, cleanItem } from "../../src/lib/pantry.js";
import { DELIVERY_ETA, instacartSearchUrl, mapsSearchUrl, type Card, type ConciergeRequest, type ScanItem } from "../../src/lib/concierge-types.js";
import { searchStores } from "./places.js";
import { createShoppingList } from "./instacart.js";

export type ToolContext = { req: ConciergeRequest; extraPantry: string[] };
export type ToolResult = { result: unknown; card?: Card };

const str = { type: "string" } as const;
const strArr = { type: "array", items: str } as const;

/** OpenAI-format tool definitions sent to the model through AI Gateway. */
export const TOOL_DEFS = [
  {
    type: "function",
    function: {
      name: "show_pantry_scan",
      description:
        "Call after looking at a photo of a pantry, fridge or shelf. List every food ingredient you can see. Use plain grocery names (e.g. 'Plantain', 'Palm Oil', 'Black-Eyed Beans'). Mark items you are not certain about as 'check'. Flag perishables that should be used soon with use_soon, based only on what is visible.",
      parameters: {
        type: "object",
        properties: {
          items: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: str,
                confidence: { type: "string", enum: ["sure", "check"] },
                use_soon: { type: "boolean", description: "True only for perishables that look like they should be cooked within a few days: ripe or overripe produce, fresh leafy greens, fresh meat or fish, cut or opened items, leftovers." },
                note: { type: "string", description: "If use_soon: 2-5 words on why, e.g. 'very ripe', 'fresh greens'." },
              },
              required: ["name", "confidence"],
            },
          },
        },
        required: ["items"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "match_dishes",
      description:
        "Rank PantryRoots' curated dishes (West and East African, from specific peoples) against the user's pantry. Always use this before suggesting what to cook. Pass extra_items for things just scanned but not yet added.",
      parameters: { type: "object", properties: { extra_items: strArr }, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "suggest_ai_dish",
      description:
        "Write ONE dish from a food tradition not covered by the curated list (e.g. Caribbean, Southern US, Filipino, Mexican) that fits the user's pantry. Only use after match_dishes, and only when the user wants more variety or the curated matches are weak. Be accurate and specific about origin.",
      parameters: {
        type: "object",
        properties: {
          name: str,
          origin: { type: "string", description: "People/region, e.g. 'Jamaica' or 'Gullah Geechee, US Lowcountry'" },
          summary: str,
          minutes: { type: "number" },
          ingredients: strArr,
          technique: str,
          steps: strArr,
        },
        required: ["name", "origin", "summary", "minutes", "ingredients", "technique", "steps"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "find_substitute",
      description: "Look up PantryRoots' substitute notes for a missing ingredient. Always call this first when the user is out of something.",
      parameters: { type: "object", properties: { ingredient: str }, required: ["ingredient"] },
    },
  },
  {
    type: "function",
    function: {
      name: "show_substitute",
      description: "Only when find_substitute returned found:false. Show your own substitute advice as a card.",
      parameters: {
        type: "object",
        properties: { ingredient: str, cheapest: str, authentic: str, fastest: str, tradeoff: str, essential: { type: "boolean" } },
        required: ["ingredient", "cheapest", "authentic", "fastest", "tradeoff", "essential"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "find_stores",
      description:
        "Find real nearby shops that sell an ingredient, with distance, drive time and closing time. Use shop_type from find_substitute when available (e.g. 'African grocery').",
      parameters: { type: "object", properties: { ingredient: str, shop_type: str }, required: ["ingredient"] },
    },
  },
  {
    type: "function",
    function: {
      name: "create_cart",
      description: "Create an Instacart shopping list the user can order for delivery.",
      parameters: { type: "object", properties: { title: str, items: strArr }, required: ["title", "items"] },
    },
  },
] as const;

function slug(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
}

const article = (w: string) => (/^[aeiou]/i.test(w) ? "an" : "a");

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Args = Record<string, any>;

export async function runTool(name: string, args: Args, ctx: ToolContext): Promise<ToolResult> {
  const { req } = ctx;

  switch (name) {
    case "show_pantry_scan": {
      const items = (Array.isArray(args.items) ? args.items : [])
        .filter((i: Args) => typeof i?.name === "string" && i.name.trim())
        .slice(0, 40)
        .map((i: Args): ScanItem => ({
          name: cleanItem(i.name),
          confidence: i.confidence === "check" ? "check" : "sure",
          ...(i.use_soon === true ? { useSoon: true, note: typeof i.note === "string" ? i.note.trim().slice(0, 40) || undefined : undefined } : {}),
        }));
      ctx.extraPantry.push(...items.map((i: { name: string }) => i.name));
      return { result: { shown: items.length }, card: { type: "scan", items } };
    }

    case "match_dishes": {
      const extra = Array.isArray(args.extra_items) ? args.extra_items.map(String) : [];
      const pantry = [...req.pantry, ...ctx.extraPantry, ...extra];
      const ranked = rankDishes(pantry).slice(0, 4);
      return {
        result: ranked.map((m) => ({ id: m.dish.id, name: m.dish.name, need: m.need, minutes: m.dish.minutes })),
        card: { type: "dishes", dishIds: ranked.map((m) => m.dish.id) },
      };
    }

    case "suggest_ai_dish": {
      const dish: Dish = {
        id: `ai-${slug(String(args.name))}`,
        name: String(args.name),
        peopleId: "ai",
        origin: String(args.origin ?? ""),
        summary: String(args.summary ?? ""),
        minutes: Math.max(5, Math.round(Number(args.minutes) || 45)),
        tone: "gold",
        ingredients: (args.ingredients ?? []).map((i: unknown) => String(i).toLowerCase()).slice(0, 14),
        technique: String(args.technique ?? ""),
        steps: (args.steps ?? []).map(String).slice(0, 10),
        aiWritten: true,
      };
      return { result: { shown: dish.name }, card: { type: "aiDish", dish } };
    }

    case "find_substitute": {
      const key = String(args.ingredient ?? "").toLowerCase().trim();
      if (!(key in SUBSTITUTES)) return { result: { found: false, ingredient: key } };
      const s = substituteFor(key);
      return {
        result: { found: true, ...s },
        card: {
          type: "swap",
          ingredient: key,
          cheapest: s.swap,
          authentic: s.essential ? `Get the real thing from ${article(s.shop)} ${s.shop}.${s.tip ? " " + s.tip : ""}` : `${s.swap}. ${s.tradeoff}`,
          fastest: `Use the swap tonight and order real ${key} for next time.`,
          tradeoff: s.tradeoff,
          essential: s.essential,
          source: "pantryroots",
        },
      };
    }

    case "show_substitute":
      return {
        result: { shown: true },
        card: {
          type: "swap",
          ingredient: String(args.ingredient).toLowerCase(),
          cheapest: String(args.cheapest),
          authentic: String(args.authentic),
          fastest: String(args.fastest),
          tradeoff: String(args.tradeoff),
          essential: Boolean(args.essential),
          source: "ai",
        },
      };

    case "find_stores": {
      const ingredient = String(args.ingredient ?? "").toLowerCase();
      const shop = String(args.shop_type || substituteFor(ingredient).shop || "grocery store");
      const query = /^(any )?supermarket$/i.test(shop) ? `grocery store` : shop;
      const searchUrl = mapsSearchUrl(`${query} near me`);
      if (!req.location && !req.zip) {
        return { result: { error: "need_location", hint: "Ask the user for their ZIP code or to allow location." } };
      }
      try {
        const stores = await searchStores({ query, location: req.location, zip: req.zip, timeZone: req.timeZone });
        return { result: { stores }, card: { type: "stores", ingredient, stores, searchUrl, source: "live" } };
      } catch (e) {
        return {
          result: { error: "stores_unavailable", detail: String(e).slice(0, 120) },
          card: { type: "stores", ingredient, stores: [], searchUrl, source: "link" },
        };
      }
    }

    case "create_cart": {
      const items: string[] = (Array.isArray(args.items) ? args.items : []).map((i: unknown) => cleanItem(String(i))).filter(Boolean).slice(0, 20);
      const title = String(args.title || "PantryRoots shopping list");
      try {
        const url = await createShoppingList(title, items);
        return { result: { url }, card: { type: "cart", items, url, source: "live", eta: DELIVERY_ETA } };
      } catch {
        const url = instacartSearchUrl(items[0] ?? "groceries");
        return { result: { url, note: "Instacart cart unavailable; using a search link" }, card: { type: "cart", items, url, source: "link", eta: DELIVERY_ETA } };
      }
    }

    default:
      return { result: { error: `Unknown tool ${name}` } };
  }
}

export const DISH_NAMES = DISHES.map((d) => d.name).join(", ");
