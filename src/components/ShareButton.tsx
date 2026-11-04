import { useCallback, useEffect, useRef, useState } from "react";
import type { Dish } from "@/data/dishes";
import { useApp } from "@/lib/app-context";
import { matchDish } from "@/lib/pantry";
import { Sheet } from "@/components/ui";
import { battleCard, dishCard, shareOrDownload, type BattlePick, type ShareResult } from "@/lib/share-card";

type Common = {
  /** Show the image in a sheet before sharing. Defaults to true on desktop widths (≥ 720px). */
  preview?: boolean;
  /** Button label; defaults to "Share". */
  label?: string;
  /** Smaller button for dense places like the dish sheet header. */
  small?: boolean;
  className?: string;
};

type Props =
  | (Common & { kind: "dish"; dish: Dish; cooked?: boolean })
  | (Common & { kind: "battle"; battleTitle: string; picks: BattlePick[]; tasteLine?: string });

type Made = { blob: Blob; filename: string; text: string; key: string };

function ShareIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      <path d="M12 3.5v11.5" />
      <path d="m7.5 8 4.5-4.5L16.5 8" />
      <path d="M8.5 11.5H6.5A1.5 1.5 0 0 0 5 13v6a1.5 1.5 0 0 0 1.5 1.5h11A1.5 1.5 0 0 0 19 19v-6a1.5 1.5 0 0 0-1.5-1.5h-2" />
    </svg>
  );
}

function isWide() {
  try {
    return window.matchMedia("(min-width: 720px)").matches;
  } catch {
    return false;
  }
}

function slug(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "card";
}

export function ShareButton(props: Props) {
  const { notify, pantry } = useApp();
  const [busy, setBusy] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const made = useRef<Made | null>(null);
  const pending = useRef<Promise<Made> | null>(null);

  // A stable key for what the card would show, so a cached image is reused only when nothing changed.
  const key =
    props.kind === "dish"
      ? ["dish", props.dish.id, props.dish.name, props.cooked ? 1 : 0, matchDish(props.dish, pantry).have.length].join("|")
      : ["battle", props.battleTitle, props.picks.map((p) => p.dish).join(","), props.tasteLine ?? ""].join("|");

  const make = useCallback((): Promise<Made> => {
    if (made.current?.key === key) return Promise.resolve(made.current);
    if (pending.current) return pending.current;
    const run = (async () => {
      let blob: Blob;
      let filename: string;
      let text: string;
      if (props.kind === "dish") {
        const m = matchDish(props.dish, pantry);
        blob = await dishCard(props.dish, { cooked: props.cooked, match: { have: m.have.length, total: props.dish.ingredients.length } });
        filename = `pantryroots-${slug(props.dish.name)}.png`;
        text = props.cooked ? `I cooked ${props.dish.name} tonight. Found it on PantryRoots.` : `Tonight's pick: ${props.dish.name}. Found it on PantryRoots.`;
      } else {
        blob = await battleCard(props.battleTitle, props.picks, props.tasteLine);
        filename = `pantryroots-${slug(props.battleTitle)}-ranking.png`;
        const top = props.picks[0]?.dish;
        text = top ? `My ${props.battleTitle.toLowerCase()} ranking, with ${top} on top. Made on PantryRoots.` : `My ${props.battleTitle.toLowerCase()} ranking on PantryRoots.`;
      }
      const result = { blob, filename, text, key };
      made.current = result;
      return result;
    })();
    pending.current = run;
    run.finally(() => {
      if (pending.current === run) pending.current = null;
    }).catch(() => {});
    return run;
    // props is read through `key`, which captures everything the card shows.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  const report = (r: ShareResult) => {
    if (r === "shared") notify("Shared");
    else if (r === "downloaded") notify("Card saved");
    else if (r === "failed") notify("Couldn't share the card. Try again.");
  };

  const share = async (m: Made) => report(await shareOrDownload(m.blob, m.filename, m.text));

  const onClick = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const m = await make();
      if (props.preview ?? isWide()) {
        setPreviewUrl(URL.createObjectURL(m.blob));
      } else {
        await share(m);
      }
    } catch {
      notify("Couldn't make the card. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const closePreview = useCallback(() => setPreviewUrl(null), []);
  const canShareFiles = (() => {
    try {
      return !!made.current && !!navigator.canShare?.({ files: [new File([made.current.blob], made.current.filename, { type: "image/png" })] });
    } catch {
      return false;
    }
  })();

  const label = props.label ?? "Share";
  const what = props.kind === "dish" ? props.dish.name : `${props.battleTitle} ranking`;

  return (
    <>
      <button
        type="button"
        className={["btn btn--secondary share-btn", props.small ? "btn--sm" : "", props.className ?? ""].filter(Boolean).join(" ")}
        onPointerDown={() => void make().catch(() => {})}
        onClick={onClick}
        aria-busy={busy || undefined}
        aria-disabled={busy || undefined}
        aria-label={busy ? undefined : label === "Share" ? `Share ${what} as an image` : undefined}
      >
        <ShareIcon size={props.small ? 16 : 18} />
        <span>{busy ? "Making card…" : label}</span>
      </button>

      {previewUrl && made.current && (
        <Sheet
          title={props.kind === "dish" ? (props.cooked ? "Share what you cooked" : "Share this dish") : "Share your ranking"}
          onClose={closePreview}
          footer={
            <div className="btn-row">
              {canShareFiles ? (
                <button
                  type="button"
                  className="btn btn--primary"
                  onClick={async () => {
                    const m = made.current;
                    if (!m) return;
                    const r = await shareOrDownload(m.blob, m.filename, m.text);
                    report(r);
                    if (r !== "cancelled" && r !== "failed") closePreview();
                  }}
                >
                  <ShareIcon />
                  Share image
                </button>
              ) : (
                <a
                  className="btn btn--primary"
                  href={previewUrl}
                  download={made.current.filename}
                  onClick={() => {
                    notify("Card saved");
                    // Let the download start before the sheet (and its object URL) goes away.
                    setTimeout(closePreview, 1000);
                  }}
                >
                  Save image
                </a>
              )}
            </div>
          }
        >
          <figure className="share-preview">
            <img
              className="share-preview__img"
              src={previewUrl}
              width={1080}
              height={1350}
              alt={props.kind === "dish" ? `Share card for ${props.dish.name}` : `Share card: my ${props.battleTitle.toLowerCase()} ranking`}
            />
            <figcaption className="share-preview__note">Sized 4:5 for Instagram, WhatsApp status and most feeds</figcaption>
          </figure>
        </Sheet>
      )}
    </>
  );
}
