/**
 * Reguły zamieniające metryki na wnioski w języku montażu (§8.1–§8.2). Każdy wniosek rozdziela:
 * fakt (zmierzone liczby) → obserwację (wzorzec w danych) → hipotezę (możliwa przyczyna,
 * zaznaczona niepewność) → rekomendację (konkretna zmiana montażowa). Warstwa AI dostaje
 * te same liczby i nie może dodawać nowych.
 */
import { PLATFORM_SPECS, type Platform } from '../config/platforms';
import { formatTime } from '../core/math/util';
import type { DropWithContext, Segment, VariantReport } from './report';
import type { ResearchText, SegmentRef } from './text';

export type FindingKind = 'drop' | 'weak_segment' | 'hook' | 'ending' | 'aoi_missed' | 'text_unread' | 'unsafe_zone' | 'brand_late' | 'cta_missed' | 'feed_skip' | 'strong';
export type FindingSeverity = 'high' | 'medium' | 'positive';

export interface Finding {
  id: string;
  kind: FindingKind;
  severity: FindingSeverity;
  title: string;
  /** Tylko zmierzone liczby. */
  fact: string;
  observation: string | null;
  hypothesis: string | null;
  recommendation: string | null;
  t0: number;
  t1: number;
  /** Wniosek z małej próby (< 10 widzów). */
  preliminary: boolean;
}

export const MAX_FINDINGS = 6;
const P = (v: number) => Math.round(v * 100);
/** Znaczniki czasu: początek w dół, koniec w górę — przedział obejmuje cały spadek (rozdzielczość 0,5 s). */
const T = (t: number) => formatTime(Math.floor(t + 1e-6), 0);
const TE = (t: number) => formatTime(Math.ceil(t - 1e-6), 0);
const S1 = (v: number) => (Math.round(v * 10) / 10).toString();

/** Opis segmentu dla tekstów (scena albo fragment czasu). */
export const segRef = (seg: Segment): SegmentRef => ({ kind: seg.source, n: seg.index + 1, range: seg.label });

export interface FindingContext {
  vertical: boolean;
  platform: Platform;
  /** Wyniki feedu (M6): zatrzymanie scrolla testowanego klipu i wypełniaczy, istotność różnicy. */
  feed?: { stop: number; fillerStop: number; significant: boolean; stopSeconds: number } | null;
}

function dropFinding(d: DropWithContext, i: number, ctx: FindingContext, preliminary: boolean, tx: ResearchText): Finding {
  const x = tx.findings.drop;
  const seg = d.segment ? segRef(d.segment) : null;
  const from = T(d.start);
  const to = TE(d.end);
  let observation: string | null = null;
  let hypothesis: string | null = null;
  let recommendation: string;
  if (ctx.vertical && d.start < 3) {
    ({ observation, hypothesis, recommendation } = x.start);
  } else if (seg && d.afterCut) {
    observation = x.afterCut.observation(seg);
    hypothesis = x.afterCut.hypothesis;
    recommendation = x.afterCut.recommendation(seg);
  } else if (seg && d.intoSegment !== null && d.intoSegment >= 2) {
    observation = x.intoScene.observation({ seconds: Math.round(d.intoSegment), seg });
    hypothesis = x.intoScene.hypothesis;
    recommendation = x.intoScene.recommendation({ seg, cut: Math.max(2, Math.round(d.end - d.start)), before: from });
  } else {
    recommendation = x.genericRecommendation({ from, to });
  }
  return {
    id: `drop-${i}`,
    kind: 'drop',
    severity: d.delta >= 0.2 ? 'high' : 'medium',
    title: x.title({ where: seg ? tx.seg(seg, 'nom') : null, deltaPp: P(d.delta), from, to }),
    fact: x.fact({ from, to, fromPct: P(d.from), toPct: P(d.to), deltaPp: P(d.delta), lost: d.lost, n: d.n }),
    observation,
    hypothesis,
    recommendation,
    t0: d.start,
    t1: d.end,
    preliminary,
  };
}

