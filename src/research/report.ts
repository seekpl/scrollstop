/**
 * Raport (§7): liczony z sesji, ten sam kod w przeglądarce i na serwerze (link udostępniania, AI).
 */
import { formatTime, mean } from '../core/math/util';
import { aoiMetrics, brandMoment, type AoiResult, type BrandMoment } from './aoi';
import {
  attentionCurve,
  binSize,
  curveMean,
  findDrops,
  hookRetention,
  intervalBounds,
  intervalStats,
  valueAt,
  viewerBins,
  viewerMean,
  type AttentionDrop,
  type BinState,
  type CurvePoint,
  type IntervalStat,
} from './attention';
import { buildFindings, type FindingContext, type Finding } from './insights';
import type { AgeBand, DeviceType, Project, RejectCode, Variant, VariantId, ViewerSession } from './model';
import { MIN_VERDICT_SAMPLE, reportSessions, sampleLevel, type SampleLevel } from './sessions';
import { holm, twoProportionTest, welch, type ProportionTestResult, type WelchResult } from './statsMath';
import type { ResearchText } from './text';

export interface Segment {
  index: number;
  label: string;
  t0: number;
  t1: number;
  source: 'scene' | 'interval';
}

export interface SegmentStat extends Segment, IntervalStat {
  /** Zmiana od początku do końca segmentu (ujemna = utrata uwagi). */
  change: number | null;
  /** Pozycja w rankingu „do poprawy” (1 = najpilniejsza); null = bez problemu. */
  fixRank: number | null;
}

export interface DropWithContext extends AttentionDrop {
  /** Segment (scena), w którym zaczyna się spadek. */
  segment: Segment | null;
  /** Spadek zaczyna się od 0,5 s przed do 1,5 s po cięciu. */
  afterCut: boolean;
  /** Ile sekund od początku sceny zaczyna się spadek. */
  intoSegment: number | null;
}

export interface SessionsSummary {
  total: number;
  valid: number;
  rejected: number;
  rejectedBy: Partial<Record<RejectCode, number>>;
  simulated: number;
  byDevice: Record<DeviceType, number>;
  byQuality: Record<'GOOD' | 'FAIR' | 'POOR' | 'NONE', number>;
  byAge: Partial<Record<AgeBand, number>>;
  audioOn: number;
  audioOff: number;
  panel: number;
  community: number;
}

export interface HookMetrics {
  at1: number | null;
  at2: number | null;
  at3: number | null;
  /** Utrzymanie hooka (§6.4). */
  retention: number | null;
  retained: number;
  base: number;
  /** Mini-krzywa 0–10 s co 0,5 s (§7 pkt 3). */
  mini: Array<{ t: number; value: number | null }>;
}

export interface VariantReport {
  variantId: VariantId;
  label: string;
  duration: number;
  /** Rozdzielczość krzywej (s). */
  bin: number;
  viewers: number;
  level: SampleLevel;
  sessions: SessionsSummary;
  curve: CurvePoint[];
  meanAttention: number | null;
  hook: HookMetrics;
  /** Średnia z ostatnich 3 s (materiały ≥ 6 s). */
  endAttention: number | null;
  drops: DropWithContext[];
  segments: SegmentStat[];
  aois: AoiResult[];
  brand: BrandMoment | null;
  findings: Finding[];
  /** Średnia uwaga każdego widza (do testów A/B). */
  perViewer: number[];
  /** Stany widzów w przedziałach (do porównań w oknach). */
  states: BinState[][];
}

