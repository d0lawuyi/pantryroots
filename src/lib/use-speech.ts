import { useCallback, useEffect, useRef, useState } from "react";

/** Minimal typing for the browser Web Speech API (Chrome, Edge, Safari). */
type SpeechResultList = { length: number; [i: number]: { isFinal: boolean; 0: { transcript: string } } };
type Recognition = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((e: { resultIndex: number; results: SpeechResultList }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
};

function getCtor(): (new () => Recognition) | null {
  const w = window as unknown as { SpeechRecognition?: new () => Recognition; webkitSpeechRecognition?: new () => Recognition };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/**
 * Push-to-talk speech input. `onInterim` streams words while speaking;
 * `onFinal` fires once with the full sentence when the speaker pauses.
 */
export function useSpeech(onInterim: (text: string) => void, onFinal: (text: string) => void) {
  const supported = typeof window !== "undefined" && !!getCtor();
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const rec = useRef<Recognition | null>(null);
  const finalText = useRef("");
  const handlers = useRef({ onInterim, onFinal });
  handlers.current = { onInterim, onFinal };

  useEffect(() => () => rec.current?.abort(), []);

  const start = useCallback(() => {
    const Ctor = getCtor();
    if (!Ctor) return;
    setError(null);
    finalText.current = "";
    const r = new Ctor();
    r.lang = navigator.language || "en-US";
    r.interimResults = true;
    r.continuous = false;
    r.onresult = (e) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) finalText.current += res[0].transcript;
        else interim += res[0].transcript;
      }
      handlers.current.onInterim((finalText.current + interim).trim());
    };
    r.onerror = (e) => {
      setError(e.error === "not-allowed" ? "Microphone access was blocked." : e.error === "no-speech" ? "Didn't hear anything. Try again." : null);
    };
    r.onend = () => {
      setListening(false);
      const text = finalText.current.trim();
      if (text) handlers.current.onFinal(text);
    };
    rec.current = r;
    try {
      r.start();
      setListening(true);
    } catch {
      setListening(false);
    }
  }, []);

  const stop = useCallback(() => rec.current?.stop(), []);

  return { supported, listening, error, start, stop };
}
