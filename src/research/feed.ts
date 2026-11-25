/**
 * Test w feedzie (§4.4, §5.20, §6 pkt 7–11): zatrzymanie scrolla (zachowanie i wzrok), czas na
 * klipie wobec wypełniaczy, obejrzenie do końca, pętle, „oglądają, ale nie patrzą”, retencja
 * i momenty przewinięcia. Każdy widz ma tę samą wagę.
 */
import { focusItem } from './compact';
import { GazeCode, type FeedSettings, type ItemLog, type ViewerSession } from './model';
import { MIN_VERDICT_SAMPLE, reportSessions } from './sessions';
import { bootstrapMeanCI, twoProportionTest } from './statsMath';

export const DEFAULT_FEED: FeedSettings = { items: 6, stopSeconds: 2, capSeconds: 180 };
/** Okno „zatrzymania wzrokiem”: pierwsze 2 s na klipie, patrzy co najmniej połowę czasu. */
export const GAZE_STOP_WINDOW_MS = 2000;
export const GAZE_STOP_SHARE = 0.5;
/** Najmniej rozstrzygających próbek w oknie (~0,3 s przy 30 Hz), żeby widz wszedł do mianownika. */
const MIN_WINDOW_SAMPLES = 10;

type FeedSession = Pick<ViewerSession, 'items' | 'data'>;

export function testedIndex(s: Pick<ViewerSession, 'items'>): number | null {
  const v = s.items?.find((i) => i.role === 'tested');
  return v ? v.index : null;
}

/** Sesja feedu sprowadzona do testowanego klipu (`it` = 0) — raport liczy się jak dla pełnego ekranu. */
export function feedFocus<T extends FeedSession>(s: T): T {
  const idx = testedIndex(s);
  return { ...s, data: focusItem(s.data, idx ?? -1) };
}

const sessionEnd = (s: FeedSession) => (s.data.tc.length ? s.data.tc[s.data.tc.length - 1] : 0);
const dwellMs = (v: ItemLog, end: number) => Math.max(0, (v.exitMs ?? end) - v.enterMs);
const median = (xs: number[]) => {
  if (!xs.length) return null;
  const a = [...xs].sort((x, y) => x - y);
  const m = a.length >> 1;
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
};
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

export interface FeedMetrics {
  viewers: number;
  stopSeconds: number;
  /** Zachowanie: zostali na klipie co najmniej `stopSeconds`. */
  stop: number | null;
  stopped: number;
  /** Wzrok: w pierwszych 2 s patrzyli na klip co najmniej połowę czasu. */
  gazeStop: number | null;
  gazeStopBase: number;
  /** Czas na klipie (s, pierwsza wizyta): mediana, średnia i 95% bootstrap średniej. */
  dwellMedian: number | null;
  dwellMean: number | null;
  dwellCi: { lo: number; hi: number } | null;
  /** Wypełniacze: średni czas i odsetek zatrzymań (wizyty). */
  fillerDwellMean: number | null;
  fillerStop: number | null;
  /** Test dwóch proporcji: zatrzymanie klipu wobec wypełniaczy. */
  stopP: number | null;
  significant: boolean;
  /** Dotrwali do końca pierwszej pętli. */
  completion: number | null;
  meanLoops: number | null;
  /** Średni udział czasu na klipie, gdy wzrok był poza ekranem. */
  notLooking: number | null;
  /** Odsetek widzów wciąż na klipie (pierwsza pętla). */
  retention: Array<{ t: number; value: number | null; n: number }>;
  /** Momenty przewinięcia dalej (sekunda klipu) — histogram co 1 s. */
  swipes: Array<{ t0: number; t1: number; n: number }>;
}

