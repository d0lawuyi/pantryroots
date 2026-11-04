import { memo, useMemo, type ReactElement } from "react";
import type { Dish } from "@/data/dishes";

/**
 * PlateArt — a small, hand-drawn-feeling, top-down illustration of a dish.
 *
 * Everything is generated from the dish's own data (name, summary, tone,
 * ingredients) and seeded by dish.id, so the same dish always draws the same
 * plate. The plate itself (rim, well, shadow ring) uses design-token CSS
 * variables so it follows dark mode; the food uses fixed colours because food
 * colour is content, derived from the --tone-* palette.
 *
 * Drawn on a 64-unit canvas and scaled to `size`. Below 52px a lighter level
 * of detail is used so the silhouette still reads at 40px.
 */

type Props = { dish: Dish; size?: number; className?: string };

/* ───────────── palette (mirrors --tone-* in tokens.css) ───────────── */

const TONE: Record<Dish["tone"], string> = {
  red: "#c8402a",
  orange: "#df7a2c",
  gold: "#d9a13a",
  green: "#4e7a3a",
  brown: "#85573a",
  cream: "#e6dcc4",
};

const C = {
  chili: "#c8402a",
  stem: "#4e7a3a",
  onion: "#b67a9c",
  friedOnion: "#b8722e",
  plantain: "#efbf3f",
  plantainEdge: "#b77a1c",
  eggWhite: "#fbf7ee",
  eggEdge: "#d8cfbd",
  yolk: "#eeaa22",
  lime: "#8db648",
  lemon: "#efcf45",
  pith: "#f6f0d8",
  leaf: "#4e7a3a",
  leafLight: "#77a356",
  leafDark: "#355a27",
  fish: "#cfb08a",
  fishSkin: "#8f6a48",
  tomato: "#d24b33",
  tomatoSeed: "#f3c27a",
  avocado: "#a9c25a",
  avocadoSkin: "#3f5b2a",
  carrot: "#e5822f",
  raisin: "#4a2a2e",
  peanut: "#c99a63",
  shito: "#2c1d17",
  honey: "#e7a92c",
  meat: "#7a4a30",
  char: "#2b1d14",
  stick: "#c49a63",
  spice: "#3b2a1f",
  maize: "#ecc449",
  bean: "#7b3a2c",
  beanLight: "#c9a07a",
  palmOil: "#d2532a",
};

/* ───────────── tiny utilities ───────────── */

function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** mulberry32 — small, fast, deterministic. */
function makeRng(seed: number) {
  let a = seed || 1;
  const next = () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    range: (lo: number, hi: number) => lo + (hi - lo) * next(),
    pick: <T,>(xs: readonly T[]): T => xs[Math.floor(next() * xs.length) % xs.length],
  };
}
type Rng = ReturnType<typeof makeRng>;

const n = (v: number) => Math.round(v * 100) / 100;

function hexToRgb(hex: string): [number, number, number] {
  const v = parseInt(hex.slice(1), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}
function mix(a: string, b: string, t: number): string {
  const A = hexToRgb(a);
  const B = hexToRgb(b);
  const c = A.map((x, i) => Math.round(x + (B[i] - x) * t));
  return `#${c.map((x) => x.toString(16).padStart(2, "0")).join("")}`;
}
const shade = (c: string, t: number) => mix(c, "#1b130d", t);
const tint = (c: string, t: number) => mix(c, "#fffaf0", t);

/** A closed, gently irregular blob — the "hand-made" outline used for all food. */
function blob(cx: number, cy: number, rx: number, ry: number, wobble: number, rng: Rng, points = 9, rot = 0): string {
  const pts: [number, number][] = [];
  for (let i = 0; i < points; i++) {
    const a = rot + (i / points) * Math.PI * 2;
    const k = 1 + wobble * (rng.next() * 2 - 1);
    pts.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]);
  }
  // Closed Catmull-Rom → cubic Bézier.
  let d = `M${n(pts[0][0])} ${n(pts[0][1])}`;
  for (let i = 0; i < points; i++) {
    const p0 = pts[(i - 1 + points) % points];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % points];
    const p3 = pts[(i + 2) % points];
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += `C${n(c1x)} ${n(c1y)} ${n(c2x)} ${n(c2y)} ${n(p2[0])} ${n(p2[1])}`;
  }
  return d + "Z";
}

/** Uniform random point in a disc. */
function inDisc(cx: number, cy: number, r: number, rng: Rng): [number, number] {
  const a = rng.next() * Math.PI * 2;
  const d = Math.sqrt(rng.next()) * r;
  return [cx + Math.cos(a) * d, cy + Math.sin(a) * d];
}

/** Jittered grid of points inside a disc — even coverage without clumps. */
function packedDisc(cx: number, cy: number, r: number, step: number, rng: Rng): [number, number][] {
  const out: [number, number][] = [];
  for (let y = cy - r; y <= cy + r; y += step * 0.87) {
    const row = Math.round((y - cy) / (step * 0.87));
    for (let x = cx - r + (row % 2 ? step / 2 : 0); x <= cx + r; x += step) {
      const px = x + rng.range(-step * 0.22, step * 0.22);
      const py = y + rng.range(-step * 0.22, step * 0.22);
      if ((px - cx) ** 2 + (py - cy) ** 2 <= r * r) out.push([px, py]);
    }
  }
  return out;
}

