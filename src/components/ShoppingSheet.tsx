import { useState, type FormEvent } from "react";
import { useApp } from "@/lib/app-context";
import { usePersistentState } from "@/lib/storage";
import { groupByAisle, listAsText, useShoppingList, type ShoppingItem } from "@/lib/shopping";
import { doordashSearchUrl, instacartSearchUrl, walmartSearchUrl } from "@/lib/concierge-types";
import { Icon } from "./Icon";
import { Sheet } from "./ui";

/** "For Jollof rice", "For Jollof rice and Egusi soup", "For Jollof rice, Waakye and 2 more" */
function forLine(dishes: string[]) {
  if (dishes.length === 0) return null;
  if (dishes.length === 1) return `For ${dishes[0]}`;
  if (dishes.length === 2) return `For ${dishes[0]} and ${dishes[1]}`;
  return `For ${dishes[0]}, ${dishes[1]} and ${dishes.length - 2} more`;
}

function CartIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 4h2.5l2.2 10.5h10.6L20.5 7.5H7" />
      <circle cx="9.5" cy="19" r="1.5" />
      <circle cx="17" cy="19" r="1.5" />
    </svg>
  );
}

function ItemRow({ item, onToggle, onRemove }: { item: ShoppingItem; onToggle: () => void; onRemove: () => void }) {
  const meta = forLine(item.forDishes);
  return (
    <li className={item.checked ? "shop-row shop-row--checked" : "shop-row"}>
      <label className="shop-row__hit">
        <input type="checkbox" className="shop-check" checked={item.checked} onChange={onToggle} />
        <span className="shop-row__text">
          <span className="shop-row__name">{item.name}</span>
          {meta && <span className="shop-row__for">{meta}</span>}
        </span>
      </label>
      <button type="button" className="shop-row__remove" aria-label={`Remove ${item.name} from list`} onClick={onRemove}>
        <Icon name="close" size={18} />
      </button>
    </li>
  );
}

