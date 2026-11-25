/**
 * Strefy zainteresowania (§5.16), czytelność napisów (§6.13), moment marki i zasięg CTA (§4.7).
 * Metryki probabilistyczne: próbka „wkłada” do strefy czas × prawdopodobieństwo, że wzrok tam był.
 */
import { overlapsUnsafe, type Platform } from '../config/platforms';
import { MEASUREMENT } from '../core/config';
import { clamp, median } from '../core/math/util';
import { GazeCode, type Aoi, type CompactSamples } from './model';
import { normalCdf, wilson } from './statsMath';

/** Widz „spojrzał”, gdy suma ≥ 0,2 s. */
export const MIN_DWELL_S = 0.2;
/** Strefy mniejsze niż ok. 2σ są na granicy rozdzielczości pomiaru. */
export const SMALL_AOI = 0.12;
/** Tempo czytania (słowa na sekundę), konfigurowalne 2,5–4 (§6.13). */
export const READING_WPS = 3;
const MAX_DT = 0.1;
const BRAND_TYPES: Aoi['type'][] = ['logo', 'product'];
const UNSAFE_TYPES: Aoi['type'][] = ['text', 'subtitle', 'logo', 'cta'];

export interface ViewerAoi {
  /** Czas, przez który materiał był przed widzem w oknie strefy (s). */
  exposure: number;
  /** Czas patrzenia na ekran w oknie strefy (s). */
  onScreen: number;
  /** Oczekiwany czas patrzenia na strefę (s). */
  dwell: number;
  /** Pierwsze spojrzenie (s od początku strefy), próbka z p ≥ 0,5. */
  first: number | null;
}

export interface AoiResult {
  aoi: Aoi;
  /** Widzowie, którzy mieli materiał przed oczami co najmniej min(1 s; 0,5 × okno strefy). */
  n: number;
  lookers: number;
  reach: number | null;
  reachLo: number | null;
  reachHi: number | null;
  /** Średni udział czasu patrzenia na ekran przypadający na strefę. */
  dwellShare: number | null;
  /** Mediana czasu do pierwszego spojrzenia (s od początku strefy). */
  firstLook: number | null;
  /** Mediana czasu patrzenia u patrzących (s). */
  dwellMedian: number | null;
  /** Strefa mniejsza niż dokładność pomiaru. */
  small: boolean;
  /** Czytelność (tylko tekst i napisy z liczbą słów). */
  reading: ReadingCheck | null;
  /** Tekst, logo albo CTA w strefie zasłoniętej przez interfejs platformy (§4.8). */
  unsafe: boolean;
}

export interface ReadingCheck {
  words: number;
  /** Potrzebny czas = słowa / tempo + 0,5 s. */
  needed: number;
  /** Czas ekspozycji strefy krótszy niż potrzebny. */
  tooShort: boolean;
  /** Mediana patrzenia u patrzących < 50% potrzebnego. */
  fewRead: boolean;
}

/** Prawdopodobieństwo, że punkt (x,y) z niepewnością σ leży w prostokącie. */
export function rectProbability(x: number, y: number, sigma: number, a: Pick<Aoi, 'x' | 'y' | 'w' | 'h'>): number {
  const s = Math.max(sigma, 1e-4);
  const px = normalCdf((a.x + a.w - x) / s) - normalCdf((a.x - x) / s);
  const py = normalCdf((a.y + a.h - y) / s) - normalCdf((a.y - y) / s);
  return clamp(px * py, 0, 1);
}

/** Metryki jednego widza dla strefy. */
export function viewerAoi(aoi: Aoi, c: CompactSamples, item = 0): ViewerAoi {
  let exposure = 0;
  let onScreen = 0;
  let dwell = 0;
  let first: number | null = null;
  const floor = MEASUREMENT.aoiMinSigma;
  for (let i = 0; i < c.st.length; i++) {
    if (c.it[i] !== (aoi.slide ?? item)) continue;
    const code = c.st[i];
    const vt = c.vt[i];
    if (code === GazeCode.NOT_PLAYING || vt < aoi.t0 || vt > aoi.t1) continue;
    const dt = i + 1 < c.tc.length ? clamp((c.tc[i + 1] - c.tc[i]) / 1000, 0, MAX_DT) : 1 / 30;
    exposure += dt;
    if (code === GazeCode.LOOK || code === GazeCode.LOOK_OFF_MEDIA) onScreen += dt;
    if (code !== GazeCode.LOOK) continue;
    const sigma = Math.max(floor, c.un[i] >= 0 ? c.un[i] / 1000 : floor);
    const p = rectProbability(c.vx[i] / 1000, c.vy[i] / 1000, sigma, aoi);
    dwell += p * dt;
    if (first === null && p >= 0.5) first = vt - aoi.t0;
  }
  return { exposure, onScreen, dwell, first };
}