/* ───────────── reading the dish ───────────── */

type Kind = "rice" | "stew" | "swallow" | "flatbread" | "grilled" | "mix" | "mash" | "greens";

type Read = {
  kind: Kind;
  base: string;
  text: string;
  ings: string;
  stewOnTop: boolean;
  torn: boolean;
};

function readDish(dish: Dish): Read {
  const name = dish.name.toLowerCase();
  const text = `${name} ${dish.summary.toLowerCase()}`;
  const ings = dish.ingredients.join(" | ").toLowerCase();
  const base = TONE[dish.tone] ?? TONE.cream;
  const r: Read = { kind: "stew", base, text, ings, stewOnTop: false, torn: false };

  if (/injera|canjeero|anjero|chechebsa|kitcha|laxoox|chapati|flatbread|pancake/.test(name) || /teff/.test(ings)) {
    r.kind = "flatbread";
    r.stewOnTop = /\bwat\b|stew|tibs/.test(name);
    r.torn = /torn|shredded|pieces/.test(dish.summary.toLowerCase());
  } else if (/suya|kebab|skewer|kilishi|nyama choma|mishkaki|grill/.test(name)) {
    r.kind = "grilled";
  } else if (/amala|fufu|ugali|tuwo|matooke|banku|kenkey|\beba\b|pounded yam|sadza|nshima|posho|semo/.test(name)) {
    r.kind = "swallow";
  } else if (/mukimo|irio/.test(name)) {
    r.kind = "mash";
  } else if (/githeri|waakye|red red|nyoyo|kande/.test(name)) {
    r.kind = "mix";
  } else if (/efo|sukuma|greens|ewedu|ugu|kontomire|mboga/.test(name)) {
    r.kind = "greens";
  } else if (/\brice\b|pilau|jollof|biryani/.test(ings) || /jollof|pilau|bariis|rice/.test(name)) {
    r.kind = "rice";
  } else if (/soup|stew|\bwat\b|curry|sauce|mchuzi|nsala|egusi|broth/.test(text)) {
    r.kind = "stew";
  }
  return r;
}

/* ───────────── garnish ───────────── */

type GarnishId =
  | "egg" | "fish" | "plantain" | "citrus" | "avocado" | "chili" | "onion" | "shito"
  | "raisins" | "peanut" | "honey" | "carrot" | "leaves" | "meat" | "tomato" | "spice";

const GARNISH_RULES: [GarnishId, RegExp][] = [
  ["egg", /\beggs?\b/],
  ["fish", /(^|\| )(fish|tilapia|catfish|snapper|mackerel|tuna)\b/],
  ["plantain", /plantain/],
  ["citrus", /\blime\b|\blemon\b/],
  ["avocado", /avocado/],
  ["chili", /scotch bonnet|chil+i|habanero|pili pili|cayenne/],
  ["onion", /onion/],
  ["shito", /shito/],
  ["raisins", /raisin|sultana/],
  ["peanut", /peanut|groundnut/],
  ["honey", /honey/],
  ["carrot", /carrot/],
  ["leaves", /parsley|bay leaf|coriander|cilantro|basil|uziza|utazi|bitter leaf|scent leaf|curry leaf|mint|collard|kale|sukuma|cabbage|spinach|leaves/],
  ["meat", /chicken|beef|goat|lamb|mutton|turkey/],
  ["tomato", /tomato(?! paste)/],
  ["spice", /cardamom|clove|cumin|cinnamon|xawaash|berbere|yaji/],
];

function pickGarnish(read: Read, dish: Dish): GarnishId[] {
  const found: GarnishId[] = [];
  for (const [id, re] of GARNISH_RULES) {
    if (re.test(read.ings)) found.push(id);
  }
  // Don't repeat what the base already says.
  let list = found.filter((g) => {
    if (read.kind === "greens" && g === "leaves") return false;
    if (read.kind === "grilled" && (g === "meat" || g === "spice")) return false;
    if (read.kind === "mix" && g === "shito") return true;
    return true;
  });
  // A whole fish is the star when it's there; meat is redundant next to it.
  if (list.includes("fish")) list = list.filter((g) => g !== "meat");
  list = list.slice(0, 3);
  if (list.length < 2) {
    for (const fallback of ["leaves", "spice"] as GarnishId[]) {
      if (list.length >= 2) break;
      if (!list.includes(fallback)) list.push(fallback);
    }
  }
  return list;
}

type Draw = (x: number, y: number, rot: number, rng: Rng, small: boolean, key: string, fried?: boolean) => ReactElement;

const g = (x: number, y: number, rot: number, s = 1) => `translate(${n(x)} ${n(y)}) rotate(${n(rot)}) scale(${n(s * GSCALE)})`;
/** Garnish reads a touch larger than life so it survives 40px. */
const GSCALE = 1.12;