export function buildFindings(r: VariantReport, ctx: FindingContext, tx: ResearchText): Finding[] {
  if (!r.viewers || r.meanAttention === null) return [];
  const f = tx.findings;
  const preliminary = r.level === 'preview';
  const out: Finding[] = [];
  const film = r.meanAttention;
  const base = { observation: null, preliminary } as const;

  // Spadek ≥ 10 pp (high przy ≥ 20 pp).
  r.drops.filter((d) => d.delta >= 0.1).forEach((d, i) => out.push(dropFinding(d, i, ctx, preliminary, tx)));

  // Słaby segment: z rankingu i bez spadku ≥ 10 pp w tym segmencie.
  for (const s of r.segments.filter((x) => x.fixRank !== null).sort((a, b) => (a.fixRank ?? 9) - (b.fixRank ?? 9))) {
    const hasDrop = r.drops.some((d) => d.delta >= 0.1 && d.start >= s.t0 && d.start < s.t1);
    if (hasDrop || s.mean === null) continue;
    const ref = segRef(s);
    const change = s.change !== null && s.change <= -0.05 ? f.weak.change(P(-s.change)) : '';
    const lowest = r.segments.every((o) => o.mean === null || o.mean >= s.mean!);
    out.push({
      ...base,
      id: `segment-${s.index}`,
      kind: 'weak_segment',
      severity: film - s.mean >= 0.15 ? 'high' : 'medium',
      title: f.weak.title({ seg: ref, low: s.mean < film - 0.03, lowest }),
      fact: f.weak.fact({ seg: ref, from: T(s.t0), to: TE(s.t1), meanPct: P(s.mean), filmPct: P(film) }) + change,
      hypothesis: f.weak.hypothesis,
      recommendation: f.weak.recommendation(ref),
      t0: s.t0,
      t1: s.t1,
    });
  }

  // Hook: uwaga @3 s poniżej 0,90 (pion) lub 0,85 (poziom), bez innego wniosku w 0–3 s.
  const limit = ctx.vertical ? 0.9 : 0.85;
  const at3 = r.hook.at3;
  if (at3 !== null && at3 < limit && !out.some((x) => x.t0 < 3)) {
    out.push({
      ...base,
      id: 'hook',
      kind: 'hook',
      severity: at3 < limit - 0.15 ? 'high' : 'medium',
      title: f.hook.title,
      fact: f.hook.fact({ pct: P(at3), limitPct: P(limit) }),
      hypothesis: f.hook.hypothesis,
      recommendation: ctx.vertical ? f.hook.recommendationVertical : f.hook.recommendationHorizontal,
      t0: 0,
      t1: 3,
    });
  }

  // Koniec: ostatnie 3 s ponad 10 pp poniżej średniej.
  if (r.endAttention !== null && r.endAttention < film - 0.1) {
    out.push({
      ...base,
      id: 'ending',
      kind: 'ending',
      severity: 'medium',
      title: f.ending.title,
      fact: f.ending.fact({ pct: P(r.endAttention), filmPct: P(film) }),
      hypothesis: f.ending.hypothesis,
      recommendation: f.ending.recommendation,
      t0: Math.max(0, r.duration - 3),
      t1: r.duration,
    });
  }

  for (const a of r.aois) {
    const name = a.aoi.name;
    // CTA niezauważone (zasięg < 50%).
    if (a.aoi.type === 'cta') {
      if (a.reach !== null && a.n >= 3 && a.reach < 0.5) {
        out.push({ ...base, id: `cta-${a.aoi.id}`, kind: 'cta_missed', severity: 'medium', title: f.cta.title(name), fact: f.cta.fact({ name, pct: P(a.reach), lookers: a.lookers, n: a.n }), hypothesis: f.cta.hypothesis, recommendation: f.cta.recommendation, t0: a.aoi.t0, t1: a.aoi.t1 });
      }
    } else if (a.aoi.type !== 'logo' && a.aoi.type !== 'product' && a.reach !== null && a.n >= 3 && a.reach < 0.5) {
      // Strefa niezauważona (marka liczona osobno jako moment marki).
      out.push({
        ...base,
        id: `aoi-${a.aoi.id}`,
        kind: 'aoi_missed',
        severity: a.reach < 0.3 ? 'high' : 'medium',
        title: f.aoi.title(name),
        fact: f.aoi.fact({ pct: P(a.reach), lookers: a.lookers, n: a.n, name, from: T(a.aoi.t0), to: TE(a.aoi.t1) }) + (a.small ? f.aoi.small : ''),
        hypothesis: f.aoi.hypothesis,
        recommendation: f.aoi.recommendation,
        t0: a.aoi.t0,
        t1: a.aoi.t1,
      });
    }
    // Napis nieprzeczytany (medium; high przy obu flagach).
    const rd = a.reading;
    if (rd && (rd.tooShort || rd.fewRead)) {
      const facts = [
        rd.tooShort ? f.text.factShort({ name, seconds: S1(a.aoi.t1 - a.aoi.t0), needed: S1(rd.needed), words: rd.words }) : null,
        rd.fewRead && a.dwellMedian !== null ? f.text.factFew({ name, median: S1(a.dwellMedian), needed: S1(rd.needed) }) : null,
      ].filter(Boolean);
      out.push({ ...base, id: `text-${a.aoi.id}`, kind: 'text_unread', severity: rd.tooShort && rd.fewRead ? 'high' : 'medium', title: f.text.title(name), fact: facts.join(' '), hypothesis: f.text.hypothesis, recommendation: f.text.recommendation, t0: a.aoi.t0, t1: a.aoi.t1 });
    }
    // Strefa zasłonięta przez interfejs platformy.
    if (a.unsafe) {
      const u = PLATFORM_SPECS[ctx.platform].unsafe;
      out.push({ ...base, id: `unsafe-${a.aoi.id}`, kind: 'unsafe_zone', severity: 'medium', title: f.unsafe.title(name), fact: f.unsafe.fact({ name }), hypothesis: f.unsafe.hypothesis, recommendation: f.unsafe.recommendation({ bottomPct: P(u?.bottom ?? 0.2) }), t0: a.aoi.t0, t1: a.aoi.t1 });
    }
  }

  // Marka za późno: mediana pierwszego spojrzenia > 3 s albo zasięg marki < 50%.
  const b = r.brand;
  if (b && b.n >= 3 && b.reach !== null && ((b.firstLookMedian !== null && b.firstLookMedian > 3) || b.reach < 0.5)) {
    out.push({
      ...base,
      id: 'brand',
      kind: 'brand_late',
      severity: 'medium',
      title: f.brand.title,
      fact: f.brand.fact({ median: b.firstLookMedian === null ? null : S1(b.firstLookMedian), by3Pct: P(b.by3s ?? 0), reachPct: P(b.reach) }),
      hypothesis: f.brand.hypothesis,
      recommendation: f.brand.recommendation,
      t0: 0,
      t1: Math.min(r.duration, Math.max(3, b.firstLookMedian ?? 3)),
    });
  }

  // Feed: przewijają testowany klip częściej niż wypełniacze (różnica istotna).
  if (ctx.feed && ctx.feed.significant && ctx.feed.stop < ctx.feed.fillerStop) {
    out.push({ ...base, id: 'feed', kind: 'feed_skip', severity: 'high', title: f.feedSkip.title, fact: f.feedSkip.fact({ stopPct: P(ctx.feed.stop), fillerPct: P(ctx.feed.fillerStop), seconds: S1(ctx.feed.stopSeconds) }), hypothesis: f.feedSkip.hypothesis, recommendation: f.feedSkip.recommendation, t0: 0, t1: Math.min(r.duration, 3) });
  }

  // Działa: najlepszy segment ≥ 5 pp powyżej średniej, przy co najmniej 2 segmentach.
  const best = [...r.segments].filter((s) => s.mean !== null).sort((x, y) => (y.mean ?? 0) - (x.mean ?? 0))[0];
  if (best && best.mean !== null && best.mean >= film + 0.05 && r.segments.length > 1) {
    const ref = segRef(best);
    out.push({ ...base, id: 'strong', kind: 'strong', severity: 'positive', title: f.strong.title(ref), fact: f.strong.fact({ seg: ref, pct: P(best.mean), filmPct: P(film) }), hypothesis: null, recommendation: f.strong.recommendation, t0: best.t0, t1: best.t1 });
  }

  const order: Record<FindingSeverity, number> = { high: 0, medium: 1, positive: 2 };
  return out.sort((a, c) => order[a.severity] - order[c.severity]).slice(0, MAX_FINDINGS);
}

