import { describe, expect, it } from 'vitest';
import {
  baseSigmaFrom,
  buildSchedule,
  CALIBRATION_POINTS,
  evaluateTest,
  failedScheduleItems,
  qualityFromTest,
  referenceFromSamples,
  scheduleDuration,
  SKIP_MS,
  targetAt,
  targetForSample,
  TEST_POINTS,
  type CollectedSample,
} from '../src/core/calibration/calibration';
import { GazeModel } from '../src/core/estimation/gazeModel';
import { MemorySessionStore } from '../src/storage/sessionStore';
import { SessionRecorder } from '../src/core/session/recorder';
import { SCHEMA_VERSION, type CalibrationSummary, type SessionMeta } from '../src/core/contracts/types';
import { rng, synthFeatures } from './helpers';

/** Symuluje przebieg kalibracji: klatki 30 Hz, poza głowy losowo ±6°. */
function simulateCalibration(seed = 11): CollectedSample[] {
  const r = rng(seed);
  const schedule = buildSchedule(CALIBRATION_POINTS);
  const out: CollectedSample[] = [];
  for (let t = 0; t < scheduleDuration(schedule); t += 1000 / 30) {
    const tgt = targetForSample(schedule, t);
    if (!tgt) continue;
    const pose = { yaw: (r() - 0.5) * 12, pitch: (r() - 0.5) * 8, roll: (r() - 0.5) * 4 };
    // Oko trafia w cel (dla przejść — w opóźnioną pozycję celu).
    out.push({
      features: synthFeatures(tgt.target.x, tgt.target.y, r, pose),
      target: tgt.target,
      pointId: tgt.pointId,
      weight: tgt.weight,
      tCapture: t,
      pose,
      scale: 0.066,
      scheduleIndex: tgt.state.index,
    });
  }
  return out;
}

describe('harmonogram kalibracji', () => {
  it('przechodzi przez 10 pozycji w kolejności ze specyfikacji i kończy się', () => {
    const s = buildSchedule(CALIBRATION_POINTS);
    expect(s).toHaveLength(10);
    expect(s[0].point).toMatchObject({ x: 0.5, y: 0.5 });
    expect(s[5].point).toMatchObject({ x: 0.5, y: 0.5 });
    expect(targetAt(s, scheduleDuration(s) + 1).phase).toBe('done');
  });

  it('cel porusza się płynnie, a fixacja zaczyna się po przejściu', () => {
    const s = buildSchedule(CALIBRATION_POINTS);
    const mid = targetAt(s, s[1].tStart + 400);
    expect(mid.phase).toBe('transition');
    expect(mid.x).toBeGreaterThan(0.08);
    expect(mid.x).toBeLessThan(0.5);
    expect(targetAt(s, s[1].tDwell + 10)).toMatchObject({ phase: 'dwell', x: 0.08, y: 0.08 });
  });

  it('pomija pierwsze ms fixacji i nadaje mniejszą wagę próbkom z ruchu celu', () => {
    const s = buildSchedule(CALIBRATION_POINTS);
    expect(targetForSample(s, s[2].tDwell + SKIP_MS - 50)).toBeNull();
    expect(targetForSample(s, s[2].tDwell + SKIP_MS + 50)?.weight).toBe(1);
    expect(targetForSample(s, s[2].tStart + 300)?.weight).toBeLessThan(1);
  });
});

