import type { Dish } from "@/data/dishes";
import { cleanItem } from "@/lib/pantry";

/** Preparation water and optional extras never become pantry requirements. */
export function RecipeExtras({ dish }: { dish: Dish }) {
  const extras = Object.entries(dish.optionalIngredients ?? {});
  if (!dish.water && !dish.prepNote && !extras.length) return null;

  return (
    <section aria-label="Preparation notes" style={{ marginTop: 20 }}>
      {dish.prepNote && <p className="small muted" style={{ marginBottom: 8 }}><strong>Before you start:</strong> {dish.prepNote}</p>}
      {dish.water && <p className="small muted"><strong>Water:</strong> {dish.water}</p>}
      {extras.length > 0 && (
        <>
          <h3 className="section__title" style={{ marginTop: 16 }}>Optional extras</h3>
          <p className="xs muted" style={{ marginTop: 4 }}>Not counted in pantry matches or added to the shopping list automatically.</p>
          <ul className="group" style={{ marginTop: 8 }}>
            {extras.map(([name, amount]) => (
              <li key={name} className="row">
                <span className="row__body small">{cleanItem(name)}<span className="row__meta" style={{ display: "block" }}>{amount}</span></span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
