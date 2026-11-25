import { isValidSample, type GazeSample } from '../contracts/types';

export interface PathPoint {
  t: number;
  x: number;
  y: number;
}

/** Punkty trajektorii z okna (tEnd − duration, tEnd], w układzie obrazu materiału. */
export function pathWindow(samples: readonly GazeSample[], tEnd: number, duration: number, maxPoints = 900): PathPoint[] {
  const pts = samples
    .filter((s) => isValidSample(s) && s.vx !== null && s.vy !== null)
    .filter((s) => (s.videoTime as number) > tEnd - duration && (s.videoTime as number) <= tEnd)
    .map((s) => ({ t: s.videoTime as number, x: s.vx as number, y: s.vy as number }))
    .sort((a, b) => a.t - b.t);
  if (pts.length <= maxPoints) return pts;
  const step = pts.length / maxPoints;
  return Array.from({ length: maxPoints }, (_, i) => pts[Math.floor(i * step)]);
}
