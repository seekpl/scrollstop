import { describe, expect, it } from 'vitest';
import { isValidSample } from '../src/core/contracts/types';
import { FULL_RECT } from '../src/core/geometry/coords';
import { SampleBuilder } from '../src/core/pipeline/sampleBuilder';
import { WebcamGazeEstimator } from '../src/core/pipeline/webcamEstimator';
import type { FaceObservation } from '../src/core/tracking/features';
import { buildObservation, poseFromMatrix } from '../src/core/tracking/features';
import type { TrackerFrame } from '../src/core/tracking/faceTracker';
import { gateObservation, RollingQuality } from '../src/core/quality/quality';
import { ManualClock } from '../src/core/time/playbackClock';
import { GazeSmoother } from '../src/core/filters/oneEuro';
import { gaussian, mulberry32 } from '../src/core/math/util';

const ref = { pose: { yaw: 0, pitch: 0, roll: 0 }, scale: 0.066, viewport: { width: 1920, height: 1080 } };
const cal = { baseSigma: 0.05, reference: ref };

function face(over: Partial<FaceObservation> = {}): FaceObservation {
  return {
    features: new Array(11).fill(0),
    pose: { yaw: 0, pitch: 0, roll: 0 },
    scale: 0.066,
    center: { x: 0.5, y: 0.5 },
    ear: 0.3,
    blink: 0.05,
    eyesOpen: true,
    debug: { irisL: { x: 0, y: 0 }, irisR: { x: 0, y: 0 }, eyePoints: [] },
    ...over,
  };
}

const frame = (f: FaceObservation | null, t = 1000): TrackerFrame => ({
  captureTime: t,
  clockSource: 'captureTime',
  face: f,
  inferenceMs: 20,
  width: 1280,
  height: 720,
});

const fixedModel = (x: number, y: number, novelty = 0) => ({ name: 'fixed', predict: () => ({ x, y, novelty }) });

function playingBuilder() {
  const clock = new ManualClock(600);
  clock.play(0);
  return new SampleBuilder(2, clock, () => FULL_RECT);
}

describe('estymacja gaze', () => {
  it('x/y są zawsze w zakresie 0–1 albo null', () => {
    const r = mulberry32(4);
    const builder = playingBuilder();
    for (let i = 0; i < 300; i++) {
      const est = new WebcamGazeEstimator(fixedModel(0.5 + gaussian(r) * 0.4, 0.5 + gaussian(r) * 0.4), cal);
      const s = builder.build(est.estimate(frame(face(), 1000 + i * 33))).sample;
      for (const v of [s.x, s.y, s.vx, s.vy, s.fx, s.fy]) {
        if (v !== null) {
          expect(v).toBeGreaterThanOrEqual(0);
          expect(v).toBeLessThanOrEqual(1);
        }
      }
    }
  });

  it('brak twarzy nie generuje punktu wzroku', () => {
    const est = new WebcamGazeEstimator(fixedModel(0.4, 0.4), cal);
    const raw = est.estimate(frame(null));
    expect(raw).toMatchObject({ x: null, y: null, faceDetected: false });
    expect(raw.flags).toContain('no_face');
    const s = playingBuilder().build(raw).sample;
    expect(isValidSample(s)).toBe(false);
  });

  it('mrugnięcie i odwrócona głowa wstrzymują pomiar', () => {
    const est = new WebcamGazeEstimator(fixedModel(0.4, 0.4), cal);
    expect(est.estimate(frame(face({ eyesOpen: false, blink: 0.9 }))).flags).toContain('blink');
    const turned = est.estimate(frame(face({ pose: { yaw: 40, pitch: 0, roll: 0 } })));
    expect(turned.x).toBeNull();
    expect(turned.flags).toContain('head_pose');
    expect(gateObservation(face({ scale: 0.1 }), ref).flags).toContain('distance');
  });

  it('niska pewność nie jest zapisywana jako prawidłowy pomiar', () => {
    const est = new WebcamGazeEstimator(fixedModel(0.4, 0.4, 1), { ...cal, baseSigma: 0.5 });
    const raw = est.estimate(frame(face({ blink: 0.5 })));
    expect(raw.flags).toContain('low_conf');
    const s = playingBuilder().build(raw).sample;
    expect(s.x).toBeNull();
    expect(isValidSample(s)).toBe(false);
  });

  it('predykcja daleko poza ekranem jest odrzucana', () => {
    const raw = new WebcamGazeEstimator(fixedModel(1.6, 0.5), cal).estimate(frame(face()));
    expect(raw.x).toBeNull();
    expect(raw.flags).toContain('off_screen');
  });

  it('wskaźnik jakości: GOOD przy stabilnych danych, POOR przy ich braku', () => {
    const q = new RollingQuality();
    for (let i = 0; i < 60; i++) q.push(i * 33, true, 0.8);
    expect(q.current()).toBe('GOOD');
    for (let i = 60; i < 130; i++) q.push(i * 33, false, 0);
    expect(q.current()).toBe('POOR');
  });

  it('wygładzanie zmniejsza drgania, poziom 0 przepuszcza surowe dane', () => {
    const r = mulberry32(8);
    const raw = Array.from({ length: 120 }, () => 0.5 + 0.03 * gaussian(r));
    const spread = (xs: number[]) => Math.max(...xs) - Math.min(...xs);
    const s0 = new GazeSmoother(0);
    const s3 = new GazeSmoother(3);
    const out0 = raw.map((x, i) => s0.push(x, 0.5, i * 33).x);
    const out3 = raw.map((x, i) => s3.push(x, 0.5, i * 33).x);
    expect(out0).toEqual(raw);
    expect(spread(out3.slice(20))).toBeLessThan(spread(raw.slice(20)) / 2);
  });
});