export function summarizeSessions(all: readonly ViewerSession[]): SessionsSummary {
  const out: SessionsSummary = {
    total: all.length,
    valid: 0,
    rejected: 0,
    rejectedBy: {},
    simulated: 0,
    byDevice: { desktop: 0, tablet: 0, mobile: 0 },
    byQuality: { GOOD: 0, FAIR: 0, POOR: 0, NONE: 0 },
    byAge: {},
    audioOn: 0,
    audioOff: 0,
    panel: 0,
    community: 0,
  };
  for (const s of all) {
    if (s.status === 'valid') out.valid++;
    else {
      out.rejected++;
      if (s.rejectCode) out.rejectedBy[s.rejectCode] = (out.rejectedBy[s.rejectCode] ?? 0) + 1;
    }
    if (s.source === 'simulated') out.simulated++;
    if (s.status !== 'valid') continue;
    out.byDevice[s.device.type]++;
    out.byQuality[s.calibration?.quality ?? 'NONE']++;
    out.byAge[s.ageBand] = (out.byAge[s.ageBand] ?? 0) + 1;
    if (s.audio.mode === 'on' && s.audio.confirmed) out.audioOn++;
    else out.audioOff++;
    if (s.panel) out.panel++;
    else out.community++;
  }
  return out;
}

export function segmentsFor(variant: Pick<Variant, 'scenes'>, duration: number, tx: ResearchText): Segment[] {
  const scenes = (variant.scenes ?? []).filter((s) => s.end > s.start).sort((a, b) => a.start - b.start);
  if (scenes.length >= 2) return scenes.map((s, i) => ({ index: i, label: tx.scene(i + 1), t0: s.start, t1: Math.min(s.end, duration || s.end), source: 'scene' }));
  const b = intervalBounds(duration);
  return b.slice(0, -1).map((t0, i) => ({ index: i, label: `${formatTime(t0, 0)}–${formatTime(b[i + 1], 0)}`, t0, t1: b[i + 1], source: 'interval' }));
}

/** Długość wersji: z projektu, a jeśli nieznana — najdłuższy obejrzany fragment. */
export function variantDuration(variant: Pick<Variant, 'duration'>, sessions: readonly ViewerSession[]): number {
  if (variant.duration > 0) return variant.duration;
  return Math.max(0, ...sessions.map((s) => s.mediaDuration || 0));
}

export interface ReportOptions {
  /** Raporty przykładowe: sesje symulowane wchodzą do raportu. */
  includeSimulated?: boolean;
  feed?: FindingContext['feed'];
}

