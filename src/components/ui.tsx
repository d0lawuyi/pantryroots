import { useEffect, useId, useRef, type ReactNode } from "react";
import type { Dish } from "@/data/dishes";
import { Icon } from "./Icon";

export function PageHeader({ title, lede, action }: { title: string; lede?: ReactNode; action?: ReactNode }) {
  return (
    <header className="page__header">
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16 }}>
        <h1 className="page__title">{title}</h1>
        {action}
      </div>
      {lede && <p className="page__lede">{lede}</p>}
    </header>
  );
}

export function Section({ title, action, note, children }: { title?: string; action?: ReactNode; note?: ReactNode; children: ReactNode }) {
  return (
    <section className="section">
      {(title || action) && (
        <div className="section__head">
          {title && <h2 className="section__title">{title}</h2>}
          {action}
        </div>
      )}
      {children}
      {note && <p className="section__note">{note}</p>}
    </section>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" className="seg__opt" aria-pressed={value === o.value} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Plate({ tone, large }: { tone: Dish["tone"]; large?: boolean }) {
  return <span className={large ? "plate plate--lg" : "plate"} data-tone={tone} aria-hidden="true" />;
}

export function Meter({ have, total, large }: { have: number; total: number; large?: boolean }) {
  return (
    <span className={large ? "meter meter--lg" : "meter"} role="img" aria-label={`${have} of ${total} ingredients in your pantry`}>
      {Array.from({ length: total }, (_, i) => (
        <span key={i} className={i < have ? "meter__bar meter__bar--have" : "meter__bar"} />
      ))}
    </span>
  );
}

export function Sheet({ title, onClose, children, footer }: { title: ReactNode; onClose: () => void; children: ReactNode; footer?: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      previouslyFocused?.focus?.();
    };
  }, [onClose]);

  return (
    <div className="scrim" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} className="sheet" role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}>
        <div className="sheet__grabber" />
        <div className="sheet__head">
          <h2 id={titleId} className="sheet__title">{title}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            <Icon name="close" size={20} />
          </button>
        </div>
        <div className="sheet__body">{children}</div>
        {footer && <div className="sheet__foot">{footer}</div>}
      </div>
    </div>
  );
}

export function Toast({ message, onDone }: { message: string; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2400);
    return () => clearTimeout(t);
  }, [message, onDone]);
  return (
    <div className="toast" role="status" aria-live="polite">
      <Icon name="check" size={16} strokeWidth={2.25} />
      {message}
    </div>
  );
}

export function formatMinutes(min: number) {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m ? `${h} hr ${m} min` : `${h} hr`;
}
