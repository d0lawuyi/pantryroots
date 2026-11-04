import { useMemo, useState, type FormEvent } from "react";
import { DISHES } from "@/data/dishes";
import { KNOWN_INGREDIENTS, cleanItem, have, matchDish } from "@/lib/pantry";
import { useApp } from "@/lib/app-context";
import { Icon } from "@/components/Icon";
import { PageHeader, Section } from "@/components/ui";

type Product = { name: string; brand: string; image?: string };
type Lookup = { state: "idle" } | { state: "loading" } | { state: "found"; product: Product } | { state: "missing" } | { state: "error" };

export function PantryScreen() {
  const { pantry, addItems, removeItem, notify } = useApp();
  const [draft, setDraft] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [lookup, setLookup] = useState<Lookup>({ state: "idle" });

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

  function submit(e: FormEvent) {
    e.preventDefault();
    const items = draft.split(",").map(cleanItem).filter(Boolean);
    if (!items.length) return;
    addItems(items);
    setDraft("");
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

  return (
    <div className="page">
      <PageHeader
        title="Pantry"
        lede={pantry.length ? `${pantry.length} items. Saved on this device.` : "Add what you have and we'll match it to dishes."}
      />

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
        {pantry.length === 0 ? (
          <div className="group empty">
            <strong>Nothing here yet</strong>
            Start with your staples: rice, onion, tomato, oil.
          </div>
        ) : (
          <ul className="group">
            {pantry.map((item) => (
              <li key={item} className="row" style={{ minHeight: 48, paddingBlock: 6 }}>
                <span className="row__body">{item}</span>
                <button type="button" className="icon-btn" onClick={() => { removeItem(item); notify(`Removed ${item}`); }} aria-label={`Remove ${item}`}>
                  <Icon name="trash" size={18} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="From a photo" note="Automatic recognition isn't switched on yet. Use your photo as a checklist and tap what you see.">
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
