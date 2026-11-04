import { useState } from "react";
import { peopleById } from "@/data/dishes";
import { SUBSTITUTES, substituteFor } from "@/data/substitutes";
import { cleanItem, matchDish } from "@/lib/pantry";
import { useApp } from "@/lib/app-context";
import { Icon } from "@/components/Icon";
import { Meter, Sheet, formatMinutes } from "@/components/ui";
import { PlateArt } from "@/components/PlateArt";
import { AddToListButton } from "@/components/AddToListButton";
import { storyFor } from "@/data/stories";
import { SayItButton } from "@/components/SayItButton";
import { DishStory } from "@/components/DishStory";
import { ShareButton } from "@/components/ShareButton";
import { isFamilyRecipe } from "@/lib/family";
import { FamilyQuote } from "@/components/FamilyRecipeSheet";
import { MacrosPanel } from "@/components/MacrosPanel";

export function DishSheet({ id, onClose }: { id: string; onClose: () => void }) {
  const { pantry, addItems, ask, getDish, notify, startCooking } = useApp();
  const [open, setOpen] = useState<string | null>(null);
  const found = getDish(id);
  if (!found) return null;
  const dish = found;
  const people = peopleById[dish.peopleId];
  const family = isFamilyRecipe(dish) ? dish : null;
  const originLine = family?.from ? `From ${family.from}` : people ? `${people.name}, ${people.area}` : dish.origin ?? "";
  const m = matchDish(dish, pantry);
  const story = storyFor(dish.id);



  return (
    <Sheet
      title={dish.name}
      onClose={onClose}
      footer={
        <div className="stack" style={{ gap: 8 }}>
          {m.need.length > 0 && (
            <div className="btn-row">
              <AddToListButton items={m.need.map(cleanItem)} dishName={dish.name} />
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
        <PlateArt dish={dish} size={56} />
        <div>
          <p className="small muted">{originLine}</p>
          <div className="facts" style={{ marginTop: 4 }}>
            <span><Icon name="clock" size={16} />{formatMinutes(dish.minutes)}</span>
            {dish.ahead && <span><Icon name="hourglass" size={16} />{dish.ahead}</span>}
          </div>
        </div>
        <div className="dish-head__actions">
          {story && <SayItButton text={dish.name} say={story.say} lang={story.lang} size="md" />}
          <ShareButton kind="dish" dish={dish} small />
        </div>
      </div>

      {family ? (
        <>
          {family.quote && <FamilyQuote quote={family.quote} from={family.from} />}
          <p className="xs muted" style={{ margin: "12px 0 16px" }}>
            {family.aiWritten ? "A family recipe, shaped into steps by AI from your words." : "A family recipe, saved exactly as it was told."}
          </p>
        </>
      ) : dish.aiWritten && (
        <div className="callout" style={{ marginBottom: 16 }}>
          <p className="callout__title">AI-written recipe</p>
          <p className="small" style={{ marginTop: 2 }}>Written by the concierge, not from our tested list. Check it with someone who cooks this dish.</p>
        </div>
      )}

      <p style={{ lineHeight: 1.6 }}>{dish.summary}</p>

      <DishStory dishId={dish.id} name={dish.name} />

      {dish.ingredients.length > 0 && (
        <>
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
                    {ing in SUBSTITUTES ? (
                      <button type="button" className="btn btn--tinted btn--sm" aria-expanded={open === ing} onClick={() => setOpen(open === ing ? null : ing)}>
                        Swap
                      </button>
                    ) : (
                      <button type="button" className="btn btn--tinted btn--sm" onClick={() => ask(`I need ${ing} for ${dish.name}. Where can I get it nearby, or delivered?`)}>
                        Find it
                      </button>
                    )}
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
        </>
      )}

      <MacrosPanel dish={dish} />

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
