import { useState } from "react";
import { SUBSTITUTES, instacartUrl, mapsUrl, substituteFor, type SubMode } from "@/data/substitutes";
import { cleanItem } from "@/lib/pantry";
import { Icon } from "@/components/Icon";
import { Segmented, Sheet } from "@/components/ui";

const OPTIONS = Object.keys(SUBSTITUTES).sort();

const article = (word: string) => (/^[aeiou]/i.test(word) ? "an" : "a");
const shopLabel = (shop: string) => (/^(any )?supermarket$/i.test(shop) ? "Find a supermarket" : `Find ${article(shop)} ${shop}`);

export function SwapSheet({ initial, onClose }: { initial?: string; onClose: () => void }) {
  const [ingredient, setIngredient] = useState(initial ?? "palm oil");
  const [mode, setMode] = useState<SubMode>(() => (initial && SUBSTITUTES[initial]?.essential ? "authentic" : "cheapest"));
  const sub = substituteFor(ingredient);
  const name = cleanItem(ingredient);

  const verdict = {
    cheapest: { title: `Use this instead of ${name.toLowerCase()}`, body: sub.swap, foot: sub.tradeoff },
    authentic: sub.essential
      ? { title: "Worth the trip", body: `The dish isn't quite itself without real ${name.toLowerCase()}. Try ${article(sub.shop)} ${sub.shop}.`, foot: sub.tip ?? sub.tradeoff }
      : { title: "A swap is fine here", body: sub.swap, foot: sub.tradeoff },
    fastest: { title: "Keep cooking, order for next time", body: `Tonight: ${sub.swap.charAt(0).toLowerCase() + sub.swap.slice(1)}.`, foot: "Get the real thing delivered for next time." },
  }[mode];

  return (
    <Sheet title="Out of something?" onClose={onClose}>
      <div className="stack stack--lg">
        <div>
          <label className="label" htmlFor="swap-ing">Ingredient</label>
          <select id="swap-ing" className="input" value={ingredient} onChange={(e) => setIngredient(e.target.value)}>
            {!OPTIONS.includes(ingredient) && <option value={ingredient}>{name}</option>}
            {OPTIONS.map((o) => (
              <option key={o} value={o}>{cleanItem(o)}</option>
            ))}
          </select>
        </div>

        <Segmented<SubMode>
          label="What matters most"
          value={mode}
          onChange={setMode}
          options={[
            { value: "cheapest", label: "Cheapest" },
            { value: "authentic", label: "Authentic" },
            { value: "fastest", label: "Fastest" },
          ]}
        />

        <div className="callout">
          <p className="callout__title">{verdict.title}</p>
          <p style={{ marginTop: 4, fontWeight: 500 }}>{verdict.body}</p>
          <p className="small muted" style={{ marginTop: 6 }}>{verdict.foot}</p>
        </div>

        <div className="group">
          <a className="row row--inset" href={mapsUrl(sub.shop === "Any supermarket" || sub.shop === "Supermarket" ? sub.search : sub.shop)} target="_blank" rel="noreferrer">
            <span className="avatar"><Icon name="pin" size={20} /></span>
            <span className="row__body">
              <span className="row__title" style={{ display: "block" }}>{shopLabel(sub.shop)}</span>
              <span className="row__meta" style={{ display: "block" }}>Opens Google Maps near you</span>
            </span>
            <span className="row__trail"><Icon name="chevron" size={18} /></span>
          </a>
          <a className="row row--inset" href={instacartUrl(sub.search)} target="_blank" rel="noreferrer">
            <span className="avatar" style={{ ["--av" as string]: "var(--leaf-tint)", ["--av-ink" as string]: "var(--leaf)" }}><Icon name="bag" size={20} /></span>
            <span className="row__body">
              <span className="row__title" style={{ display: "block" }}>Order {name.toLowerCase()}</span>
              <span className="row__meta" style={{ display: "block" }}>Search Instacart for "{sub.search}"</span>
            </span>
            <span className="row__trail"><Icon name="chevron" size={18} /></span>
          </a>
        </div>
      </div>
    </Sheet>
  );
}
