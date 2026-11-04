import { Fragment, useCallback, useEffect, useId, useRef, useState, type ChangeEvent } from "react";
import type { Dish } from "@/data/dishes";
import { useApp } from "@/lib/app-context";
import { useSpeech } from "@/lib/use-speech";
import { resizeImage } from "@/lib/concierge-client";
import {
  SAMPLE_REPLY,
  asWritten,
  demoModeOn,
  fromReply,
  isFamilyRecipe,
  makeThumbnail,
  useFamilyRecipes,
  type FamilyRecipe,
  type RecipeReply,
} from "@/lib/family";
import { Icon } from "@/components/Icon";
import { PlateArt } from "@/components/PlateArt";
import { Segmented, Sheet, formatMinutes } from "@/components/ui";

const MAX = 6000;
const MIN = 20;
/** Keep in step with MAX_IMAGE in api/recipe.ts. */
const MAX_IMAGE = 3_400_000;

type Step = "write" | "loading" | "preview";
type Mode = "scan" | "type";
type ScanStep = "pick" | "reading" | "preview" | "failed";
const MODES: { value: Mode; label: string }[] = [
  { value: "scan", label: "Scan a card" },
  { value: "type", label: "Say or type it" },
];

/** Ask the server to shape the text into a recipe. Throws an Error with a plain message on failure. */
async function shapeRecipe(body: { text?: string; image?: string; title?: string; from?: string }, signal: AbortSignal): Promise<RecipeReply> {
  let res: Response;
  try {
    res = await fetch("/api/recipe", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal });
  } catch (e) {
    if ((e as Error).name === "AbortError") throw e;
    throw new Error("We couldn't reach PantryRoots. Check your connection.");
  }
  let data: (Partial<RecipeReply> & { message?: string }) | null = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  if (!res.ok || !data?.dish) {
    throw new Error(data?.message || "Recipe help isn't available right now.");
  }
  return data as RecipeReply;
}

