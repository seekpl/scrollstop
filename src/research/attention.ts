/**
 * Stan widza w przedziałach czasu, krzywa uwagi, spadki i segmenty (§5.11–§5.14).
 * Rozdzielczość: 0,5 s dla materiałów do 60 s, 1 s dla dłuższych.
 */
import { clamp, mean } from '../core/math/util';
import { GazeCode, type CompactSamples } from './model';
import { wilson } from './statsMath';

/** Stan widza w przedziale: 1 = patrzy, 0 = nie patrzy, null = brak danych / nie widział. */
export type BinState = 0 | 1 | null;

/** Rozdzielczość krzywej (s). */
export const binSize = (duration: number): number => (duration > 0 && duration <= 60 ? 0.5 : 1);

/** Minimalna liczba rozstrzygających próbek w przedziale: 3 na 1 s, 2 na 0,5 s. */
export const minDeterminate = (bin: number): number => (bin >= 1 ? 3 : 2);

export const binCount = (duration: number, bin: number): number => Math.max(1, Math.ceil(duration / bin - 1e-9));

/** Najdłuższy odtworzony czas materiału w sesji (opcjonalnie tylko pozycja `item`). */
export function sessionDuration(c: CompactSamples, item?: number): number {
  let max = 0;
  for (let i = 0; i < c.vt.length; i++) {
    if (item !== undefined && c.it[i] !== item) continue;
    if (c.st[i] !== GazeCode.NOT_PLAYING && c.vt[i] > max) max = c.vt[i];
  }
  return max;
}

/**
 * Stan widza przedział po przedziale (§5.11). Decyduje większość rozstrzygających próbek
 * (patrzy = LOOK + LOOK_OFF_MEDIA, nie patrzy = AWAY). Jedna krótka luka bez rozstrzygnięcia
 * (mrugnięcie) przejmuje stan z poprzedniego przedziału; dłuższe luki zostają `null`, nie fałszywe „nie patrzy”.
 * `item` — tylko próbki danej pozycji (feed, siatka); pełny ekran: 0.
 */
export function viewerBins(c: CompactSamples, duration: number, bin = binSize(duration), item = 0): BinState[] {
  const n = binCount(duration > 0 ? duration : sessionDuration(c, item), bin);
  const look = new Uint16Array(n);
  const away = new Uint16Array(n);
  const seen = new Uint8Array(n);
  for (let i = 0; i < c.st.length; i++) {
    if (c.it[i] !== item) continue;
    const code = c.st[i];
    const vt = c.vt[i];
    if (code === GazeCode.NOT_PLAYING || vt < 0) continue;
    const k = Math.min(n - 1, Math.floor(vt / bin));
    seen[k] = 1;
    if (code === GazeCode.LOOK || code === GazeCode.LOOK_OFF_MEDIA) look[k]++;
    else if (code === GazeCode.AWAY) away[k]++;
  }
  const need = minDeterminate(bin);
  const out: BinState[] = new Array(n).fill(null);
  let prev: BinState = null;
  let gap = 0;
  for (let k = 0; k < n; k++) {
    if (!seen[k]) {
      prev = null;
      continue;
    }
    const det = look[k] + away[k];
    if (det >= need) {
      out[k] = look[k] / det >= 0.5 ? 1 : 0;
      prev = out[k];
      gap = 0;
    } else if (prev !== null && gap < 1) {
      out[k] = prev;
      gap++;
    } else {
      prev = null;
    }
  }
  return out;
}

/** Liczba przedziałów, w których materiał był odtwarzany (z danymi lub bez). */
export function playedBins(c: CompactSamples, duration: number, bin = binSize(duration), item = 0): number {
  const n = binCount(duration > 0 ? duration : sessionDuration(c, item), bin);
  const seen = new Uint8Array(n);
  for (let i = 0; i < c.st.length; i++) {
    if (c.it[i] !== item || c.st[i] === GazeCode.NOT_PLAYING || c.vt[i] < 0) continue;
    seen[Math.min(n - 1, Math.floor(c.vt[i] / bin))] = 1;
  }
  return seen.reduce((a, b) => a + b, 0);
}

export interface CurvePoint {
  /** Początek przedziału (s). */
  t: number;
  /** Udział patrzących (0..1); null, gdy nikt nie ma danych. */
  value: number | null;
  /** 95% przedział Wilsona. */
  lo: number | null;
  hi: number | null;
  /** Liczba widzów z danymi w tym przedziale. */
  n: number;
  watching: number;
}