const GARNISH: Record<GarnishId, Draw> = {
  chili: (x, y, r, _rng, small, key) => (
    <g key={key} transform={g(x, y, r, small ? 1.15 : 1)}>
      <path d="M-4.2 0.6C-3.2 -1.9 0.8 -2.4 3.2 -1.1C4 -0.7 4 0.4 3.2 0.6C0.6 1.3 -2 1.9 -4.2 0.6Z" fill={C.chili} />
      <path d="M3.4 -0.3C4.4 -0.6 5 -1.4 5.4 -2.2" stroke={C.stem} strokeWidth={1.1} strokeLinecap="round" fill="none" />
      {!small && <path d="M-2.4 -0.6C-1 -1.3 0.8 -1.4 2 -1" stroke="#fff" strokeOpacity={0.45} strokeWidth={0.6} strokeLinecap="round" fill="none" />}
    </g>
  ),
  onion: (x, y, r, _rng, small, key, fried) => (
    <g key={key} transform={g(x, y, r, small ? 1.1 : 1)} fill="none" stroke={fried ? C.friedOnion : C.onion} strokeLinecap="round" strokeWidth={small ? 1.3 : 1}>
      <path d="M-4 1.6A4.2 4.2 0 0 1 4 1.2" />
      <path d="M-2.4 1.8A2.6 2.6 0 0 1 2.4 1.5" />
      {!small && <path d="M-1.5 -3.6A5.6 5.6 0 0 1 5 -0.6" strokeOpacity={0.8} />}
    </g>
  ),
  plantain: (x, y, r, _rng, small, key) => (
    <g key={key} transform={g(x, y, r, small ? 1.15 : 1)}>
      <ellipse cx={-1.6} cy={0} rx={2.9} ry={2.2} fill={C.plantain} stroke={C.plantainEdge} strokeWidth={0.7} />
      <ellipse cx={2.4} cy={1.3} rx={2.9} ry={2.2} fill={C.plantain} stroke={C.plantainEdge} strokeWidth={0.7} />
      {!small && <ellipse cx={2.2} cy={1.1} rx={1.2} ry={0.8} fill={C.plantainEdge} fillOpacity={0.35} />}
    </g>
  ),
  egg: (x, y, r, _rng, small, key) => (
    <g key={key} transform={g(x, y, r, small ? 1.15 : 1.05)}>
      <ellipse cx={0} cy={0} rx={4.4} ry={3.4} fill={C.eggWhite} stroke={C.eggEdge} strokeWidth={0.6} />
      <circle cx={0.4} cy={0.2} r={1.9} fill={C.yolk} />
    </g>
  ),
  citrus: (x, y, r, _rng, small, key) => {
    return (
      <g key={key} transform={g(x, y, r, small ? 1.15 : 1)}>
        <path d="M-4.4 0A4.4 4.4 0 0 0 4.4 0Z" fill={C.pith} />
        <path d="M-4.4 0A4.4 4.4 0 0 0 4.4 0" fill="none" stroke={C.lime} strokeWidth={1.2} />
        <path d="M-3.4 0.4A3.4 3.4 0 0 0 3.4 0.4Z" fill={C.lime} fillOpacity={0.55} />
        {!small && <path d="M0 0.4V3.4M0 0.4L-2.4 2.6M0 0.4L2.4 2.6" stroke={C.pith} strokeWidth={0.5} />}
      </g>
    );
  },
  avocado: (x, y, r, _rng, small, key) => (
    <g key={key} transform={g(x, y, r, small ? 1.1 : 1)}>
      <path d="M-5 0C-4 -3.2 3 -3.6 5 -0.4C3.4 1.8 -3 2.4 -5 0Z" fill={C.avocado} stroke={C.avocadoSkin} strokeWidth={0.9} />
    </g>
  ),
  fish: (x, y, r, _rng, small, key) => (
    <g key={key} transform={g(x, y, r, small ? 1.05 : 1)}>
      <path d="M-6.5 0C-4.5 -3.4 2.4 -3.6 4.4 0C2.4 3.6 -4.5 3.4 -6.5 0Z" fill={C.fish} stroke={C.fishSkin} strokeWidth={0.8} />
      <path d="M4 0L7 -2.6V2.6Z" fill={C.fishSkin} />
      <circle cx={-4.4} cy={-0.5} r={0.7} fill={C.char} />
      {!small && <path d="M-2.6 -2V2M-0.6 -2.4V2.4M1.4 -2V2" stroke={C.fishSkin} strokeWidth={0.5} strokeOpacity={0.7} />}
    </g>
  ),
  tomato: (x, y, r, _rng, small, key) => (
    <g key={key} transform={g(x, y, r, small ? 1.1 : 1)}>
      <circle r={3.4} fill={C.tomato} />
      <circle r={2.4} fill="none" stroke={C.tomatoSeed} strokeOpacity={0.6} strokeWidth={0.5} />
      {!small && [0, 120, 240].map((a) => (
        <ellipse key={a} cx={Math.cos((a * Math.PI) / 180) * 1.3} cy={Math.sin((a * Math.PI) / 180) * 1.3} rx={0.6} ry={0.4} fill={C.tomatoSeed} />
      ))}
    </g>
  ),
  carrot: (x, y, r, _rng, small, key) => (
    <g key={key} transform={g(x, y, r, small ? 1.1 : 1)}>
      <circle cx={-1.6} r={2.3} fill={C.carrot} stroke={shade(C.carrot, 0.25)} strokeWidth={0.5} />
      <circle cx={2} cy={1.4} r={2.1} fill={C.carrot} stroke={shade(C.carrot, 0.25)} strokeWidth={0.5} />
    </g>
  ),
  leaves: (x, y, _r, rng, small, key) => {
    const count = small ? 3 : 4;
    return (
      <g key={key} transform={`translate(${n(x)} ${n(y)})`}>
        {Array.from({ length: count }, (_, i) => {
          const a = rng.range(0, 360);
          const dx = rng.range(-3.6, 3.6);
          const dy = rng.range(-3.6, 3.6);
          return (
            <path key={i} d="M-1.8 0Q0 -1.5 1.8 0Q0 1.5 -1.8 0Z" transform={`translate(${n(dx)} ${n(dy)}) rotate(${n(a)}) scale(${small ? 1.25 : 1})`}
              fill={i % 2 ? C.leafLight : C.leaf} />
          );
        })}
      </g>
    );
  },
  meat: (x, y, r, rng, small, key) => (
    <g key={key} transform={g(x, y, r, small ? 1.05 : 1)}>
      <path d={blob(0, 0, 3.6, 3, 0.18, rng, 7)} fill={C.meat} />
      <path d={blob(-0.6, -0.6, 2, 1.4, 0.2, rng, 6)} fill={tint(C.meat, 0.25)} />
    </g>
  ),
  shito: (x, y, _r, rng, small, key) => (
    <g key={key} transform={`translate(${n(x)} ${n(y)})`}>
      <path d={blob(0, 0, 3.4, 2.9, 0.2, rng, 7)} fill={C.shito} />
      {!small && <circle cx={-1} cy={-0.9} r={0.7} fill="#fff" fillOpacity={0.35} />}
    </g>
  ),
  raisins: (x, y, _r, rng, small, key) => (
    <g key={key} transform={`translate(${n(x)} ${n(y)})`} fill={C.raisin}>
      {Array.from({ length: small ? 4 : 6 }, (_, i) => {
        const [px, py] = inDisc(0, 0, 3.4, rng);
        return <ellipse key={i} cx={n(px)} cy={n(py)} rx={small ? 1.2 : 1} ry={small ? 0.95 : 0.8} transform={`rotate(${n(rng.range(0, 180))} ${n(px)} ${n(py)})`} />;
      })}
    </g>
  ),
  peanut: (x, y, _r, rng, small, key) => (
    <g key={key} transform={`translate(${n(x)} ${n(y)})`} fill={C.peanut} stroke={shade(C.peanut, 0.3)} strokeWidth={0.4}>
      {Array.from({ length: small ? 3 : 4 }, (_, i) => {
        const [px, py] = inDisc(0, 0, 3, rng);
        return <ellipse key={i} cx={n(px)} cy={n(py)} rx={1.5} ry={1.05} transform={`rotate(${n(rng.range(0, 180))} ${n(px)} ${n(py)})`} />;
      })}
    </g>
  ),
  honey: (x, y, r, _rng, small, key) => (
    <g key={key} transform={g(x, y, r)}>
      <path d="M-6 -1C-3 -3 -1 1 2 -1S6 1 7 -1" fill="none" stroke={C.honey} strokeWidth={small ? 1.6 : 1.3} strokeLinecap="round" />
    </g>
  ),
  spice: (x, y, _r, rng, small, key) => (
    <g key={key} transform={`translate(${n(x)} ${n(y)})`} fill={C.spice}>
      {Array.from({ length: small ? 4 : 6 }, (_, i) => {
        const [px, py] = inDisc(0, 0, 3.8, rng);
        return <circle key={i} cx={n(px)} cy={n(py)} r={small ? 0.8 : 0.6} />;
      })}
    </g>
  ),
};

