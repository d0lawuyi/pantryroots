import { useState } from "react";
import { dishById } from "@/data/dishes";
import { doordashSearchUrl, walmartSearchUrl, type Card } from "@/lib/concierge-types";
import { matchDish } from "@/lib/pantry";
import { useApp } from "@/lib/app-context";
import { DishRow } from "./DishRow";
import { Icon } from "./Icon";
import { formatMinutes } from "./ui";
import { PlateArt } from "./PlateArt";
import { AddToListButton } from "./AddToListButton";
import { useUseSoon } from "@/lib/use-soon";

export function ConciergeCard({ card }: { card: Card }) {
  switch (card.type) {
    case "scan":
      return <ScanCard items={card.items} source={card.source} />;
    case "dishes":
      return <DishesCard ids={card.dishIds} />;
    case "aiDish":
      return <AiDishCard card={card} />;
    case "swap":
      return <SwapCard card={card} />;
    case "stores":
      return <StoresCard card={card} />;
    case "cart":
      return <CartCard card={card} />;
  }
}

function CardShell({ title, meta, children }: { title: string; meta?: string; children: React.ReactNode }) {
  return (
    <div className="ccard">
      <div className="ccard__head">
        <span className="ccard__title">{title}</span>
        {meta && <span className="ccard__meta">{meta}</span>}
      </div>
      {children}
    </div>
  );
}

function ScanCard({ items, source }: { items: { name: string; confidence: "sure" | "check"; useSoon?: boolean; note?: string }[]; source?: "photo" | "sweep" | "receipt" }) {
  const { addItems, pantry } = useApp();
  const useSoon = useUseSoon();
  const owned = new Set(pantry.map((p) => p.toLowerCase()));
  const [picked, setPicked] = useState(() => new Set(items.filter((i) => !owned.has(i.name.toLowerCase())).map((i) => i.name)));
  const [added, setAdded] = useState(false);
  const toggle = (n: string) =>
    setPicked((s) => {
      const next = new Set(s);
      next.has(n) ? next.delete(n) : next.add(n);
      return next;
    });

  return (
    <CardShell title={source === "receipt" ? "Found on your receipt" : source === "sweep" ? "Found in your sweep" : "Found in your photo"} meta={`${items.length} items`}>
      <ul className="ccard__list">
        {items.map((i) => {
          const have = owned.has(i.name.toLowerCase());
          return (
            <li key={i.name}>
              <label className="check-row">
                <input type="checkbox" checked={have || picked.has(i.name)} disabled={have || added} onChange={() => toggle(i.name)} />
                <span className="row__body">{i.name}{source === "receipt" && i.note && <span className="xs muted" style={{ display: "block" }}>{i.note}</span>}</span>
                {i.useSoon && <span className="pill pill--soon" title={i.note}>Use soon</span>}
                {have ? <span className="xs muted">In pantry</span> : i.confidence === "check" && <span className="pill pill--neutral">Check</span>}
              </label>
            </li>
          );
        })}
      </ul>
      <div className="ccard__foot">
        <button
          type="button"
          className="btn btn--primary btn--sm btn--block"
          disabled={added || picked.size === 0}
          onClick={() => {
            addItems([...picked]);
            useSoon.add(items.filter((i) => i.useSoon && (picked.has(i.name) || owned.has(i.name.toLowerCase()))).map((i) => ({ name: i.name, note: i.note })));
            setAdded(true);
          }}
        >
          {added ? "Added to pantry" : `Add ${picked.size} to pantry`}
        </button>
      </div>
    </CardShell>
  );
}

function DishesCard({ ids }: { ids: string[] }) {
  const { pantry } = useApp();
  const matches = ids.map((id) => dishById[id]).filter(Boolean).map((d) => matchDish(d, pantry));
  if (!matches.length) return null;
  return (
    <div className="ccard ccard--flush">
      {matches.map((m) => (
        <DishRow key={m.dish.id} match={m} />
      ))}
    </div>
  );
}

