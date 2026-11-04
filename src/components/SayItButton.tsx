import { useEffect, useRef, useState } from "react";

type Props = {
  /** The dish name as written, e.g. "Thieboudienne". */
  text: string;
  /** English respelling with the stress in caps, e.g. "chay-boo-JEN". */
  say: string;
  /** BCP-47 tag to prefer for a native voice, e.g. "wo-SN". */
  lang?: string;
  /** Show the respelling next to the button as well as in the tooltip. */
  showCaption?: boolean;
  size?: "sm" | "md";
  className?: string;
};

function speechSupported() {
  try {
    return typeof window !== "undefined" && !!window.speechSynthesis && typeof window.SpeechSynthesisUtterance === "function";
  } catch {
    return false;
  }
}

/** "chay-boo-JEN, eh-WEH-doo" -> "chay boo jen, eh weh doo" so an English voice reads it as words. */
export function respellingToSpeech(say: string) {
  return say
    .toLowerCase()
    .replace(/(\w)-(\w)/g, "$1 $2")
    .replace(/-/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function pickVoice(voices: SpeechSynthesisVoice[], lang?: string) {
  if (lang && lang !== "en") {
    const want = lang.toLowerCase();
    const base = want.split("-")[0];
    const exact = voices.find((v) => v.lang.toLowerCase().replace("_", "-") === want);
    if (exact) return { voice: exact, native: true };
    const sameLanguage = voices.find((v) => v.lang.toLowerCase().split(/[-_]/)[0] === base);
    if (sameLanguage) return { voice: sameLanguage, native: true };
  }
  const english =
    voices.find((v) => /^en[-_](gb|us)/i.test(v.lang) && v.localService) ??
    voices.find((v) => /^en/i.test(v.lang)) ??
    null;
  return { voice: english, native: false };
}

/**
 * Small round speaker button that says a dish name out loud.
 * Uses a native voice for the language when the device has one; otherwise an
 * English voice reads the respelling. Renders nothing without speechSynthesis.
 */
export function SayItButton({ text, say, lang, showCaption = false, size = "sm", className }: Props) {
  const [supported, setSupported] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const voicesRef = useRef<SpeechSynthesisVoice[]>([]);
  const utterRef = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    if (!speechSupported()) return;
    setSupported(true);
    const synth = window.speechSynthesis;
    const load = () => {
      try {
        voicesRef.current = synth.getVoices() ?? [];
      } catch {
        voicesRef.current = [];
      }
    };
    load();
    synth.addEventListener?.("voiceschanged", load);
    return () => {
      synth.removeEventListener?.("voiceschanged", load);
      // Only cancel if this button is the one talking.
      if (utterRef.current) {
        try {
          synth.cancel();
        } catch {
          /* ignore */
        }
      }
    };
  }, []);

  if (!supported) return null;

  const speak = () => {
    const synth = window.speechSynthesis;
    try {
      if (speaking) {
        synth.cancel();
        setSpeaking(false);
        return;
      }
      synth.cancel();
      if (!voicesRef.current.length) voicesRef.current = synth.getVoices() ?? [];
      const { voice, native } = pickVoice(voicesRef.current, lang);
      const u = new SpeechSynthesisUtterance(native ? text : respellingToSpeech(say));
      if (voice) u.voice = voice;
      u.lang = voice?.lang ?? (native ? lang ?? "en-GB" : "en-GB");
      u.rate = 0.85;
      const end = () => {
        if (utterRef.current === u) utterRef.current = null;
        setSpeaking(false);
      };
      u.onend = end;
      u.onerror = end;
      utterRef.current = u;
      setSpeaking(true);
      synth.speak(u);
      // Some engines never fire onend; don't leave the button stuck.
      window.setTimeout(() => utterRef.current === u && !synth.speaking && end(), 6000);
    } catch {
      setSpeaking(false);
    }
  };

  const classes = ["say-it", `say-it--${size}`, speaking ? "is-speaking" : "", className ?? ""].filter(Boolean).join(" ");

  return (
    <span className={classes}>
      <button
        type="button"
        className="say-it__btn"
        onClick={speak}
        aria-label={`Hear how to say ${text}`}
        aria-pressed={speaking}
        title={say}
      >
        <SpeakerIcon />
      </button>
      {showCaption && (
        <span className="say-it__caption" aria-hidden="true">
          {say}
        </span>
      )}
    </span>
  );
}

function SpeakerIcon() {
  return (
    <svg
      className="say-it__icon"
      width={18}
      height={18}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M4 9.5h3l4.5-4v13L7 14.5H4z" />
      <path className="say-it__wave say-it__wave--1" d="M15 9.5a3.5 3.5 0 0 1 0 5" />
      <path className="say-it__wave say-it__wave--2" d="M17.5 7a7 7 0 0 1 0 10" />
    </svg>
  );
}
