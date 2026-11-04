import { useMemo } from "react";
import { covers, rankDishes } from "@/lib/pantry";
import { useUseSoon } from "@/lib/use-soon";
import { useApp } from "@/lib/app-context";
import { DishRow } from "./DishRow";
import { Icon } from "./Icon";
import { Section } from "./ui";

/** "Use these first": perishables the photo scan flagged, and dishes that use them up. */
export function UseItUp() {
  const { pantry } = useApp();
  const { items, remove } = useUseSoon();

  // Only items still in the pantry count.
  const active = useMemo(
    () => items.filter((i) => pantry.some((p) => p.toLowerCase() === i.name.toLowerCase())),
    [items, pantry],
  );

  const dishes = useMemo(() => {
    if (!active.length) return [];
    return rankDishes(pantry)
      .map((m) => ({ m, uses: active.filter((a) => m.dish.ingredients.some((ing) => covers(a.name, ing))) }))
      .filter((x) => x.uses.length > 0 && x.m.need.length <= 2)
      .sort((a, b) => b.uses.length - a.uses.length || a.m.need.length - b.m.need.length)
      .slice(0, 3);
  }, [active, pantry]);

  if (!active.length) return null;

  return (
    <Section title="Use these first" note="Flagged from your photo. Tap the cross once you've used something.">
      <div className="useup">
        <ul className="useup__items">
          {active.map((i) => (
            <li key={i.name} className="useup__item">
              <span className="useup__name">{i.name}</span>
              {i.note && <span className="useup__note">{i.note}</span>}
              <button type="button" className="useup__done" onClick={() => remove(i.name)} aria-label={`I've used the ${i.name.toLowerCase()}`}>
                <Icon name="close" size={14} strokeWidth={2} />
              </button>
            </li>
          ))}
        </ul>
        {dishes.length > 0 ? (
          <div className="group">
            {dishes.map(({ m }) => (
              <DishRow key={m.dish.id} match={m} />
            ))}
          </div>
        ) : (
          <p className="small muted" style={{ padding: "4px 4px 0" }}>
            None of our dishes use these yet. Ask the concierge for an idea.
          </p>
        )}
      </div>
    </Section>
  );
}