describe('model kalibracyjny', () => {
  it('kalibracja działa: mapowanie przewiduje nowe punkty z małym błędem mimo ruchu głowy', () => {
    const samples = simulateCalibration();
    const { model, report } = GazeModel.fit(samples);
    expect(report.candidates.length).toBeGreaterThan(3);
    expect(Number.isFinite(report.cvError)).toBe(true);

    const r = rng(99);
    const preds = TEST_POINTS.flatMap((p) =>
      Array.from({ length: 30 }, (_, i) => {
        const pose = { yaw: (r() - 0.5) * 10, pitch: (r() - 0.5) * 6, roll: 0 };
        const q = model.predict(synthFeatures(p.x, p.y, r, pose));
        return { pointId: p.id, x: q.x, y: q.y, dwellElapsed: SKIP_MS + i * 33 };
      }),
    );
    const test = evaluateTest(preds, TEST_POINTS);
    expect(test).not.toBeNull();
    expect(test!.xPct).toBeLessThan(5);
    expect(test!.yPct).toBeLessThan(5);
    expect(qualityFromTest(test)).toBe('GOOD');
  });

  it('nowość predykcji rośnie daleko od danych kalibracyjnych', () => {
    const { model } = GazeModel.fit(simulateCalibration(5));
    const r = rng(1);
    const near = model.predict(synthFeatures(0.5, 0.5, r));
    const far = model.predict(synthFeatures(0.5, 0.5, r, { yaw: 60, pitch: 40, roll: 20 }));
    expect(far.novelty).toBeGreaterThanOrEqual(near.novelty);
  });

  it('odrzuca zbyt małą liczbę próbek', () => {
    expect(() => GazeModel.fit(simulateCalibration().slice(0, 5))).toThrow();
  });

  it('wskazuje punkty do powtórzenia, gdy dziecko nie patrzyło', () => {
    const s = buildSchedule(CALIBRATION_POINTS);
    const samples = simulateCalibration().filter((x) => !(x.scheduleIndex === 3 && x.weight >= 1));
    expect(failedScheduleItems(samples, s)).toContain(3);
  });

  it('progi jakości testu: GOOD / FAIR / POOR', () => {
    const mk = (x: number, y: number) => ({ xPct: x, yPct: y, euclid: 0, perPoint: [] });
    // Progi startowe dla dorosłych (core/config.ts): GOOD ≤ 6/8, FAIR ≤ 13/15.
    expect(qualityFromTest(mk(5, 7))).toBe('GOOD');
    expect(qualityFromTest(mk(7, 9))).toBe('FAIR');
    expect(qualityFromTest(mk(12, 14))).toBe('FAIR');
    expect(qualityFromTest(mk(14, 14))).toBe('POOR');
    expect(qualityFromTest(mk(20, 25))).toBe('POOR');
    expect(qualityFromTest(null)).toBe('POOR');
    expect(baseSigmaFrom(mk(7, 9), 0.1)).toBeCloseTo(Math.hypot(7, 9) / 100 / Math.SQRT2, 5);
  });
});

describe('zapis danych kalibracji', () => {
  it('podsumowanie kalibracji jest zapisywane w metadanych sesji', async () => {
    const samples = simulateCalibration();
    const { report } = GazeModel.fit(samples);
    const ref = referenceFromSamples(samples);
    const summary: CalibrationSummary = {
      model: report.model,
      params: report.params,
      points: 9,
      samples: samples.length,
      cvError: report.cvError,
      testError: { xPct: 3, yPct: 4, euclid: 0.05 },
      quality: 'GOOD',
      baseSigma: 0.04,
      reference: { ...ref, viewport: { width: 1920, height: 1080 } },
      createdAt: new Date().toISOString(),
    };
    const store = new MemorySessionStore();
    const meta: SessionMeta = {
      schemaVersion: SCHEMA_VERSION,
      id: 's1',
      createdAt: new Date().toISOString(),
      mode: 'measurement',
      source: 'webcam',
      participant: 'P1',
      video: { kind: 'file', name: 'rolka.mp4', duration: 10, width: 1920, height: 1080 },
      screen: { width: 1920, height: 1080, dpr: 1, fullscreen: true },
      engine: { name: 'test', smoothingLevel: 2 },
      calibration: summary,
      sampleCount: 0,
      disclaimerShown: true,
    };
    const rec = new SessionRecorder(meta, store);
    await rec.begin();
    await rec.finish();
    const loaded = await store.loadSession('s1');
    expect(loaded?.meta.calibration?.model).toBe(report.model);
    expect(loaded?.meta.calibration?.reference.scale).toBeCloseTo(0.066, 2);
  });
});
