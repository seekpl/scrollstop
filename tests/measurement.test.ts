import { describe, expect, it } from 'vitest';
import { DESKTOP_PLAN, MOBILE_PLAN, planDurationMs, qualityFromTest, TEST_THRESHOLDS } from '../src/core/calibration/calibration';
import { MEASUREMENT } from '../src/core/config';
import { CodedError, errorCode } from '../src/core/errors';
import { estimateDistanceCm, type FaceObservation } from '../src/core/tracking/features';
import { DEMO_IDS, DEMO_SPECS } from '../src/demo/demoScene';
import { assessPositioning } from '../src/features/shared/positioning';

describe('progi dla dorosłych (core/config.ts)', () => {
  it('odległość liczona z rozstawem źrenic dorosłego 6,3 cm', () => {
    expect(MEASUREMENT.interPupillaryCm).toBe(6.3);
    // scale = E / (d · 2 · tan(32,5°)) → dla d = 60 cm
    const scale = 6.3 / (60 * 2 * Math.tan((32.5 * Math.PI) / 180));
    expect(estimateDistanceCm(scale)).toBeCloseTo(60, 5);
    expect(Number.isNaN(estimateDistanceCm(0))).toBe(true);
  });

  it('progi jakości ostrzejsze niż dla dzieci (8/10, 15/17)', () => {
    expect(TEST_THRESHOLDS.good.x).toBeLessThan(8);
    expect(TEST_THRESHOLDS.fair.x).toBeLessThan(15);
    const mk = (x: number, y: number) => ({ xPct: x, yPct: y, euclid: 0, perPoint: [] });
    expect(qualityFromTest(mk(TEST_THRESHOLDS.good.x, TEST_THRESHOLDS.good.y))).toBe('GOOD');
    expect(qualityFromTest(mk(TEST_THRESHOLDS.fair.x, TEST_THRESHOLDS.fair.y))).toBe('FAIR');
    expect(qualityFromTest(mk(TEST_THRESHOLDS.fair.x + 0.1, 1))).toBe('POOR');
  });

  it('plany kalibracji: komputer 10 pozycji z marginesem 8%, telefon 13%/10%, 5 i 4 punkty testowe', () => {
    expect(DESKTOP_PLAN.points).toHaveLength(10);
    expect(MOBILE_PLAN.points).toHaveLength(10);
    expect(DESKTOP_PLAN.points[1]).toMatchObject({ x: 0.08, y: 0.08 });
    expect(MOBILE_PLAN.points[1]).toMatchObject({ x: 0.13, y: 0.1 });
    expect(DESKTOP_PLAN.points[0].id).toBe(DESKTOP_PLAN.points[5].id);
    expect(DESKTOP_PLAN.test).toHaveLength(5);
    expect(MOBILE_PLAN.test).toHaveLength(4);
    expect(DESKTOP_PLAN.targetSize).toBe(92);
    expect(MOBILE_PLAN.targetSize).toBe(66);
    // Komputer ok. 40 s, telefon ok. 35 s (z testem).
    expect(planDurationMs(DESKTOP_PLAN) / 1000).toBeCloseTo(42, 0);
    expect(planDurationMs(MOBILE_PLAN) / 1000).toBeCloseTo(33.6, 0);
  });
});

describe('ustawienie przed kamerą (§10.5)', () => {
  const face = (cx: number, cy: number, scale: number, eyesOpen = true) =>
    ({ center: { x: cx, y: cy }, scale, eyesOpen, features: [], pose: { yaw: 0, pitch: 0, roll: 0 }, ear: 0.3, blink: 0, debug: { irisL: { x: 0, y: 0 }, irisR: { x: 0, y: 0 }, eyePoints: [] } }) as FaceObservation;
  const scaleAt = (cm: number) => 6.3 / (cm * 2 * Math.tan((32.5 * Math.PI) / 180));

  it('telefon 20–55 cm, komputer 45–85 cm', () => {
    expect(assessPositioning(face(0.5, 0.4, scaleAt(35)), 120, 'mobile', 900).distance).toBe('ok');
    expect(assessPositioning(face(0.5, 0.4, scaleAt(15)), 120, 'mobile', 900).distance).toBe('near');
    expect(assessPositioning(face(0.5, 0.4, scaleAt(35)), 120, 'desktop', 900).distance).toBe('near');
    expect(assessPositioning(face(0.5, 0.4, scaleAt(95)), 120, 'desktop', 900).distance).toBe('far');
  });

  it('środek kadru, jasność, brak twarzy', () => {
    expect(assessPositioning(face(0.5, 0.4, scaleAt(60)), 120, 'desktop', 0).centered).toBe(true);
    expect(assessPositioning(face(0.85, 0.4, scaleAt(60)), 120, 'desktop', 0).centered).toBe(false);
    expect(assessPositioning(face(0.5, 0.4, scaleAt(60)), 60, 'desktop', 0).dark).toBe(true);
    const none = assessPositioning(null, null, 'desktop', 0);
    expect(none).toMatchObject({ face: false, eyes: false, distance: 'unknown', dark: false });
  });
});

describe('kody błędów', () => {
  it('CodedError i errorCode', () => {
    expect(errorCode(new CodedError('camera_denied'))).toBe('camera_denied');
    expect(errorCode({ code: 'bad_code' })).toBe('bad_code');
    expect(errorCode(new Error('x'))).toBe('unknown');
  });
});

describe('klipy demo (§23)', () => {
  it('rolka 15 s 9:16, film 60 s 16:9 z 5 scenami, 5 wypełniaczy, 6 miniatur', () => {
    expect(DEMO_SPECS.reel).toMatchObject({ duration: 15, w: 1080, h: 1920, sharedFrom: 3 });
    expect(DEMO_SPECS.video).toMatchObject({ duration: 60, w: 1920, h: 1080 });
    expect(DEMO_SPECS.video.cuts).toHaveLength(5);
    expect(DEMO_IDS.filter((d) => d.startsWith('filler'))).toHaveLength(5);
    expect(DEMO_IDS.filter((d) => d.startsWith('thumb')).every((d) => DEMO_SPECS[d].kind === 'image')).toBe(true);
    // Strefy rolki: twarz, hook, napisy (w strefie zasłoniętej), produkt, CTA, logo.
    expect(DEMO_SPECS.reel.aois.map((a) => a.key)).toEqual(['face', 'hook', 'captions', 'product', 'cta', 'logo']);
  });

  it('cel wzroku jest deterministyczny i w kadrze', () => {
    for (const id of DEMO_IDS) {
      const spec = DEMO_SPECS[id];
      for (let t = 0; t <= spec.duration; t += 0.7) {
        const a = spec.target(t);
        expect(a).toEqual(spec.target(t));
        expect(a.x).toBeGreaterThanOrEqual(0);
        expect(a.x).toBeLessThanOrEqual(1);
        expect(a.y).toBeGreaterThanOrEqual(0);
        expect(a.y).toBeLessThanOrEqual(1);
      }
    }
  });
});
