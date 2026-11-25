import type { HeadPose, TrackingQuality } from '../contracts/types';
import type { TrainingSample } from '../estimation/gazeModel';
import { MEASUREMENT } from '../config';
import { mean, median, std } from '../math/util';

export interface CalPoint {
  id: number;
  x: number;
  y: number;
}

/**
 * 10 pozycji z marginesem (§5.5); środek pokazany dwa razy (ten sam punkt → to samo id).
 * Komputer: margines 8%; telefon w pionie: 13% w poziomie i 10% w pionie.
 */
export function calibrationPoints(mx: number, my: number): CalPoint[] {
  return [
    { id: 0, x: 0.5, y: 0.5 },
    { id: 1, x: mx, y: my },
    { id: 2, x: 0.5, y: my },
    { id: 3, x: 1 - mx, y: my },
    { id: 4, x: mx, y: 0.5 },
    { id: 0, x: 0.5, y: 0.5 },
    { id: 5, x: 1 - mx, y: 0.5 },
    { id: 6, x: mx, y: 1 - my },
    { id: 7, x: 0.5, y: 1 - my },
    { id: 8, x: 1 - mx, y: 1 - my },
  ];
}

const C = MEASUREMENT.calibration;

export const CALIBRATION_POINTS: CalPoint[] = calibrationPoints(C.desktop.marginX, C.desktop.marginY);

/** 5 nowych punktów testowych na komputerze (spoza siatki kalibracyjnej). */
export const TEST_POINTS: CalPoint[] = [
  { id: 100, x: 0.3, y: 0.3 },
  { id: 101, x: 0.7, y: 0.28 },
  { id: 102, x: 0.5, y: 0.62 },
  { id: 103, x: 0.28, y: 0.75 },
  { id: 104, x: 0.72, y: 0.72 },
];

/** 4 punkty testowe na telefonie w pionie. */
export const MOBILE_TEST_POINTS: CalPoint[] = [
  { id: 100, x: 0.3, y: 0.28 },
  { id: 101, x: 0.7, y: 0.36 },
  { id: 102, x: 0.35, y: 0.66 },
  { id: 103, x: 0.68, y: 0.78 },
];

export interface ScheduleOptions {
  transitionMs: number;
  dwellMs: number;
}

export const DEFAULT_SCHEDULE: ScheduleOptions = { transitionMs: C.desktop.transitionMs, dwellMs: C.desktop.dwellMs };
/** Pierwsze ~450 ms na punkcie to czas, w którym widz dopiero przenosi wzrok. */
export const SKIP_MS = C.skipMs;
/** Opóźnienie śledzenia płynnie poruszającego się celu (smooth pursuit). */
export const PURSUIT_LAG_MS = C.pursuitLagMs;
export const PURSUIT_WEIGHT = C.pursuitWeight;
export const MIN_DWELL_SAMPLES = C.minDwellSamples;

/** Plan kalibracji dla urządzenia: punkty, test, harmonogram i rozmiar celu (px). */
export interface CalibrationPlan {
  device: 'desktop' | 'mobile';
  points: CalPoint[];
  test: CalPoint[];
  schedule: ScheduleOptions;
  targetSize: number;
}

export const DESKTOP_PLAN: CalibrationPlan = {
  device: 'desktop',
  points: CALIBRATION_POINTS,
  test: TEST_POINTS,
  schedule: DEFAULT_SCHEDULE,
  targetSize: C.desktop.targetPx,
};

/** Telefon w pionie: te same 10 pozycji z większym marginesem bocznym, krótszy postój, 4 punkty testowe. */
export const MOBILE_PLAN: CalibrationPlan = {
  device: 'mobile',
  points: calibrationPoints(C.mobile.marginX, C.mobile.marginY),
  test: MOBILE_TEST_POINTS,
  schedule: { transitionMs: C.mobile.transitionMs, dwellMs: C.mobile.dwellMs },
  targetSize: C.mobile.targetPx,
};

/** Czas planu (ms) z testem — do komunikatu „trwa ok. 40 s”. */
export function planDurationMs(plan: CalibrationPlan): number {
  const per = plan.schedule.transitionMs + plan.schedule.dwellMs;
  return per * (plan.points.length + plan.test.length);
}

export interface ScheduleItem {
  index: number;
  point: CalPoint;
  from: { x: number; y: number };
  tStart: number;
  tDwell: number;
  tEnd: number;
}

export function buildSchedule(
  points: CalPoint[],
  opts: ScheduleOptions = DEFAULT_SCHEDULE,
  start: { x: number; y: number } = { x: 0.5, y: 0.5 },
): ScheduleItem[] {
  let t = 0;
  let from = start;
  return points.map((point, index) => {
    const item = { index, point, from, tStart: t, tDwell: t + opts.transitionMs, tEnd: t + opts.transitionMs + opts.dwellMs };
    t = item.tEnd;
    from = { x: point.x, y: point.y };
    return item;
  });
}

export const scheduleDuration = (s: ScheduleItem[]): number => (s.length ? s[s.length - 1].tEnd : 0);

export interface TargetState {
  x: number;
  y: number;
  pointId: number;
  index: number;
  phase: 'transition' | 'dwell' | 'done';
  dwellElapsed: number;
  progress: number;
}

const ease = (u: number) => (u < 0.5 ? 4 * u * u * u : 1 - (-2 * u + 2) ** 3 / 2);