/** Ask Muse to read a photo of a recipe card. Same errors as shapeRecipe. */
async function readRecipePhoto(body: { image: string; from?: string }, signal: AbortSignal): Promise<RecipeReply> {
  const reply = await shapeRecipe(body, signal);
  if (!reply.transcript) throw new Error("Muse couldn't read that page.");
  return reply;
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function FamilyRecipeSheet({
  onClose,
  onSaved,
  initialMode = "scan",
}: {
  onClose: () => void;
  onSaved?: (r: FamilyRecipe) => void;
  /** Which way in the sheet opens on: scanning a card, or saying/typing it. */
  initialMode?: Mode;
}) {
  const { registerDish, notify } = useApp();
  const { add } = useFamilyRecipes();
  const ids = { name: useId(), from: useId(), text: useId(), hint: useId(), scanFrom: useId(), previewFrom: useId() };

  const [mode, setMode] = useState<Mode>(initialMode);
  const [step, setStep] = useState<Step>("write");
  const [name, setName] = useState("");
  const [from, setFrom] = useState("");
  const [text, setText] = useState("");
  const [interim, setInterim] = useState("");
  const [failure, setFailure] = useState<string | null>(null);
  const [preview, setPreview] = useState<FamilyRecipe | null>(null);
  const abort = useRef<AbortController | null>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => () => abort.current?.abort(), []);

  /* ── Scan a card: photo in, Muse reads it, preview ── */
  const [scanStep, setScanStep] = useState<ScanStep>("pick");
  const [photo, setPhoto] = useState<string | null>(null);
  const [thumb, setThumb] = useState<string | undefined>(undefined);
  const [scanFailure, setScanFailure] = useState<string | null>(null);
  const [scanned, setScanned] = useState<FamilyRecipe | null>(null);
  const cameraInput = useRef<HTMLInputElement>(null);
  const libraryInput = useRef<HTMLInputElement>(null);

  const readPhoto = async (image: string, small: string | undefined) => {
    setScanFailure(null);
    setScanStep("reading");
    abort.current?.abort();
    const ctrl = new AbortController();
    abort.current = ctrl;
    const started = Date.now();
    const timer = setTimeout(() => ctrl.abort(), 45_000);
    const who = from.trim() || undefined;
    try {
      const reply = await readRecipePhoto({ image, from: who }, ctrl.signal);
      setScanned(fromReply(reply, reply.transcript ?? "", who, { sourceImage: small }));
      setScanStep("preview");
    } catch (e) {
      if (ctrl.signal.aborted && abort.current !== ctrl) return; // superseded or closed
      if (demoModeOn()) {
        // Demo mode: show the built-in sample, clearly labelled. It is never presented as a real reading.
        await wait(Math.max(0, 1200 - (Date.now() - started)));
        if (abort.current !== ctrl) return;
        setScanned(fromReply(SAMPLE_REPLY, SAMPLE_REPLY.transcript ?? "", who, { sourceImage: small, sample: true }));
        setScanStep("preview");
        return;
      }
      setScanFailure(ctrl.signal.aborted ? "Muse took too long to read it." : (e as Error).message);
      setScanStep("failed");
    } finally {
      clearTimeout(timer);
    }
  };

  const onPhoto = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // let the same photo be picked again
    if (!file) return;
    setScanned(null);
    setScanFailure(null);
    setScanStep("reading");
    let image: string;
    try {
      image = await resizeImage(file, 1600);
      if (image.length > MAX_IMAGE) image = await resizeImage(file, 1100);
    } catch {
      setPhoto(null);
      setThumb(undefined);
      setScanFailure("We couldn't open that photo. Try a JPEG or PNG, or take a new photo.");
      setScanStep("failed");
      return;
    }
    setPhoto(image);
    const small = await makeThumbnail(image);
    setThumb(small);
    void readPhoto(image, small);
  };

  const typeInstead = (prefill?: { text: string; name: string }) => {
    abort.current?.abort();
    setMode("type");
    setStep("write");
    setFailure(null);
    if (prefill) {
      setText(prefill.text.slice(0, MAX));
      if (!name.trim()) setName(prefill.name);
    }
    requestAnimationFrame(() => textRef.current?.focus());
  };

  const pickAgain = () => {
    abort.current?.abort();
    setScanStep("pick");
    setScanned(null);
    setScanFailure(null);
    setPhoto(null);
    setThumb(undefined);
  };

  /* ── Dictation: keep listening after each sentence until the user taps stop ── */
  const keepListening = useRef(false);
  const emptyRuns = useRef(0);
  const appendSpoken = useCallback((spoken: string) => {
    const words = spoken.trim();
    if (!words) return;
    const sentence = words.charAt(0).toUpperCase() + words.slice(1) + (/[.!?]$/.test(words) ? "" : ".");
    setText((t) => (t.trim() ? `${t.replace(/\s+$/, "")} ${sentence}` : sentence).slice(0, MAX));
  }, []);
  const speech = useSpeech(
    (live) => setInterim(live),
    (final) => {
      emptyRuns.current = 0;
      setInterim("");
      appendSpoken(final);
    },
  );
  const start = speech.start;

  useEffect(() => {
    if (speech.listening || !keepListening.current) return;
    setInterim("");
    // Blocked mic or repeated silence: stop instead of looping.
    if (speech.error === "Microphone access was blocked." || ++emptyRuns.current > 3) {
      keepListening.current = false;
      return;
    }
    const t = setTimeout(() => keepListening.current && start(), 120);
    return () => clearTimeout(t);
  }, [speech.listening, speech.error, start]);

  const toggleMic = () => {
    if (speech.listening || keepListening.current) {
      keepListening.current = false;
      if (speech.listening) speech.stop();
    } else {
      keepListening.current = true;
      emptyRuns.current = 0;
      speech.start();
    }
  };
  const stopMic = () => {
    keepListening.current = false;
    if (speech.listening) speech.stop();
  };

  const recording = speech.listening || keepListening.current;
  const shown = interim ? `${text.replace(/\s+$/, "")}${text.trim() ? " " : ""}${interim}` : text;
  const trimmed = text.trim();
  const tooShort = trimmed.length < MIN;

  /* ── Actions ── */
  const shape = async () => {
    stopMic();
    if (tooShort) return;
    setFailure(null);
    setStep("loading");
    abort.current?.abort();
    const ctrl = new AbortController();
    abort.current = ctrl;
    const timer = setTimeout(() => ctrl.abort(), 40_000);
    try {
      const reply = await shapeRecipe({ text: trimmed, title: name.trim() || undefined, from: from.trim() || undefined }, ctrl.signal);
      setPreview(fromReply(reply, trimmed, from));
      setStep("preview");
    } catch (e) {
      if (ctrl.signal.aborted && abort.current !== ctrl) return; // superseded or closed
      setFailure(ctrl.signal.aborted ? "That took too long." : (e as Error).message);
      setStep("write");
    } finally {
      clearTimeout(timer);
    }
  };

  const save = (r: FamilyRecipe) => {
    add(r);
    registerDish(r);
    notify(`Saved ${r.name} to your kitchen`);
    onSaved?.(r);
    onClose();
  };

  const editText = () => {
    setStep("write");
    requestAnimationFrame(() => textRef.current?.focus());
  };

  /* ── Footer per step ── */
  const scanFooter =
    scanStep === "preview" && scanned ? (
      <div className="btn-row">
        <button type="button" className="btn btn--secondary" onClick={pickAgain}>
          Scan another
        </button>
        <button type="button" className="btn btn--primary" onClick={() => save({ ...scanned, from: from.trim() || undefined })}>
          Save to my kitchen
        </button>
      </div>
    ) : scanStep === "reading" ? (
      <button type="button" className="btn btn--primary btn--block" disabled>
        Muse is reading the card
      </button>
    ) : scanStep === "failed" ? (
      <div className="btn-row">
        <button type="button" className="btn btn--secondary" onClick={() => typeInstead()}>
          Type it instead
        </button>
        {photo ? (
          <button type="button" className="btn btn--primary" onClick={() => readPhoto(photo, thumb)}>
            Try again
          </button>
        ) : (
          <button type="button" className="btn btn--primary" onClick={() => libraryInput.current?.click()}>
            Choose another photo
          </button>
        )}
      </div>
    ) : undefined;

  const footer =
    mode === "scan" ? scanFooter : step === "preview" && preview ? (
      <div className="btn-row">
        <button type="button" className="btn btn--secondary" onClick={editText}>
          Edit text
        </button>
        <button type="button" className="btn btn--primary" onClick={() => save(preview)}>
          Save to my kitchen
        </button>
      </div>
    ) : step === "loading" ? (
      <button type="button" className="btn btn--primary btn--block" disabled>
        Writing it up
      </button>
    ) : failure ? (
      <div className="btn-row">
        <button type="button" className="btn btn--secondary" onClick={() => save(asWritten(trimmed, name, from))} disabled={!trimmed}>
          Save as written
        </button>
        <button type="button" className="btn btn--primary" onClick={shape} disabled={tooShort}>
          Try again
        </button>
      </div>
    ) : (
      <button type="button" className="btn btn--primary btn--block" onClick={shape} disabled={tooShort}>
        Turn into a recipe
      </button>
    );

  return (
    <Sheet title="Family recipe" onClose={onClose} footer={footer}>
      {/* Hidden photo inputs: one opens the camera on phones, one opens the photo library. */}
      <input ref={cameraInput} className="visually-hidden" type="file" accept="image/*" capture="environment" tabIndex={-1} aria-hidden="true" onChange={onPhoto} data-testid="fam-camera" />
      <input ref={libraryInput} className="visually-hidden" type="file" accept="image/*" tabIndex={-1} aria-hidden="true" onChange={onPhoto} data-testid="fam-library" />

      {((mode === "scan" && (scanStep === "pick" || scanStep === "failed")) || (mode === "type" && step === "write")) && (
        <div className="fam-mode">
          <Segmented label="How to add the recipe" options={MODES} value={mode} onChange={(m) => (m === "type" ? typeInstead() : setMode("scan"))} />
        </div>
      )}

      {mode === "scan" && scanStep === "pick" && (
        <div className="fam-write">
          <p className="fam-intro">Snap a handwritten recipe card, a notebook page or a cookbook page. Muse reads it, handwriting too, and keeps the cook's own words.</p>
          <div>
            <label className="label" htmlFor={ids.scanFrom}>Whose recipe</label>
            <input id={ids.scanFrom} className="input" placeholder="Grandma Bisi" value={from} maxLength={60} onChange={(e) => setFrom(e.target.value)} autoComplete="off" />
          </div>
          <div className="fam-pick">
            <CardGlyph />
            <p className="fam-pick__title">Photograph the whole page</p>
            <p className="small muted fam-pick__text">Flat, in good light, with every line in the frame.</p>
            <div className="fam-pick__actions">
              <button type="button" className="btn btn--primary" onClick={() => cameraInput.current?.click()}>
                <Icon name="camera" size={18} />
                Take a photo
              </button>
              <button type="button" className="btn btn--secondary" onClick={() => libraryInput.current?.click()}>
                <PhotosGlyph />
                Choose a photo
              </button>
            </div>
          </div>
          <p className="xs muted">The photo is sent to Muse to read, then only a small copy is kept with the recipe on this device.</p>
        </div>
      )}

      {mode === "scan" && scanStep === "reading" && <ReadingCard photo={photo} from={from.trim()} />}

      {mode === "scan" && scanStep === "failed" && (
        <div className="fam-write">
          {photo && <img className="fam-photo" src={photo} alt="Your photo of the recipe" />}
          <div className="callout fam-failure" role="alert">
            <p className="callout__title">Muse couldn't read this one</p>
            <p className="small" style={{ marginTop: 2 }}>
              {scanFailure} {photo ? "Your photo is still here. Try again, or type the recipe in yourself." : ""}
            </p>
          </div>
          {photo && (
            <button type="button" className="fam-link" onClick={pickAgain}>
              Use a different photo
            </button>
          )}
        </div>
      )}

      {mode === "scan" && scanStep === "preview" && scanned && (
        <ScanPreview
          recipe={scanned}
          from={from}
          fromId={ids.previewFrom}
          onFrom={setFrom}
          onEditText={() => typeInstead({ text: scanned.transcript ?? "", name: scanned.name })}
        />
      )}

      {mode === "type" && step === "loading" && <LoadingCard from={from.trim()} />}

      {mode === "type" && step === "preview" && preview && <Preview recipe={preview} />}

      {mode === "type" && step === "write" && (
        <div className="fam-write">
          <p className="fam-intro">Keep a family recipe. Say it the way they taught you.</p>

          {failure && (
            <div className="callout fam-failure" role="alert">
              <p className="callout__title">We couldn't turn it into a recipe card</p>
              <p className="small" style={{ marginTop: 2 }}>
                {failure} Your words are safe below. Try again, or save it exactly as written and it will open like any other recipe.
              </p>
            </div>
          )}

          <div className="fam-fields">
            <div>
              <label className="label" htmlFor={ids.from}>Whose recipe</label>
              <input id={ids.from} className="input" placeholder="Grandma Bisi" value={from} maxLength={60} onChange={(e) => setFrom(e.target.value)} autoComplete="off" />
            </div>
            <div>
              <label className="label" htmlFor={ids.name}>Dish name <span className="fam-optional">optional</span></label>
              <input id={ids.name} className="input" placeholder="Her ata dindin" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} autoComplete="off" />
            </div>
          </div>

          <div className="fam-text">
            <div className="fam-text__head">
              <label className="label" htmlFor={ids.text} style={{ margin: 0 }}>How they make it</label>
              {speech.supported && (
                <button
                  type="button"
                  className={recording ? "fam-mic fam-mic--on" : "fam-mic"}
                  aria-pressed={recording}
                  onClick={toggleMic}
                >
                  {recording ? <StopGlyph /> : <Icon name="mic" size={18} />}
                  {recording ? "Stop" : "Speak it"}
                </button>
              )}
            </div>
            <textarea
              id={ids.text}
              ref={textRef}
              className="input fam-textarea"
              aria-describedby={ids.hint}
              placeholder={"You blend the tatashe and rodo, then boil it down till the water dries. You fry the pepper until the oil comes up, then…"}
              value={shown}
              readOnly={recording}
              maxLength={MAX}
              onChange={(e) => setText(e.target.value)}
            />
            <p id={ids.hint} className="xs muted fam-hint" aria-live="polite">
              {recording
                ? "Listening. Keep talking; tap stop when you're done."
                : speech.error && speech.error !== "Didn't hear anything. Try again."
                  ? speech.error
                  : trimmed.length > MAX - 500
                    ? `${MAX - trimmed.length} characters left`
                    : "Their words, their order. Amounts are fine to leave out; we won't invent them."}
            </p>
          </div>
        </div>
      )}
    </Sheet>
  );
}

