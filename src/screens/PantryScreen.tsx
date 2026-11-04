import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { DISHES } from "@/data/dishes";
import { KNOWN_INGREDIENTS, cleanItem, have, matchDish } from "@/lib/pantry";
import { AISLES, AISLE_META, aisleOf, usePantryLow, type Aisle, type AisleIcon } from "@/lib/aisles";
import { useApp } from "@/lib/app-context";
import { Icon } from "@/components/Icon";
import { PageHeader, Section } from "@/components/ui";

type Product = { name: string; brand: string; image?: string };
type Lookup = { state: "idle" } | { state: "loading" } | { state: "found"; product: Product } | { state: "missing" } | { state: "error" };

const UNDO_MS = 5000;

const plural = (n: number, one: string, many = one + "s") => `${n} ${n === 1 ? one : many}`;

/* Local glyphs in the Icon.tsx style: 24 grid, currentColor stroke, round caps. */
function Glyph({ children, size = 18 }: { children: ReactNode; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {children}
    </svg>
  );
}

const AISLE_GLYPHS: Record<AisleIcon, ReactNode> = {
  leaf: (
    <>
      <path d="M5 19c0-8 5-13.5 14-14-.5 9-6 14-14 14z" />
      <path d="M5 19 13 11" />
    </>
  ),
  grain: (
    <>
      <path d="M12 21V9" />
      <path d="M12 9c-2.5 0-4-1.8-4-4.5 2.5 0 4 1.8 4 4.5zM12 9c2.5 0 4-1.8 4-4.5-2.5 0-4 1.8-4 4.5z" />
      <path d="M12 15c-2.5 0-4-1.8-4-4.5 2.5 0 4 1.8 4 4.5zM12 15c2.5 0 4-1.8 4-4.5-2.5 0-4 1.8-4 4.5z" />
    </>
  ),
  jar: (
    <>
      <path d="M8 3.5h8v3H8z" />
      <path d="M7 6.5h10a1 1 0 0 1 1 1V19a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 6 19V7.5a1 1 0 0 1 1-1z" />
      <path d="M9 12h6" />
    </>
  ),
  drop: <path d="M12 3.5s6 6.5 6 10.5a6 6 0 0 1-12 0c0-4 6-10.5 6-10.5z" />,
  fish: (
    <>
      <path d="M3 12c3-4.5 9-6 14-2l4-3v10l-4-3c-5 4-11 2.5-14-2z" />
      <path d="M8 11.5v.01" />
    </>
  ),
  can: (
    <>
      <ellipse cx="12" cy="6" rx="6" ry="2.25" />
      <path d="M6 6v12c0 1.25 2.7 2.25 6 2.25s6-1 6-2.25V6" />
      <path d="M6 11c0 1.25 2.7 2.25 6 2.25s6-1 6-2.25" />
    </>
  ),
  box: (
    <>
      <path d="M4 8 12 4l8 4v8.5l-8 4-8-4z" />
      <path d="M4 8l8 4 8-4M12 12v8.5" />
    </>
  ),
};

/** A half-empty gauge: "running low". */
const LowGlyph = () => (
  <Glyph size={20}>
    <path d="M4 17a8 8 0 0 1 16 0" />
    <path d="M12 17 8.5 12.5" />
    <path d="M4 17h16" />
  </Glyph>
);

type Removed = { name: string; key: string };

