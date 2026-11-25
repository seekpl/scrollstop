/**
 * Funkcje statystyczne bez zależności (§5.19, §5.21): rozkład normalny, test t Welcha,
 * test dwóch proporcji, korekta Holma, przedział Wilsona, bootstrap, kalkulator MDE.
 */
import { clamp, mulberry32 } from '../core/math/util';

/** erf — przybliżenie Abramowitza i Stegun 7.1.26 (błąd < 1,5·10⁻⁷). */
export function erf(x: number): number {
  const s = Math.sign(x);
  const a = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * a);
  const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-a * a);
  return s * y;
}

export const normalCdf = (x: number): number => 0.5 * (1 + erf(x / Math.SQRT2));

function logGamma(x: number): number {
  const c = [76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
  let y = x;
  const tmp = x + 5.5 - (x + 0.5) * Math.log(x + 5.5);
  let ser = 1.000000000190015;
  for (const ci of c) ser += ci / ++y;
  return -tmp + Math.log((2.5066282746310005 * ser) / x);
}

function betacf(a: number, b: number, x: number): number {
  const MAXIT = 200;
  const EPS = 3e-12;
  const FPMIN = 1e-300;
  const qab = a + b;
  const qap = a + 1;
  const qam = a - 1;
  let c = 1;
  let d = 1 - (qab * x) / qap;
  if (Math.abs(d) < FPMIN) d = FPMIN;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= MAXIT; m++) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    h *= d * c;
    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c;
    if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < EPS) break;
  }
  return h;
}

/** Regularyzowana niekompletna funkcja beta I_x(a, b). */
export function incompleteBeta(x: number, a: number, b: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const bt = Math.exp(logGamma(a + b) - logGamma(a) - logGamma(b) + a * Math.log(x) + b * Math.log(1 - x));
  return x < (a + 1) / (a + b + 2) ? (bt * betacf(a, b, x)) / a : 1 - (bt * betacf(b, a, 1 - x)) / b;
}

/** Dwustronna wartość p dla statystyki t o df stopniach swobody. */
export function tTwoSidedP(t: number, df: number): number {
  if (!Number.isFinite(t) || df <= 0) return 1;
  return incompleteBeta(df / (df + t * t), df / 2, 0.5);
}

export interface WelchResult {
  t: number;
  df: number;
  p: number;
  meanA: number;
  meanB: number;
}

/** Test t Welcha (różne wariancje) dla średnich dwóch grup (B − A). */
export function welch(a: readonly number[], b: readonly number[]): WelchResult | null {
  if (a.length < 2 || b.length < 2) return null;
  const m = (v: readonly number[]) => v.reduce((s, x) => s + x, 0) / v.length;
  const varS = (v: readonly number[], mu: number) => v.reduce((s, x) => s + (x - mu) ** 2, 0) / (v.length - 1);
  const ma = m(a);
  const mb = m(b);
  const va = varS(a, ma) / a.length;
  const vb = varS(b, mb) / b.length;
  const se = Math.sqrt(va + vb);
  if (se === 0) return { t: 0, df: a.length + b.length - 2, p: ma === mb ? 1 : 0, meanA: ma, meanB: mb };
  const t = (mb - ma) / se;
  const df = (va + vb) ** 2 / ((va * va) / (a.length - 1) + (vb * vb) / (b.length - 1));
  return { t, df, p: tTwoSidedP(t, df), meanA: ma, meanB: mb };
}

export interface ProportionTestResult {
  z: number;
  p: number;
  pA: number;
  pB: number;
}

/** Test dwóch proporcji (z, dwustronny, wariancja z połączonej próby): xA z nA vs xB z nB. */
export function twoProportionTest(xA: number, nA: number, xB: number, nB: number): ProportionTestResult | null {
  if (nA < 1 || nB < 1) return null;
  const pA = xA / nA;
  const pB = xB / nB;
  const pool = (xA + xB) / (nA + nB);
  const se = Math.sqrt(pool * (1 - pool) * (1 / nA + 1 / nB));
  if (se === 0) return { z: 0, p: pA === pB ? 1 : 0, pA, pB };
  const z = (pB - pA) / se;
  return { z, p: 2 * (1 - normalCdf(Math.abs(z))), pA, pB };
}

/**
 * Korekta Holma–Bonferroniego: wartości p skorygowane (monotonicznie), w kolejności wejścia.
 * Wartości null (test niemożliwy) przechodzą bez zmian i nie liczą się do m.
 */
export function holm(ps: ReadonlyArray<number | null>): Array<number | null> {
  const idx = ps.map((p, i) => ({ p, i })).filter((x): x is { p: number; i: number } => x.p !== null && Number.isFinite(x.p));
  const m = idx.length;
  idx.sort((a, b) => a.p - b.p);
  const out: Array<number | null> = ps.map((p) => (p === null ? null : p));
  let running = 0;
  idx.forEach((x, k) => {
    running = Math.max(running, Math.min(1, (m - k) * x.p));
    out[x.i] = running;
  });
  return out;
}

const Z95 = 1.96;

/** 95% przedział Wilsona dla proporcji x/n (§5.12). */
export function wilson(x: number, n: number, z = Z95): { lo: number; hi: number } {
  if (n <= 0) return { lo: 0, hi: 1 };
  const p = x / n;
  const d = 1 + (z * z) / n;
  const c = (p + (z * z) / (2 * n)) / d;
  const h = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / d;
  return { lo: clamp(c - h, 0, 1), hi: clamp(c + h, 0, 1) };
}

/** Przedział bootstrap 95% (percentylowy) dla średniej (§6.8). Deterministyczny (ziarno). */
export function bootstrapMeanCI(values: readonly number[], iterations = 2000, seed = 17): { lo: number; hi: number } | null {
  if (values.length < 2) return null;
  const rng = mulberry32(seed);
  const n = values.length;
  const means = new Float64Array(iterations);
  for (let b = 0; b < iterations; b++) {
    let s = 0;
    for (let i = 0; i < n; i++) s += values[Math.floor(rng() * n)];
    means[b] = s / n;
  }
  means.sort();
  return { lo: means[Math.floor(0.025 * (iterations - 1))], hi: means[Math.ceil(0.975 * (iterations - 1))] };
}

/** (z_α/2 + z_β)² dla α = 0,05 (dwustronnie) i mocy 80% (§5.21). */
const K = (1.96 + 0.84) ** 2;

/** Liczba widzów na wersję potrzebna do wykrycia różnicy p1 → p2 (§5.21). */
export function sampleSizeForProportions(p1: number, p2: number): number {
  const d = p1 - p2;
  if (Math.abs(d) < 1e-9) return Infinity;
  return Math.ceil((K * (p1 * (1 - p1) + p2 * (1 - p2))) / (d * d));
}

/**
 * Minimalna wykrywalna różnica (MDE) przy n widzach na wersję, dla bazowej proporcji p1
 * (spadek do p2 = p1 − d). Szukamy najmniejszego d, dla którego wymagane n ≤ podane n.
 */
export function minimumDetectableDifference(n: number, p1 = 0.7): number {
  if (n <= 0) return 1;
  let lo = 0.001;
  let hi = p1;
  if (sampleSizeForProportions(p1, p1 - hi) > n) return hi;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (sampleSizeForProportions(p1, p1 - mid) <= n) hi = mid;
    else lo = mid;
  }
  return hi;
}
