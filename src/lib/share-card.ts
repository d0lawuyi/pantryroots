import { createElement } from "react";
import { flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import { PlateArt } from "@/components/PlateArt";
import { dishById, peopleById, type Dish } from "@/data/dishes";

/**
 * Share cards — 1080×1350 (4:5) PNGs drawn with Canvas 2D, made to be posted
 * from a phone (Instagram feed/story, WhatsApp status, X). No libraries.
 *
 * The card is always the dark adire-indigo surface from the Tonight hero, in
 * both light and dark mode, so a shared card looks the same for everyone.
 */

export const CARD_W = 1080;
export const CARD_H = 1350;

/* ───────────── palette (fixed: the card is an intentionally dark surface) ───────────── */

const INDIGO = "#1f2f72";
const INDIGO_GLOW = "#2d4196";
const GOLD = "#e9a825";
const WHITE = "#ffffff";
const WHITE_78 = "rgb(255 255 255 / 0.78)";
const WHITE_60 = "rgb(255 255 255 / 0.6)";
const WHITE_18 = "rgb(255 255 255 / 0.18)";

/** Light-mode plate tokens, so the plate is always a white plate on indigo. */
const PLATE_VARS: Record<string, string> = {
  "--surface": "#ffffff",
  "--surface-sunken": "#f7f8fa",
  "--line": "#e2e4ea",
  "--line-strong": "#cfd3dc",
  "--ink-3": "#6a7082",
};

const FONT_STACK = `"Schibsted Grotesk", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
const font = (weight: number, px: number) => `${weight} ${px}px ${FONT_STACK}`;

const M = 88; // outer margin

/* ───────────── public API ───────────── */

export type DishCardOptions = {
  /** "I cooked this tonight" instead of "Tonight's pick". */
  cooked?: boolean;
  /** Origin line override; defaults to "People, area" from the dish data. */
  from?: string;
  /** Pantry match for the meter. Omit to hide the meter. */
  match?: { have: number; total: number };
};

export type BattlePick = {
  /** Contender name, e.g. "Party Jollof". */
  dish: string;
  origin: string;
  /** Curated dish id, used to draw its plate when we have one. */
  dishId?: string;
};

export async function dishCard(dish: Dish, opts: DishCardOptions = {}): Promise<Blob> {
  await fontsReady();
  const { canvas, ctx } = makeCanvas();
  drawBackground(ctx);

  // Kicker
  ctx.fillStyle = GOLD;
  ctx.font = font(700, 40);
  ctx.textBaseline = "alphabetic";
  ctx.fillText(opts.cooked ? "I cooked this tonight" : "Tonight's pick", M, M + 36);

  // Lay out bottom-up: footer, meter, origin, name; the plate gets the rest.
  const footerLine = CARD_H - M - 92;
  const hasMeter = !!opts.match && opts.match.total > 0;
  const meterY = footerLine - 56 - 64;
  const from = opts.from ?? originOf(dish);
  const originBase = hasMeter ? meterY - 72 : footerLine - 72;
  const name = fitLines(ctx, dish.name, CARD_W - M * 2, 2, [112, 104, 96, 88, 80, 72], 800);
  const lineH = name.size * 1.0;
  const nameLastBase = from ? originBase - 64 : originBase;
  const nameTop = nameLastBase - (name.lines.length - 1) * lineH - name.size * 0.76;

  // Plate: as large as fits, centred in the space under the kicker.
  const areaTop = M + 36 + 56;
  const areaBottom = nameTop - 64;
  const plateSize = Math.min(640, areaBottom - areaTop);
  await drawPlate(ctx, dish, (CARD_W - plateSize) / 2, areaTop + (areaBottom - areaTop - plateSize) / 2, plateSize, 14);

  // Name
  ctx.fillStyle = WHITE;
  ctx.font = font(800, name.size);
  setTracking(ctx, -0.03 * name.size);
  name.lines.forEach((line, i) => ctx.fillText(line, M - 4, nameLastBase - (name.lines.length - 1 - i) * lineH));
  setTracking(ctx, 0);

  // Origin
  if (from) {
    ctx.font = font(500, 40);
    ctx.fillStyle = WHITE_78;
    ctx.fillText(ellipsize(ctx, from, CARD_W - M * 2), M, originBase);
  }

  // Match meter
  if (hasMeter) {
    const { have, total } = opts.match!;
    drawMeter(ctx, M, meterY, CARD_W - M * 2, have, total);
    ctx.font = font(600, 32);
    ctx.fillStyle = WHITE_78;
    const label =
      have === total
        ? `All ${total} ingredients were already in my pantry`
        : `${have} of ${total} ingredients already in my pantry`;
    ctx.fillText(label, M, meterY + 64);
  }

  drawFooter(ctx);
  return toBlob(canvas);
}

export async function battleCard(battleTitle: string, topPicks: BattlePick[], tasteLine?: string): Promise<Blob> {
  await fontsReady();
  const { canvas, ctx } = makeCanvas();
  drawBackground(ctx);

  ctx.fillStyle = GOLD;
  ctx.font = font(700, 40);
  ctx.fillText("Battles", M, M + 36);

  // Title: "My jollof ranking"
  const title = `My ${battleTitle.toLowerCase()} ranking`;
  const t = fitLines(ctx, title, CARD_W - M * 2, 2, [112, 100, 88, 76], 800);
  ctx.fillStyle = WHITE;
  ctx.font = font(800, t.size);
  setTracking(ctx, -0.03 * t.size);
  let y = M + 60;
  for (const line of t.lines) {
    y += t.size * 0.98;
    ctx.fillText(line, M, y);
  }
  setTracking(ctx, 0);

  // Ranking rows fill the space between the title and the taste box (or footer).
  const picks = topPicks.slice(0, 3);
  const footerTop = CARD_H - M - 92;
  const tasteH = 150;
  const tasteY = footerTop - 56 - tasteH;
  const rowsTop = y + 64;
  const rowsBottom = (tasteLine ? tasteY : footerTop) - 48;
  const gap = 20;
  const avail = rowsBottom - rowsTop - gap * Math.max(0, picks.length - 1);
  const weights = picks.map((_, i) => (i === 0 ? 1.35 : 1));
  const unit = avail / weights.reduce((a, b) => a + b, 0);
  const firstH = Math.min(300, unit * 1.35);
  const restH = Math.min(220, picks.length > 1 ? (avail - firstH) / (picks.length - 1) : 0);

  let ry = rowsTop;
  for (let i = 0; i < picks.length; i++) {
    const h = i === 0 ? firstH : restH;
    await drawRankRow(ctx, picks[i], i, M, ry, CARD_W - M * 2, h);
    ry += h + gap;
  }

  if (tasteLine) {
    const boxY = tasteY;
    ctx.fillStyle = GOLD;
    roundRect(ctx, M, boxY, 8, tasteH, 4);
    ctx.fill();
    ctx.font = font(600, 30);
    ctx.fillStyle = GOLD;
    ctx.fillText("My taste", M + 40, boxY + 46);
    const taste = fitLines(ctx, tasteLine, CARD_W - M * 2 - 40, 2, [48, 42, 38], 700);
    ctx.font = font(700, taste.size);
    ctx.fillStyle = WHITE;
    setTracking(ctx, -0.015 * taste.size);
    taste.lines.forEach((line, i) => ctx.fillText(line, M + 40, boxY + 46 + 26 + taste.size * (0.85 + i * 1.12)));
    setTracking(ctx, 0);
  }

  drawFooter(ctx);
  return toBlob(canvas);
}

export type ShareResult = "shared" | "downloaded" | "cancelled" | "failed";

/**
 * Share the image with the native share sheet when files can be shared
 * (mobile Safari/Chrome), otherwise download it. Never throws.
 * "cancelled" means the person closed the share sheet — not an error.
 */
export async function shareOrDownload(blob: Blob, filename: string, text: string): Promise<ShareResult> {
  try {
    const file = new File([blob], filename, { type: "image/png" });
    const data: ShareData = { files: [file], text };
    if (typeof navigator !== "undefined" && navigator.canShare?.({ files: [file] }) && navigator.share) {
      try {
        await navigator.share(data);
        return "shared";
      } catch (err) {
        const name = (err as DOMException | undefined)?.name;
        if (name === "AbortError") return "cancelled";
        // NotAllowedError (gesture expired) or anything else: fall through to download.
      }
    }
    return download(blob, filename) ? "downloaded" : "failed";
  } catch {
    return "failed";
  }
}

function download(blob: Blob, filename: string) {
  try {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.rel = "noopener";
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
    return true;
  } catch {
    return false;
  }
}

/* ───────────── drawing helpers ───────────── */

function makeCanvas() {
  const canvas = document.createElement("canvas");
  canvas.width = CARD_W;
  canvas.height = CARD_H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D is not available");
  ctx.textBaseline = "alphabetic";
  ctx.imageSmoothingQuality = "high";
  return { canvas, ctx };
}

function toBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not encode the card"))), "image/png"),
  );
}

/** Indigo base, a soft glow top-right, and faint adire resist-dye rings (as in .hero). */
function drawBackground(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = INDIGO;
  ctx.fillRect(0, 0, CARD_W, CARD_H);

  const cx = CARD_W * 1.08;
  const cy = CARD_H * -0.1;
  const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, CARD_W * 1.05);
  glow.addColorStop(0, INDIGO_GLOW);
  glow.addColorStop(1, "rgb(45 65 150 / 0)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, CARD_W, CARD_H);

  ctx.strokeStyle = "rgb(255 255 255 / 0.07)";
  ctx.lineWidth = 3;
  const maxR = Math.hypot(cx, CARD_H - cy);
  for (let r = 34; r < maxR; r += 34) {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
  }
}

function drawMeter(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, have: number, total: number) {
  const gap = 10;
  const bw = (w - gap * (total - 1)) / total;
  for (let i = 0; i < total; i++) {
    roundRect(ctx, x + i * (bw + gap), y, bw, 16, 8);
    ctx.fillStyle = i < have ? GOLD : WHITE_18;
    ctx.fill();
  }
}

function drawFooter(ctx: CanvasRenderingContext2D) {
  const y = CARD_H - M - 56;
  ctx.fillStyle = "rgb(255 255 255 / 0.16)";
  ctx.fillRect(M, y - 36, CARD_W - M * 2, 2);
  drawJar(ctx, M, y, 56);
  ctx.font = font(800, 40);
  ctx.fillStyle = WHITE;
  setTracking(ctx, -0.8);
  ctx.fillText("PantryRoots", M + 56 + 20, y + 42);
  setTracking(ctx, 0);
  ctx.font = font(500, 30);
  ctx.fillStyle = WHITE_60;
  const tag = "Cook from what you have";
  ctx.fillText(tag, CARD_W - M - ctx.measureText(tag).width, y + 40);
}

/** The app logo (jar with a gold contents line), inverted to a white tile for the indigo card. */
function drawJar(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
  const s = size / 28;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  roundRect(ctx, 1, 1, 26, 26, 8);
  ctx.fillStyle = WHITE;
  ctx.fill();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = INDIGO;
  ctx.lineWidth = 1.9;
  ctx.stroke(new Path2D("M9 9.5h10v9a2.5 2.5 0 0 1-2.5 2.5h-5A2.5 2.5 0 0 1 9 18.5z"));
  ctx.stroke(new Path2D("M8 7h12"));
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 2.4;
  ctx.stroke(new Path2D("M11 14.5h6"));
  ctx.restore();
}

async function drawRankRow(
  ctx: CanvasRenderingContext2D,
  pick: BattlePick,
  i: number,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  const first = i === 0;
  const pad = first ? 36 : 28;
  roundRect(ctx, x, y, w, h, 32);
  ctx.fillStyle = first ? "rgb(255 255 255 / 0.1)" : "rgb(255 255 255 / 0.05)";
  ctx.fill();
  if (first) {
    ctx.strokeStyle = GOLD;
    ctx.lineWidth = 4;
    roundRect(ctx, x + 2, y + 2, w - 4, h - 4, 30);
    ctx.stroke();
  }

  // Rank numeral
  const numSize = first ? 120 : 80;
  ctx.font = font(800, numSize);
  ctx.fillStyle = first ? GOLD : WHITE_60;
  setTracking(ctx, -0.04 * numSize);
  const num = String(i + 1);
  const numW = first ? 96 : 72;
  ctx.textBaseline = "middle";
  ctx.fillText(num, x + pad + (numW - ctx.measureText(num).width) / 2, y + h / 2 + numSize * 0.04);
  setTracking(ctx, 0);

  // Plate on the right, when we have the recipe.
  const plateDish = pick.dishId ? dishById[pick.dishId] : undefined;
  const plateSize = Math.min(h - pad * 2, first ? 220 : 150);
  let textRight = x + w - pad;
  if (plateDish) {
    await drawPlate(ctx, plateDish, x + w - pad - plateSize, y + (h - plateSize) / 2, plateSize, first ? 6 : 4);
    textRight -= plateSize + 28;
  }

  // Name + origin
  const tx = x + pad + numW + (first ? 32 : 28);
  const tw = textRight - tx;
  const nameSize = first ? 64 : 48;
  const name = fitLines(ctx, pick.dish, tw, 2, first ? [64, 56, 50] : [48, 44, 40], 800);
  const originSize = first ? 32 : 28;
  const blockH = name.lines.length * name.size * 1.05 + 14 + originSize;
  let ty = y + (h - blockH) / 2;
  ctx.textBaseline = "top";
  ctx.font = font(800, name.size);
  ctx.fillStyle = WHITE;
  setTracking(ctx, -0.025 * nameSize);
  for (const line of name.lines) {
    ctx.fillText(line, tx, ty);
    ty += name.size * 1.05;
  }
  setTracking(ctx, 0);
  ty += 14;
  ctx.font = font(500, originSize);
  ctx.fillStyle = WHITE_78;
  ctx.fillText(ellipsize(ctx, pick.origin, tw), tx, ty);
  ctx.textBaseline = "alphabetic";
}

async function drawPlate(ctx: CanvasRenderingContext2D, dish: Dish, x: number, y: number, size: number, halo: number) {
  const r = size / 2;
  // Halo, like .hero .plate-art
  ctx.beginPath();
  ctx.arc(x + r, y + r, r + halo, 0, Math.PI * 2);
  ctx.fillStyle = "rgb(255 255 255 / 0.14)";
  ctx.fill();
  try {
    const img = await plateImage(dish, size);
    ctx.drawImage(img, x, y, size, size);
  } catch {
    // Fall back to a plain plate in the dish's tone so the card still works.
    ctx.beginPath();
    ctx.arc(x + r, y + r, r, 0, Math.PI * 2);
    ctx.fillStyle = WHITE;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + r, y + r, r * 0.62, 0, Math.PI * 2);
    ctx.fillStyle = TONE_FALLBACK[dish.tone] ?? "#d9a13a";
    ctx.fill();
  }
}

const TONE_FALLBACK: Record<string, string> = {
  red: "#c8402a",
  orange: "#df7a2c",
  gold: "#d9a13a",
  green: "#4e7a3a",
  brown: "#85573a",
  cream: "#e6dcc4",
};

/** Render <PlateArt> off-screen, inline its CSS variables, and load it as an image. */
async function plateImage(dish: Dish, size: number): Promise<HTMLImageElement> {
  const host = document.createElement("div");
  host.setAttribute("aria-hidden", "true");
  host.style.cssText = "position:fixed;left:-10000px;top:0;width:0;height:0;overflow:hidden;pointer-events:none;";
  document.body.appendChild(host);
  const root = createRoot(host);
  let markup = "";
  try {
    flushSync(() => root.render(createElement(PlateArt, { dish, size })));
    const svg = host.querySelector("svg");
    if (!svg) throw new Error("PlateArt did not render");
    const clone = svg.cloneNode(true) as SVGSVGElement;
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    clone.setAttribute("width", String(size));
    clone.setAttribute("height", String(size));
    markup = resolveVars(new XMLSerializer().serializeToString(clone), svg);
  } finally {
    root.unmount();
    host.remove();
  }
  return loadImage(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`);
}

