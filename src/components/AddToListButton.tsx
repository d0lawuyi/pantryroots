import { useApp } from "@/lib/app-context";
import { useShoppingList } from "@/lib/shopping";
import { cleanItem } from "@/lib/pantry";
import { Icon } from "./Icon";

/**
 * Adds ingredients to the shopping list, tagged with the dish they're for.
 * `size="sm"` for cards; `className` lets a caller add e.g. "btn--block".
 */
export function AddToListButton({
  items,
  dishName,
  size,
  className = "",
  label = "Add to list",
}: {
  items: string[];
  dishName?: string;
  size?: "sm";
  className?: string;
  label?: string;
}) {
  const { notify } = useApp();
  const { items: list, add } = useShoppingList();
  const onList = new Set(list.filter((i) => !i.checked).map((i) => i.name.toLowerCase()));
  const allOnList = items.length > 0 && items.every((i) => onList.has(cleanItem(i).toLowerCase()));

  function onClick() {
    const fresh = items.filter((i) => !onList.has(cleanItem(i).toLowerCase())).length;
    add(items, dishName);
    notify(fresh === 0 ? "Already on your shopping list" : `Added ${fresh} to your shopping list`);
  }

  return (
    <button
      type="button"
      className={["btn", allOnList ? "btn--tinted" : "btn--secondary", size === "sm" ? "btn--sm" : "", className].filter(Boolean).join(" ")}
      onClick={onClick}
      disabled={items.length === 0}
    >
      <Icon name={allOnList ? "check" : "plus"} size={size === "sm" ? 16 : 18} strokeWidth={allOnList ? 2.25 : 1.75} />
      {allOnList ? "On your list" : label}
    </button>
  );
}