/* ───────────── food bases ───────────── */

const CX = 32;
const CY = 32;

type Ctx = { read: Read; rng: Rng; small: boolean; dish: Dish };

/** Soft volume: a darker underside offset down-right, then the body. */
function mound(cx: number, cy: number, rx: number, ry: number, color: string, ctx: Ctx, key: string, wobble = 0.08, depth = 0.22) {
  const { rng } = ctx;
  return [
    <path key={`${key}-u`} d={blob(cx + 0.9, cy + 1.1, rx, ry, wobble, rng, 9)} fill={shade(color, depth)} />,
    <path key={`${key}-b`} d={blob(cx - 0.3, cy - 0.3, rx - 0.6, ry - 0.6, wobble, rng, 9)} fill={color} />,
  ];
}

function drawRice(ctx: Ctx): ReactElement[] {
  const { read, rng, small } = ctx;
  // Tomato warms a brown rice toward orange (bariis vs. a tomato-free pilau).
  const base = read.base === TONE.brown && /tomato/.test(read.ings) ? mix(read.base, TONE.orange, 0.3) : read.base;
  const cream = base === TONE.cream;
  const out = mound(CX, CY + 0.5, 17, 16, base, ctx, "rice", 0.07, cream ? 0.3 : 0.22);
  const grainLight = tint(base, cream ? 0.6 : 0.42);
  const grainDark = shade(base, cream ? 0.24 : 0.2);
  const count = small ? 30 : 64;
  const len = small ? 1.05 : 0.85;
  for (let i = 0; i < count; i++) {
    const [x, y] = inDisc(CX - 0.4, CY + 0.2, 14, rng);
    const a = rng.range(0, Math.PI);
    const dx = Math.cos(a) * len;
    const dy = Math.sin(a) * len;
    out.push(
      <line key={`g${i}`} x1={n(x - dx)} y1={n(y - dy)} x2={n(x + dx)} y2={n(y + dy)}
        stroke={rng.next() < 0.75 ? grainLight : grainDark} strokeWidth={small ? 1.45 : 1.1} strokeLinecap="round" />,
    );
  }
  // Whole spices left in the pot: cloves, cardamom pods, a piece of cinnamon.
  if (/cinnamon|cloves/.test(read.ings)) {
    for (let i = 0; i < (small ? 3 : 5); i++) {
      const [x, y] = inDisc(CX, CY, 11, rng);
      const pod = i % 2 ? "#6f8a3c" : C.spice;
      out.push(<ellipse key={`pod${i}`} cx={n(x)} cy={n(y)} rx={small ? 1.5 : 1.25} ry={small ? 0.95 : 0.75} fill={pod} transform={`rotate(${n(rng.range(0, 180))} ${n(x)} ${n(y)})`} />);
    }
    const [sx, sy] = inDisc(CX, CY, 7, rng);
    out.push(<rect key="cinnamon" x={n(sx - 3.6)} y={n(sy - 0.9)} width={7.2} height={1.8} rx={0.8} fill="#8a4f2a" stroke="#5e3218" strokeWidth={0.4} transform={`rotate(${n(rng.range(-60, 60))} ${n(sx)} ${n(sy)})`} />);
  }
  return out;
}

