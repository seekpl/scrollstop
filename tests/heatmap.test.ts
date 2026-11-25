import { describe, expect, it } from 'vitest';
import { colorize, computeDensity, DEFAULT_DENSITY, normalizeDensity, selectRange } from '../src/core/analysis/heatmap';
import { cluster, makeSample } from './helpers';

function argmax(grid: Float32Array, w: number) {
  let best = 0;
  for (let i = 1; i < grid.length; i++) if (grid[i] > grid[best]) best = i;
  return { x: (best % w) / w, y: Math.floor(best / w) / (grid.length / w) };
}

describe('heat mapa', () => {
  const samples = [...cluster(0, 3, 0.5, 0.5), ...cluster(3, 6, 0.2, 0.55, 0.005, 4), ...cluster(6, 9, 0.82, 0.2, 0.005, 5)];

  it('filtruje próbki do zakresu czasu i odrzuca nieważne', () => {
    const extra = [
      makeSample({ t: 4, x: null, y: null, vx: null, vy: null, flags: ['blink'] }),
      makeSample({ t: 4.1, videoState: 'paused' }),
      makeSample({ t: 4.2, confidence: 0.05 }),
      makeSample({ t: 4.3, vx: null, vy: null, flags: ['outside_video'] }),
    ];
    const sel = selectRange([...samples, ...extra], 3, 6);
    expect(sel.length).toBeGreaterThan(80);
    expect(sel.every((s) => (s.videoTime as number) >= 3 && (s.videoTime as number) <= 6)).toBe(true);
    expect(sel.every((s) => s.vx !== null && s.videoState === 'playing' && s.confidence >= 0.2)).toBe(true);
  });

  it('heat mapę można wygenerować dla zakresu czasu — maksimum leży tam, gdzie patrzono', () => {
    const d = computeDensity(selectRange(samples, 3, 6));
    const peak = argmax(d.grid, d.w);
    expect(peak.x).toBeCloseTo(0.2, 1);
    expect(peak.y).toBeCloseTo(0.55, 1);
    expect(d.validSeconds).toBeGreaterThan(2.5);
    const d2 = computeDensity(selectRange(samples, 6, 9));
    expect(argmax(d2.grid, d2.w).x).toBeCloseTo(0.82, 1);
  });

  it('większa niepewność rozmywa mapę (niższe maksimum przy tej samej masie)', () => {
    const sharp = cluster(0, 2, 0.5, 0.5).map((s) => ({ ...s, uncertainty: 0.01 }));
    const blurry = sharp.map((s) => ({ ...s, uncertainty: 0.1 }));
    const a = computeDensity(sharp);
    const b = computeDensity(blurry);
    expect(Math.max(...b.grid)).toBeLessThan(Math.max(...a.grid) / 3);
    const noUnc = computeDensity(blurry, { ...DEFAULT_DENSITY, useUncertainty: false });
    expect(Math.max(...noUnc.grid)).toBeCloseTo(Math.max(...a.grid), 0);
  });

  it('normalizacja i kolorowanie: tło przezroczyste, szczyt czerwony', () => {
    const d = computeDensity(selectRange(samples, 0, 3));
    const n = normalizeDensity(d);
    const rgba = colorize(n, 'inferno');
    expect(rgba.length).toBe(d.w * d.h * 4);
    expect(rgba[3]).toBe(0);
    const i = n.indexOf(1);
    expect(rgba[i * 4]).toBeGreaterThan(200);
    expect(rgba[i * 4 + 3]).toBeGreaterThan(150);
  });

  it('pusty zakres daje pustą mapę bez błędów', () => {
    const d = computeDensity(selectRange(samples, 50, 60));
    expect(d.n).toBe(0);
    expect(normalizeDensity(d).every((v) => v === 0)).toBe(true);
  });
});
