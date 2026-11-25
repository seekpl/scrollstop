import { useCallback, useEffect, useRef, useState } from 'react';
import {
  baseSigmaFrom,
  buildSchedule,
  DESKTOP_PLAN,
  evaluateTest,
  failedScheduleItems,
  qualityFromTest,
  referenceFromSamples,
  targetAt,
  targetForSample,
  type CalibrationPlan,
  type CollectedSample,
  type ScheduleItem,
  type TargetState,
  type TestPrediction,
  type TestResult,
} from '../../core/calibration/calibration';
import type { CalibrationSummary } from '../../core/contracts/types';
import { errorCode } from '../../core/errors';
import { GazeModel } from '../../core/estimation/gazeModel';
import type { TrackerFrame } from '../../core/tracking/faceTracker';
import { trackingHub } from '../../core/tracking/trackingHub';
import { nextFrame, playChime } from './browser';

export type CalibrationPhase = 'idle' | 'calibrating' | 'fitting' | 'testing' | 'result' | 'error';

export interface CalibrationOutcome {
  summary: CalibrationSummary;
  model: GazeModel;
  test: TestResult | null;
}

/** Po tylu ms bez twarzy pokazujemy „Nie widzę Twojej twarzy” (§10.7). */
export const FACE_LOST_MS = 700;

/**
 * Przebieg kalibracji (wspólny dla laboratorium i badania, §5.5): cel, zbieranie próbek, jedna
 * powtórka słabych punktów, dopasowanie modelu, test na nowych punktach. Błąd jako kod.
 */
export function useCalibration(plan: CalibrationPlan = DESKTOP_PLAN, opts: { sound?: boolean } = {}) {
  const [phase, setPhase] = useState<CalibrationPhase>('idle');
  const [target, setTarget] = useState<TargetState | null>(null);
  const [outcome, setOutcome] = useState<CalibrationOutcome | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [faceVisible, setFaceVisible] = useState(true);
  const cleanup = useRef<(() => void) | null>(null);
  const sound = opts.sound ?? false;

  useEffect(() => () => cleanup.current?.(), []);

  const runSchedule = useCallback(
    (schedule: ScheduleItem[], onFrame: (f: TrackerFrame, t: number) => void) =>
      new Promise<void>((resolve) => {
        const t0 = performance.now();
        let lastIndex = -1;
        let raf = 0;
        let lastFace = performance.now();
        const unsub = trackingHub.subscribe((f) => {
          if (f.face) lastFace = performance.now();
          onFrame(f, f.captureTime - t0);
        });
        const tick = () => {
          const st = targetAt(schedule, performance.now() - t0);
          if (st.index !== lastIndex && st.phase !== 'done') {
            lastIndex = st.index;
            if (sound) playChime();
          }
          setTarget(st);
          setFaceVisible(performance.now() - lastFace < FACE_LOST_MS);
          if (st.phase === 'done') {
            unsub();
            cleanup.current = null;
            resolve();
            return;
          }
          raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
        cleanup.current = () => {
          cancelAnimationFrame(raf);
          unsub();
        };
      }),
    [sound],
  );

  const run = useCallback(async (): Promise<CalibrationOutcome | null> => {
    setError(null);
    setOutcome(null);
    setPhase('calibrating');
    let samples: CollectedSample[] = [];
    const collect = (schedule: ScheduleItem[], offset: number) => (f: TrackerFrame, t: number) => {
      if (!f.face || !f.face.eyesOpen) return;
      const tgt = targetForSample(schedule, t);
      if (!tgt) return;
      samples.push({
        features: f.face.features,
        target: tgt.target,
        pointId: tgt.pointId,
        weight: tgt.weight,
        tCapture: f.captureTime,
        pose: f.face.pose,
        scale: f.face.scale,
        scheduleIndex: tgt.state.index + offset,
      });
    };

    const main = buildSchedule(plan.points, plan.schedule);
    await runSchedule(main, collect(main, 0));

    // Jedna powtórka punktów, na które widz prawdopodobnie nie patrzył.
    const failed = failedScheduleItems(samples, main);
    if (failed.length && failed.length < main.length) {
      samples = samples.filter((s) => !failed.includes(s.scheduleIndex) || s.weight < 1);
      const retry = buildSchedule(
        failed.map((i) => main[i].point),
        plan.schedule,
      );
      await runSchedule(retry, collect(retry, 1000));
    }

    setPhase('fitting');
    await nextFrame();
    let fitted: ReturnType<typeof GazeModel.fit>;
    try {
      fitted = GazeModel.fit(samples);
    } catch (e) {
      setError(errorCode(e) === 'unknown' ? 'calibration_failed' : errorCode(e));
      setPhase('error');
      return null;
    }

    setPhase('testing');
    const preds: TestPrediction[] = [];
    const testSchedule = buildSchedule(plan.test, plan.schedule);
    await runSchedule(testSchedule, (f, t) => {
      const st = targetAt(testSchedule, t);
      if (st.phase !== 'dwell' || !f.face || !f.face.eyesOpen) return;
      const p = fitted.model.predict(f.face.features);
      preds.push({ pointId: st.pointId, x: p.x, y: p.y, dwellElapsed: st.dwellElapsed });
    });

    const test = evaluateTest(preds, plan.test);
    const ref = referenceFromSamples(samples);
    const summary: CalibrationSummary = {
      model: fitted.report.model,
      params: fitted.report.params,
      points: new Set(samples.map((s) => s.pointId)).size,
      samples: samples.length,
      cvError: fitted.report.cvError,
      testError: test ? { xPct: test.xPct, yPct: test.yPct, euclid: test.euclid } : null,
      quality: qualityFromTest(test),
      baseSigma: baseSigmaFrom(test, fitted.report.cvError),
      reference: { ...ref, viewport: { width: window.innerWidth, height: window.innerHeight } },
      createdAt: new Date().toISOString(),
    };
    const out = { summary, model: fitted.model, test };
    setOutcome(out);
    setPhase('result');
    return out;
  }, [runSchedule, plan]);

  const cancel = useCallback(() => {
    cleanup.current?.();
    cleanup.current = null;
    setPhase('idle');
  }, []);

  return { phase, target, outcome, error, faceVisible, run, cancel };
}
