import { CodedError } from '../errors';
import type { Scene } from '../contracts/types';
import type { FrameSource } from '../render/frameSource';

/** Histogram RGB (bins³ przedziałów), znormalizowany do sumy 1. */
export function rgbHistogram(data: ArrayLike<number>, bins = 4): Float32Array {
  const h = new Float32Array(bins ** 3);
  let n = 0;
  for (let i = 0; i + 2 < data.length; i += 4) {
    const r = Math.min(bins - 1, (data[i] * bins) >> 8);
    const g = Math.min(bins - 1, (data[i + 1] * bins) >> 8);
    const b = Math.min(bins - 1, (data[i + 2] * bins) >> 8);
    h[(r * bins + g) * bins + b]++;
    n++;
  }
  if (n) for (let k = 0; k < h.length; k++) h[k] /= n;
  return h;
}

/** Odległość 0..1 (połowa normy L1). */
export function histDistance(a: Float32Array, b: Float32Array): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += Math.abs(a[i] - b[i]);
  return s / 2;
}

export interface CutOptions {
  threshold: number;
  minScene: number;
}

export const DEFAULT_CUTS: CutOptions = { threshold: 0.35, minScene: 1 };

export function sceneLabel(i: number): string {
  return `Scene ${String(i + 1).padStart(2, '0')}`;
}

/** Cięcie = duża zmiana histogramu między kolejnymi próbkami klatek. */
export function detectCuts(
  hists: ReadonlyArray<{ t: number; h: Float32Array }>,
  duration: number,
  opts: CutOptions = DEFAULT_CUTS,
): Scene[] {
  const cuts = [0];
  for (let i = 1; i < hists.length; i++) {
    const d = histDistance(hists[i - 1].h, hists[i].h);
    if (d > opts.threshold && hists[i].t - cuts[cuts.length - 1] >= opts.minScene) cuts.push(hists[i].t);
  }
  return cuts
    .map((start, i) => ({ id: `scene_${String(i + 1).padStart(2, '0')}`, start, end: cuts[i + 1] ?? duration, source: 'auto' as const }))
    .filter((s) => s.end > s.start);
}

const SEGMENT_LENGTHS = [10, 15, 20, 30, 60, 120, 300, 600];
const MAX_SEGMENTS = 12;

/** Długość odcinka (s) tak, aby materiał dzielił się na co najwyżej 12 części (§5.14). */
export function segmentLength(duration: number): number {
  return SEGMENT_LENGTHS.find((l) => duration / l <= MAX_SEGMENTS) ?? Math.ceil(duration / MAX_SEGMENTS);
}

/**
 * Równe odcinki zamiast wykrytych scen — gdy klatek filmu nie da się odczytać (YouTube bez
 * lokalnej kopii). Końcówka krótsza niż 1/3 odcinka jest dołączana do poprzedniego.
 */
export function fixedScenes(duration: number, len: number): Scene[] {
  if (!(duration > 0) || !(len > 0)) return [];
  const starts: number[] = [];
  for (let t = 0; t < duration; t += len) starts.push(t);
  if (starts.length > 1 && duration - starts[starts.length - 1] < len / 3) starts.pop();
  return starts.map((start, i) => ({
    id: `scene_${String(i + 1).padStart(2, '0')}`,
    start,
    end: starts[i + 1] ?? duration,
    source: 'manual' as const,
  }));
}

/** Analiza materiału w przeglądarce: klatki 32×18 → histogramy RGB 4³ → cięcia (§5.14). */
export async function detectScenes(
  src: FrameSource,
  opts: { step?: number; onProgress?: (p: number) => void } = {},
): Promise<Scene[]> {
  await src.ready;
  const duration = src.duration;
  const step = opts.step ?? Math.max(0.25, duration / 1200);
  const canvas = document.createElement('canvas');
  canvas.width = 32;
  canvas.height = 18;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new CodedError('canvas_unsupported');
  const hists: Array<{ t: number; h: Float32Array }> = [];
  for (let t = 0; t < duration; t += step) {
    await src.drawFrame(ctx, t, 32, 18);
    hists.push({ t, h: rgbHistogram(ctx.getImageData(0, 0, 32, 18).data) });
    opts.onProgress?.(t / duration);
  }
  opts.onProgress?.(1);
  return detectCuts(hists, duration);
}
