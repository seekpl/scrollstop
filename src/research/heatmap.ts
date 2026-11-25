/**
 * Zbiorcze heat mapy (§5.15): gęstość każdego widza normalizujemy do sumy 1, żeby każdy widz
 * miał tę samą wagę. Liczone wprost z formatu kolumnowego, przerzedzone do 10 Hz (§20).
 */
import { DEFAULT_DENSITY, type Density, type DensityOptions } from '../core/analysis/heatmap';
import { GazeCode, type CompactSamples } from './model';

/** Siatka o dłuższym boku 192, dopasowana do proporcji materiału (pion → siatka pionowa). */
export function densityOptionsFor(width: number, height: number): DensityOptions {
  const long = 192;
  const short = 108;
  return height > width
    ? { ...DEFAULT_DENSITY, gridW: Math.round((long * width) / height) || short, gridH: long }
    : { ...DEFAULT_DENSITY, gridW: long, gridH: Math.round((long * height) / width) || short };
}

export interface AggregateDensity extends Density {
  viewers: number;
}

export function aggregateDensityCompact(
  sessions: readonly CompactSamples[],
  t0: number,
  t1: number,
  opts: DensityOptions = DEFAULT_DENSITY,
  maxHz = 10,
  item = 0,
): AggregateDensity {
  const { gridW: w, gridH: h } = opts;
  const grid = new Float32Array(w * h);
  const local = new Float32Array(w * h);
  let used = 0;
  let n = 0;
  let secs = 0;
  let unc = 0;
  for (const c of sessions) {
    local.fill(0);
    let total = 0;
    let count = 0;
    let uncSum = 0;
    let lastT = -Infinity;
    for (let i = 0; i < c.st.length; i++) {
      if (c.st[i] !== GazeCode.LOOK || c.it[i] !== item) continue;
      const vt = c.vt[i];
      if (vt < t0 || vt > t1) continue;
      if (c.tc[i] - lastT < 1000 / maxHz - 1) continue;
      const dt = Math.min(opts.maxDt * 3, lastT === -Infinity ? 1 / maxHz : (c.tc[i] - lastT) / 1000);
      lastT = c.tc[i];
      const weight = (c.cf[i] / 100) * dt;
      if (weight <= 0) continue;
      const u = opts.useUncertainty && c.un[i] >= 0 ? c.un[i] / 1000 : 0;
      const sigma = Math.sqrt(opts.baseSigma ** 2 + u * u);
      const sx = Math.max(sigma * w, 0.6);
      const sy = Math.max(sigma * h, 0.6);
      const cx = (c.vx[i] / 1000) * w;
      const cy = (c.vy[i] / 1000) * h;
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
          local[row + xx] += ey * Math.exp(-0.5 * dx * dx);
        }
      }
      total += weight;
      count++;
      uncSum += u;
      secs += dt;
    }
    if (total <= 0) continue;
    for (let k = 0; k < grid.length; k++) grid[k] += local[k] / total;
    used++;
    n += count;
    unc += uncSum / count;
  }
  return { grid, w, h, n, totalWeight: used, validSeconds: secs, meanUncertainty: used ? unc / used : 0, viewers: used };
}
