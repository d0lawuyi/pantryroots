import { useEffect, useState } from "react";
import { useApp } from "@/lib/app-context";
import { useFamilyRecipes, type FamilyRecipe } from "@/lib/family";
import { FamilyRecipeSheet } from "@/components/FamilyRecipeSheet";
import { Icon } from "@/components/Icon";
import { PlateArt } from "@/components/PlateArt";
import { Section } from "@/components/ui";

/** "From your family" on the Cook screen: saved family recipes plus a way to add one. */
export function FamilyRecipesSection() {
  const { openDish, registerDish, notify } = useApp();
  const { list, remove } = useFamilyRecipes();
  const [adding, setAdding] = useState(false);

  // Make every saved recipe openable in the dish sheet and cook mode.
  useEffect(() => {
    list.forEach(registerDish);
  }, [list, registerDish]);

  const del = (r: FamilyRecipe) => {
    if (!window.confirm(`Remove ${r.name} from your kitchen? This can't be undone.`)) return;
    remove(r.id);
    notify(`Removed ${r.name}`);
  };

  const addButton = (
    <button type="button" className="btn btn--tinted fam-add" onClick={() => setAdding(true)}>
      <Icon name="plus" size={18} />
      Add a recipe
    </button>
  );

  return (
    <>
      <Section title="From your family" action={list.length > 0 ? addButton : undefined}>
        {list.length === 0 ? (
          <div className="fam-empty">
            <QuoteGlyph />
            <p className="fam-empty__title">The recipes you grew up on</p>
            <p className="small muted fam-empty__text">
              Type or say how your mum, dad or grandma makes it, in their words. We'll turn it into a recipe card you can cook from, and keep their voice in it.
            </p>
            <button type="button" className="btn btn--primary" onClick={() => setAdding(true)}>
              <Icon name="plus" size={18} />
              Add a family recipe
            </button>
          </div>
        ) : (
          <ul className="group">
            {list.map((r) => (
              <li key={r.id} className="row fam-row">
                <button type="button" className="fam-row__open" onClick={() => openDish(r.id)}>
                  <PlateArt dish={r} size={40} />
                  <span className="row__body">
                    <span className="row__title fam-row__name">{r.name}</span>
                    <span className="row__meta fam-row__meta">{r.from ? `From ${r.from}` : r.origin || "Family recipe"}</span>
                  </span>
                  <span className="row__trail"><Icon name="chevron" size={18} /></span>
                </button>
                <button type="button" className="icon-btn fam-row__del" aria-label={`Remove ${r.name}`} onClick={() => del(r)}>
                  <Icon name="trash" size={18} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Section>
      {adding && <FamilyRecipeSheet onClose={() => setAdding(false)} />}
    </>
  );
}

function QuoteGlyph() {
  return (
    <svg className="fam-empty__glyph" width={28} height={28} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M10 7H6.5A1.5 1.5 0 0 0 5 8.5V12h5V7Z" />
      <path d="M10 12c0 3-1.5 4.5-4 5" />
      <path d="M19 7h-3.5A1.5 1.5 0 0 0 14 8.5V12h5V7Z" />
      <path d="M19 12c0 3-1.5 4.5-4 5" />
    </svg>
  );
}
