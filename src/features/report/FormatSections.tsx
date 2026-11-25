import { useMemo } from 'react';
import { useI18n } from '../../i18n';
import { formatNumber, formatPct } from '../../i18n/format';
import type { CarouselMetrics } from '../../research/carousel';
import { focusItem } from '../../research/compact';
import type { FeedMetrics } from '../../research/feed';
import type { GridMetrics } from '../../research/grid';
import type { CompactSamples, MediaSource } from '../../research/model';
import { Callout } from '../../ui/kit';
import { TOKENS } from '../../ui/tokens';
import { useMediaFrames } from './frames';
import { HeatLegend, SceneHeatmap } from './Visuals';

function Card({ label, value, hint }: { label: string; value: string; hint?: string | null }) {
  return (
    <div className="min-w-0 rounded-2xl bg-surface p-4 ring-1 ring-line">
      <div className="text-[13px] text-muted">{label}</div>
      <div className="tabular mt-1 text-[26px] font-semibold tracking-[-0.02em] text-ink">{value}</div>
      {hint && <div className="mt-0.5 text-[12.5px] leading-snug text-muted">{hint}</div>}
    </div>
  );
}

/** Słupki poziome (histogram): etykieta, liczba, długość względem maksimum. Bez kolorów kategorii. */
function Bars({ rows, label }: { rows: Array<{ key: string; label: string; n: number; text?: string }>; label: string }) {
  const max = Math.max(1, ...rows.map((r) => r.n));
  return (
    <figure className="min-w-0">
      <figcaption className="mb-2 text-[14px] font-semibold text-ink">{label}</figcaption>
      <ul className="space-y-1.5" aria-label={label}>
        {rows.map((r) => (
          <li key={r.key} className="grid grid-cols-[4.5rem_minmax(0,1fr)_3rem] items-center gap-2 text-[13px]">
            <span className="tabular text-muted">{r.label}</span>
            <span className="h-3 rounded-sm bg-ink/[0.06]">
              <span className="block h-3 rounded-sm" style={{ width: `${(r.n / max) * 100}%`, background: TOKENS.cobalt }} />
            </span>
            <span className="tabular text-right text-ink">{r.text ?? r.n}</span>
          </li>
        ))}
      </ul>
    </figure>
  );
}

/** Test w feedzie (§7 pkt 10): zatrzymanie scrolla, czas na klipie wobec wypełniaczy, pętle, momenty przewinięcia. */
export function FeedPanel({ feed }: { feed: FeedMetrics }) {
  const { t, locale } = useI18n();
  const f = t.report.feed;
  const P = (v: number | null) => formatPct(v, locale);
  const S = (v: number | null) => (v === null ? '–' : `${formatNumber(v, locale, 1)} s`);
  const swipes = feed.swipes.filter((b, i, a) => b.n > 0 || a.slice(i).some((x) => x.n > 0));
  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Card label={f.stop} value={P(feed.stop)} hint={f.stopHint(formatNumber(feed.stopSeconds, locale, 1), P(feed.fillerStop))} />
        <Card label={f.gazeStop} value={P(feed.gazeStop)} hint={f.gazeStopHint} />
        <Card label={f.dwell} value={S(feed.dwellMedian)} hint={f.dwellHint(S(feed.dwellMean), feed.dwellCi ? `${formatNumber(feed.dwellCi.lo, locale, 1)}–${formatNumber(feed.dwellCi.hi, locale, 1)} s` : null, S(feed.fillerDwellMean))} />
        <Card label={f.completion} value={P(feed.completion)} hint={f.loops(feed.meanLoops === null ? '–' : formatNumber(feed.meanLoops, locale, 1))} />
        <Card label={f.notLooking} value={P(feed.notLooking)} hint={f.notLookingHint} />
      </div>
      <p className="text-[13.5px] leading-relaxed text-muted">
        {feed.stopP === null ? f.noTest : feed.significant ? f.significant(feed.stopP < 0.001 ? `< ${formatNumber(0.001, locale, 3)}` : `= ${formatNumber(feed.stopP, locale, 3)}`) : f.notSignificant(feed.stopP < 0.001 ? `< ${formatNumber(0.001, locale, 3)}` : `= ${formatNumber(feed.stopP, locale, 3)}`)}
      </p>
      {swipes.some((b) => b.n > 0) && (
        <div className="max-w-xl">
          <Bars label={f.swipes} rows={swipes.map((b) => ({ key: String(b.t0), label: `${b.t0}–${b.t1} s`, n: b.n }))} />
        </div>
      )}
    </div>
  );
}

