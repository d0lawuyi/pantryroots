import { useApp } from "@/lib/app-context";
import { matchDish } from "@/lib/pantry";
import { usePlan } from "@/lib/plan";
import { Icon } from "./Icon";
import { PlateArt } from "./PlateArt";
import { formatMinutes } from "./ui";
import { CalendarIcon } from "./WeekPlanSheet";

/**
 * One compact row for the Cook screen. With a dinner planned for today: the dish and a Cook
 * button. Otherwise: a way into the week plan, with how many days are filled.
 */
export function TonightPlanned({ onOpenPlan }: { onOpenPlan: () => void }) {
  const { getDish, pantry, startCooking } = useApp();
  const { plan, today } = usePlan();
  const dish = today.dishId ? getDish(today.dishId) : undefined;
  const upcoming = plan.filter((d) => !d.isPast);
  const planned = upcoming.filter((d) => d.dishId && getDish(d.dishId)).length;

  if (dish) {
    const { need } = matchDish(dish, pantry);
    return (
      <div className="group tonight-plan">
        <div className="row tonight-plan__row">
          <button type="button" className="tonight-plan__open" onClick={onOpenPlan} aria-label={`Planned for tonight: ${dish.name}. Open week plan`}>
            <PlateArt dish={dish} size={40} />
            <span className="row__body">
              <span className="row__meta plan-block tonight-plan__kicker">Planned for tonight</span>
              <span className="row__title plan-block">{dish.name}</span>
              <span className="row__meta plan-block">
                {formatMinutes(dish.minutes)}, {need.length === 0 ? "you have everything" : `need ${need.length === 1 ? need[0] : `${need.length} items`}`}
              </span>
            </span>
          </button>
          <button type="button" className="btn btn--primary tonight-plan__cook" onClick={() => startCooking(dish.id)}>
            <Icon name="cook" size={18} />
            Cook
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="group tonight-plan">
      <button type="button" className="row tonight-plan__row" onClick={onOpenPlan}>
        <span className="avatar">
          <CalendarIcon />
        </span>
        <span className="row__body">
          <span className="row__title plan-block">Plan this week's dinners</span>
          <span className="row__meta plan-block">
            {planned > 0
              ? `${planned} of ${upcoming.length} days planned, nothing for tonight`
              : "Pick dinners for the week and get one shopping list"}
          </span>
        </span>
        <span className="row__trail">
          <Icon name="chevron" size={18} />
        </span>
      </button>
    </div>
  );
}