export function feedMetrics(all: readonly ViewerSession[], opts: { stopSeconds: number; duration: number; bin: number; includeSimulated?: boolean }): FeedMetrics {
  const sessions = reportSessions(all, { includeSimulated: opts.includeSimulated }).filter((s) => testedIndex(s) !== null);
  const stopMs = opts.stopSeconds * 1000;
  const dwells: number[] = [];
  const clipSeconds: number[] = [];
  let stopped = 0;
  let completed = 0;
  let loops = 0;
  let gazeBase = 0;
  let gazeStopped = 0;
  const notLooking: number[] = [];
  const fillerDwell: number[] = [];
  let fillerStayed = 0;
  const swipeAt: number[] = [];
  for (const s of sessions) {
    const idx = testedIndex(s) as number;
    const end = sessionEnd(s);
    const visits = (s.items ?? []).filter((v) => v.role === 'tested').sort((a, b) => a.enterMs - b.enterMs);
    const first = visits[0];
    const d = dwellMs(first, end);
    dwells.push(d / 1000);
    const stayed = d >= stopMs || first.exitMs === null;
    if (stayed) stopped++;
    if (first.loops >= 1) completed++;
    loops += visits.reduce((a, v) => a + v.loops, 0);
    clipSeconds.push(first.loops >= 1 ? opts.duration : Math.min(opts.duration, d / 1000));
    if (first.exitType === 'swipe_next' && first.loops === 0) swipeAt.push(d / 1000);
    // Wzrok w pierwszych 2 s na klipie oraz „oglądają, ale nie patrzą”.
    let look = 0;
    let det = 0;
    let away = 0;
    let all2 = 0;
    for (let i = 0; i < s.data.tc.length; i++) {
      if (s.data.it[i] !== idx) continue;
      const code = s.data.st[i];
      const determinate = code === GazeCode.LOOK || code === GazeCode.LOOK_OFF_MEDIA || code === GazeCode.AWAY;
      if (determinate) {
        all2++;
        if (code === GazeCode.AWAY) away++;
      }
      const tc = s.data.tc[i];
      if (tc >= first.enterMs && tc < first.enterMs + GAZE_STOP_WINDOW_MS && determinate) {
        det++;
        if (code === GazeCode.LOOK) look++;
      }
    }
    if (det >= MIN_WINDOW_SAMPLES) {
      gazeBase++;
      if (look / det >= GAZE_STOP_SHARE) gazeStopped++;
    }
    if (all2 > 0) notLooking.push(away / all2);
    for (const v of s.items ?? []) {
      if (v.role !== 'filler') continue;
      const fd = dwellMs(v, end);
      fillerDwell.push(fd / 1000);
      if (fd >= stopMs || v.exitMs === null) fillerStayed++;
    }
  }
  const n = sessions.length;
  const test = n && fillerDwell.length ? twoProportionTest(stopped, n, fillerStayed, fillerDwell.length) : null;
  const bins = Math.max(1, Math.ceil(opts.duration / opts.bin));
  const retention = Array.from({ length: bins }, (_, k) => {
    const t = k * opts.bin;
    return { t, value: n ? clipSeconds.filter((c) => c > t).length / n : null, n };
  });
  const swipeBins = Math.max(1, Math.ceil(opts.duration));
  const swipes = Array.from({ length: swipeBins }, (_, k) => ({ t0: k, t1: k + 1, n: swipeAt.filter((x) => x >= k && x < k + 1).length }));
  return {
    viewers: n,
    stopSeconds: opts.stopSeconds,
    stop: n ? stopped / n : null,
    stopped,
    gazeStop: gazeBase ? gazeStopped / gazeBase : null,
    gazeStopBase: gazeBase,
    dwellMedian: median(dwells),
    dwellMean: mean(dwells),
    dwellCi: dwells.length >= 2 ? bootstrapMeanCI(dwells) : null,
    fillerDwellMean: mean(fillerDwell),
    fillerStop: fillerDwell.length ? fillerStayed / fillerDwell.length : null,
    stopP: test?.p ?? null,
    significant: !!test && test.p < 0.05 && n >= MIN_VERDICT_SAMPLE,
    completion: n ? completed / n : null,
    meanLoops: n ? loops / n : null,
    notLooking: mean(notLooking),
    retention,
    swipes,
  };
}
