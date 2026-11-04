import { useState } from "react";
import { peopleById } from "@/data/dishes";
import { substituteFor } from "@/data/substitutes";
import { cleanItem, matchDish } from "@/lib/pantry";
import { useApp } from "@/lib/app-context";
import { Icon } from "@/components/Icon";
import { Meter, Plate, Sheet, formatMinutes } from "@/components/ui";

export function DishSheet({ id, onClose }: { id: string; onClose: () => void }) {
  const { pantry, addItems, ask, getDish, notify, startCooking } = useApp();
  const [open, setOpen] = useState<string | null>(null);
  const found = getDish(id);
  if (!found) return null;
  const dish = found;
  const people = peopleById[dish.peopleId];
  const originLine = people ? `${people.name}, ${people.area}` : dish.origin ?? "";
  const m = matchDish(dish, pantry);

  async function copyList() {
    const text = `${dish.name}: shopping list\n` + m.need.map((n) => `- ${cleanItem(n)}`).join("\n");
    try {
      await navigator.clipboard.writeText(text);
      notify("Shopping list copied");
    } catch {
      notify("Couldn't copy — your browser blocked the clipboard");
    }
  }

  return (
    <Sheet
      title={dish.name}
      onClose={onClose}
      footer={
        <div className="stack" style={{ gap: 8 }}>
          {m.need.length > 0 && (
            <div className="btn-row">
              <button type="button" className="btn btn--secondary" onClick={copyList}>
                <Icon name="copy" size={18} />
                Copy list
              </button>
              <button type="button" className="btn btn--secondary" onClick={() => addItems(m.need.map(cleanItem))}>
                I've got them
              </button>
            </div>
          )}
          <button type="button" className="btn btn--primary btn--block" onClick={() => startCooking(dish.id)}>
            <Icon name="cook" size={18} />
            Start cooking
          </button>
        </div>
      }
    >
      <div className="dish-head">
        <Plate tone={dish.tone} large />
        <div>
          <p className="small muted">{originLine}</p>
          <div className="facts" style={{ marginTop: 4 }}>
            <span><Icon name="clock" size={16} />{formatMinutes(dish.minutes)}</span>
            {dish.ahead && <span><Icon name="hourglass" size={16} />{dish.ahead}</span>}
          </div>
        </div>
      </div>

      {dish.aiWritten && (
        <div className="callout" style={{ marginBottom: 16 }}>
          <p className="callout__title">AI-written recipe</p>
          <p className="small" style={{ marginTop: 2 }}>Written by the concierge, not from our tested list. Check it with someone who cooks this dish.</p>
        </div>
      )}

      <p style={{ lineHeight: 1.6 }}>{dish.summary}</p>

      <div style={{ margin: "24px 0 8px", display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <h3 className="section__title" style={{ fontSize: "var(--fs-lg)" }}>Ingredients</h3>
        <span className="small muted num">{m.have.length} of {dish.ingredients.length} in pantry</span>
      </div>
      <Meter have={m.have.length} total={dish.ingredients.length} large />

      <ul className="group" style={{ marginTop: 12 }}>
        {dish.ingredients.map((ing) => {
          const has = m.have.includes(ing);
          const sub = substituteFor(ing);
          return (
            <li key={ing}>
              <div className="row" style={{ minHeight: 48, paddingBlock: 8 }}>
                <span className="row__body">{cleanItem(ing)}</span>
                {has ? (
                  <span className="status status--have"><Icon name="check" size={16} strokeWidth={2.25} />Have</span>
                ) : (
                  <span className="row__trail">
                    <button type="button" className="btn btn--tinted btn--sm" aria-expanded={open === ing} onClick={() => setOpen(open === ing ? null : ing)}>
                      Swap
                    </button>
                    <button type="button" className="icon-btn" aria-label={`Add ${ing} to pantry`} onClick={() => addItems([cleanItem(ing)])}>
                      <Icon name="plus" size={18} />
                    </button>
                  </span>
                )}
              </div>
              {open === ing && (
                <div className="sub-panel">
                  <p><strong>Use instead:</strong> {sub.swap}</p>
                  <p className="muted" style={{ marginTop: 4 }}>{sub.tradeoff}</p>
                  <button type="button" className="link" style={{ marginTop: 8 }} onClick={() => ask(`I'm out of ${ing} for ${dish.name}`)}>
                    Find it nearby or delivered
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <div className="callout callout--indigo" style={{ marginTop: 24 }}>
        <p className="callout__title">What makes it this dish</p>
        <p style={{ marginTop: 4 }}>{dish.technique}</p>
      </div>

      <h3 className="section__title" style={{ fontSize: "var(--fs-lg)", margin: "24px 0 12px" }}>Method</h3>
      <ol className="steps">
        {dish.steps.map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ol>
    </Sheet>
  );
}
