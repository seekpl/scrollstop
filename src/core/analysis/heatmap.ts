import { isValidSample, type GazeSample } from '../contracts/types';
import { clamp } from '../math/util';

/**
 * Heat mapa = ważona estymacja gęstości (KDE).
 * Każda próbka to gaussian o σ = √(σ_jądra² + σ_niepewności²) i wadze confidence × Δt
 * (Δt koryguje zmienną częstotliwość próbkowania kamery).
 */
export interface DensityOptions {
  gridW: number;
  gridH: number;
  baseSigma: number;
  useUncertainty: boolean;
  maxDt: number;
}

export const DEFAULT_DENSITY: DensityOptions = {
  gridW: 192,
  gridH: 108,
  baseSigma: 0.02,
  useUncertainty: true,
  maxDt: 0.1,
};

export interface Density {
  grid: Float32Array;
  w: number;
  h: number;
  n: number;
  totalWeight: number;
  validSeconds: number;
  meanUncertainty: number;
}

/** Ważne próbki z zakresu czasu materiału [t0, t1], leżące na obrazie materiału. */
export function selectRange(samples: readonly GazeSample[], t0: number, t1: number): GazeSample[] {
  return samples.filter(
    (s) => isValidSample(s) && s.vx !== null && s.vy !== null && (s.videoTime as number) >= t0 && (s.videoTime as number) <= t1,
  );
}

export function computeDensity(samples: readonly GazeSample[], opts: DensityOptions = DEFAULT_DENSITY): Density {
  const { gridW: w, gridH: h } = opts;
  const grid = new Float32Array(w * h);
  const sorted = [...samples].sort((a, b) => a.tCapture - b.tCapture);
  let total = 0;
  let secs = 0;
  let uncSum = 0;
  for (let i = 0; i < sorted.length; i++) {
    const s = sorted[i];
    if (s.vx === null || s.vy === null) continue;
    const next = sorted[i + 1];
    const dt = next ? clamp((next.tCapture - s.tCapture) / 1000, 0, opts.maxDt) : 1 / 30;
    const weight = s.confidence * dt;
    if (weight <= 0) continue;
    const unc = opts.useUncertainty ? (s.uncertainty ?? 0) : 0;
    const sigma = Math.sqrt(opts.baseSigma ** 2 + unc ** 2);
    const sx = Math.max(sigma * w, 0.6);
    const sy = Math.max(sigma * h, 0.6);
    const cx = s.vx * w;
    const cy = s.vy * h;
    const x0 = Math.max(0, Math.floor(cx - 3 * sx));
    const x1 = Math.min(w - 1, Math.ceil(cx + 3 * sx));
    const y0 = Math.max(0, Math.floor(cy - 3 * sy));
    const y1 = Math.min(h - 1, Math.ceil(cy + 3 * sy));
    const norm = weight / (2 * Math.PI * sx * sy);
    for (let yy = y0; yy <= y1; yy++) {
      const dy = (yy + 0.5 - cy) / sy;
      const ey = Math.exp(-0.5 * dy * dy) * norm;
      const row = yy * w;
      for (let xx = x0; xx <= x1; xx++) {
        const dx = (xx + 0.5 - cx) / sx;
        grid[row + xx] += ey * Math.exp(-0.5 * dx * dx);
      }
    }
    total += weight;
    secs += dt;
    uncSum += unc;
  }
  return { grid, w, h, n: sorted.length, totalWeight: total, validSeconds: secs, meanUncertainty: sorted.length ? uncSum / sorted.length : 0 };
}

/** Normalizacja do percentyla (domyślnie 99.) — pojedyncze szczyty nie „wypalają” mapy. */
export function normalizeDensity(d: Density, pct = 0.99): Float32Array {
  const out = new Float32Array(d.grid.length);
  const nz: number[] = [];
  for (const v of d.grid) if (v > 0) nz.push(v);
  if (!nz.length) return out;
  nz.sort((a, b) => a - b);
  const ref = nz[Math.floor(pct * (nz.length - 1))] || nz[nz.length - 1];
  for (let i = 0; i < out.length; i++) out[i] = Math.min(1, d.grid[i] / ref);
  return out;
}

/**
 * Palety sekwencyjne, percepcyjnie równe (§5.15, lekcja §24.12): tęczowa (niebieski → zielony →
 * żółty → czerwony) myli daltonistów, więc jej nie ma. Domyślna: inferno.
 */
export type PaletteName = 'inferno' | 'viridis';

const PALETTES: Record<PaletteName, Array<[number, number, number, number]>> = {
  inferno: [
    [0, 20, 11, 53],
    [0.2, 87, 16, 110],
    [0.4, 159, 42, 99],
    [0.6, 221, 81, 58],
    [0.8, 252, 155, 6],
    [1, 252, 255, 164],
  ],
  viridis: [
    [0, 68, 1, 84],
    [0.25, 59, 82, 139],
    [0.5, 33, 145, 140],
    [0.75, 94, 201, 98],
    [1, 253, 231, 37],
  ],
};

export function paletteColor(name: PaletteName, v: number): [number, number, number] {
  const stops = PALETTES[name];
  const t = clamp(v, 0, 1);
  for (let i = 1; i < stops.length; i++) {
    if (t <= stops[i][0]) {
      const [p0, r0, g0, b0] = stops[i - 1];
      const [p1, r1, g1, b1] = stops[i];
      const u = (t - p0) / (p1 - p0 || 1);
      return [r0 + (r1 - r0) * u, g0 + (g1 - g0) * u, b0 + (b1 - b0) * u];
    }
  }
  const last = stops[stops.length - 1];
  return [last[1], last[2], last[3]];
}

export function paletteCss(name: PaletteName): string {
  return `linear-gradient(90deg, ${PALETTES[name].map(([p, r, g, b]) => `rgb(${r},${g},${b}) ${p * 100}%`).join(', ')})`;
}

/** Gęstość → RGBA. Poniżej progu `cutoff` piksel jest w pełni przezroczysty (brak „mgły” na całej klatce). */
export function colorize(
  norm: Float32Array,
  palette: PaletteName = 'inferno',
  opts: { cutoff?: number; maxAlpha?: number } = {},
): Uint8ClampedArray {
  const cutoff = opts.cutoff ?? 0.03;
  const maxAlpha = opts.maxAlpha ?? 0.9;
  const out = new Uint8ClampedArray(norm.length * 4);
  for (let i = 0; i < norm.length; i++) {
    const v = norm[i];
    if (v < cutoff) continue;
    const [r, g, b] = paletteColor(palette, v);
    // Alfa rośnie płynnie od zera — brak „schodków” na brzegu mapy po przeskalowaniu.
    const a = maxAlpha * Math.min(1, (v - cutoff) / (0.45 - cutoff)) ** 0.6;
    out[i * 4] = r;
    out[i * 4 + 1] = g;
    out[i * 4 + 2] = b;
    out[i * 4 + 3] = a * 255;
  }
  return out;
}
