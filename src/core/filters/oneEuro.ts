import type { SmoothingLevel } from '../contracts/types';
import { median } from '../math/util';

/**
 * Filtr One Euro (Casiez, Roussel, Vogel, CHI 2012): mocno wygładza przy wolnym ruchu,
 * mało opóźnia przy szybkim (sakady).
 */
export class OneEuroFilter {
  private xPrev: number | null = null;
  private dxPrev = 0;
  private tPrev: number | null = null;

  constructor(
    readonly minCutoff = 1,
    readonly beta = 0.007,
    readonly dCutoff = 1,
  ) {}

  reset(): void {
    this.xPrev = null;
    this.dxPrev = 0;
    this.tPrev = null;
  }

  filter(x: number, tSec: number): number {
    if (this.xPrev === null || this.tPrev === null) {
      this.xPrev = x;
      this.tPrev = tSec;
      return x;
    }
    const dt = Math.max(tSec - this.tPrev, 1e-3);
    const dx = (x - this.xPrev) / dt;
    const aD = alpha(this.dCutoff, dt);
    const dxHat = aD * dx + (1 - aD) * this.dxPrev;
    const cutoff = this.minCutoff + this.beta * Math.abs(dxHat);
    const a = alpha(cutoff, dt);
    const xHat = a * x + (1 - a) * this.xPrev;
    this.xPrev = xHat;
    this.dxPrev = dxHat;
    this.tPrev = tSec;
    return xHat;
  }
}

function alpha(cutoff: number, dt: number): number {
  const tau = 1 / (2 * Math.PI * cutoff);
  return 1 / (1 + tau / dt);
}

export interface SmoothingPreset {
  minCutoff: number;
  beta: number;
  dCutoff: number;
  /** >1 = filtr medianowy przed One Euro (tłumi pojedyncze skoki). */
  median: number;
}

/** 0 brak, 1 minimalne, 2 normalne (domyślne), 3 mocne. */
export const SMOOTHING_PRESETS: Record<SmoothingLevel, SmoothingPreset | null> = {
  0: null,
  1: { minCutoff: 1.5, beta: 0.01, dCutoff: 1, median: 0 },
  2: { minCutoff: 1.0, beta: 0.007, dCutoff: 1, median: 0 },
  3: { minCutoff: 0.5, beta: 0.003, dCutoff: 1, median: 5 },
};


/** Parametry presetów dobrane dla skali „pikseli” ekranu ~1000 px. */
const SCALE = 1000;
const GAP_RESET_MS = 300;

/** Wygładzanie 2D wyłącznie do prezentacji — analizy liczone są na surowych danych. */
export class GazeSmoother {
  private fx: OneEuroFilter | null = null;
  private fy: OneEuroFilter | null = null;
  private hist: Array<{ x: number; y: number }> = [];
  private lastT: number | null = null;
  private readonly preset: SmoothingPreset | null;

  constructor(readonly level: SmoothingLevel) {
    this.preset = SMOOTHING_PRESETS[level];
    if (this.preset) {
      this.fx = new OneEuroFilter(this.preset.minCutoff, this.preset.beta, this.preset.dCutoff);
      this.fy = new OneEuroFilter(this.preset.minCutoff, this.preset.beta, this.preset.dCutoff);
    }
  }

  reset(): void {
    this.fx?.reset();
    this.fy?.reset();
    this.hist = [];
  }

  push(x: number, y: number, tMs: number): { x: number; y: number } {
    if (this.lastT !== null && tMs - this.lastT > GAP_RESET_MS) this.reset();
    this.lastT = tMs;
    if (!this.preset || !this.fx || !this.fy) return { x, y };
    let mx = x;
    let my = y;
    if (this.preset.median > 1) {
      this.hist.push({ x, y });
      if (this.hist.length > this.preset.median) this.hist.shift();
      mx = median(this.hist.map((h) => h.x));
      my = median(this.hist.map((h) => h.y));
    }
    const t = tMs / 1000;
    return { x: this.fx.filter(mx * SCALE, t) / SCALE, y: this.fy.filter(my * SCALE, t) / SCALE };
  }
}