function LoadingCard({ from }: { from: string }) {
  return (
    <div className="fam-loading" role="status" aria-live="polite">
      <span className="visually-hidden">Turning {from ? `${from}'s` : "your"} words into a recipe card</span>
      <div className="fam-skel-head" aria-hidden="true">
        <span className="fam-skel fam-skel--plate" />
        <div className="fam-skel-lines">
          <span className="fam-skel" style={{ width: "70%", height: 20 }} />
          <span className="fam-skel" style={{ width: "40%" }} />
        </div>
      </div>
      <span className="fam-skel fam-skel--quote" aria-hidden="true" />
      <div className="fam-skel-lines" aria-hidden="true">
        {[92, 84, 60].map((w) => (
          <span key={w} className="fam-skel" style={{ width: `${w}%` }} />
        ))}
      </div>
      <p className="small muted fam-loading__note" aria-hidden="true">
        Keeping {from ? `${from}'s` : "their"} words while we write it up
      </p>
    </div>
  );
}

function Preview({ recipe }: { recipe: FamilyRecipe }) {
  return (
    <article className="fam-preview" aria-label={`Preview of ${recipe.name}`}>
      <div className="fam-preview__head">
        <PlateArt dish={recipe} size={72} />
        <div>
          <h3 className="fam-preview__name">{recipe.name}</h3>
          <p className="small muted">
            {recipe.from ? `From ${recipe.from}` : recipe.origin}
            <span className="fam-preview__time">
              <Icon name="clock" size={14} />
              About {formatMinutes(recipe.minutes)}
            </span>
          </p>
        </div>
      </div>

      {recipe.quote && <FamilyQuote quote={recipe.quote} from={recipe.from} />}

      {recipe.summary && <p className="fam-preview__summary">{recipe.summary}</p>}

      {recipe.ingredients.length > 0 && (
        <>
          <h4 className="fam-preview__label">Ingredients</h4>
          <div className="tokens">
            {recipe.ingredients.map((i) => (
              <span key={i} className="token fam-token">{i}</span>
            ))}
          </div>
        </>
      )}

      <h4 className="fam-preview__label">Method</h4>
      <ol className="steps">
        {recipe.steps.map((s, i) => (
          <li key={i}>{s}</li>
        ))}
      </ol>

      <p className="xs muted fam-preview__note">Shaped by AI from your words. Check it reads the way they'd say it; your original text is saved with it.</p>
    </article>
  );
}