export function targetAt(schedule: ScheduleItem[], tMs: number): TargetState {
  const total = scheduleDuration(schedule);
  if (!schedule.length || tMs >= total) {
    const last = schedule[schedule.length - 1];
    return {
      x: last?.point.x ?? 0.5,
      y: last?.point.y ?? 0.5,
      pointId: last?.point.id ?? -1,
      index: schedule.length,
      phase: 'done',
      dwellElapsed: 0,
      progress: 1,
    };
  }
  const t = Math.max(0, tMs);
  const item = schedule.find((s) => t < s.tEnd) as ScheduleItem;
  const progress = t / total;
  if (t < item.tDwell) {
    const u = (t - item.tStart) / Math.max(item.tDwell - item.tStart, 1);
    const e = ease(Math.min(1, Math.max(0, u)));
    return {
      x: item.from.x + (item.point.x - item.from.x) * e,
      y: item.from.y + (item.point.y - item.from.y) * e,
      pointId: item.point.id,
      index: item.index,
      phase: 'transition',
      dwellElapsed: 0,
      progress,
    };
  }
  return {
    x: item.point.x,
    y: item.point.y,
    pointId: item.point.id,
    index: item.index,
    phase: 'dwell',
    dwellElapsed: t - item.tDwell,
    progress,
  };
}

/** Cel i waga dla próbki zarejestrowanej w chwili t; null = próbki nie używamy. */
export function targetForSample(
  schedule: ScheduleItem[],
  tMs: number,
): { target: { x: number; y: number }; pointId: number; weight: number; state: TargetState } | null {
  const st = targetAt(schedule, tMs);
  if (st.phase === 'done') return null;
  if (st.phase === 'dwell') {
    if (st.dwellElapsed < SKIP_MS) return null;
    return { target: { x: st.x, y: st.y }, pointId: st.pointId, weight: 1, state: st };
  }
  const lagged = targetAt(schedule, Math.max(0, tMs - PURSUIT_LAG_MS));
  return { target: { x: lagged.x, y: lagged.y }, pointId: st.pointId, weight: PURSUIT_WEIGHT, state: st };
}

export interface CollectedSample extends TrainingSample {
  tCapture: number;
  pose: HeadPose;
  scale: number;
  scheduleIndex: number;
}

/** Punkty do powtórzenia: za mało próbek albo rozrzut cech oczu znacznie większy niż przy innych punktach. */
export function failedScheduleItems(samples: CollectedSample[], schedule: ScheduleItem[]): number[] {
  const stats = schedule.map((item) => {
    const own = samples.filter((s) => s.scheduleIndex === item.index && s.weight >= 1);
    const dispersion = own.length >= 3 ? [0, 1, 2, 3].reduce((acc, j) => acc + std(own.map((s) => s.features[j])), 0) : Infinity;
    return { index: item.index, count: own.length, dispersion };
  });
  const finite = stats.filter((s) => s.count >= MIN_DWELL_SAMPLES && Number.isFinite(s.dispersion));
  const med = median(finite.map((s) => s.dispersion));
  return stats
    .filter((s) => s.count < MIN_DWELL_SAMPLES || (Number.isFinite(med) && s.dispersion > C.retryDispersion * med))
    .map((s) => s.index);
}

export function referenceFromSamples(samples: CollectedSample[]): { pose: HeadPose; scale: number } {
  const dwell = samples.filter((s) => s.weight >= 1);
  const src = dwell.length ? dwell : samples;
  return {
    pose: {
      yaw: median(src.map((s) => s.pose.yaw)),
      pitch: median(src.map((s) => s.pose.pitch)),
      roll: median(src.map((s) => s.pose.roll)),
    },
    scale: median(src.map((s) => s.scale)),
  };
}

export interface TestPrediction {
  pointId: number;
  x: number;
  y: number;
  dwellElapsed: number;
}

export interface TestResult {
  xPct: number;
  yPct: number;
  euclid: number;
  perPoint: Array<{ pointId: number; target: { x: number; y: number }; pred: { x: number; y: number }; dx: number; dy: number }>;
}

/** Błąd na nowych punktach: mediana predykcji na punkcie vs pozycja celu. */
export function evaluateTest(preds: TestPrediction[], points: CalPoint[]): TestResult | null {
  const perPoint: TestResult['perPoint'] = [];
  for (const p of points) {
    const ps = preds.filter((q) => q.pointId === p.id && q.dwellElapsed >= SKIP_MS);
    if (ps.length < 3) continue;
    const pred = { x: median(ps.map((q) => q.x)), y: median(ps.map((q) => q.y)) };
    perPoint.push({ pointId: p.id, target: { x: p.x, y: p.y }, pred, dx: Math.abs(pred.x - p.x), dy: Math.abs(pred.y - p.y) });
  }
  if (!perPoint.length) return null;
  return {
    xPct: mean(perPoint.map((p) => p.dx)) * 100,
    yPct: mean(perPoint.map((p) => p.dy)) * 100,
    euclid: mean(perPoint.map((p) => Math.hypot(p.dx, p.dy))),
    perPoint,
  };
}

/** Progi jakości z testu (% szerokości / wysokości) — dla dorosłych, do strojenia na pilotażu (`core/config.ts`). */
export const TEST_THRESHOLDS = C.thresholds;

export function qualityFromTest(r: TestResult | null): TrackingQuality {
  if (!r) return 'POOR';
  if (r.xPct <= TEST_THRESHOLDS.good.x && r.yPct <= TEST_THRESHOLDS.good.y) return 'GOOD';
  if (r.xPct <= TEST_THRESHOLDS.fair.x && r.yPct <= TEST_THRESHOLDS.fair.y) return 'FAIR';
  return 'POOR';
}

export function baseSigmaFrom(test: TestResult | null, cvError: number): number {
  if (test) return Math.max(0.03, Math.hypot(test.xPct, test.yPct) / 100 / Math.SQRT2);
  return Math.max(0.03, Number.isFinite(cvError) ? cvError / Math.SQRT2 : 0.1);
}
