import { useApp } from "@/lib/app-context";

export function SamplePantryNotice() {
  const { pantry, usingSamplePantry, startOwnPantry, trySamplePantry } = useApp();
  if (pantry.length && !usingSamplePantry) return null;

  return (
    <section className="callout" aria-label="Sample pantry" style={{ marginBottom: 24 }}>
      <p className="callout__title">{usingSamplePantry ? "This matches our sample pantry" : "Start with your kitchen"}</p>
      <p className="small" style={{ marginTop: 4 }}>
        {usingSamplePantry
          ? "These 11 ingredients were used in the demo. Check that you actually have them, or start with an empty pantry."
          : "Add ingredients you actually have, or explore with 11 clearly labeled sample items."}
      </p>
      <button type="button" className="btn btn--tinted btn--sm" style={{ marginTop: 12 }} onClick={usingSamplePantry ? startOwnPantry : trySamplePantry}>
        {usingSamplePantry ? "Start my own pantry" : "Try sample pantry"}
      </button>
    </section>
  );
}
