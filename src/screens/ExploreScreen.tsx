import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { DISHES, PEOPLES, peopleById, type Region } from "@/data/dishes";
import { matchDish, type Match } from "@/lib/pantry";
import { useApp } from "@/lib/app-context";
import { usePersistentState } from "@/lib/storage";
import { DishRow } from "@/components/DishRow";
import { Icon } from "@/components/Icon";
import { PageHeader, Section, Segmented } from "@/components/ui";

/* ───────────────── Types & preferences ───────────────── */

type RegionFilter = "all" | Region;
type SortKey = "best" | "quickest" | "az";
type ViewMode = "people" | "all";
type FilterKey = "ready" | "near" | "quick" | "noAhead";

type Prefs = {
  region: RegionFilter;
  sort: SortKey;
  view: ViewMode;
  filters: Record<FilterKey, boolean>;
};

const NO_FILTERS: Record<FilterKey, boolean> = { ready: false, near: false, quick: false, noAhead: false };
const DEFAULT_PREFS: Prefs = { region: "all", sort: "best", view: "people", filters: NO_FILTERS };

/** Dishes at or below this many minutes count as quick. */
const QUICK_MINUTES = 45;

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "ready", label: "Ready now" },
  { key: "near", label: "1–2 away" },
  { key: "quick", label: "Under 45 min" },
  { key: "noAhead", label: "No overnight prep" },
];

const SORTS: { value: SortKey; label: string }[] = [
  { value: "best", label: "Best match" },
  { value: "quickest", label: "Quickest" },
  { value: "az", label: "A–Z" },
];

type Criteria = { query: string; region: RegionFilter; filters: Record<FilterKey, boolean> };

/** A matched dish plus which ingredient (if any) explains a search hit. */
type Hit = Match & { viaIngredient?: string };

/* ───────────────── Pure helpers ───────────────── */

function matchesQuery(m: Match, q: string): { ok: boolean; viaIngredient?: string } {
  if (!q) return { ok: true };
  const people = peopleById[m.dish.peopleId];
  if (m.dish.name.toLowerCase().includes(q)) return { ok: true };
  if (people && (people.name.toLowerCase().includes(q) || people.area.toLowerCase().includes(q))) return { ok: true };
  const ing = m.dish.ingredients.find((i) => i.toLowerCase().includes(q));
  return ing ? { ok: true, viaIngredient: ing } : { ok: false };
}

function passes(m: Match, c: Criteria): Hit | null {
  const people = peopleById[m.dish.peopleId];
  if (c.region !== "all" && people?.region !== c.region) return null;

  // "Ready now" and "1–2 away" are both about the pantry, so together they widen rather than contradict.
  const { ready, near, quick, noAhead } = c.filters;
  const missing = m.need.length;
  if (ready || near) {
    const ok = (ready && missing === 0) || (near && missing >= 1 && missing <= 2);
    if (!ok) return null;
  }
  if (quick && m.dish.minutes > QUICK_MINUTES) return null;
  if (noAhead && m.dish.ahead) return null;

  const q = matchesQuery(m, c.query);
  return q.ok ? { ...m, viaIngredient: q.viaIngredient } : null;
}

function filterAll(all: Match[], c: Criteria): Hit[] {
  const out: Hit[] = [];
  for (const m of all) {
    const hit = passes(m, c);
    if (hit) out.push(hit);
  }
  return out;
}

function compare(sort: SortKey) {
  return (a: Match, b: Match) => {
    if (sort === "quickest") return a.dish.minutes - b.dish.minutes || a.dish.name.localeCompare(b.dish.name);
    if (sort === "az") return a.dish.name.localeCompare(b.dish.name);
    return a.need.length - b.need.length || b.ratio - a.ratio || a.dish.minutes - b.dish.minutes;
  };
}

const plural = (n: number) => `${n} ${n === 1 ? "dish" : "dishes"}`;