export function ShoppingSheet({ onClose }: { onClose: () => void }) {
  const { addItems, notify } = useApp();
  const { items, add, toggle, remove, clearChecked, count } = useShoppingList();
  const [draft, setDraft] = useState("");
  const [toPantry, setToPantry] = usePersistentState("shopping-to-pantry", true);

  const open = items.filter((i) => !i.checked);
  const inCart = items.filter((i) => i.checked).sort((a, b) => a.name.localeCompare(b.name));
  const groups = groupByAisle(open);
  const query = open.length === 1 ? open[0].name : open.map((i) => i.name).join(", ");

  function onAdd(e: FormEvent) {
    e.preventDefault();
    const names = draft.split(",").map((s) => s.trim()).filter(Boolean);
    if (!names.length) return;
    const n = add(names);
    setDraft("");
    if (n === 0) notify(names.length === 1 ? "Already on your list" : "Those are already on your list");
  }

  function onToggle(item: ShoppingItem) {
    toggle(item.id);
    if (!item.checked && toPantry) {
      addItems([item.name]);
      notify(`${item.name} is in your pantry now`);
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(listAsText(items));
      notify("Shopping list copied");
    } catch {
      notify("Couldn't copy: your browser blocked the clipboard");
    }
  }

  function onClear() {
    const n = inCart.length;
    clearChecked();
    notify(`Cleared ${n} checked ${n === 1 ? "item" : "items"}`);
  }

  const footer =
    items.length === 0 ? undefined : (
      <div className="shop-foot">
        {open.length > 0 && (
          <>
            <a className="btn btn--primary btn--block" href={instacartSearchUrl(query)} target="_blank" rel="noreferrer">
              <Icon name="bag" size={18} />
              Order on Instacart
            </a>
            <div className="btn-row">
              <a className="btn btn--secondary" href={walmartSearchUrl(query)} target="_blank" rel="noreferrer">
                Walmart
              </a>
              <a className="btn btn--secondary" href={doordashSearchUrl(query)} target="_blank" rel="noreferrer">
                DoorDash
              </a>
            </div>
          </>
        )}
        <div className="shop-foot__quiet">
          <button type="button" className="link shop-foot__link" onClick={copy} disabled={open.length === 0}>
            <Icon name="copy" size={16} />
            Copy list
          </button>
          <button type="button" className="link shop-foot__link" onClick={onClear} disabled={inCart.length === 0}>
            <Icon name="trash" size={16} />
            Clear checked
          </button>
        </div>
      </div>
    );

  return (
    <Sheet
      title={
        <span className="shop-title">
          Shopping list
          {count > 0 && <span className="shop-title__count num" aria-label={`${count} to buy`}>{count}</span>}
        </span>
      }
      onClose={onClose}
      footer={footer}
    >
      <form className="shop-add" onSubmit={onAdd}>
        <label htmlFor="shop-add-input" className="visually-hidden">Add an item</label>
        <input
          id="shop-add-input"
          className="input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Add an item, like plantain"
          autoComplete="off"
          enterKeyHint="done"
        />
        <button type="submit" className="btn btn--tinted shop-add__btn" disabled={!draft.trim()} aria-label="Add to list">
          <Icon name="plus" size={20} />
        </button>
      </form>

      {items.length === 0 ? (
        <div className="shop-empty">
          <span className="shop-empty__icon"><CartIcon size={28} /></span>
          <strong>Your list is empty</strong>
          <p>Open a dish and tap "Add to list" to save what you're missing. You can also type items above.</p>
        </div>
      ) : (
        <>
          {open.length === 0 && (
            <div className="shop-done" role="status">
              <Icon name="check" size={20} strokeWidth={2.25} />
              You've got everything on your list
            </div>
          )}

          {groups.map((g) => (
            <section key={g.aisle} className="shop-aisle" aria-label={g.aisle}>
              <h3 className="shop-aisle__title">
                {g.aisle}
                <span className="num">{g.items.length}</span>
              </h3>
              <ul className="group shop-list">
                {g.items.map((it) => (
                  <ItemRow key={it.id} item={it} onToggle={() => onToggle(it)} onRemove={() => remove(it.id)} />
                ))}
              </ul>
            </section>
          ))}

          {inCart.length > 0 && (
            <details className="shop-cart">
              <summary className="shop-cart__summary">
                <Icon name="chevron" size={18} />
                In your cart
                <span className="num">{inCart.length}</span>
              </summary>
              <ul className="group shop-list">
                {inCart.map((it) => (
                  <ItemRow key={it.id} item={it} onToggle={() => onToggle(it)} onRemove={() => remove(it.id)} />
                ))}
              </ul>
            </details>
          )}

          <label className="shop-pantry">
            <input type="checkbox" checked={toPantry} onChange={(e) => setToPantry(e.target.checked)} />
            <span>
              <span className="shop-pantry__title">Add to my pantry when I check something off</span>
              <span className="shop-pantry__note">Bought it, so it counts toward what you can cook.</span>
            </span>
          </label>
        </>
      )}
    </Sheet>
  );
}

/** Compact header/sidebar trigger with an unchecked-count badge. */
export function ShoppingListButton({ onClick, variant = "icon", className = "" }: { onClick: () => void; variant?: "icon" | "sidebar"; className?: string }) {
  const { count } = useShoppingList();
  const label = count > 0 ? `Shopping list, ${count} to buy` : "Shopping list";
  if (variant === "sidebar") {
    return (
      <button type="button" className="sidebar__item shop-trigger--sidebar" onClick={onClick} aria-label={label}>
        <CartIcon />
        Shopping list
        {count > 0 && <span className="shop-badge num" aria-hidden="true">{count}</span>}
      </button>
    );
  }
  return (
    <button type="button" className={`shop-trigger ${className}`.trim()} onClick={onClick} aria-label={label}>
      <CartIcon size={22} />
      {count > 0 && <span className="shop-badge shop-badge--dot num" aria-hidden="true">{count > 99 ? "99+" : count}</span>}
    </button>
  );
}