export function PantryScreen() {
  const { pantry, addItems, removeItem } = useApp();
  const { low, isLow, setLow, toggleLow } = usePantryLow();
  const [draft, setDraft] = useState("");
  const [query, setQuery] = useState("");
  const [lowOnly, setLowOnly] = useState(false);
  const [removed, setRemoved] = useState<Removed[]>([]);
  const timers = useRef(new Map<string, number>());
  const [photo, setPhoto] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [lookup, setLookup] = useState<Lookup>({ state: "idle" });

  // Clear pending undo timers if the screen goes away.
  useEffect(() => {
    const map = timers.current;
    return () => map.forEach((t) => window.clearTimeout(t));
  }, []);

  // If an item comes back some other way (chip, typing), drop its "Removed" row.
  useEffect(() => {
    const owned = new Set(pantry.map((p) => p.toLowerCase()));
    setRemoved((r) => (r.some((x) => owned.has(x.key)) ? r.filter((x) => !owned.has(x.key)) : r));
  }, [pantry]);

  // Leaving "running low" view once nothing is low.
  useEffect(() => {
    if (lowOnly && low.length === 0) setLowOnly(false);
  }, [lowOnly, low.length]);

  // Ingredients that would bring the most nearly-there dishes into reach.
  const worthAdding = useMemo(() => {
    const counts = new Map<string, number>();
    for (const dish of DISHES) {
      const m = matchDish(dish, pantry);
      if (m.need.length === 0 || m.need.length > 3) continue;
      for (const n of m.need) counts.set(n, (counts.get(n) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
  }, [pantry]);

  const aisleCount = useMemo(() => new Set(pantry.map(aisleOf)).size, [pantry]);

  const q = query.trim().toLowerCase();

  // Pantry items plus recently removed ones (shown as undo rows in place), grouped by aisle.
  const groups = useMemo(() => {
    type Entry = { name: string; low: boolean; removed: boolean };
    const entries: Entry[] = [
      ...pantry.map((name) => ({ name, low: isLow(name), removed: false })),
      ...removed.map((r) => ({ name: r.name, low: isLow(r.name), removed: true })),
    ].filter((e) => (!q || e.name.toLowerCase().includes(q)) && (!lowOnly || e.low));

    const byAisle = new Map<Aisle, Entry[]>();
    for (const e of entries) {
      const a = aisleOf(e.name);
      byAisle.set(a, [...(byAisle.get(a) ?? []), e]);
    }
    return AISLES.filter((a) => byAisle.has(a)).map((aisle) => {
      const items = byAisle.get(aisle)!.sort((x, y) => Number(y.low) - Number(x.low) || x.name.localeCompare(y.name));
      return { aisle, items, count: items.filter((i) => !i.removed).length };
    });
  }, [pantry, removed, isLow, q, lowOnly]);

  const visibleCount = groups.reduce((n, g) => n + g.count, 0);

  function submit(e: FormEvent) {
    e.preventDefault();
    const items = draft.split(",").map(cleanItem).filter(Boolean);
    if (!items.length) return;
    addItems(items);
    setDraft("");
  }

  function remove(name: string) {
    const key = name.toLowerCase();
    removeItem(name);
    setRemoved((r) => [...r.filter((x) => x.key !== key), { name, key }]);
    window.clearTimeout(timers.current.get(key));
    timers.current.set(
      key,
      window.setTimeout(() => {
        timers.current.delete(key);
        setRemoved((r) => r.filter((x) => x.key !== key));
        setLow(name, false);
      }, UNDO_MS),
    );
  }

  function undo(name: string) {
    const key = name.toLowerCase();
    window.clearTimeout(timers.current.get(key));
    timers.current.delete(key);
    setRemoved((r) => r.filter((x) => x.key !== key));
    addItems([name]);
  }

  async function findProduct(e: FormEvent) {
    e.preventDefault();
    const digits = code.replace(/\D/g, "");
    if (digits.length < 8) return;
    setLookup({ state: "loading" });
    try {
      const res = await fetch(
        `https://world.openfoodfacts.org/api/v2/product/${digits}.json?fields=product_name,generic_name,brands,image_front_small_url`,
      );
      const data = await res.json();
      if (data.status !== 1 || !data.product) return setLookup({ state: "missing" });
      const p = data.product;
      setLookup({
        state: "found",
        product: {
          name: p.product_name || p.generic_name || "Unnamed product",
          brand: (p.brands || "").split(",")[0],
          image: p.image_front_small_url,
        },
      });
    } catch {
      setLookup({ state: "error" });
    }
  }

  const lede = pantry.length
    ? `${plural(pantry.length, "item")} across ${plural(aisleCount, "aisle")}. Saved on this device.`
    : "Add what you have and we'll match it to dishes.";

  return (
    <div className="page pantry">
      <PageHeader title="Pantry" lede={lede} />

      <Section>
        <form onSubmit={submit} className="input-row">
          <label htmlFor="add-item" className="visually-hidden">Add an ingredient</label>
          <input
            id="add-item"
            className="input"
            list="known-ingredients"
            placeholder="Add an ingredient, e.g. plantain"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            autoComplete="off"
            enterKeyHint="done"
          />
          <datalist id="known-ingredients">
            {KNOWN_INGREDIENTS.filter((i) => !have(pantry, i)).map((i) => (
              <option key={i} value={i} />
            ))}
          </datalist>
          <button className="btn btn--primary" type="submit" disabled={!draft.trim()}>
            Add
          </button>
        </form>
        <p className="section__note">Separate several with commas.</p>
      </Section>

      {worthAdding.length > 0 && (
        <Section title="Worth picking up" note="The number is how many dishes it gets you closer to.">
          <div className="scroller">
            {worthAdding.map(([item, n]) => (
              <button key={item} type="button" className="chip chip--add" onClick={() => addItems([cleanItem(item)])}>
                <Icon name="plus" size={14} strokeWidth={2} />
                {cleanItem(item)}
                <span className="chip__count num">{n}</span>
              </button>
            ))}
          </div>
        </Section>
      )}

      <Section title="What you have">
        {pantry.length === 0 && removed.length === 0 ? (
          <div className="group empty">
            <strong>Nothing here yet</strong>
            Start with your staples: rice, onion, tomato, oil.
          </div>
        ) : (
          <div className="pantry-list">
            <div className="search pantry-search">
              <Icon name="search" size={18} />
              <label htmlFor="pantry-search" className="visually-hidden">Search your pantry</label>
              <input
                id="pantry-search"
                className="input"
                type="search"
                placeholder="Search your pantry"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                autoComplete="off"
                enterKeyHint="search"
              />
            </div>

            {low.length > 0 && (
              <button
                type="button"
                className="pantry-lowbar"
                aria-pressed={lowOnly}
                onClick={() => setLowOnly((v) => !v)}
              >
                <span className="pantry-lowbar__icon"><LowGlyph /></span>
                <span className="pantry-lowbar__body">
                  <span className="pantry-lowbar__title">Running low <span className="num">({low.length})</span></span>
                  <span className="pantry-lowbar__meta">
                    {lowOnly ? "Showing only these items" : low.slice(0, 3).join(", ") + (low.length > 3 ? ` and ${low.length - 3} more` : "")}
                  </span>
                </span>
                <span className="pantry-lowbar__action">{lowOnly ? "Show all" : "Show"}</span>
              </button>
            )}

            {groups.length === 0 ? (
              <div className="group empty pantry-noresult" role="status">
                <strong>{q ? `Nothing matches "${query.trim()}"` : "Nothing to show"}</strong>
                {lowOnly ? "Nothing running low matches that." : "It isn't in your pantry yet."}
                {!lowOnly && q && (
                  <button type="button" className="btn btn--tinted btn--sm" onClick={() => { addItems([cleanItem(query)]); setQuery(""); }}>
                    <Icon name="plus" size={16} strokeWidth={2} />
                    Add {cleanItem(query)}
                  </button>
                )}
              </div>
            ) : (
              groups.map(({ aisle, items, count }) => {
                const meta = AISLE_META[aisle];
                const headId = `aisle-${meta.slug}`;
                return (
                  <section key={aisle} className="aisle" data-aisle={meta.slug} aria-labelledby={headId}>
                    <h3 id={headId} className="aisle__head">
                      <span className="aisle__icon"><Glyph size={16}>{AISLE_GLYPHS[meta.icon]}</Glyph></span>
                      <span className="aisle__name">{aisle}</span>
                      <span className="aisle__count num" aria-label={plural(count, "item")}>{count}</span>
                    </h3>
                    <ul className="group">
                      {items.map((item) =>
                        item.removed ? (
                          <li key={"removed-" + item.name} className="row pantry-item pantry-item--removed">
                            <span className="row__body" role="status">Removed {item.name}</span>
                            <button type="button" className="btn btn--sm pantry-undo" onClick={() => undo(item.name)}>
                              Undo
                            </button>
                          </li>
                        ) : (
                          <li key={item.name} className="row pantry-item">
                            <span className="row__body pantry-item__name">
                              {item.name}
                              {item.low && <span className="pill pill--need pantry-item__pill">Running low</span>}
                            </span>
                            <button
                              type="button"
                              className="icon-btn pantry-item__low"
                              aria-pressed={item.low}
                              aria-label={item.low ? `${item.name} is running low. Tap to mark it as stocked.` : `Mark ${item.name} as running low`}
                              title={item.low ? "Mark as stocked" : "Mark as running low"}
                              onClick={() => toggleLow(item.name)}
                            >
                              <LowGlyph />
                            </button>
                            <button type="button" className="icon-btn pantry-item__remove" onClick={() => remove(item.name)} aria-label={`Remove ${item.name}`} title="Remove">
                              <Icon name="trash" size={18} />
                            </button>
                          </li>
                        ),
                      )}
                    </ul>
                  </section>
                );
              })
            )}

            {(q || lowOnly) && groups.length > 0 && (
              <p className="section__note" role="status">
                Showing {plural(visibleCount, "item")} of {pantry.length}.
              </p>
            )}
            {!q && !lowOnly && low.length === 0 && pantry.length > 0 && (
              <p className="section__note">Tap the gauge next to an item to mark it as running low.</p>
            )}
          </div>
        )}
      </Section>

      <Section title="From a photo" note="Want it done for you? Tap Ask, then Scan my shelf, and the concierge will read the photo. Or use this one as a checklist and tap what you see.">
        <div className="group" style={{ padding: 16 }}>
          {photo ? (
            <div className="stack">
              <div className="photo"><img src={photo} alt="Your pantry" /></div>
              <div className="tokens">
                {KNOWN_INGREDIENTS.filter((i) => !have(pantry, i)).slice(0, 24).map((i) => (
                  <button key={i} type="button" className="chip" style={{ height: 30 }} onClick={() => addItems([cleanItem(i)])}>
                    {cleanItem(i)}
                  </button>
                ))}
              </div>
              <button type="button" className="btn btn--secondary btn--sm" onClick={() => setPhoto(null)}>Remove photo</button>
            </div>
          ) : (
            <label className="btn btn--secondary btn--block" style={{ cursor: "pointer" }}>
              <Icon name="camera" size={18} />
              Take or choose a photo
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="visually-hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) setPhoto(URL.createObjectURL(f));
                }}
              />
            </label>
          )}
        </div>
      </Section>

      <Section title="Look up a barcode" note="Product data from Open Food Facts.">
        <div className="group" style={{ padding: 16 }}>
          <form onSubmit={findProduct} className="input-row">
            <label htmlFor="barcode" className="visually-hidden">Barcode number</label>
            <input
              id="barcode"
              className="input num"
              inputMode="numeric"
              placeholder="Number under the barcode"
              value={code}
              onChange={(e) => { setCode(e.target.value); setLookup({ state: "idle" }); }}
            />
            <button className="btn btn--secondary" type="submit" disabled={code.replace(/\D/g, "").length < 8 || lookup.state === "loading"}>
              <Icon name="barcode" size={18} />
              {lookup.state === "loading" ? "Looking…" : "Look up"}
            </button>
          </form>

          {lookup.state === "found" && (
            <div className="stack" style={{ marginTop: 16 }}>
              <div className="product">
                {lookup.product.image && <img src={lookup.product.image} alt="" />}
                <div>
                  <p className="row__title">{lookup.product.name}</p>
                  {lookup.product.brand && <p className="small muted">{lookup.product.brand}</p>}
                </div>
              </div>
              <button type="button" className="btn btn--tinted btn--sm" onClick={() => addItems([cleanItem(lookup.product.name)])}>
                Add to pantry
              </button>
            </div>
          )}
          {lookup.state === "missing" && (
            <p className="small muted" style={{ marginTop: 12 }}>No product found for that number. Check the digits under the barcode, or add the item by name above.</p>
          )}
          {lookup.state === "error" && (
            <p className="small muted" style={{ marginTop: 12 }}>Couldn't reach Open Food Facts. Check your connection and try again.</p>
          )}
        </div>
      </Section>
    </div>
  );
}
