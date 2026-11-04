import { useMemo } from "react";
import { BATTLES } from "@/data/battles";
import { rankDishes } from "@/lib/pantry";
import { useApp } from "@/lib/app-context";
import { DishRow } from "@/components/DishRow";
import { Icon } from "@/components/Icon";
import { PageHeader, Section } from "@/components/ui";

const plural = (n: number, one: string, many = one + "s") => `${n} ${n === 1 ? one : many}`;

export function CookScreen({ ratings }: { ratings: Record<string, Record<string, number>> }) {
  const { pantry, go, ask } = useApp();
  const ranked = useMemo(() => rankDishes(pantry), [pantry]);
  const ready = ranked.filter((m) => m.need.length === 0);
  const close = ranked.filter((m) => m.need.length > 0 && m.need.length <= 2);

  const jollof = BATTLES[0];
  const jollofRatings = ratings[jollof.id] ?? {};
  const leader = [...jollof.contenders].sort(
    (a, b) => (jollofRatings[b.id] ?? b.rating) - (jollofRatings[a.id] ?? a.rating),
  )[0];

  const lede =
    pantry.length === 0
      ? "Add what's in your kitchen and we'll show what you can cook from it."
      : ready.length > 0
        ? `You can cook ${plural(ready.length, "dish", "dishes")} right now, and ${close.length} more if you pick up one or two things.`
        : `Nothing is fully covered yet. ${plural(close.length, "dish", "dishes")} are one or two ingredients away.`;

  return (
    <div className="page">
      <PageHeader title="Cook" lede={lede} />

      <Section>
        <div className="group">
          <div className="row" style={{ alignItems: "flex-start" }}>
            <div className="row__body">
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                <span className="row__title">In your pantry</span>
                <button type="button" className="link" onClick={() => go("pantry")}>
                  {pantry.length ? "Edit" : "Add items"}
                </button>
              </div>
              {pantry.length > 0 ? (
                <div className="tokens">
                  {pantry.slice(0, 10).map((p) => (
                    <span key={p} className="token">{p}</span>
                  ))}
                  {pantry.length > 10 && <span className="token">+{pantry.length - 10} more</span>}
                </div>
              ) : (
                <p className="small muted">Your pantry is empty.</p>
              )}
            </div>
          </div>
        </div>
      </Section>

      {ready.length > 0 && (
        <Section title="Ready to cook">
          <div className="group">
            {ready.map((m) => (
              <DishRow key={m.dish.id} match={m} />
            ))}
          </div>
        </Section>
      )}

      {close.length > 0 && (
        <Section
          title="One or two short"
          action={<button type="button" className="link" onClick={() => go("explore")}>All dishes</button>}
          note="Tap a missing ingredient inside a dish to see what to use instead."
        >
          <div className="group">
            {close.slice(0, 6).map((m) => (
              <DishRow key={m.dish.id} match={m} />
            ))}
          </div>
        </Section>
      )}

      <Section>
        <div className="group">
          <button type="button" className="row row--inset" onClick={() => ask()}>
            <span className="avatar" style={{ ["--av" as string]: "var(--gold-tint)", ["--av-ink" as string]: "var(--gold-ink)" }}>
              <Icon name="swap" size={20} />
            </span>
            <span className="row__body">
              <span className="row__title" style={{ display: "block" }}>Out of something?</span>
              <span className="row__meta" style={{ display: "block" }}>Ask the concierge for a swap, a shop nearby or delivery</span>
            </span>
            <span className="row__trail"><Icon name="chevron" size={18} /></span>
          </button>
          <button type="button" className="row row--inset" onClick={() => go("battles")}>
            <span className="avatar">
              <Icon name="battles" size={20} />
            </span>
            <span className="row__body">
              <span className="row__title" style={{ display: "block" }}>Jollof standings</span>
              <span className="row__meta" style={{ display: "block" }}>{leader.dish} ({leader.origin}) is in first</span>
            </span>
            <span className="row__trail"><Icon name="chevron" size={18} /></span>
          </button>
        </div>
      </Section>
    </div>
  );
}
