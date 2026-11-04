import { useRef, useState, type ReactNode } from "react";
import { resizeImage } from "@/lib/concierge-client";
import { extractFrames } from "@/lib/video-frames";
import { TARGET_IMAGE_CHARS, type ScanMode } from "@/lib/concierge-types";
import { useApp } from "@/lib/app-context";
import { Icon } from "./Icon";

/** Frames per sweep. Five keeps the live model fast and well inside request limits. */
const SWEEP_FRAMES = 5;

const PROMPTS: Record<ScanMode, string> = {
  photo: "Scan my kitchen. What do you see, and what can I cook with it?",
  sweep: "Here's a quick video sweep of my fridge. What do I have, and what can I cook?",
  receipt: "Here's my grocery receipt. What did I buy, and what can I cook with it?",
};

/**
 * The core PantryRoots moment: show us your food and the concierge reads it, fills the
 * pantry and shows what you can cook. Three ways in: one photo, a short video sweep of
 * the fridge (sent as several frames), or a grocery receipt.
 */
export function ScanKitchen({ variant = "card" }: { variant?: "card" | "button" }) {
  const { ask, notify } = useApp();
  const photoInput = useRef<HTMLInputElement>(null);
  const videoInput = useRef<HTMLInputElement>(null);
  const receiptInput = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<string | null>(null);
  const busy = status !== null;

  async function onPhoto(file: File | undefined, mode: "photo" | "receipt") {
    if (!file) return;
    setStatus(mode === "receipt" ? "Preparing receipt…" : "Preparing photo…");
    try {
      // Receipts are tall and full of small print, so keep a little more detail.
      const image = mode === "receipt" ? await resizeImage(file, 2000, 0.8) : await resizeImage(file);
      ask(PROMPTS[mode], [image], mode);
    } catch {
      notify(mode === "receipt" ? "Couldn't read that receipt photo. Try a JPEG or PNG." : "Couldn't read that photo. Try a JPEG or PNG.");
    } finally {
      setStatus(null);
    }
  }

  async function onVideo(file: File | undefined) {
    if (!file) return;
    setStatus(`Reading ${SWEEP_FRAMES} frames…`);
    try {
      const frames = await extractFrames(file, {
        count: SWEEP_FRAMES,
        maxSide: 1024,
        quality: 0.72,
        maxTotalChars: TARGET_IMAGE_CHARS,
        onProgress: (done, total) => setStatus(done >= total ? `Read ${total} frames` : `Reading frame ${done + 1} of ${total}…`),
      });
      ask(PROMPTS.sweep, frames, "sweep");
    } catch {
      notify("Couldn't read that video. Try a 3 to 8 second clip, or take a photo instead.");
    } finally {
      setStatus(null);
    }
  }

  const inputs = (
    <>
      <input
        ref={photoInput}
        type="file"
        accept="image/*"
        capture="environment"
        className="visually-hidden"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => {
          void onPhoto(e.target.files?.[0], "photo");
          e.target.value = "";
        }}
      />
      <input
        ref={videoInput}
        type="file"
        accept="video/*"
        capture="environment"
        className="visually-hidden"
        tabIndex={-1}
        aria-hidden="true"
        data-scan="sweep"
        onChange={(e) => {
          void onVideo(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <input
        ref={receiptInput}
        type="file"
        accept="image/*"
        capture="environment"
        className="visually-hidden"
        tabIndex={-1}
        aria-hidden="true"
        data-scan="receipt"
        onChange={(e) => {
          void onPhoto(e.target.files?.[0], "receipt");
          e.target.value = "";
        }}
      />
    </>
  );

  const statusLine = (
    <p className="scan-modes__status" role="status" aria-live="polite">
      {status ?? ""}
    </p>
  );

  if (variant === "button") {
    return (
      <div className="scan-modes scan-modes--compact">
        <button type="button" className="btn btn--primary btn--block" onClick={() => photoInput.current?.click()} disabled={busy}>
          <Icon name="camera" size={18} />
          Scan with a photo
        </button>
        <div className="scan-modes__row">
          <button type="button" className="btn btn--secondary" onClick={() => videoInput.current?.click()} disabled={busy}>
            <VideoIcon size={18} />
            Video sweep
          </button>
          <button type="button" className="btn btn--secondary" onClick={() => receiptInput.current?.click()} disabled={busy}>
            <ReceiptIcon size={18} />
            Receipt
          </button>
        </div>
        {statusLine}
        {inputs}
      </div>
    );
  }

  return (
    <section className="scan-modes" aria-label="Scan your kitchen" aria-busy={busy}>
      <button type="button" className="scan-cta scan-modes__main" onClick={() => photoInput.current?.click()} disabled={busy}>
        <span className="scan-cta__icon"><Icon name="camera" size={24} /></span>
        <span className="scan-cta__body">
          <span className="scan-cta__title">Scan your kitchen</span>
          <span className="scan-cta__sub">Take a photo of a shelf or the fridge. We'll find what you have and what you can cook.</span>
        </span>
        <Icon name="chevron" size={20} />
      </button>
      <div className="scan-modes__alts">
        <button type="button" className="scan-alt" onClick={() => videoInput.current?.click()} disabled={busy}>
          <span className="scan-alt__icon"><VideoIcon size={20} /></span>
          <span className="scan-alt__body">
            <span className="scan-alt__title">Video sweep</span>
            <span className="scan-alt__sub">Pan the fridge</span>
          </span>
        </button>
        <button type="button" className="scan-alt" onClick={() => receiptInput.current?.click()} disabled={busy}>
          <span className="scan-alt__icon"><ReceiptIcon size={20} /></span>
          <span className="scan-alt__body">
            <span className="scan-alt__title">Receipt</span>
            <span className="scan-alt__sub">What you bought</span>
          </span>
        </button>
      </div>
      {statusLine}
      {inputs}
    </section>
  );
}

function Svg({ size, children }: { size: number; children: ReactNode }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}

/** Video camera. */
function VideoIcon({ size = 20 }: { size?: number }) {
  return (
    <Svg size={size}>
      <rect x="3" y="6.5" width="12.5" height="11" rx="2.5" />
      <path d="m15.5 10.5 5-3v9l-5-3z" />
    </Svg>
  );
}

/** Till receipt with a zigzag tear at the bottom. */
function ReceiptIcon({ size = 20 }: { size?: number }) {
  return (
    <Svg size={size}>
      <path d="M6 3.5h12v17l-2-1.5-2 1.5-2-1.5-2 1.5-2-1.5-2 1.5z" />
      <path d="M9 8h6M9 11.5h6M9 15h3.5" />
    </Svg>
  );
}
