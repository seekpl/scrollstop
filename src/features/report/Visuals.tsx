import { useEffect, useMemo, useState } from 'react';
import { PLATFORM_SPECS, type Platform } from '../../config/platforms';
import { colorize, normalizeDensity, paletteCss, type Density } from '../../core/analysis/heatmap';
import { formatTime } from '../../core/math/util';
import type { FrameSource } from '../../core/render/frameSource';
import { drawHeatmapLayer } from '../../core/render/draw';
import { useI18n } from '../../i18n';
import { formatPct } from '../../i18n/format';
import type { CurvePoint } from '../../research/attention';
import { aggregateDensityCompact, densityOptionsFor, type AggregateDensity } from '../../research/heatmap';
import type { Aoi, CompactSamples } from '../../research/model';
import { TOKENS } from '../../ui/tokens';
import { useCanvasFrame } from '../shared/useCanvasFrame';

export interface Overlay {
  density?: Density | null;
  aois?: Array<Aoi & { highlight?: boolean }>;
  draft?: { x: number; y: number; w: number; h: number } | null;
  /** Strefy zasłonięte przez interfejs platformy (§4.8). */
  unsafe?: Platform | null;
}

/** Klatka materiału z nakładką heat mapy, stref i obszarów zasłoniętych. */
export function FrameCanvas({ src, t, overlay, label, vertical }: { src: FrameSource | null; t: number; overlay?: Overlay; label: string; vertical: boolean }) {
  const rgba = useMemo(() => (overlay?.density ? colorize(normalizeDensity(overlay.density)) : null), [overlay?.density]);
  const ref = useCanvasFrame(
    src,
    t,
    (ctx, w, h) => {
      if (overlay?.density && rgba) drawHeatmapLayer(ctx, rgba, overlay.density.w, overlay.density.h, w, h, 0.75);
      const lw = Math.max(2, w / 360);
      const u = overlay?.unsafe ? PLATFORM_SPECS[overlay.unsafe].unsafe : null;
      if (u) {
        ctx.save();
        ctx.fillStyle = 'rgba(192,54,54,0.22)';
        ctx.strokeStyle = 'rgba(192,54,54,0.9)';
        ctx.lineWidth = lw;
        ctx.setLineDash([lw * 3, lw * 2]);
        const rects: Array<[number, number, number, number]> = [
          [0, 0, w, u.top * h],
          [0, (1 - u.bottom) * h, w, u.bottom * h],
          [(1 - u.right) * w, u.top * h, u.right * w, (1 - u.top - u.bottom) * h],
        ];
        for (const r of rects) {
          ctx.fillRect(...r);
          ctx.strokeRect(...r);
        }
        ctx.restore();
      }
      for (const a of overlay?.aois ?? []) {
        ctx.save();
        ctx.strokeStyle = a.highlight ? TOKENS.marker : '#FFFFFF';
        ctx.lineWidth = lw * (a.highlight ? 1.6 : 1);
        ctx.setLineDash(a.highlight ? [] : [lw * 3, lw * 2]);
        ctx.strokeRect(a.x * w, a.y * h, a.w * w, a.h * h);
        const fs = Math.round(Math.max(12, w / 40));
        ctx.font = `600 ${fs}px system-ui, sans-serif`;
        const tw = ctx.measureText(a.name).width + 10;
        const bh = fs + 6;
        ctx.fillStyle = 'rgba(31,42,68,0.86)';
        ctx.fillRect(a.x * w, Math.max(0, a.y * h - bh), tw, bh);
        ctx.fillStyle = '#fff';
        ctx.textBaseline = 'bottom';
        ctx.fillText(a.name, a.x * w + 5, Math.max(bh, a.y * h) - 3);
        ctx.restore();
      }
      if (overlay?.draft) {
        const d = overlay.draft;
        ctx.save();
        ctx.fillStyle = 'rgba(242,183,5,0.2)';
        ctx.strokeStyle = TOKENS.marker;
        ctx.lineWidth = lw * 1.5;
        ctx.fillRect(d.x * w, d.y * h, d.w * w, d.h * h);
        ctx.strokeRect(d.x * w, d.y * h, d.w * w, d.h * h);
        ctx.restore();
      }
    },
    [overlay?.density, rgba, overlay?.aois, overlay?.draft, overlay?.unsafe],
    vertical ? 540 : 1280,
  );
  return <canvas ref={ref} className="block h-auto w-full" role="img" aria-label={label} />;
}