/** Test miniatury (§4.5, §6 pkt 16): spojrzenia, pierwsze spojrzenie, udział, kolejność, wybór (deklaracja). */
export function GridPanel({ grid }: { grid: GridMetrics }) {
  const { t, locale } = useI18n();
  const g = t.report.grid;
  const P = (v: number | null) => formatPct(v, locale);
  const chosen = grid.choice.asked ? grid.choice.tested / grid.choice.asked : null;
  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Card label={g.looked} value={P(grid.looked)} hint={g.lookedHint(grid.lookedCount, grid.viewers)} />
        <Card label={g.firstLook} value={grid.firstLookMedian === null ? '–' : `${formatNumber(grid.firstLookMedian, locale, 1)} s`} hint={g.firstLookHint} />
        <Card label={g.dwellShare} value={P(grid.dwellShare)} hint={g.dwellShareHint} />
        <Card label={g.rank} value={grid.rankMedian === null ? '–' : g.rankValue(formatNumber(grid.rankMedian, locale, 1), grid.cells)} hint={g.rankHint} />
        <Card label={g.position} value={grid.positionIndex === null ? '–' : `${formatNumber(grid.positionIndex, locale, 2)}×`} hint={g.positionHint} />
        {grid.choice.asked > 0 && <Card label={g.choice} value={P(chosen)} hint={g.choiceHint(P(grid.choice.none / grid.choice.asked))} />}
      </div>
      {grid.rank.some((n) => n > 0) && (
        <div className="max-w-xl">
          <Bars label={g.rankBars} rows={grid.rank.map((n, i) => ({ key: String(i), label: g.rankLabel(i + 1), n }))} />
        </div>
      )}
      {grid.choice.asked > 0 && <Callout>{g.declared}</Callout>}
    </div>
  );
}

function SlideRow({ k, media, width, height, reach, time, attention, drop, sessions, heatmaps }: { k: number; media: MediaSource | null; width: number; height: number; reach: number; time: number | null; attention: number | null; drop: number; sessions: readonly CompactSamples[]; heatmaps: boolean }) {
  const { t, locale } = useI18n();
  const c = t.report.carousel;
  const src = useMediaFrames(media, { width, height });
  const P = (v: number | null) => formatPct(v, locale);
  return (
    <li className="grid min-w-0 gap-4 rounded-2xl bg-surface p-4 ring-1 ring-line sm:grid-cols-[140px_minmax(0,1fr)]">
      <div className="w-[140px] max-w-full">
        {heatmaps ? (
          <SceneHeatmap src={src} sessions={sessions} t0={0} t1={3600} label={c.slide(k + 1)} mean={attention} width={width} height={height} />
        ) : (
          <div className="grid aspect-[4/5] place-items-center rounded-xl bg-ink/[0.06] text-[13px] font-semibold text-muted">{c.slide(k + 1)}</div>
        )}
      </div>
      <dl className="grid min-w-0 grid-cols-2 gap-x-4 gap-y-3 self-center text-[14px] lg:grid-cols-4">
        <div>
          <dt className="text-[12.5px] text-muted">{c.reach}</dt>
          <dd className="tabular text-[20px] font-semibold">{P(reach)}</dd>
          <dd className="mt-1 h-2 rounded-sm bg-ink/[0.06]">
            <span className="block h-2 rounded-sm" style={{ width: `${reach * 100}%`, background: TOKENS.cobalt }} />
          </dd>
        </div>
        <div>
          <dt className="text-[12.5px] text-muted">{c.time}</dt>
          <dd className="tabular text-[20px] font-semibold">{time === null ? '–' : `${formatNumber(time, locale, 1)} s`}</dd>
        </div>
        <div>
          <dt className="text-[12.5px] text-muted">{c.attention}</dt>
          <dd className="tabular text-[20px] font-semibold">{P(attention)}</dd>
        </div>
        <div>
          <dt className="text-[12.5px] text-muted">{c.dropOff}</dt>
          <dd className="tabular text-[20px] font-semibold">{drop}</dd>
        </div>
      </dl>
    </li>
  );
}

/** Karuzela i slajdy (§4.6, §6 pkt 17): zasięg, czas, uwaga i porzucenia slajd po slajdzie, heat mapa slajdu. */
export function CarouselPanel({ carousel, slides, width, height, sessions, heatmaps }: { carousel: CarouselMetrics; slides: Array<MediaSource | null>; width: number; height: number; sessions: readonly CompactSamples[]; heatmaps: boolean }) {
  const { t, locale } = useI18n();
  const c = t.report.carousel;
  const perSlide = useMemo(() => Array.from({ length: carousel.slides }, (_, k) => sessions.map((d) => focusItem(d, k))), [sessions, carousel.slides]);
  return (
    <div className="space-y-4">
      <p className="text-[14px] text-muted">{c.summary(formatPct(carousel.completed, locale), carousel.slides)}</p>
      {heatmaps && <HeatLegend />}
      <ol className="space-y-3">
        {Array.from({ length: carousel.slides }, (_, k) => (
          <SlideRow key={k} k={k} media={slides[k] ?? null} width={width} height={height} reach={carousel.reach[k]} time={carousel.timeMedian[k]} attention={carousel.attention[k]} drop={carousel.dropOff[k]} sessions={perSlide[k]} heatmaps={heatmaps} />
        ))}
      </ol>
    </div>
  );
}