function drawStew(ctx: Ctx): ReactElement[] {
  const { read, rng, small } = ctx;
  const base = read.base;
  const out: ReactElement[] = [];
  // The bowl: a raised ring inside the plate.
  out.push(<circle key="bowl" cx={CX} cy={CY + 0.6} r={22.4} fill="var(--line)" />);
  out.push(<circle key="bowl-in" cx={CX} cy={CY} r={22} fill="var(--surface)" />);
  out.push(<path key="sauce-edge" d={blob(CX, CY, 18.6, 18.6, 0.04, rng, 10)} fill={shade(base, 0.2)} />);
  out.push(<path key="sauce" d={blob(CX - 0.3, CY - 0.3, 17.6, 17.6, 0.04, rng, 10)} fill={base} />);

  // Swirl: an Archimedean spiral that loosens toward the rim.
  const turns = 2.1;
  const start = rng.range(0, Math.PI * 2);
  let d = "";
  const steps = 40;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const a = start + t * turns * Math.PI * 2;
    const r = 2 + t * 11.5;
    d += `${i ? "L" : "M"}${n(CX + Math.cos(a) * r)} ${n(CY + Math.sin(a) * r)}`;
  }
  const swirlColor = base === TONE.cream ? shade(base, 0.16) : tint(base, 0.32);
  out.push(<path key="swirl" d={d} fill="none" stroke={swirlColor} strokeWidth={small ? 1.6 : 1.2} strokeLinecap="round" strokeOpacity={0.9} />);

  // Egusi sets into curds.
  if (/egusi/.test(read.ings)) {
    for (let i = 0; i < (small ? 7 : 12); i++) {
      const [x, y] = inDisc(CX, CY, 13, rng);
      out.push(<path key={`curd${i}`} d={blob(x, y, small ? 2.1 : 1.8, small ? 1.8 : 1.5, 0.25, rng, 6)} fill={tint(base, 0.55)} />);
    }
  }
  // Palm-oil stews get a sheen of red oil beads.
  if (/palm oil/.test(read.ings) || /coconut/.test(read.ings)) {
    const bead = /coconut/.test(read.ings) ? "#f6efdc" : C.palmOil;
    for (let i = 0; i < (small ? 3 : 6); i++) {
      const [x, y] = inDisc(CX, CY, 15, rng);
      out.push(<circle key={`oil${i}`} cx={n(x)} cy={n(y)} r={n(rng.range(0.7, 1.3) * (small ? 1.2 : 1))} fill={bead} fillOpacity={0.85} />);
    }
  }
  // A few herb flecks.
  for (let i = 0; i < (small ? 3 : 6); i++) {
    const [x, y] = inDisc(CX, CY, 15, rng);
    out.push(<circle key={`fleck${i}`} cx={n(x)} cy={n(y)} r={small ? 0.85 : 0.6} fill={i % 2 ? C.leafDark : C.leaf} />);
  }
  return out;
}

const SWALLOW_BODY: [RegExp, string][] = [
  [/amala/, "#6e5141"],
  [/matooke/, "#d6c25e"],
  [/fufu/, "#efe6cf"],
  [/ugali|tuwo|banku|posho|sadza|nshima/, "#f1ead8"],
];