export function buildVariantReport(
  project: Pick<Project, 'platform' | 'kind'>,
  variant: Variant,
  allSessions: readonly ViewerSession[],
  tx: ResearchText,
  opts: ReportOptions = {},
): VariantReport {
  const own = allSessions.filter((s) => s.variantId === variant.id);
  const valid = reportSessions(own, { includeSimulated: opts.includeSimulated });
  const duration = variantDuration(variant, own);
  const bin = binSize(duration);
  const states = valid.map((s) => viewerBins(s.data, duration, bin));
  const curve = attentionCurve(states, duration, bin);
  const segments = segmentsFor(variant, duration, tx);
  const stats = intervalStats(curve, [...segments.map((s) => s.t0), segments.length ? segments[segments.length - 1].t1 : duration]);
  const film = curveMean(curve);
  const segStats: SegmentStat[] = segments.map((seg, i) => {
    const st = stats[i];
    const change = st.startValue !== null && st.endValue !== null ? st.endValue - st.startValue : null;
    return { ...seg, ...st, t0: seg.t0, t1: seg.t1, change, fixRank: null };
  });
  // Ranking „do poprawy” (§5.14): wynik = max(0; −zmiana) + max(0; średnia − średnia segmentu).
  segStats
    .map((s) => ({ s, score: Math.max(0, -(s.change ?? 0)) + Math.max(0, (film ?? 0) - (s.mean ?? film ?? 0)) }))
    .filter((x) => x.s.mean !== null && x.score >= 0.08 && (x.s.mean < (film ?? 0) - 0.03 || (x.s.change ?? 0) <= -0.1))
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .forEach((x, i) => (x.s.fixRank = i + 1));

  const cuts = segments.filter((s, i) => i > 0 && s.source === 'scene').map((s) => s.t0);
  const drops: DropWithContext[] = findDrops(curve).map((d) => {
    const seg = segments.find((s) => d.start >= s.t0 - 1e-9 && d.start < s.t1 - 1e-9) ?? null;
    const afterCut = cuts.some((c) => d.start >= c - 0.5 && d.start <= c + 1.5);
    return { ...d, segment: seg, afterCut, intoSegment: seg ? d.start - seg.t0 : null };
  });

  const ret = hookRetention(states, bin);
  const vertical = variant.height > variant.width;
  const sessionsData = valid.map((s) => s.data);
  const report: VariantReport = {
    variantId: variant.id,
    label: variant.label,
    duration,
    bin,
    viewers: valid.length,
    level: sampleLevel(valid.length),
    sessions: summarizeSessions(own),
    curve,
    meanAttention: film,
    hook: {
      at1: duration >= 1.5 ? valueAt(curve, 1) : null,
      at2: duration >= 2.5 ? valueAt(curve, 2) : null,
      at3: duration >= 3.5 ? valueAt(curve, 3) : null,
      retention: ret.value,
      retained: ret.retained,
      base: ret.base,
      mini: curve.filter((p) => p.t < 10 - 1e-9).map((p) => ({ t: p.t, value: p.value })),
    },
    endAttention: duration >= 6 ? curveMean(curve, Math.max(0, duration - 3)) : null,
    drops,
    segments: segStats,
    aois: variant.aois.map((a) => aoiMetrics(a, sessionsData, { platform: project.platform })),
    brand: brandMoment(variant.aois, sessionsData, duration),
    findings: [],
    perViewer: states.map((st) => viewerMean(st, bin)).filter((v): v is number => v !== null),
    states,
  };
  report.findings = buildFindings(report, { vertical, platform: project.platform, feed: opts.feed ?? null }, tx);
  return report;
}

const P = (v: number | null) => (v === null ? '–' : `${Math.round(v * 100)}%`);
const pp = (v: number) => Math.abs(Math.round(v * 100));

/** Zdanie otwierające raportu (§7 pkt 2), też na stronie głównej. */
export function headline(r: VariantReport | null, tx: ResearchText): { lead: string; detail: string | null } {
  if (!r || !r.viewers || r.meanAttention === null) return { lead: tx.headline.empty, detail: null };
  const d = r.drops.filter((x) => x.delta >= 0.1)[0];
  if (!d) return { lead: tx.headline.stable({ meanPct: Math.round(r.meanAttention * 100) }), detail: tx.headline.stableDetail };
  const where = d.segment ? tx.seg({ kind: d.segment.source, n: d.segment.index + 1, range: d.segment.label }, 'nom') : null;
  return {
    lead: tx.headline.drop({ from: formatTime(Math.floor(d.start + 1e-6), 0), to: formatTime(Math.ceil(d.end - 1e-6), 0), where }),
    detail: tx.headline.dropDetail({ fromPct: Math.round(d.from * 100), toPct: Math.round(d.to * 100), deltaPp: Math.round(d.delta * 100), meanPct: Math.round(r.meanAttention * 100) }),
  };
}

export interface VariantComparisonRow {
  id: VariantId;
  label: string;
  viewers: number;
  mean: number | null;
  hookRetention: number | null;
  /** Wobec wersji A (null dla A). */
  diff: number | null;
  welch: WelchResult | null;
  welchAdj: number | null;
  proportion: ProportionTestResult | null;
  proportionAdj: number | null;
  /** Różnica rozstrzygająca: p < 0,05 po korekcie i ≥ 15 widzów w obu wersjach. */
  significant: boolean;
}

export interface SegmentComparison {
  label: string;
  values: Array<number | null>;
  /** B − A dla dwóch wersji; największa różnica względem A przy więcej wersjach. */
  diff: number | null;
}

