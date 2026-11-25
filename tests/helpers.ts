import type { GazeSample } from '../src/core/contracts/types';
import { gaussian, mulberry32 } from '../src/core/math/util';

/**
 * Syntetyczny „model oka”: cechy jak z buildObservation, wygenerowane z punktu na ekranie,
 * pozy głowy i szumu. Wzrok = głowa + oko, więc model musi kompensować pozę.
 */
export function synthFeatures(
  x: number,
  y: number,
  rng: () => number,
  pose = { yaw: 0, pitch: 0, roll: 0 },
  noise = 0.004,
): number[] {
  const gx = (x - 0.5) * 0.9 - pose.yaw * 0.012;
  const gy = (y - 0.5) * 0.6 - pose.pitch * 0.012;
  const n = () => noise * gaussian(rng);
  const uR = 0.22 * Math.sin(gx) + 0.02 * gy * gx + n();
  const vR = 0.1 * Math.sin(gy) + 0.03 * gx * gx + n();
  const uL = 0.21 * Math.sin(gx) - 0.01 + n();
  const vL = 0.1 * Math.sin(gy) + 0.025 * gx * gx + n();
  return [uR, vR, uL, vL, pose.yaw, pose.pitch, pose.roll, 0.066 + n() * 0.1, 0.5 + pose.yaw * 0.004, 0.45, 0.32 - 0.08 * gy];
}

export const rng = (seed = 1) => mulberry32(seed);

export function makeSample(p: Partial<GazeSample> & { t: number }): GazeSample {
  const { t, ...rest } = p;
  return {
    tCapture: t * 1000,
    videoTime: t,
    segment: 1,
    videoState: 'playing',
    x: 0.5,
    y: 0.5,
    vx: 0.5,
    vy: 0.5,
    fx: 0.5,
    fy: 0.5,
    confidence: 0.8,
    uncertainty: 0.05,
    faceDetected: true,
    eyesOpen: true,
    quality: 'GOOD',
    flags: [],
    ...rest,
  };
}

/** Seria próbek 30 Hz skupiona wokół (x,y) z danym szumem. */
export function cluster(t0: number, t1: number, x: number, y: number, noise = 0.005, seed = 3): GazeSample[] {
  const r = mulberry32(seed);
  const out: GazeSample[] = [];
  for (let t = t0; t < t1; t += 1 / 30) {
    const px = x + noise * gaussian(r);
    const py = y + noise * gaussian(r);
    out.push(makeSample({ t, x: px, y: py, vx: px, vy: py }));
  }
  return out;
}
