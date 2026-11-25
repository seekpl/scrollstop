import { isValidSample, type Fixation, type GazeSample } from '../contracts/types';
import { mean, median } from '../math/util';

/**
 * Detekcja fixacji I-DT liczona w czasie (nie w liczbie próbek), dostosowana do
 * zaszumionych danych z kamery 15–30 Hz: krótka mediana przed detekcją, luki ≤ 100 ms
 * (mrugnięcia) nie przerywają fixacji, dłuższe — przerywają.
 */
export interface FixationOptions {
  minDuration: number;
  maxDispersion: number;
  maxGap: number;
  mergeDistance: number;
  mergeGap: number;
  preMedian: number;
}

export const DEFAULT_FIXATION: FixationOptions = {
  minDuration: 0.15,
  maxDispersion: 0.08,
  maxGap: 0.1,
  mergeDistance: 0.05,
  mergeGap: 0.075,
  preMedian: 5,
};

interface P {
  t: number;
  x: number;
  y: number;
  c: number;
}

export function detectFixations(samples: readonly GazeSample[], options: Partial<FixationOptions> = {}): Fixation[] {
  const o = { ...DEFAULT_FIXATION, ...options };
  const pts = samples
    .filter((s) => isValidSample(s) && s.vx !== null && s.vy !== null)
    .map((s) => ({ t: s.videoTime as number, x: s.vx as number, y: s.vy as number, c: s.confidence, seg: s.segment }))
    .sort((a, b) => a.t - b.t);

  // Podział na ciągłe odcinki.
  const runs: P[][] = [];
  let cur: P[] = [];
  let prevSeg = -1;
  for (const p of pts) {
    if (cur.length && (p.t - cur[cur.length - 1].t > o.maxGap || p.seg !== prevSeg)) {
      runs.push(cur);
      cur = [];
    }
    cur.push({ t: p.t, x: p.x, y: p.y, c: p.c });
    prevSeg = p.seg;
  }
  if (cur.length) runs.push(cur);

  const raw: Omit<Fixation, 'id'>[] = [];
  for (const run0 of runs) {
    const run = medianSmooth(run0, o.preMedian);
    let i = 0;
    while (i < run.length) {
      let j = i;
      while (j < run.length && run[j].t - run[i].t < o.minDuration) j++;
      if (j >= run.length) break;
      if (dispersion(run, i, j) <= o.maxDispersion) {
        while (j + 1 < run.length && dispersion(run, i, j + 1) <= o.maxDispersion) j++;
        raw.push(toFixation(run, i, j));
        i = j + 1;
      } else i++;
    }
  }

  // Scalanie sąsiednich fixacji w tym samym miejscu.
  const merged: Omit<Fixation, 'id'>[] = [];
  for (const f of raw) {
    const last = merged[merged.length - 1];
    if (last && f.start - last.end <= o.mergeGap && Math.hypot(f.x - last.x, f.y - last.y) <= o.mergeDistance) {
      const n = last.nSamples + f.nSamples;
      merged[merged.length - 1] = {
        start: last.start,
        end: f.end,
        x: (last.x * last.nSamples + f.x * f.nSamples) / n,
        y: (last.y * last.nSamples + f.y * f.nSamples) / n,
        duration: f.end - last.start,
        dispersion: Math.max(last.dispersion, f.dispersion),
        nSamples: n,
        meanConfidence: (last.meanConfidence * last.nSamples + f.meanConfidence * f.nSamples) / n,
      };
    } else merged.push(f);
  }
  return merged.map((f, k) => ({ id: k + 1, ...f }));
}

function medianSmooth(run: P[], k: number): P[] {
  if (k <= 1 || run.length < k) return run;
  const h = k >> 1;
  return run.map((p, i) => {
    const w = run.slice(Math.max(0, i - h), Math.min(run.length, i + h + 1));
    return { ...p, x: median(w.map((q) => q.x)), y: median(w.map((q) => q.y)) };
  });
}

function dispersion(run: P[], i: number, j: number): number {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (let k = i; k <= j; k++) {
    const p = run[k];
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  return maxX - minX + (maxY - minY);
}

function toFixation(run: P[], i: number, j: number): Omit<Fixation, 'id'> {
  const seg = run.slice(i, j + 1);
  return {
    start: seg[0].t,
    end: seg[seg.length - 1].t,
    x: mean(seg.map((p) => p.x)),
    y: mean(seg.map((p) => p.y)),
    duration: seg[seg.length - 1].t - seg[0].t,
    dispersion: dispersion(run, i, j),
    nSamples: seg.length,
    meanConfidence: mean(seg.map((p) => p.c)),
  };
}