function resolveVars(markup: string, el: Element) {
  const cs = getComputedStyle(el);
  return markup.replace(/var\(\s*(--[\w-]+)\s*(?:,\s*([^)]+))?\)/g, (_m, name: string, fallback?: string) => {
    return PLATE_VARS[name] ?? (cs.getPropertyValue(name).trim() || fallback?.trim() || "#000");
  });
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not load plate image"));
    img.src = src;
  });
}

/* ───────────── text ───────────── */

async function fontsReady() {
  if (typeof document === "undefined" || !document.fonts) return;
  const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
  try {
    await Promise.race([
      Promise.all([
        document.fonts.load(font(800, 80)),
        document.fonts.load(font(700, 40)),
        document.fonts.load(font(600, 32)),
        document.fonts.load(font(500, 32)),
      ]).then(() => document.fonts.ready),
      wait(2500),
    ]);
  } catch {
    /* fall back to system fonts */
  }
}

function setTracking(ctx: CanvasRenderingContext2D, px: number) {
  const c = ctx as CanvasRenderingContext2D & { letterSpacing?: string };
  if ("letterSpacing" in c) c.letterSpacing = `${px.toFixed(1)}px`;
}

/** Pick the largest size at which `text` wraps into at most `maxLines` lines. */
function fitLines(ctx: CanvasRenderingContext2D, text: string, maxW: number, maxLines: number, sizes: number[], weight: number) {
  for (const size of sizes) {
    ctx.font = font(weight, size);
    setTracking(ctx, -0.03 * size);
    const lines = wrap(ctx, text, maxW);
    if (lines.length <= maxLines && lines.every((l) => ctx.measureText(l).width <= maxW)) {
      setTracking(ctx, 0);
      return { size, lines };
    }
  }
  const size = sizes[sizes.length - 1];
  ctx.font = font(weight, size);
  setTracking(ctx, -0.03 * size);
  const lines = wrap(ctx, text, maxW).slice(0, maxLines);
  lines[maxLines - 1] = ellipsize(ctx, lines.slice(maxLines - 1).join(" ") + "…", maxW);
  setTracking(ctx, 0);
  return { size, lines };
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (line && ctx.measureText(next).width > maxW) {
      lines.push(line);
      line = w;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

function ellipsize(ctx: CanvasRenderingContext2D, text: string, maxW: number) {
  if (ctx.measureText(text).width <= maxW) return text;
  let t = text.replace(/…$/, "");
  while (t.length > 1 && ctx.measureText(`${t}…`).width > maxW) t = t.slice(0, -1);
  return `${t.trimEnd()}…`;
}

export function originOf(dish: Dish) {
  const p = peopleById[dish.peopleId];
  return p ? `${p.name}, ${p.area}` : dish.origin ?? "";
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}