/** Krzywa uwagi: udział patrzących w każdym przedziale (§5.12). */
export function attentionCurve(viewers: readonly BinState[][], duration: number, bin = binSize(duration)): CurvePoint[] {
  const n = binCount(duration > 0 ? duration : Math.max(1, ...viewers.map((v) => v.length)) * bin, bin);
  const out: CurvePoint[] = [];
  for (let k = 0; k < n; k++) {
    let nn = 0;
    let x = 0;
    for (const v of viewers) {
      const s = v[k];
      if (s === null || s === undefined) continue;
      nn++;
      x += s;
    }
    const t = Math.round(k * bin * 1000) / 1000;
    if (!nn) {
      out.push({ t, value: null, lo: null, hi: null, n: 0, watching: 0 });
      continue;
    }
    const w = wilson(x, nn);
    out.push({ t, value: x / nn, lo: w.lo, hi: w.hi, n: nn, watching: x });
  }
  return out;
}

/** Średnia krocząca (okno nieparzyste), ignoruje brak danych. */
export function smooth(values: ReadonlyArray<number | null>, window = 3): Array<number | null> {
  const half = Math.floor(window / 2);
  return values.map((v, i) => {
    if (v === null) return null;
    let s = 0;
    let n = 0;
    for (let j = i - half; j <= i + half; j++) {
      const u = values[j];
      if (u !== null && u !== undefined) {
        s += u;
        n++;
      }
    }
    return n ? s / n : null;
  });
}

/** Rozdzielczość krzywej odczytana z punktów. */
export const curveBin = (curve: readonly CurvePoint[]): number => (curve.length > 1 ? Math.round((curve[1].t - curve[0].t) * 1000) / 1000 : 1);

/** Wartość wygładzonej krzywej w chwili t (s). */
export function valueAt(curve: readonly CurvePoint[], t: number): number | null {
  if (!curve.length) return null;
  const bin = curveBin(curve);
  const s = smooth(curve.map((p) => p.value));
  return s[clamp(Math.floor(t / bin), 0, s.length - 1)] ?? null;
}

export interface AttentionDrop {
  /** Początek spadku (szczyt), s. */
  start: number;
  /** Koniec spadku (dołek), s. */
  end: number;
  from: number;
  to: number;
  /** Spadek (ułamek, 0..1). */
  delta: number;
  /** Utraceni widzowie = spadek × n. */
  lost: number;
  n: number;
}

export interface DropOptions {
  /** Okno wyszukiwania (s). */
  windowSeconds?: number;
  minDelta?: number;
  /** Minimalne nachylenie (ułamek na sekundę) — powolne dryfowanie to nie spadek. */
  minSlope?: number;
  max?: number;
}

/** Okno wyszukiwania spadków W = round(clamp(długość/5; 4; 12)) s (§5.13). */
export const dropWindow = (duration: number): number => Math.round(clamp(duration / 5, 4, 12));

/**
 * Najbardziej strome spadki krzywej (§5.13): największa różnica szczyt − dołek na wygładzonej
 * krzywej (przy remisie krótszy, czyli bardziej stromy), zawężona do stromej części na surowej krzywej.
 * Odrzucamy spadki < 8 pp i wolniejsze niż 1,5 pp/s. Najwyżej 3, bez nakładania się.
 */
export function findDrops(curve: readonly CurvePoint[], opts: DropOptions = {}): AttentionDrop[] {
  if (curve.length < 2) return [];
  const bin = curveBin(curve);
  const duration = curve[curve.length - 1].t + bin;
  const W = Math.max(1, Math.round((opts.windowSeconds ?? dropWindow(duration)) / bin));
  const minDelta = opts.minDelta ?? 0.08;
  const minSlope = opts.minSlope ?? 0.015;
  const max = opts.max ?? 3;
  const s = smooth(curve.map((p) => p.value));
  const used = new Uint8Array(s.length);
  const drops: AttentionDrop[] = [];
  for (let guard = 0; drops.length < max && guard < 20; guard++) {
    let best: { i: number; j: number; d: number } | null = null;
    for (let i = 0; i < s.length; i++) {
      const a = s[i];
      if (a === null || used[i]) continue;
      for (let j = i + 1; j <= Math.min(s.length - 1, i + W); j++) {
        if (used[j]) break;
        const b = s[j];
        if (b === null) continue;
        const d = a - b;
        if (!best || d > best.d + 1e-9 || (Math.abs(d - best.d) < 1e-9 && j - i < best.j - best.i)) best = { i, j, d };
      }
    }
    if (!best || best.d < minDelta) break;
    let { i, j } = best;
    const raw = (k: number) => curve[k].value ?? s[k] ?? 0;
    const tol = Math.max(0.03, 0.15 * best.d);
    const peak = raw(i);
    const low = raw(j);
    while (i + 1 < j && (curve[i + 1].value ?? -1) >= peak - tol) i++;
    while (j - 1 > i && (curve[j - 1].value ?? 2) <= low + tol) j--;
    const from = raw(i);
    const to = raw(j);
    for (let k = Math.max(0, i - 1); k <= Math.min(s.length - 1, j + 1); k++) used[k] = 1;
    const seconds = Math.max(bin, (j - i) * bin);
    if ((from - to) / seconds < minSlope || from - to < minDelta) continue;
    const n = Math.round(mean([curve[i].n, curve[j].n].filter((x) => x > 0)) || 0);
    drops.push({ start: curve[i].t, end: Math.round((curve[j].t + bin) * 1000) / 1000, from, to, delta: from - to, lost: Math.round((from - to) * n), n });
  }
  return drops.sort((a, b) => b.delta - a.delta);
}

