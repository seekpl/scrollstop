/**
 * Kontrola jakości sesji (§5.17) i poziom próby (§5.18). Powody odrzucenia zapisujemy jako kody.
 */
import { binSize, playedBins, viewerBins } from './attention';
import { GazeCode, type CalibrationInfo, type CompactSamples, type RejectCode, type ViewerSession } from './model';

/** Poniżej tego udziału przedziałów z rozstrzygniętym stanem sesja nie wchodzi do raportu. */
export const MIN_DETERMINATE_SHARE = 0.5;
/** Minimalny czas odtwarzania (s). */
export const MIN_WATCHED_S = 3;
/** Progi poziomu próby (§5.18). */
export const INDICATIVE_SAMPLE = 10;
export const RELIABLE_SAMPLE = 30;
/** Werdykt A/B tylko przy co najmniej tylu ważnych sesjach w każdej porównywanej wersji (§4.3). */
export const MIN_VERDICT_SAMPLE = 15;
/** Zalecana liczba sesji na wersję przy porównaniach (§5.18). */
export const RECOMMENDED_AB_SAMPLE = 50;
/** Segmenty źródła widzów pokazujemy osobno od tylu sesji w każdym (§4.9). */
export const MIN_SOURCE_SEGMENT = 10;

export type SampleLevel = 'none' | 'preview' | 'indicative' | 'reliable';

export function sampleLevel(n: number): SampleLevel {
  if (n <= 0) return 'none';
  if (n < INDICATIVE_SAMPLE) return 'preview';
  if (n < RELIABLE_SAMPLE) return 'indicative';
  return 'reliable';
}

export interface Assessment {
  status: 'valid' | 'rejected';
  rejectCode: RejectCode | null;
  /** Udział odtworzonych przedziałów z rozstrzygniętym stanem patrzy / nie patrzy. */
  determinateShare: number;
  /** Odtworzony czas (s). */
  playedSeconds: number;
}

/** Pełny ekran: przedziały materiału z rozstrzygniętym stanem. */
function singleMedia(data: CompactSamples, duration: number) {
  const bin = binSize(duration);
  const det = viewerBins(data, duration, bin).filter((x) => x !== null).length;
  const played = playedBins(data, duration, bin);
  return { determinateShare: played ? det / played : 0, playedSeconds: played * bin };
}

/**
 * Feed, siatka, karuzela (sesje z `items`): ocena całej sesji, nie jednej pozycji — przewinięcie
 * badanego klipu po sekundzie to wynik, a nie powód odrzucenia.
 */
function wholeSession(data: CompactSamples) {
  let active = 0;
  let det = 0;
  let first = -1;
  let last = -1;
  for (let i = 0; i < data.st.length; i++) {
    const code = data.st[i];
    if (code === GazeCode.NOT_PLAYING) continue;
    active++;
    if (first < 0) first = data.tc[i];
    last = data.tc[i];
    if (code === GazeCode.LOOK || code === GazeCode.LOOK_OFF_MEDIA || code === GazeCode.AWAY) det++;
  }
  return { determinateShare: active ? det / active : 0, playedSeconds: active ? (last - first) / 1000 : 0 };
}

/**
 * Automatyczna kontrola jakości. Widz, który przerwał albo przewinął dalej, NIE jest odrzucany —
 * moment odejścia to też wynik. Sesje symulowane oceniamy jak z kamery (do raportów demo).
 */
export function assessSession(s: { source: ViewerSession['source']; calibration: CalibrationInfo | null; data: CompactSamples; mediaDuration: number; items?: ViewerSession['items'] }, opts: { treatSimulatedAsWebcam?: boolean } = {}): Assessment {
  const base = s.items?.length ? wholeSession(s.data) : singleMedia(s.data, s.mediaDuration);
  const share = base.determinateShare;
  const webcam = s.source === 'webcam' || opts.treatSimulatedAsWebcam;
  if (webcam) {
    if (!s.calibration) return { status: 'rejected', rejectCode: 'no_calibration', ...base };
    if (s.calibration.quality === 'POOR') return { status: 'rejected', rejectCode: 'poor_calibration', ...base };
  }
  if (base.playedSeconds < MIN_WATCHED_S) return { status: 'rejected', rejectCode: 'too_short', ...base };
  if (share < MIN_DETERMINATE_SHARE) return { status: 'rejected', rejectCode: 'low_data', ...base };
  return { status: 'valid', rejectCode: null, ...base };
}

/**
 * Sesje w raporcie: ważne (z decyzjami twórcy). Symulowane domyślnie poza raportem (§5.17),
 * chyba że `includeSimulated` (raporty przykładowe z symulowanego panelu).
 */
export function reportSessions<T extends Pick<ViewerSession, 'status' | 'source'>>(sessions: readonly T[], opts: { includeSimulated?: boolean } = {}): T[] {
  return sessions.filter((s) => s.status === 'valid' && (opts.includeSimulated || s.source !== 'simulated'));
}

export function isExpired(s: Pick<ViewerSession, 'expiresAt'>, now = Date.now()): boolean {
  return Date.parse(s.expiresAt) <= now;
}

export function expiryDate(createdAt: string, retentionDays: number): string {
  return new Date(Date.parse(createdAt) + retentionDays * 86_400_000).toISOString();
}

/** Klucz miesiąca rozliczeniowego (RRRR-MM). */
export const monthKey = (iso: string): string => iso.slice(0, 7);