function drawSwallow(ctx: Ctx): ReactElement[] {
  const { read, rng, small } = ctx;
  const name = ctx.dish.name.toLowerCase();
  const body = SWALLOW_BODY.find(([re]) => re.test(name))?.[1] ?? tint(read.base, 0.6);

  // Sauces: amala comes with two (ewedu + gbegiri); peanut sauces go brown;
  // a pale swallow on a pale tone gets a tomato stew so it doesn't vanish.
  let pools: string[] = [read.base];
  if (/ewedu|jute/.test(read.text + read.ings) && /gbegiri|beans/.test(read.text + read.ings)) pools = ["#3f6b2f", "#d9a13a"];
  else if (/peanut|groundnut/.test(read.ings)) pools = ["#9a6a3c"];
  else if (read.base === TONE.cream) pools = ["#c4492f"];

  const out: ReactElement[] = [];
  if (pools.length === 2) {
    out.push(<path key="p0e" d={blob(42.5, 25, 9.4, 8.4, 0.08, rng, 8)} fill={shade(pools[0], 0.25)} />);
    out.push(<path key="p0" d={blob(42.2, 24.7, 8.6, 7.6, 0.08, rng, 8)} fill={pools[0]} />);
    out.push(<path key="p1e" d={blob(40.5, 42.5, 9.6, 8.4, 0.08, rng, 8)} fill={shade(pools[1], 0.22)} />);
    out.push(<path key="p1" d={blob(40.2, 42.2, 8.8, 7.6, 0.08, rng, 8)} fill={pools[1]} />);
  } else {
    out.push(<path key="pe" d={blob(41.5, 37, 11.4, 10.6, 0.08, rng, 9)} fill={shade(pools[0], 0.24)} />);
    out.push(<path key="p" d={blob(41.2, 36.7, 10.6, 9.8, 0.08, rng, 9)} fill={pools[0]} />);
    // Sauce texture: tiny lighter specks.
    for (let i = 0; i < (small ? 3 : 6); i++) {
      const [x, y] = inDisc(42, 37, 7, rng);
      out.push(<circle key={`ps${i}`} cx={n(x)} cy={n(y)} r={small ? 0.85 : 0.6} fill={tint(pools[0], 0.4)} />);
    }
  }
  // The swallow: a smooth, round mound with a soft highlight.
  const mx = pools.length === 2 ? 24 : 24.5;
  const my = pools.length === 2 ? 32 : 28;
  out.push(<ellipse key="m-shadow" cx={mx + 1.6} cy={my + 2} rx={12.4} ry={11.6} fill="var(--line)" />);
  out.push(<path key="m-under" d={blob(mx + 0.6, my + 0.8, 12, 11.4, 0.03, rng, 10)} fill={shade(body, 0.16)} />);
  out.push(<path key="m" d={blob(mx - 0.2, my - 0.3, 11.2, 10.6, 0.03, rng, 10)} fill={body} />);
  out.push(<path key="m-hi" d={`M${mx - 7} ${my - 2}A8 8 0 0 1 ${mx - 1} ${my - 8}`} fill="none" stroke="#fff" strokeOpacity={0.5} strokeWidth={small ? 2 : 1.6} strokeLinecap="round" />);
  return out;
}

function drawFlatbread(ctx: Ctx): ReactElement[] {
  const { read, rng, small, dish } = ctx;
  const out: ReactElement[] = [];
  const name = dish.name.toLowerCase();
  const bread = /injera|doro|teff/.test(name + read.ings) ? "#c7ab88" : /canjeero|anjero/.test(name) ? "#ecdcb6" : tint(read.base, 0.25);
  const hole = shade(bread, 0.28);

  if (read.torn) {
    // Torn pieces, tossed together.
    const pieces = packedDisc(CX, CY, 13, 9.5, rng);
    pieces.forEach(([x, y], i) => {
      const rot = rng.range(0, Math.PI);
      out.push(<path key={`te${i}`} d={blob(x + 0.6, y + 0.8, 5.6, 4.4, 0.2, rng, 6, rot)} fill={shade(bread, 0.22)} />);
      out.push(<path key={`t${i}`} d={blob(x, y, 5.2, 4, 0.2, rng, 6, rot)} fill={bread} />);
      for (let k = 0; k < (small ? 1 : 3); k++) {
        const [hx, hy] = inDisc(x, y, 2.6, rng);
        out.push(<circle key={`th${i}-${k}`} cx={n(hx)} cy={n(hy)} r={small ? 0.8 : 0.55} fill={hole} />);
      }
    });
    // Berbere dusting.
    for (let i = 0; i < (small ? 5 : 10); i++) {
      const [x, y] = inDisc(CX, CY, 15, rng);
      out.push(<circle key={`b${i}`} cx={n(x)} cy={n(y)} r={small ? 0.8 : 0.6} fill={C.chili} />);
    }
    return out;
  }

  out.push(<path key="fb-e" d={blob(CX + 0.6, CY + 0.8, 23.4, 23.4, 0.035, rng, 12)} fill={shade(bread, 0.2)} />);
  out.push(<path key="fb" d={blob(CX, CY, 22.8, 22.8, 0.035, rng, 12)} fill={bread} />);
  // The "eyes" — injera and canjeero are full of tiny holes.
  const pts = packedDisc(CX, CY, 20.5, small ? 4.4 : 3.1, rng);
  pts.forEach(([x, y], i) => {
    if (read.stewOnTop && (x - CX) ** 2 + (y - CY) ** 2 < 11 ** 2) return;
    out.push(<circle key={`h${i}`} cx={n(x)} cy={n(y)} r={n(rng.range(0.45, 0.85) * (small ? 1.35 : 1))} fill={hole} fillOpacity={0.75} />);
  });
  if (read.stewOnTop) {
    out.push(<path key="st-e" d={blob(CX + 0.5, CY + 0.7, 10.6, 10, 0.1, rng, 8)} fill={shade(read.base, 0.25)} />);
    out.push(<path key="st" d={blob(CX, CY, 10, 9.4, 0.1, rng, 8)} fill={read.base} />);
    for (let i = 0; i < (small ? 2 : 4); i++) {
      const [x, y] = inDisc(CX, CY, 6, rng);
      out.push(<circle key={`so${i}`} cx={n(x)} cy={n(y)} r={small ? 0.9 : 0.7} fill={tint(read.base, 0.35)} />);
    }
  }
  return out;
}