export interface IntervalStat {
  t0: number;
  t1: number;
  /** Średni udział patrzących w przedziale. */
  mean: number | null;
  /** Wartość wygładzona na początku i na końcu przedziału. */
  startValue: number | null;
  endValue: number | null;
  min: number | null;
  n: number;
}

/** Statystyki uwagi w przedziałach [b0,b1), [b1,b2)… (granice scen albo równe odcinki). */
export function intervalStats(curve: readonly CurvePoint[], bounds: readonly number[]): IntervalStat[] {
  const out: IntervalStat[] = [];
  const s = smooth(curve.map((p) => p.value));
  const eps = 1e-6;
  for (let b = 0; b + 1 < bounds.length; b++) {
    const t0 = bounds[b];
    const t1 = bounds[b + 1];
    const idx = curve.map((_, i) => i).filter((i) => curve[i].t >= t0 - eps && curve[i].t < t1 - eps);
    const vals = idx.map((i) => curve[i].value).filter((v): v is number => v !== null);
    const sm = idx.map((i) => s[i]).filter((v): v is number => v !== null);
    out.push({
      t0,
      t1,
      mean: vals.length ? mean(vals) : null,
      startValue: sm.length ? sm[0] : null,
      endValue: sm.length ? sm[sm.length - 1] : null,
      min: vals.length ? Math.min(...vals) : null,
      n: idx.length ? Math.max(...idx.map((i) => curve[i].n)) : 0,
    });
  }
  return out;
}

/**
 * Równe przedziały, gdy brak scen (§5.14): do 30 s co max(2; round(d/4)) s, do 120 s co 10 s,
 * dłużej co max(15; round(d/12/5)·5) s. Końcówka krótsza niż 1/3 przedziału dołącza do poprzedniego.
 */
export function intervalBounds(duration: number): number[] {
  if (duration <= 0) return [0, 1];
  const len = duration <= 30 ? Math.max(2, Math.round(duration / 4)) : duration <= 120 ? 10 : Math.max(15, Math.round(duration / 12 / 5) * 5);
  const out: number[] = [];
  for (let t = 0; t < duration - 1e-6; t += len) out.push(t);
  if (out.length > 1 && duration - out[out.length - 1] < len / 3) out.pop();
  out.push(duration);
  return out;
}

/** Średnia uwaga jednego widza: udział przedziałów, w których patrzy (opcjonalnie w oknie [t0, t1)). */
export function viewerMean(states: readonly BinState[], bin: number, t0 = 0, t1 = Infinity): number | null {
  let s = 0;
  let n = 0;
  states.forEach((v, k) => {
    const t = k * bin;
    if (v === null || t < t0 - 1e-9 || t >= t1 - 1e-9) return;
    s += v;
    n++;
  });
  return n ? s / n : null;
}

/** Średnia uwaga z krzywej (każdy przedział z danymi ma tę samą wagę, §5.12). */
export function curveMean(curve: readonly CurvePoint[], t0 = 0, t1 = Infinity): number | null {
  const v = curve.filter((p) => p.t >= t0 - 1e-9 && p.t < t1 - 1e-9 && p.value !== null).map((p) => p.value as number);
  return v.length ? mean(v) : null;
}

/** Stan widza w chwili t (przedział zawierający t). */
export const stateAt = (states: readonly BinState[], bin: number, t: number): BinState => states[Math.floor(t / bin + 1e-9)] ?? null;

/**
 * Utrzymanie hooka (§6.4): spośród widzów patrzących w 0–0,5 s odsetek patrzących w 2,5–3,0 s.
 * Zwraca liczniki do testu proporcji.
 */
export function hookRetention(viewers: readonly BinState[][], bin: number): { retained: number; base: number; value: number | null } {
  let base = 0;
  let retained = 0;
  for (const v of viewers) {
    if (stateAt(v, bin, 0) !== 1) continue;
    const late = stateAt(v, bin, 2.5);
    if (late === null) continue;
    base++;
    if (late === 1) retained++;
  }
  return { retained, base, value: base ? retained / base : null };
}
