import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useApp } from "@/lib/app-context";
import { useSpeech } from "@/lib/use-speech";
import { asWritten, fromReply, useFamilyRecipes, type FamilyRecipe, type RecipeReply } from "@/lib/family";
import { Icon } from "@/components/Icon";
import { PlateArt } from "@/components/PlateArt";
import { Sheet, formatMinutes } from "@/components/ui";

const MAX = 6000;
const MIN = 20;

type Step = "write" | "loading" | "preview";

/** Ask the server to shape the text into a recipe. Throws an Error with a plain message on failure. */
async function shapeRecipe(body: { text: string; title?: string; from?: string }, signal: AbortSignal): Promise<RecipeReply> {
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

export function FamilyRecipeSheet({ onClose, onSaved }: { onClose: () => void; onSaved?: (r: FamilyRecipe) => void }) {
  const { registerDish, notify } = useApp();
  const { add } = useFamilyRecipes();
  const ids = { name: useId(), from: useId(), text: useId(), hint: useId() };

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
  const footer =
    step === "preview" && preview ? (
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
      {step === "loading" && <LoadingCard from={from.trim()} />}

      {step === "preview" && preview && <Preview recipe={preview} />}

      {step === "write" && (
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