function ReadingCard({ photo, from }: { photo: string | null; from: string }) {
  return (
    <div className="fam-loading" role="status" aria-live="polite">
      <span className="visually-hidden">Muse is reading {from ? `${from}'s` : "the"} recipe card</span>
      <div className="fam-reading">
        {photo ? <img className="fam-reading__photo" src={photo} alt="" /> : <span className="fam-reading__photo fam-skel" aria-hidden="true" />}
        <div className="fam-skel-lines" aria-hidden="true">
          <span className="fam-skel" style={{ width: "80%", height: 20 }} />
          <span className="fam-skel" style={{ width: "50%" }} />
          <span className="fam-skel" style={{ width: "92%", marginTop: 12 }} />
          <span className="fam-skel" style={{ width: "70%" }} />
          <span className="fam-skel" style={{ width: "84%" }} />
        </div>
      </div>
      <span className="fam-skel fam-skel--quote" aria-hidden="true" />
      <p className="small muted fam-loading__note" aria-hidden="true">
        Muse is reading {from ? `${from}'s` : "the"} handwriting, word by word
      </p>
    </div>
  );
}

function ScanPreview({
  recipe,
  from,
  fromId,
  onFrom,
  onEditText,
}: {
  recipe: FamilyRecipe;
  from: string;
  fromId: string;
  onFrom: (v: string) => void;
  onEditText: () => void;
}) {
  const who = from.trim();
  return (
    <article className="fam-preview" aria-label={`Preview of ${recipe.name}`}>
      {recipe.sample && <SampleNote />}
      <div className="fam-preview__head">
        <PlateArt dish={recipe} size={72} />
        <div className="fam-preview__title">
          <h3 className="fam-preview__name">{recipe.name}</h3>
          <p className="small muted fam-preview__meta">
            <span>{recipe.origin}</span>
            <span className="fam-preview__time">
              <Icon name="clock" size={14} />
              About {formatMinutes(recipe.minutes)}
            </span>
          </p>
        </div>
        {recipe.sourceImage && <img className="fam-card-thumb" src={recipe.sourceImage} alt="The original recipe card" />}
      </div>

      <div className="fam-from">
        <label className="label" htmlFor={fromId}>From</label>
        <input id={fromId} className="input" placeholder="Grandma Bisi" value={from} maxLength={60} onChange={(e) => onFrom(e.target.value)} autoComplete="off" />
      </div>

      {recipe.quote && <FamilyQuote quote={recipe.quote} from={who || undefined} />}

      {recipe.summary && <p className="fam-preview__summary">{recipe.summary}</p>}

      {recipe.ingredients.length > 0 && (
        <>
          <h4 className="fam-preview__label">Ingredients</h4>
          <div className="tokens">
            {recipe.ingredients.map((i) => (
              <span key={i} className="token fam-token">{i}</span>
            ))}
          </div>
        </>
      )}

      <h4 className="fam-preview__label">Method</h4>
      <ol className="steps">
        {recipe.steps.map((s, i) => (
          <li key={i}><span><Unclear text={s} /></span></li>
        ))}
      </ol>

      {recipe.transcript && (
        <details className="fam-read">
          <summary>What Muse read</summary>
          <Transcript text={recipe.transcript} />
          <button type="button" className="fam-link" onClick={onEditText}>
            Fix it as text
          </button>
        </details>
      )}

      <p className="xs muted fam-preview__note">
        {recipe.sample
          ? "This is a built-in sample, not a reading of your photo. Turn off Demo mode to have Muse read your card."
          : "Read from your photo by Muse. Check it against the card; words it couldn't make out are marked unclear."}
      </p>
    </article>
  );
}