/**
 * Liczby, które wolno przytoczyć w tekście (walidacja odpowiedzi AI, §8.4): liczby z metryk,
 * części znaczników czasu, liczby z tekstów reguł oraz 1, 2, 3, 30.
 */
export function allowedNumbers(r: VariantReport): Set<string> {
  const s = new Set<string>();
  const add = (v: number | null | undefined) => {
    if (v === null || v === undefined || !Number.isFinite(v)) return;
    s.add(String(Math.round(v)));
    s.add(String(Math.round(v * 10) / 10).replace('.', ','));
    s.add(String(Math.round(v * 10) / 10));
  };
  add(r.viewers);
  add(r.duration);
  for (const v of [r.meanAttention, r.hook.at1, r.hook.at2, r.hook.at3, r.hook.retention, r.endAttention]) if (v !== null) add(v * 100);
  for (const d of r.drops) [d.from * 100, d.to * 100, d.delta * 100, d.lost, d.n, d.start, d.end, d.intoSegment ?? NaN, d.end - d.start].forEach(add);
  for (const seg of r.segments) [seg.index + 1, seg.t0, seg.t1, (seg.mean ?? NaN) * 100, (seg.change ?? NaN) * -100, (seg.change ?? NaN) * 100].forEach(add);
  for (const a of r.aois) [(a.reach ?? NaN) * 100, a.lookers, a.n, a.aoi.t0, a.aoi.t1, a.firstLook ?? NaN, a.dwellMedian ?? NaN, a.reading?.needed ?? NaN, a.aoi.words ?? NaN].forEach(add);
  if (r.brand) [r.brand.firstLookMedian ?? NaN, (r.brand.by3s ?? NaN) * 100, (r.brand.reach ?? NaN) * 100].forEach(add);
  // Części znaczników czasu (00:07 → 0, 7).
  for (const t of [r.duration, ...r.drops.flatMap((d) => [d.start, d.end]), ...r.segments.flatMap((x) => [x.t0, x.t1]), ...r.aois.flatMap((a) => [a.aoi.t0, a.aoi.t1])])
    for (const stamp of [T(t), TE(t)]) for (const part of stamp.split(':')) s.add(String(Number(part)));
  for (const f of r.findings) for (const m of `${f.title} ${f.fact} ${f.recommendation ?? ''}`.match(/\d+(?:[.,]\d+)?/g) ?? []) s.add(m);
  ['1', '2', '3', '30'].forEach((x) => s.add(x));
  return s;
}