/** Headline says the main reason; the detail line lists the other active narrowing. */
function describeEmpty(c: Criteria, pantryEmpty: boolean): { title: string; detail: string } {
  const f = c.filters;
  const others: string[] = [];
  if (c.query) others.push(`matching "${c.query}"`);
  if (c.region !== "all") others.push(`from ${c.region}`);
  if (f.quick) others.push(`${QUICK_MINUTES} min or less`);
  if (f.noAhead) others.push("no overnight prep");
  const detail = others.length ? `Also filtered to dishes ${others.join(", ")}.` : "";

  if (f.ready && pantryEmpty) return { title: "Your pantry is empty, so nothing is ready yet", detail };
  if (f.ready && f.near) return { title: "No dishes are within 2 ingredients of your pantry", detail };
  if (f.ready) return { title: "No dishes are ready now with your pantry", detail };
  if (f.near) return { title: "No dishes are 1 or 2 ingredients away", detail };
  if (c.query && others.length === 1) return { title: `No dishes match "${c.query}"`, detail: "" };
  if (f.quick || f.noAhead || c.region !== "all") return { title: "No dishes fit all these filters", detail };
  return { title: "No dishes here yet", detail };
}

/* ───────────────── Search highlight ───────────────── */

/** Split text around case-insensitive occurrences of q, wrapping hits in <mark>. */
function highlight(text: string, q: string): ReactNode {
  if (!q) return text;
  const lower = text.toLowerCase();
  const out: ReactNode[] = [];
  let i = 0;
  let at = lower.indexOf(q);
  while (at !== -1) {
    if (at > i) out.push(text.slice(i, at));
    out.push(<mark key={at} className="explore-mark">{text.slice(at, at + q.length)}</mark>);
    i = at + q.length;
    at = lower.indexOf(q, i);
  }
  if (i < text.length) out.push(text.slice(i));
  return out;
}

const HIGHLIGHT_NAME = "explore-q";

/**
 * Highlights the query inside dish titles rendered by DishRow (which we don't own),
 * using the CSS Custom Highlight API so no markup changes are needed. Browsers
 * without the API simply show no highlight.
 */
function useTitleHighlight(root: React.RefObject<HTMLElement | null>, q: string, deps: unknown[]) {
  useEffect(() => {
    const css = (globalThis as { CSS?: { highlights?: Map<string, unknown> } }).CSS;
    const HighlightCtor = (globalThis as { Highlight?: new (...r: Range[]) => unknown }).Highlight;
    if (!css?.highlights || !HighlightCtor) return;
    css.highlights.delete(HIGHLIGHT_NAME);
    const el = root.current;
    if (!q || !el) return;

    const ranges: Range[] = [];
    el.querySelectorAll(".row__title").forEach((title) => {
      const walker = document.createTreeWalker(title, NodeFilter.SHOW_TEXT);
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        const text = (n.textContent ?? "").toLowerCase();
        for (let at = text.indexOf(q); at !== -1; at = text.indexOf(q, at + q.length)) {
          const r = document.createRange();
          r.setStart(n, at);
          r.setEnd(n, at + q.length);
          ranges.push(r);
        }
      }
    });
    if (ranges.length) css.highlights.set(HIGHLIGHT_NAME, new HighlightCtor(...ranges));
    return () => {
      css.highlights?.delete(HIGHLIGHT_NAME);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, ...deps]);
}

/* ───────────────── Small icons (local, same style as Icon.tsx) ───────────────── */

function CheckSmall() {
  return (
    <svg className="explore-chip__check" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m5 12.5 4.5 4.5L19 7" />
    </svg>
  );
}

function SortIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M7 4v16M3.5 16.5 7 20l3.5-3.5M17 20V4M13.5 7.5 17 4l3.5 3.5" />
    </svg>
  );
}

/* ───────────────── Rows ───────────────── */

function HitRows({ hits, q, showPeople }: { hits: Hit[]; q: string; showPeople: boolean }) {
  return (
    <div className="group explore-group">
      {hits.map((h) => (
        <ExploreRow key={h.dish.id} hit={h} q={q} showPeople={showPeople} />
      ))}
    </div>
  );
}

