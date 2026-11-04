import { useRef, useState } from "react";
import { resizeImage } from "@/lib/concierge-client";
import { useApp } from "@/lib/app-context";
import { Icon } from "./Icon";

/**
 * The core PantryRoots moment: photograph a shelf or fridge, and the concierge
 * reads it, fills the pantry and shows what you can cook from it.
 */
export function ScanKitchen({ variant = "card" }: { variant?: "card" | "button" }) {
  const { ask, notify } = useApp();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function onFile(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    try {
      const image = await resizeImage(file);
      ask("Scan my kitchen. What do you see, and what can I cook with it?", image);
    } catch {
      notify("Couldn't read that photo. Try a JPEG or PNG.");
    } finally {
      setBusy(false);
    }
  }

  const picker = (
    <input
      ref={input}
      type="file"
      accept="image/*"
      capture="environment"
      className="visually-hidden"
      tabIndex={-1}
      aria-hidden="true"
      onChange={(e) => {
        void onFile(e.target.files?.[0]);
        e.target.value = "";
      }}
    />
  );

  if (variant === "button") {
    return (
      <>
        <button type="button" className="btn btn--primary btn--block" onClick={() => input.current?.click()} disabled={busy}>
          <Icon name="camera" size={18} />
          {busy ? "Preparing photo…" : "Scan with a photo"}
        </button>
        {picker}
      </>
    );
  }

  return (
    <>
      <button type="button" className="scan-cta" onClick={() => input.current?.click()} disabled={busy}>
        <span className="scan-cta__icon"><Icon name="camera" size={24} /></span>
        <span className="scan-cta__body">
          <span className="scan-cta__title">{busy ? "Preparing photo…" : "Scan your kitchen"}</span>
          <span className="scan-cta__sub">Photograph a shelf or the fridge. We'll find what you have and what you can cook.</span>
        </span>
        <Icon name="chevron" size={20} />
      </button>
      {picker}
    </>
  );
}
