/**
 * Pull a handful of evenly spaced still frames out of a short video, in the browser,
 * so a "fridge sweep" can go to the vision model as several JPEGs in one request.
 *
 * Works with phone recordings (iOS needs muted + playsInline) and with MediaRecorder
 * webm files whose duration is reported as Infinity until you seek to the end.
 */

export type FrameOptions = {
  /** Frames to keep. Keep this ≤ 5 for the live model; the server accepts up to 6. */
  count?: number;
  /** Longest side of each frame, in px. */
  maxSide?: number;
  /** JPEG quality, 0–1. */
  quality?: number;
  /** Upper bound for the combined length of all data URLs; frames are shrunk until they fit. */
  maxTotalChars?: number;
  /** Called after each frame is read. */
  onProgress?: (done: number, total: number) => void;
};

export class VideoReadError extends Error {}

const wait = <T>(p: Promise<T>, ms: number, what: string) =>
  Promise.race([p, new Promise<never>((_, reject) => setTimeout(() => reject(new VideoReadError(`timed out waiting for ${what}`)), ms))]);

function once(el: HTMLMediaElement, event: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const ok = () => {
      el.removeEventListener("error", bad);
      resolve();
    };
    const bad = () => {
      el.removeEventListener(event, ok);
      reject(new VideoReadError("this video format can't be read here"));
    };
    el.addEventListener(event, ok, { once: true });
    el.addEventListener("error", bad, { once: true });
  });
}

async function seek(video: HTMLVideoElement, t: number) {
  if (Math.abs(video.currentTime - t) < 0.001 && video.readyState >= 2) return;
  const done = once(video, "seeked");
  video.currentTime = t;
  await wait(done, 5000, "the video to seek");
}

/** Some recorders (MediaRecorder webm) report Infinity until the end has been reached once. */
async function realDuration(video: HTMLVideoElement): Promise<number> {
  if (Number.isFinite(video.duration) && video.duration > 0) return video.duration;
  const known = new Promise<void>((resolve) => {
    const check = () => {
      if (Number.isFinite(video.duration) && video.duration > 0) {
        video.removeEventListener("durationchange", check);
        video.removeEventListener("seeked", check);
        resolve();
      }
    };
    video.addEventListener("durationchange", check);
    video.addEventListener("seeked", check);
  });
  video.currentTime = 1e7;
  await wait(known, 5000, "the video length").catch(() => undefined);
  // Let that seek finish so its 'seeked' event isn't mistaken for the next one.
  if (video.seeking) await wait(once(video, "seeked"), 3000, "the video to settle").catch(() => undefined);
  const d = video.duration;
  if (!Number.isFinite(d) || d <= 0) throw new VideoReadError("couldn't tell how long the video is");
  return d;
}

/** 16×16 greyscale fingerprint for spotting black and near-identical frames. */
function fingerprint(source: CanvasImageSource): Uint8ClampedArray {
  const c = document.createElement("canvas");
  c.width = c.height = 16;
  const g = c.getContext("2d", { willReadFrequently: true })!;
  g.drawImage(source, 0, 0, 16, 16);
  const px = g.getImageData(0, 0, 16, 16).data;
  const out = new Uint8ClampedArray(256);
  for (let i = 0; i < 256; i++) out[i] = (px[i * 4] * 0.299 + px[i * 4 + 1] * 0.587 + px[i * 4 + 2] * 0.114) | 0;
  return out;
}

const mean = (a: Uint8ClampedArray) => a.reduce((s, v) => s + v, 0) / a.length;
const diff = (a: Uint8ClampedArray, b: Uint8ClampedArray) => {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += Math.abs(a[i] - b[i]);
  return s / a.length;
};

function encode(source: HTMLCanvasElement, maxSide: number, quality: number) {
  const scale = Math.min(1, maxSide / Math.max(source.width, source.height));
  const c = document.createElement("canvas");
  c.width = Math.max(1, Math.round(source.width * scale));
  c.height = Math.max(1, Math.round(source.height * scale));
  c.getContext("2d")!.drawImage(source, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", quality);
}

/**
 * Read `count` evenly spaced frames from a video file and return them as JPEG data URLs.
 * Skips black frames and frames that look the same as the one before when it can.
 */
export async function extractFrames(file: Blob, opts: FrameOptions = {}): Promise<string[]> {
  const count = Math.max(1, Math.min(6, opts.count ?? 5));
  let maxSide = opts.maxSide ?? 1024;
  let quality = opts.quality ?? 0.72;
  const maxTotal = opts.maxTotalChars ?? 2_900_000;

  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.muted = true;
  video.defaultMuted = true;
  video.playsInline = true;
  video.setAttribute("playsinline", "");
  video.setAttribute("webkit-playsinline", "");
  video.setAttribute("muted", "");
  video.preload = "auto";
  video.crossOrigin = "anonymous";

  try {
    const loaded = once(video, "loadeddata");
    video.src = url;
    video.load();
    await wait(loaded, 10_000, "the video to load");
    // iOS Safari won't paint a frame for seeking until playback has started once.
    try {
      await wait(video.play(), 1500, "playback");
    } catch {
      /* autoplay refused or slow — seeking usually still works */
    }
    video.pause();

    const duration = await realDuration(video);
    const w = video.videoWidth;
    const h = video.videoHeight;
    if (!w || !h) throw new VideoReadError("the video has no picture");

    // Sample a few extra spots so skipped frames can be replaced.
    const candidates = Math.min(count + 2, 8);
    const times = Array.from({ length: candidates }, (_, i) => Math.min(duration - 0.05, Math.max(0.05, (duration * (i + 0.5)) / candidates)));

    const canvas = document.createElement("canvas");
    const scale = Math.min(1, maxSide / Math.max(w, h));
    canvas.width = Math.round(w * scale);
    canvas.height = Math.round(h * scale);
    const ctx = canvas.getContext("2d")!;

    type Shot = { at: number; frame: HTMLCanvasElement; print: Uint8ClampedArray };
    const shots: Shot[] = [];
    for (let i = 0; i < times.length; i++) {
      await seek(video, times[i]);
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const print = fingerprint(canvas);
      const copy = document.createElement("canvas");
      copy.width = canvas.width;
      copy.height = canvas.height;
      copy.getContext("2d")!.drawImage(canvas, 0, 0);
      shots.push({ at: i, frame: copy, print });
      opts.onProgress?.(Math.min(count, Math.round(((i + 1) / times.length) * count)), count);
    }

    // Drop black frames, then near-duplicates of the previous kept frame.
    let kept = shots.filter((s) => mean(s.print) > 14);
    if (!kept.length) throw new VideoReadError("the video looks too dark");
    kept = kept.filter((s, i, arr) => i === 0 || diff(s.print, arr[i - 1].print) > 4);
    // Too many left? Keep an evenly spread subset.
    if (kept.length > count) {
      const step = kept.length / count;
      kept = Array.from({ length: count }, (_, i) => kept[Math.floor(i * step + step / 2)]);
    }

    // Encode, shrinking until the whole set fits the request budget.
    for (let tries = 0; tries < 6; tries++) {
      const out = kept.map((s) => encode(s.frame, maxSide, quality));
      const total = out.reduce((n, d) => n + d.length, 0);
      if (total <= maxTotal) return out;
      maxSide = Math.round(maxSide * 0.8);
      quality = Math.max(0.5, quality - 0.06);
    }
    throw new VideoReadError("the frames are too large to send");
  } finally {
    video.removeAttribute("src");
    video.load();
    URL.revokeObjectURL(url);
  }
}