function ExploreRow({ hit, q, showPeople }: { hit: Hit; q: string; showPeople: boolean }) {
  return (
    <>
      <DishRow match={hit} showPeople={showPeople} />
      {hit.viaIngredient && (
        <p className="explore-why">
          Uses {highlight(hit.viaIngredient, q)}
        </p>
      )}
    </>
  );
}

/* ───────────────── Screen ───────────────── */

export function ExploreScreen() {
  const { pantry, go } = useApp();
  const [query, setQuery] = useState("");
  const [prefs, setPrefs] = usePersistentState<Prefs>("explore-prefs", DEFAULT_PREFS);
  const listRef = useRef<HTMLDivElement>(null);

  // Merge with defaults so an older saved shape never breaks the screen.
  const region = prefs.region ?? "all";
  const sort = prefs.sort ?? "best";
  const view = prefs.view ?? "people";
  const filters = { ...NO_FILTERS, ...prefs.filters };

  const update = (patch: Partial<Prefs>) => setPrefs((p) => ({ ...DEFAULT_PREFS, ...p, ...patch }));
  const setFilters = (patch: Partial<Record<FilterKey, boolean>>) => update({ filters: { ...filters, ...patch } });
  const toggle = (key: FilterKey) => setFilters({ [key]: !filters[key] });

  const q = query.trim().toLowerCase();
  const searching = q.length > 0;
  const criteria: Criteria = { query: q, region, filters };

  const all = useMemo(() => DISHES.map((d) => matchDish(d, pantry)), [pantry]);
  const hits = useMemo(
    () => filterAll(all, criteria).sort(compare(sort)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [all, q, region, sort, filters.ready, filters.near, filters.quick, filters.noAhead],
  );

  const groups = useMemo(() => {
    const byPeople = new Map<string, Hit[]>();
    for (const h of hits) {
      const list = byPeople.get(h.dish.peopleId) ?? [];
      list.push(h);
      byPeople.set(h.dish.peopleId, list);
    }
    return PEOPLES.filter((p) => byPeople.has(p.id)).map((people) => ({ people, hits: byPeople.get(people.id)! }));
  }, [hits]);

  const anyFilter = Object.values(filters).some(Boolean) || region !== "all";
  const flat = searching || view === "all";

  useTitleHighlight(listRef, q, [hits, flat]);

  const clearFilters = () => update({ filters: NO_FILTERS, region: "all" });

  /* Ways out of an empty result, each only offered if it actually finds something. */
  const escapes = useMemo(() => {
    if (hits.length > 0) return [];
    const count = (c: Partial<Criteria>) => filterAll(all, { ...criteria, ...c, filters: { ...filters, ...c.filters } }).length;
    const out: { label: string; run: () => void; n: number }[] = [];
    const add = (label: string, c: Partial<Criteria>, run: () => void) => {
      const n = count(c);
      if (n > 0 && !out.some((o) => o.label === label)) out.push({ label, run, n });
    };

    if (filters.ready && !filters.near) add("Show 1–2 away instead", { filters: { ...filters, ready: false, near: true } }, () => setFilters({ ready: false, near: true }));
    if (filters.near && !filters.ready) add("Include dishes ready now", { filters: { ...filters, ready: true } }, () => setFilters({ ready: true }));
    if (filters.ready || filters.near) add("Show everything, whatever's missing", { filters: { ...filters, ready: false, near: false } }, () => setFilters({ ready: false, near: false }));
    if (filters.quick) add("Allow longer cooks", { filters: { ...filters, quick: false } }, () => setFilters({ quick: false }));
    if (filters.noAhead) add("Include overnight prep", { filters: { ...filters, noAhead: false } }, () => setFilters({ noAhead: false }));
    if (region !== "all") add("Search all regions", { region: "all" }, () => update({ region: "all" }));
    if (searching && anyFilter) add(`Search "${query.trim()}" with no filters`, { filters: NO_FILTERS, region: "all" }, clearFilters);
    if (searching) add("Clear search", { query: "" }, () => setQuery(""));
    if (!out.length && anyFilter) add("Clear filters", { filters: NO_FILTERS, region: "all", query: "" }, () => { clearFilters(); setQuery(""); });
    return out.slice(0, 3);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hits.length, all, q, region, filters.ready, filters.near, filters.quick, filters.noAhead]);

  const pantryEmpty = pantry.length === 0;
  const needsPantry = filters.ready && pantryEmpty;
  const empty = describeEmpty(criteria, pantryEmpty);

  return (
    <div className="page explore">
      <PageHeader title="Explore" lede="Dishes grouped by the people who cook them, not just the country on the map." />

      <div className="explore-controls">
        <div className="search">
          <Icon name="search" size={18} />
          <label htmlFor="explore-q" className="visually-hidden">Search dishes, peoples or ingredients</label>
          <input
            id="explore-q"
            className="input"
            type="search"
            placeholder="Dish, people or ingredient"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoComplete="off"
          />
        </div>

        <Segmented<RegionFilter>
          label="Region"
          value={region}
          onChange={(v) => update({ region: v })}
          options={[
            { value: "all", label: "All" },
            { value: "West Africa", label: "West Africa" },
            { value: "East Africa", label: "East Africa" },
          ]}
        />

        <div className="scroller explore-filters" role="group" aria-label="Filters">
          {FILTERS.map((f) => (
            <button key={f.key} type="button" className="chip explore-chip" aria-pressed={filters[f.key]} onClick={() => toggle(f.key)}>
              {filters[f.key] && <CheckSmall />}
              {f.label}
            </button>
          ))}
        </div>

        <div className="explore-bar">
          <p className="explore-count" aria-live="polite">
            <strong>{plural(hits.length)}</strong>
            {anyFilter && (
              <button type="button" className="link explore-clear" onClick={clearFilters}>
                Clear filters
              </button>
            )}
          </p>

          <div className="explore-tools">
            {!searching && (
              <div className="explore-view">
                <Segmented<ViewMode>
                  label="View"
                  value={view}
                  onChange={(v) => update({ view: v })}
                  options={[
                    { value: "people", label: "By people" },
                    { value: "all", label: "All dishes" },
                  ]}
                />
              </div>
            )}
            <label className="explore-sort">
              <span className="visually-hidden">Sort by</span>
              <SortIcon />
              <select className="input explore-sort__select" value={sort} onChange={(e) => update({ sort: e.target.value as SortKey })}>
                {SORTS.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
              <span className="explore-sort__caret" aria-hidden="true">
                <Icon name="chevron" size={16} />
              </span>
            </label>
          </div>
        </div>
      </div>

      <div ref={listRef} className="explore-results">
        {hits.length === 0 ? (
          <div className="group explore-empty">
            <strong>{empty.title}</strong>
            <p>
              {needsPantry
                ? "Add what's in your kitchen and we'll show what you can cook tonight."
                : empty.detail || (criteria.query && !anyFilter ? "Try an ingredient like \"plantain\" or a people like \"Akan\"." : escapes.length > 1 ? "Try one of these instead." : "Try this instead.")}
            </p>
            <div className="explore-empty__actions">
              {needsPantry && (
                <button type="button" className="btn btn--primary btn--sm" onClick={() => go("pantry")}>
                  Add to your pantry
                </button>
              )}
              {escapes.map((e, i) => (
                <button key={e.label} type="button" className={`btn btn--sm ${i === 0 && !needsPantry ? "btn--tinted" : "btn--secondary"}`} onClick={e.run}>
                  {e.label}
                  <span className="explore-empty__n">{e.n}</span>
                </button>
              ))}
            </div>
          </div>
        ) : flat ? (
          <Section>
            <HitRows hits={hits} q={q} showPeople />
          </Section>
        ) : (
          groups.map(({ people, hits: list }) => (
            <Section key={people.id} title={people.name} action={<span className="small muted">{people.area}</span>}>
              <HitRows hits={list} q={q} showPeople={false} />
            </Section>
          ))
        )}
      </div>
    </div>
  );
}