export function readingCheck(aoi: Aoi, dwellMedian: number | null, wps = READING_WPS): ReadingCheck | null {
  if ((aoi.type !== 'text' && aoi.type !== 'subtitle') || !aoi.words || aoi.words <= 0) return null;
  const needed = aoi.words / wps + 0.5;
  return { words: aoi.words, needed, tooShort: aoi.t1 - aoi.t0 < needed, fewRead: dwellMedian !== null && dwellMedian < 0.5 * needed };
}

export function aoiMetrics(aoi: Aoi, sessions: readonly CompactSamples[], opts: { platform?: Platform; item?: number } = {}): AoiResult {
  let n = 0;
  let lookers = 0;
  const shares: number[] = [];
  const firsts: number[] = [];
  const dwells: number[] = [];
  const window = Math.max(0.5, aoi.t1 - aoi.t0);
  for (const c of sessions) {
    const v = viewerAoi(aoi, c, opts.item ?? 0);
    if (v.exposure < Math.min(1, 0.5 * window)) continue;
    n++;
    if (v.dwell >= MIN_DWELL_S) {
      lookers++;
      dwells.push(v.dwell);
      if (v.first !== null) firsts.push(v.first);
    }
    if (v.onScreen > 0) shares.push(v.dwell / v.onScreen);
  }
  const w = n ? wilson(lookers, n) : null;
  const dwellMedian = dwells.length ? median(dwells) : null;
  return {
    aoi,
    n,
    lookers,
    reach: n ? lookers / n : null,
    reachLo: w?.lo ?? null,
    reachHi: w?.hi ?? null,
    dwellShare: shares.length ? shares.reduce((a, b) => a + b, 0) / shares.length : null,
    firstLook: firsts.length ? median(firsts) : null,
    dwellMedian,
    small: aoi.w < SMALL_AOI || aoi.h < SMALL_AOI,
    reading: readingCheck(aoi, dwellMedian),
    unsafe: !!opts.platform && UNSAFE_TYPES.includes(aoi.type) && overlapsUnsafe(opts.platform, aoi),
  };
}

export interface BrandMoment {
  /** Strefy marki (logo, produkt). */
  aois: number;
  /** Widzowie z ekspozycją na co najmniej jedną strefę marki. */
  n: number;
  /** Mediana czasu (s od początku materiału) do pierwszego spojrzenia na markę, wśród patrzących. */
  firstLookMedian: number | null;
  /** Odsetek widzów, którzy spojrzeli na markę do 3 s / do 50% długości / kiedykolwiek. */
  by3s: number | null;
  byHalf: number | null;
  reach: number | null;
}

/** Moment marki (§4.7): kiedy widz pierwszy raz patrzy na logo lub produkt. */
export function brandMoment(aois: readonly Aoi[], sessions: readonly CompactSamples[], duration: number, item = 0): BrandMoment | null {
  const brand = aois.filter((a) => BRAND_TYPES.includes(a.type));
  if (!brand.length) return null;
  let n = 0;
  let by3 = 0;
  let byHalf = 0;
  let ever = 0;
  const firsts: number[] = [];
  for (const c of sessions) {
    let exposed = false;
    let first: number | null = null;
    for (const a of brand) {
      const v = viewerAoi(a, c, item);
      if (v.exposure >= Math.min(1, 0.5 * Math.max(0.5, a.t1 - a.t0))) exposed = true;
      if (v.dwell >= MIN_DWELL_S && v.first !== null) {
        const abs = a.t0 + v.first;
        first = first === null ? abs : Math.min(first, abs);
      }
    }
    if (!exposed) continue;
    n++;
    if (first === null) continue;
    ever++;
    firsts.push(first);
    if (first <= 3) by3++;
    if (first <= duration / 2) byHalf++;
  }
  return {
    aois: brand.length,
    n,
    firstLookMedian: firsts.length ? median(firsts) : null,
    by3s: n ? by3 / n : null,
    byHalf: n ? byHalf / n : null,
    reach: n ? ever / n : null,
  };
}
