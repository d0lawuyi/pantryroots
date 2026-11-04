import { useCallback, useEffect, useState } from "react";

/** An ingredient the photo scan judged should be used soon (ripe, fresh, perishable). */
export type UseSoonItem = { name: string; note?: string; since: number };

const KEY = "pantryroots:v2:use-soon";
const EVENT = "pantryroots:use-soon";
/** Forget flags after a week — the scan's judgement goes stale. */
const MAX_AGE = 7 * 24 * 3600 * 1000;

function read(): UseSoonItem[] {
  try {
    const raw = localStorage.getItem(KEY);
    const list = raw ? (JSON.parse(raw) as UseSoonItem[]) : [];
    return Array.isArray(list) ? list.filter((i) => i && typeof i.name === "string" && Date.now() - (i.since || 0) < MAX_AGE) : [];
  } catch {
    return [];
  }
}

function write(list: UseSoonItem[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    /* storage unavailable: this session still works */
  }
  window.dispatchEvent(new Event(EVENT));
}

/** Shared "use it up first" list; every component using it stays in sync. */
export function useUseSoon() {
  const [items, setItems] = useState<UseSoonItem[]>(read);

  useEffect(() => {
    const sync = () => setItems(read());
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const add = useCallback((list: { name: string; note?: string }[]) => {
    if (!list.length) return;
    const current = read();
    const byName = new Map(current.map((i) => [i.name.toLowerCase(), i]));
    for (const i of list) byName.set(i.name.toLowerCase(), { name: i.name, note: i.note, since: Date.now() });
    write([...byName.values()]);
  }, []);

  const remove = useCallback((name: string) => {
    write(read().filter((i) => i.name.toLowerCase() !== name.toLowerCase()));
  }, []);

  return { items, add, remove };
}