function drawGrilled(ctx: Ctx): ReactElement[] {
  const { read, rng, small } = ctx;
  const out: ReactElement[] = [];
  const rot = -28 + rng.range(-6, 6);
  const meat = read.base;
  [-9, 0, 9].forEach((off, s) => {
    const items: ReactElement[] = [];
    items.push(<line key="stick" x1={-21} y1={off} x2={21} y2={off} stroke={C.stick} strokeWidth={small ? 1.5 : 1.1} strokeLinecap="round" />);
    const pieces = 4;
    for (let p = 0; p < pieces; p++) {
      const x = -12.5 + p * 8.2 + rng.range(-0.6, 0.6);
      items.push(<path key={`pe${p}`} d={blob(x + 0.5, off + 0.7, 3.9, 3.3, 0.16, rng, 7)} fill={shade(meat, 0.3)} />);
      items.push(<path key={`p${p}`} d={blob(x, off, 3.7, 3.1, 0.16, rng, 7)} fill={meat} />);
      for (let c = 0; c < (small ? 1 : 3); c++) {
        const [cx, cy] = inDisc(x, off, 2.3, rng);
        items.push(<circle key={`c${p}-${c}`} cx={n(cx)} cy={n(cy)} r={small ? 0.85 : n(rng.range(0.4, 0.8))} fill={C.char} />);
      }
      if (!small) {
        const [yx, yy] = inDisc(x, off, 2.4, rng);
        items.push(<circle key={`y${p}`} cx={n(yx)} cy={n(yy)} r={0.5} fill={C.palmOil} />);
      }
    }
    out.push(<g key={`sk${s}`} transform={`translate(${CX} ${CY}) rotate(${n(rot)})`}>{items}</g>);
  });
  return out;
}

function mixPalette(read: Read): string[] {
  const ings = read.ings;
  if (/waakye|sorghum leaves/.test(ings + read.text)) return ["#7d3f33", "#5a2b25", "#b9826b"];
  const p: string[] = [];
  if (/maize|corn/.test(ings)) p.push(C.maize);
  if (/black-eyed/.test(ings)) p.push("#eadfc8");
  if (/beans/.test(ings)) p.push(C.bean, C.beanLight);
  if (/rice/.test(ings)) p.push(tint(read.base, 0.3));
  if (p.length < 2) p.push(read.base, tint(read.base, 0.4));
  return p.slice(0, 3);
}

function drawMix(ctx: Ctx): ReactElement[] {
  const { read, rng, small } = ctx;
  const palette = mixPalette(read);
  const out = mound(CX, CY + 0.5, 18.5, 17.5, shade(palette[0], 0.18), ctx, "mix", 0.07);
  const pts = packedDisc(CX - 0.3, CY + 0.2, 16.2, small ? 3.9 : 3.1, rng);
  pts.forEach(([x, y], i) => {
    const c = palette[Math.floor(rng.next() * palette.length)];
    const r = (small ? 1.75 : 1.4) * rng.range(0.85, 1.12);
    out.push(<ellipse key={`d${i}`} cx={n(x)} cy={n(y)} rx={n(r)} ry={n(r * 0.86)} transform={`rotate(${n(rng.range(0, 180))} ${n(x)} ${n(y)})`} fill={c} />);
  });
  return out;
}

function drawMash(ctx: Ctx): ReactElement[] {
  const { read, rng, small } = ctx;
  const green = /leaves|spinach|greens/.test(read.ings) ? "#6f9a4a" : read.base;
  const out = mound(CX, CY, 18.6, 17.8, green, ctx, "mash", 0.1);
  // Mashed texture: soft darker swirls.
  for (let i = 0; i < (small ? 3 : 6); i++) {
    const [x, y] = inDisc(CX, CY, 11, rng);
    const a = rng.range(0, 360);
    out.push(<path key={`sw${i}`} d="M-3 0Q0 -2.2 3 0" transform={`translate(${n(x)} ${n(y)}) rotate(${n(a)})`} fill="none" stroke={shade(green, 0.22)} strokeWidth={small ? 1.3 : 1} strokeLinecap="round" />);
  }
  const extras: string[] = [];
  if (/maize|corn/.test(read.ings)) extras.push(C.maize);
  if (/beans/.test(read.ings)) extras.push(C.bean);
  if (!extras.length) extras.push(tint(green, 0.5));
  for (let i = 0; i < (small ? 9 : 16); i++) {
    const [x, y] = inDisc(CX, CY, 14.5, rng);
    out.push(<circle key={`k${i}`} cx={n(x)} cy={n(y)} r={small ? 1.6 : 1.25} fill={extras[i % extras.length]} />);
  }
  return out;
}