export interface VariantsComparison {
  reports: VariantReport[];
  rows: VariantComparisonRow[];
  verdict: VariantId | 'unclear';
  segments: SegmentComparison[];
  biggest: SegmentComparison | null;
  aois: Array<{ name: string; values: Array<number | null> }>;
  /** Okno porównania (hook: część różna, [0, sharedFrom)). */
  window: [number, number] | null;
  holm: boolean;
  summary: string;
  testLine: string | null;
  hookLine: string | null;
}

/**
 * Porównanie wersji A/B/C/D (§4.3, §5.19): test t Welcha na średniej uwadze widza, test dwóch
 * proporcji dla utrzymania hooka @3 s; przy > 2 wersjach każda kontra A z korektą Holma.
 * Werdykt tylko przy p < 0,05 po korekcie i ≥ 15 ważnych sesjach w każdej porównywanej wersji.
 */
export function compareVariants(reports: VariantReport[], tx: ResearchText, opts: { sharedFrom?: number; formatP?: (p: number) => string } = {}): VariantsComparison {
  const [a, ...others] = reports;
  const window: [number, number] | null = opts.sharedFrom && opts.sharedFrom > 0 ? [0, opts.sharedFrom] : null;
  const meanIn = (r: VariantReport) => (window ? r.states.map((st) => viewerMean(st, r.bin, window[0], window[1])).filter((v): v is number => v !== null) : r.perViewer);
  const curveIn = (r: VariantReport) => (window ? curveMean(r.curve, window[0], window[1]) : r.meanAttention);
  const aVals = meanIn(a);
  const raw = others.map((b) => ({ b, w: welch(aVals, meanIn(b)), pr: twoProportionTest(a.hook.retained, a.hook.base, b.hook.retained, b.hook.base) }));
  const useHolm = others.length > 1;
  const wAdj = useHolm ? holm(raw.map((x) => x.w?.p ?? null)) : raw.map((x) => x.w?.p ?? null);
  const pAdj = useHolm ? holm(raw.map((x) => x.pr?.p ?? null)) : raw.map((x) => x.pr?.p ?? null);
  const aMean = curveIn(a);
  const rows: VariantComparisonRow[] = [
    { id: a.variantId, label: a.label, viewers: a.viewers, mean: aMean, hookRetention: a.hook.retention, diff: null, welch: null, welchAdj: null, proportion: null, proportionAdj: null, significant: false },
    ...raw.map(({ b, w, pr }, i) => {
      const m = curveIn(b);
      const enough = a.viewers >= MIN_VERDICT_SAMPLE && b.viewers >= MIN_VERDICT_SAMPLE;
      return {
        id: b.variantId,
        label: b.label,
        viewers: b.viewers,
        mean: m,
        hookRetention: b.hook.retention,
        diff: m !== null && aMean !== null ? m - aMean : null,
        welch: w,
        welchAdj: wAdj[i],
        proportion: pr,
        proportionAdj: pAdj[i],
        significant: enough && wAdj[i] !== null && wAdj[i]! < 0.05 && m !== null && aMean !== null,
      };
    }),
  ];
  const better = rows.filter((r) => r.significant && (r.diff ?? 0) > 0).sort((x, y) => (y.mean ?? 0) - (x.mean ?? 0));
  const worse = rows.slice(1).every((r) => r.significant && (r.diff ?? 0) < 0);
  const verdict: VariantId | 'unclear' = better.length ? better[0].id : rows.length > 1 && worse ? a.variantId : 'unclear';

  // Segmenty: po indeksie sceny (ta sama struktura) albo równe przedziały najkrótszej wersji.
  const paired = reports.every((r) => r.segments.length === a.segments.length && r.segments.every((s, i) => s.source === a.segments[i].source));
  let segments: SegmentComparison[];
  if (paired) {
    segments = a.segments.map((s, i) => {
      const values = reports.map((r) => r.segments[i].mean);
      return { label: s.label, values, diff: diffOf(values) };
    });
  } else {
    const bounds = intervalBounds(Math.min(...reports.map((r) => r.duration)));
    const per = reports.map((r) => intervalStats(r.curve, bounds));
    segments = per[0].map((s, i) => {
      const values = per.map((p) => p[i].mean);
      return { label: `${formatTime(s.t0, 0)}–${formatTime(s.t1, 0)}`, values, diff: diffOf(values) };
    });
  }
  const biggest = segments.filter((s) => s.diff !== null).sort((x, y) => Math.abs(y.diff!) - Math.abs(x.diff!))[0] ?? null;
  const aois = a.aois.map((ra) => ({
    name: ra.aoi.name,
    values: reports.map((r) => r.aois.find((x) => x.aoi.name.trim().toLowerCase() === ra.aoi.name.trim().toLowerCase())?.reach ?? null),
  }));

  const means = tx.ab.means(rows.map((r) => `${r.id} ${P(r.mean)}`).join(', '));
  let summary: string;
  if (rows.some((r) => r.mean === null) || rows.length < 2) summary = tx.ab.noData;
  else if (verdict === 'unclear') summary = `${means} ${tx.ab.unclear({ enough: rows.every((r) => r.viewers >= MIN_VERDICT_SAMPLE) })}`;
  else {
    const win = rows.find((r) => r.id === verdict)!;
    const lose = verdict === a.variantId ? rows.slice(1).sort((x, y) => (y.mean ?? 0) - (x.mean ?? 0))[0] : rows[0];
    summary = tx.ab.winner({ win: win.id, pp: pp((win.mean ?? 0) - (lose.mean ?? 0)), winVal: P(win.mean), loseVal: P(lose.mean), vs: lose.id });
  }
  if (biggest && biggest.diff !== null && Math.abs(biggest.diff) >= 0.05) {
    const idx = biggest.values.reduce<number>((best, v, i) => (v !== null && (best < 0 || v > (biggest.values[best] ?? -1)) ? i : best), -1);
    summary += ` ${tx.ab.biggest({ label: biggest.label, win: rows[Math.max(0, idx)].id, pp: pp(biggest.diff) })}`;
  }
  if (window && reports.every((r) => r.duration > window[1])) {
    const rest = reports.map((r) => curveMean(r.curve, window[1]));
    const spread = Math.max(...rest.map((v) => v ?? 0)) - Math.min(...rest.map((v) => v ?? 0));
    summary += ` ${tx.ab.sharedRest({ from: formatTime(window[1], 0), pp: pp(spread) })}`;
  }
  const fmt = opts.formatP ?? ((p: number) => (p < 0.001 ? '< 0.001' : p.toFixed(3)));
  const minP = (xs: Array<number | null>) => xs.filter((x): x is number => x !== null).sort((x, y) => x - y)[0];
  const wBest = minP(wAdj);
  const pBest = minP(pAdj);
  return {
    reports,
    rows,
    verdict,
    segments,
    biggest,
    aois,
    window,
    holm: useHolm,
    summary,
    testLine: wBest === undefined ? null : tx.ab.testLine({ p: fmt(wBest), min: MIN_VERDICT_SAMPLE, holm: useHolm }),
    hookLine: pBest === undefined ? null : tx.ab.hookLine({ p: fmt(pBest), holm: useHolm }),
  };
}

function diffOf(values: Array<number | null>): number | null {
  const [a, ...rest] = values;
  if (a === null) return null;
  const ds = rest.filter((v): v is number => v !== null).map((v) => v - a);
  if (!ds.length) return null;
  return ds.sort((x, y) => Math.abs(y) - Math.abs(x))[0];
}

/** Średnia z listy, null dla pustej. */
export const meanOrNull = (v: number[]): number | null => (v.length ? mean(v) : null);