describe('ekstrakcja cech z landmarków', () => {
  it('zwraca null bez landmarków irysa i poprawną pozę z macierzy', () => {
    expect(buildObservation(new Array(468).fill({ x: 0.5, y: 0.5 }), 640, 480)).toBeNull();
    const identity = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, -50, 1];
    const p = poseFromMatrix(identity);
    expect(Math.abs(p.yaw) + Math.abs(p.pitch) + Math.abs(p.roll)).toBeCloseTo(0, 6);
  });

  it('przesunięcie irysa w prawo zwiększa cechę u obu oczu', () => {
    const base = Array.from({ length: 478 }, () => ({ x: 0.5, y: 0.5 }));
    const set = (i: number, x: number, y: number) => (base[i] = { x, y });
    // oko prawe (po lewej stronie obrazu) i lewe
    set(33, 0.35, 0.45); set(133, 0.45, 0.45); set(159, 0.4, 0.43); set(145, 0.4, 0.47);
    set(263, 0.65, 0.45); set(362, 0.55, 0.45); set(386, 0.6, 0.43); set(374, 0.6, 0.47);
    [160, 158, 153, 144].forEach((i, k) => set(i, 0.38 + k * 0.01, k < 2 ? 0.43 : 0.47));
    [385, 387, 373, 380].forEach((i, k) => set(i, 0.58 + k * 0.01, k < 2 ? 0.43 : 0.47));
    set(1, 0.5, 0.55);
    const withIris = (dx: number) => {
      const lm = base.map((p) => ({ ...p }));
      for (let i = 468; i < 473; i++) lm[i] = { x: 0.4 + dx, y: 0.45 };
      for (let i = 473; i < 478; i++) lm[i] = { x: 0.6 + dx, y: 0.45 };
      return buildObservation(lm, 1280, 720)!;
    };
    const a = withIris(0);
    const b = withIris(0.01);
    expect(b.features[0]).toBeGreaterThan(a.features[0]);
    expect(b.features[2]).toBeGreaterThan(a.features[2]);
    expect(a.eyesOpen).toBe(true);
  });
});
