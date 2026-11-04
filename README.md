# PantryRoots

Cook from your pantry across West and East African food traditions, grouped by the peoples who cook them. A Kitchen Concierge scans a photo of your shelf, tells you what you can make, and when you're out of something it finds a swap, the nearest open shop and an Instacart cart.

## Stack

- Vite + React + TypeScript, plain CSS design system (see `DESIGN.md`)
- `/api/concierge` — Vercel function with no dependencies. It runs a tool-calling agent through **Vercel AI Gateway** (Claude by default)
- Live data: **Google Places API (New)** for shops, **Google Routes API** for drive time, **Instacart Developer Platform** for carts

## Run it

```bash
npm install
npm run dev          # UI only; the concierge falls back to built-in answers
npx vercel dev       # UI + /api/concierge with your .env.local keys
```

Copy `.env.example` to `.env.local` and fill in the keys. Only `AI_GATEWAY_API_KEY` is required.

## How the concierge works

| Tool | What it does |
|---|---|
| `show_pantry_scan` | Model looks at the photo and lists ingredients, flagging uncertain ones |
| `match_dishes` | Ranks our 23 curated dishes against the pantry |
| `suggest_ai_dish` | Adds dishes from other traditions, labeled **AI-written** |
| `find_substitute` / `show_substitute` | Our substitute notes first; AI only fills gaps |
| `find_stores` | Google Places + Routes: open shops, distance, drive time, closing time |
| `create_cart` | Instacart shopping-list link |

Every tool has a fallback: Maps search, Instacart search, or built-in answers if the AI is down. **Demo mode** (checkbox in the panel) plays sample answers and works offline. Store names are prefixed "Sample:".

## Demo script (about 60 seconds)

1. Open the Cook page. The concierge sits on the right on desktop; on a phone, tap **Ask**.
2. Tap **Scan my pantry** and take a photo of a shelf. Untick anything wrong, then **Add to pantry**. The Cook page match meters fill in behind the panel.
3. Type **"Something Caribbean with what I have"** to get an AI-written dish card. Open it to see the label.
4. Type **"I'm out of palm oil"** to get a swap card, the nearest open shops with drive time, and an Instacart cart.
5. Bad wifi? Tick **Demo mode** and run the same steps.