function SampleNote() {
  return (
    <p className="fam-sample" role="note">
      <span className="fam-sample__badge">Sample reading (Demo mode)</span>
      <span className="small muted">Muse didn't read your photo. This is a built-in example.</span>
    </p>
  );
}

/** Highlight "(unclear)" so the cook can spot words Muse couldn't read. */
function Unclear({ text }: { text: string }) {
  const parts = text.split(/(\(unclear\))/i);
  if (parts.length === 1) return <>{text}</>;
  return (
    <>
      {parts.map((p, i) =>
        /^\(unclear\)$/i.test(p) ? (
          <mark key={i} className="fam-unclear">unclear</mark>
        ) : (
          <Fragment key={i}>{p}</Fragment>
        ),
      )}
    </>
  );
}

function Transcript({ text }: { text: string }) {
  return (
    <div className="fam-transcript">
      {text.split("\n").map((line, i) => (line.trim() ? <p key={i}><Unclear text={line} /></p> : <br key={i} />))}
    </div>
  );
}

/**
 * The original card behind a scanned family recipe: a small photo (tap to enlarge) and
 * what Muse read. Renders nothing for recipes that weren't scanned. For the dish sheet.
 */
export function FamilySource({ recipe }: { recipe: Dish | FamilyRecipe }) {
  const [big, setBig] = useState(false);
  if (!isFamilyRecipe(recipe) || (!recipe.sourceImage && !recipe.transcript)) return null;
  return (
    <div className="fam-source">
      <div className="fam-source__row">
        {recipe.sourceImage && (
          <button type="button" className="fam-source__thumb" aria-expanded={big} aria-label={big ? "Show the original card smaller" : "Show the original card larger"} onClick={() => setBig((b) => !b)}>
            <img src={recipe.sourceImage} alt="" />
          </button>
        )}
        <div className="fam-source__body">
          <p className="small fam-source__title">{recipe.sample ? "Sample reading (Demo mode)" : "Scanned from the original card"}</p>
          <p className="xs muted">{recipe.sample ? "A built-in example, not a real reading." : "Read by Muse. Tap the photo to see the page."}</p>
        </div>
      </div>
      {big && recipe.sourceImage && <img className="fam-source__big" src={recipe.sourceImage} alt="The original recipe card" />}
      {recipe.transcript && (
        <details className="fam-read fam-read--compact">
          <summary>What Muse read</summary>
          <Transcript text={recipe.transcript} />
        </details>
      )}
    </div>
  );
}

/** The cook's own words, styled as a pull-quote. Exported so the dish sheet can reuse it. */
export function FamilyQuote({ quote, from }: { quote: string; from?: string }) {
  return (
    <figure className="fam-quote">
      <blockquote>
        <p>{quote}</p>
      </blockquote>
      {from && <figcaption>{from}</figcaption>}
    </figure>
  );
}

function StopGlyph() {
  return (
    <svg width={14} height={14} viewBox="0 0 24 24" aria-hidden="true">
      <rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" />
    </svg>
  );
}

function CardGlyph() {
  return (
    <svg className="fam-pick__glyph" width={32} height={32} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M7 9.5c1.2-.8 2.2.8 3.4 0s2.2.8 3.4 0" />
      <path d="M7 13h10" />
      <path d="M7 16h6" />
    </svg>
  );
}

function PhotosGlyph() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <circle cx="9" cy="9.5" r="1.5" />
      <path d="m21 15-4.5-4.5L7 20" />
    </svg>
  );
}
