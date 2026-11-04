import { peopleById } from "@/data/dishes";
import type { Match } from "@/lib/pantry";
import { useApp } from "@/lib/app-context";
import { Icon } from "./Icon";
import { Meter, formatMinutes } from "./ui";
import { PlateArt } from "./PlateArt";

export function DishRow({ match, showPeople = true }: { match: Match; showPeople?: boolean }) {
  const { openDish } = useApp();
  const { dish, have, need } = match;
  const people = peopleById[dish.peopleId];

  const status =
    need.length === 0 ? (
      <span className="status status--have">You have everything</span>
    ) : (
      <span className="status status--need">Need {need.slice(0, 2).join(", ")}{need.length > 2 ? ` +${need.length - 2}` : ""}</span>
    );

  return (
    <button type="button" className="row row--inset" onClick={() => openDish(dish.id)}>
      <PlateArt dish={dish} size={40} />
      <span className="row__body">
        <span className="row__title" style={{ display: "block" }}>{dish.name}</span>
        <span className="row__meta" style={{ display: "block" }}>
          {showPeople ? `${people?.name ?? dish.origin}, ${formatMinutes(dish.minutes)}` : formatMinutes(dish.minutes)}
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 6 }}>
          <Meter have={have.length} total={dish.ingredients.length} />
          {status}
        </span>
      </span>
      <span className="row__trail">
        <Icon name="chevron" size={18} />
      </span>
    </button>
  );
}