/** Legenda palety: „mało spojrzeń → dużo” (§5.15). */
export function HeatLegend() {
  const tv = useI18n().t.report.visuals;
  return (
    <div className="flex items-center gap-3 text-[12px] text-muted">
      <span>{tv.legendLow}</span>
      <span className="h-2 flex-1 rounded-full" style={{ background: paletteCss('inferno') }} />
      <span>{tv.legendHigh}</span>
    </div>
  );
}

/** Gęstość liczona po wyrenderowaniu (nie blokuje pierwszego malowania raportu). */
export function useLazyDensity(sessions: readonly CompactSamples[], t0: number, t1: number, width: number, height: number, enabled = true): AggregateDensity | null {
  const [d, setD] = useState<AggregateDensity | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    const id = setTimeout(() => {
      const r = aggregateDensityCompact(sessions, t0, t1, densityOptionsFor(width, height));
      if (alive) setD(r);
    }, 30);
    return () => {
      alive = false;
      clearTimeout(id);
    };
  }, [sessions, t0, t1, width, height, enabled]);
  return d;
}

/** Heat mapa sceny: klatka ze środka sceny + mapa, opis „00:00–00:12, patrzy 96%”. */
export function SceneHeatmap({ src, sessions, t0, t1, label, mean, width, height, aois, unsafe }: { src: FrameSource | null; sessions: readonly CompactSamples[]; t0: number; t1: number; label: string; mean: number | null; width: number; height: number; aois?: Aoi[]; unsafe?: Platform | null }) {
  const { t, locale } = useI18n();
  const tv = t.report.visuals;
  const vertical = height > width;
  const d = useLazyDensity(sessions, t0, t1, width, height);
  const visible = (aois ?? []).filter((a) => a.t0 < t1 && a.t1 > t0);
  return (
    <figure className="print-avoid min-w-0">
      <div className={`overflow-hidden rounded-xl bg-ink ${vertical ? 'mx-auto max-w-[240px]' : ''}`}>
        <FrameCanvas src={src} t={(t0 + t1) / 2} overlay={{ density: d, aois: visible, unsafe }} label={tv.heatmapAria(label)} vertical={vertical} />
      </div>
      <figcaption className="mt-2 flex flex-wrap items-baseline justify-between gap-x-2 text-[13px]">
        <span className="font-semibold text-ink">{label}</span>
        <span className="tabular text-muted">{tv.sceneMeta(`${formatTime(t0, 0)}–${formatTime(t1, 0)}`, mean === null ? null : formatPct(mean, locale))}</span>
      </figcaption>
      {d && d.viewers === 0 && <p className="mt-1 text-[12.5px] text-muted">{tv.noGaze}</p>}
    </figure>
  );
}

/** Panel momentu (§7 pkt 4): klatka, odsetek patrzących i heat mapa z okna ±1 s. */
export function MomentPanel({ src, sessions, t, point, width, height, onClose }: { src: FrameSource | null; sessions: readonly CompactSamples[]; t: number; point: CurvePoint | undefined; width: number; height: number; onClose(): void }) {
  const { t: m, locale } = useI18n();
  const tv = m.report.visuals;
  const vertical = height > width;
  const d = useLazyDensity(sessions, Math.max(0, t - 1), t + 1, width, height);
  return (
    <div className={`grid gap-5 rounded-2xl bg-surface p-4 ring-1 ring-line ${vertical ? 'sm:grid-cols-[220px_minmax(0,1fr)]' : 'lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]'}`}>
      <div className={`overflow-hidden rounded-xl bg-ink ${vertical ? 'mx-auto w-full max-w-[220px]' : ''}`}>
        <FrameCanvas src={src} t={t + 0.25} overlay={{ density: d }} label={tv.frameAria(formatTime(t, 0))} vertical={vertical} />
      </div>
      <div className="flex min-w-0 flex-col gap-2">
        <div className="text-[13px] text-muted">{tv.moment}</div>
        <div className="tabular text-[30px] font-semibold tracking-[-0.02em] text-ink">{formatTime(t, 0)}</div>
        {point && point.value !== null ? <p className="text-[15px] text-ink">{tv.momentWatching(formatPct(point.value, locale), point.watching, point.n)}</p> : <p className="text-[15px] text-muted">{tv.momentNoData}</p>}
        <p className="text-[13px] text-muted">{tv.momentRange(formatTime(Math.max(0, t - 1), 0), formatTime(t + 1, 0))}</p>
        <HeatLegend />
        <div className="mt-auto">
          <button type="button" className="min-h-9 text-[13.5px] font-semibold text-cobalt underline underline-offset-4" onClick={onClose}>
            {tv.closePreview}
          </button>
        </div>
      </div>
    </div>
  );
}