function drawGreens(ctx: Ctx): ReactElement[] {
  const { read, rng, small } = ctx;
  const out: ReactElement[] = [];
  const base = read.base;
  out.push(<path key="gb-e" d={blob(CX + 0.6, CY + 0.8, 19, 18.4, 0.08, rng, 9)} fill={shade(base, 0.4)} />);
  out.push(<path key="gb" d={blob(CX, CY, 18.4, 17.8, 0.08, rng, 9)} fill={shade(base, 0.2)} />);
  const shades = [base, tint(base, 0.18), shade(base, 0.08), tint(base, 0.32)];
  const count = small ? 7 : 12;
  for (let i = 0; i < count; i++) {
    const [x, y] = inDisc(CX, CY, 11.5, rng);
    const a = rng.range(0, 360);
    const s = rng.range(0.85, 1.15) * (small ? 1.15 : 1);
    const fill = shades[i % shades.length];
    out.push(
      <g key={`l${i}`} transform={`translate(${n(x)} ${n(y)}) rotate(${n(a)}) scale(${n(s)})`}>
        <path d="M-5.2 0C-3 -3.2 2.6 -3.4 5.2 0C2.6 3.4 -3 3.2 -5.2 0Z" fill={fill} stroke={shade(base, 0.35)} strokeWidth={0.4} />
        <path d="M-4.2 0H4" stroke={tint(base, 0.45)} strokeWidth={small ? 0.7 : 0.5} strokeLinecap="round" />
      </g>,
    );
  }
  if (/palm oil/.test(read.ings)) {
    for (let i = 0; i < (small ? 4 : 7); i++) {
      const [x, y] = inDisc(CX, CY, 15, rng);
      out.push(<circle key={`po${i}`} cx={n(x)} cy={n(y)} r={small ? 1 : 0.8} fill={C.palmOil} />);
    }
  }
  return out;
}

const BASES: Record<Kind, (ctx: Ctx) => ReactElement[]> = {
  rice: drawRice,
  stew: drawStew,
  swallow: drawSwallow,
  flatbread: drawFlatbread,
  grilled: drawGrilled,
  mix: drawMix,
  mash: drawMash,
  greens: drawGreens,
};

/** Where garnish may sit, by kind: [start angle°, sweep°, radius]. */
const GARNISH_ARC: Record<Kind, [number, number, number]> = {
  rice: [-70, 360, 10.5],
  stew: [-60, 360, 9.5],
  swallow: [-40, 150, 14],
  flatbread: [-60, 360, 14],
  grilled: [20, 360, 15.5],
  mix: [-60, 360, 11],
  mash: [-60, 360, 10.5],
  greens: [-60, 360, 11],
};

function drawGarnish(ctx: Ctx, garnish: GarnishId[]): ReactElement[] {
  const { read, rng, small } = ctx;
  const out: ReactElement[] = [];
  const [start, sweep, radius] = GARNISH_ARC[read.kind];
  const count = garnish.length;
  const offset = rng.range(-20, 20);
  garnish.forEach((id, i) => {
    // On a stew-topped flatbread, the egg sits in the stew.
    if (id === "egg" && read.stewOnTop) {
      out.push(GARNISH.egg(CX + 1, CY - 0.5, rng.range(-20, 20), rng, small, `gar-${id}`));
      return;
    }
    const step = sweep >= 360 ? 360 / count : sweep / Math.max(1, count - 1);
    const a = ((start + offset + i * step) * Math.PI) / 180;
    const r = radius + rng.range(-1.5, 1.5);
    const x = CX + Math.cos(a) * r;
    const y = CY + Math.sin(a) * r;
    out.push(GARNISH[id](x, y, rng.range(-50, 50), rng, small, `gar-${id}`, /fried onion/.test(read.text)));
  });
  return out;
}

/* ───────────── component ───────────── */

function PlateArtImpl({ dish, size = 40, className }: Props) {
  const small = size < 52;
  const { children, well } = useMemo(() => {
    const read = readDish(dish);
    const rng = makeRng(hashString(dish.id));
    const ctx: Ctx = { read, rng, small, dish };
    const food = BASES[read.kind](ctx);
    const garnish = drawGarnish(ctx, pickGarnish(read, dish));
    // Bowls and big flatbreads cover the well; drawing it too just adds rings.
    return { children: [...food, ...garnish], well: read.kind !== "stew" && read.kind !== "flatbread" };
    // Dish content is stable per id; tone/ingredients included for AI dishes that may be rewritten.
  }, [dish.id, dish.tone, dish.name, dish.summary, dish.ingredients.join("|"), small]);

  const ai = !!dish.aiWritten;
  return (
    <svg
      className={className ? `plate-art ${className}` : "plate-art"}
      width={size}
      height={size}
      viewBox="0 0 64 64"
      aria-hidden="true"
      focusable="false"
      data-ai={ai ? "true" : undefined}
    >
      {/* Shadow ring, then the plate and its well. */}
      <circle cx={32} cy={33.1} r={30.4} fill="var(--line-strong)" fillOpacity={0.7} />
      <circle cx={32} cy={32} r={30.4} fill="var(--surface)" />
      <circle
        cx={32}
        cy={32}
        r={ai ? 29.9 : 30}
        fill="none"
        stroke={ai ? "var(--ink-3)" : "var(--line)"}
        strokeWidth={ai ? (small ? 1.6 : 1.3) : 0.8}
        strokeDasharray={ai ? (small ? "3.6 2.9" : "3 2.4") : undefined}
        strokeLinecap="round"
      />
      {well && <circle cx={32} cy={32} r={25} fill="var(--surface-sunken)" />}
      {children}
    </svg>
  );
}

export const PlateArt = memo(
  PlateArtImpl,
  (a, b) =>
    a.size === b.size &&
    a.className === b.className &&
    (a.dish === b.dish ||
      (a.dish.id === b.dish.id &&
        a.dish.tone === b.dish.tone &&
        a.dish.aiWritten === b.dish.aiWritten &&
        a.dish.name === b.dish.name &&
        a.dish.ingredients.join("|") === b.dish.ingredients.join("|"))),
);