function AiDishCard({ card }: { card: Extract<Card, { type: "aiDish" }> }) {
  const { openDish, pantry } = useApp();
  const m = matchDish(card.dish, pantry);
  return (
    <div className="ccard ccard--flush">
      <button type="button" className="row row--inset" onClick={() => openDish(card.dish.id)}>
        <PlateArt dish={{ ...card.dish, aiWritten: true }} size={40} />
        <span className="row__body">
          <span className="row__title" style={{ display: "block" }}>{card.dish.name}</span>
          <span className="row__meta" style={{ display: "block" }}>{card.dish.origin}, {formatMinutes(card.dish.minutes)}</span>
          <span style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 6 }}>
            <span className="pill pill--neutral">AI-written</span>
            <span className="xs muted num">{m.have.length} of {card.dish.ingredients.length} in pantry</span>
          </span>
        </span>
        <span className="row__trail"><Icon name="chevron" size={18} /></span>
      </button>
    </div>
  );
}

function SwapCard({ card }: { card: Extract<Card, { type: "swap" }> }) {
  const rows = [
    { label: "Cheapest", text: card.cheapest },
    { label: "Most authentic", text: card.authentic },
    { label: "Fastest", text: card.fastest },
  ];
  return (
    <CardShell title={`Out of ${card.ingredient}`} meta={card.source === "ai" ? "AI-written" : card.essential ? "Hard to replace" : "Easy swap"}>
      <dl className="swap-list">
        {rows.map((r) => (
          <div key={r.label}>
            <dt>{r.label}</dt>
            <dd>{r.text}</dd>
          </div>
        ))}
      </dl>
      <p className="ccard__note">{card.tradeoff}</p>
    </CardShell>
  );
}

function StoresCard({ card }: { card: Extract<Card, { type: "stores" }> }) {
  const label = card.source === "live" ? "Live from Google Maps" : card.source === "demo" ? "Sample stores" : undefined;
  return (
    <CardShell title="Nearest shops" meta={label}>
      {card.stores.length > 0 ? (
        <ul className="ccard__list">
          {card.stores.map((s) => (
            <li key={s.name + s.address} className="store">
              <div className="row__body">
                <p className="row__title">{s.name}</p>
                <p className="xs muted">
                  {[
                    s.distanceMiles !== undefined ? `${s.distanceMiles} mi` : null,
                    s.driveMinutes !== undefined ? `${s.driveMinutes} min drive` : null,
                    s.openNow === false ? "Closed now" : s.closes ? `Open until ${s.closes}` : s.openNow ? "Open now" : null,
                  ]
                    .filter(Boolean)
                    .join(", ")}
                </p>
              </div>
              <a className="btn btn--secondary btn--sm" href={s.mapsUrl} target="_blank" rel="noreferrer">
                <Icon name="pin" size={16} />
                Directions
              </a>
            </li>
          ))}
        </ul>
      ) : (
        <p className="ccard__note" style={{ marginTop: 0 }}>Live store lookup isn't available right now.</p>
      )}
      <div className="ccard__foot">
        <a className="link" href={card.searchUrl} target="_blank" rel="noreferrer">Search Google Maps</a>
      </div>
    </CardShell>
  );
}

function CartCard({ card }: { card: Extract<Card, { type: "cart" }> }) {
  return (
    <CardShell title="Get it delivered" meta={card.source === "live" ? "Instacart cart ready" : "Compare 3 services"}>
      <div className="tokens" style={{ padding: "0 14px" }}>
        {card.items.map((i) => (
          <span key={i} className="token">{i}</span>
        ))}
      </div>
      <p className="ccard__note">{card.eta}</p>
      <div className="ccard__foot">
        <a className="btn btn--primary btn--sm btn--block" href={card.url} target="_blank" rel="noreferrer">
          <Icon name="bag" size={16} />
          {card.source === "live" ? "Open cart on Instacart" : "Search on Instacart"}
        </a>
        <div className="btn-row" style={{ marginTop: 8 }}>
          <a className="btn btn--secondary btn--sm" href={walmartSearchUrl(card.items[0] ?? "groceries")} target="_blank" rel="noreferrer">
            Walmart
          </a>
          <a className="btn btn--secondary btn--sm" href={doordashSearchUrl(card.items[0] ?? "groceries")} target="_blank" rel="noreferrer">
            DoorDash
          </a>
        </div>
        <div style={{ marginTop: 8 }}>
          <AddToListButton size="sm" className="btn--block" items={card.items} label="Add to my list" />
        </div>
      </div>
    </CardShell>
  );
}
