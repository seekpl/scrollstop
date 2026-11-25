import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { formatTime } from '../../core/math/util';
import { useI18n } from '../../i18n';
import { formatPct } from '../../i18n/format';
import { curveBin, type CurvePoint } from '../../research/attention';
import type { DropWithContext, Segment, SegmentStat } from '../../research/report';
import { TOKENS } from '../../ui/tokens';

export interface ChartSeries {
  id: string;
  label: string;
  curve: CurvePoint[];
  color: string;
  /** Linia przerywana (np. retencja w feedzie obok uwagi). */
  dashed?: boolean;
}

/** Szerokość elementu z ResizeObserver (minimum 240 px, §7 pkt 4). */
export function useElementWidth<T extends HTMLElement>(fallback = 720) {
  const ref = useRef<T>(null);
  const [w, setW] = useState(fallback);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setW(Math.max(240, Math.round(el.getBoundingClientRect().width) || fallback));
    update();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [fallback]);
  return [ref, w] as const;
}

const TICK_STEPS = [1, 2, 5, 10, 15, 30, 60, 120, 300, 600];

function ticksFor(duration: number, width: number): number[] {
  const max = Math.max(3, Math.floor(width / 72));
  const step = TICK_STEPS.find((s) => duration / s <= max) ?? 600;
  const out: number[] = [];
  for (let t = 0; t <= duration + 1e-6; t += step) out.push(t);
  return out;
}

/**
 * Wykres uwagi (§7 pkt 4): odsetek patrzących w każdym przedziale z 95% pasmem, chorągiewki
 * spadków, pas scen z wyróżnieniem „do poprawy”, podpowiedź po najechaniu, obsługa klawiaturą
 * (strzałki przesuwają kursor, Enter wybiera moment). Rysuje też kilka serii (wersje, retencja).
 */
export function AttentionChart({
  series,
  duration,
  segments = [],
  drops = [],
  selected = null,
  onSelect,
  height = 280,
  animate = false,
  ariaLabel,
  window: win,
}: {
  series: ChartSeries[];
  duration: number;
  segments?: Array<Segment | SegmentStat>;
  drops?: DropWithContext[];
  selected?: number | null;
  onSelect?(t: number): void;
  height?: number;
  animate?: boolean;
  ariaLabel: string;
  /** Zakres osi czasu (domyślnie cały materiał). */
  window?: [number, number];
}) {
  const { t, locale } = useI18n();
  const tc = t.report.chart;
  const pct = (v: number) => formatPct(v, locale);
  const [wrapRef, W] = useElementWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const [drawn, setDrawn] = useState(!animate);
  useEffect(() => {
    if (!animate) return;
    const id = requestAnimationFrame(() => setDrawn(true));
    return () => cancelAnimationFrame(id);
  }, [animate]);

  const bin = curveBin(series[0]?.curve ?? []);
  const [t0, t1] = win ?? [0, Math.max(bin, duration)];
  const span = Math.max(bin, t1 - t0);
  const M = { l: 40, r: 12, t: drops.length ? 30 : 12, b: 22 };
  const laneH = segments.length ? 26 : 0;
  const plotH = height - M.t - M.b - laneH - (laneH ? 8 : 0);
  const plotW = W - M.l - M.r;
  const x = (s: number) => M.l + ((Math.min(t1, Math.max(t0, s)) - t0) / span) * plotW;
  const y = (v: number) => M.t + (1 - v) * plotH;
  const nBins = Math.max(...series.map((s) => s.curve.length), 1);
  const inWin = (p: CurvePoint) => p.t >= t0 - 1e-9 && p.t < t1 - 1e-9;

  const paths = useMemo(
    () =>
      series.map((s) => {
        let line = '';
        let band = '';
        let pts: CurvePoint[] = [];
        const flush = () => {
          if (pts.length) {
            const up = pts.map((p) => `${x(p.t + bin / 2).toFixed(1)},${y(p.hi ?? p.value ?? 0).toFixed(1)}`);
            const down = [...pts].reverse().map((p) => `${x(p.t + bin / 2).toFixed(1)},${y(p.lo ?? p.value ?? 0).toFixed(1)}`);
            band += `M${up.join('L')}L${down.join('L')}Z`;
          }
          pts = [];
        };
        let pen = false;
        for (const p of s.curve) {
          if (p.value === null || !inWin(p)) {
            pen = false;
            flush();
            continue;
          }
          line += `${pen ? 'L' : 'M'}${x(p.t + bin / 2).toFixed(1)},${y(p.value).toFixed(1)}`;
          pen = true;
          pts.push(p);
        }
        flush();
        return { id: s.id, color: s.color, line, band, dashed: !!s.dashed };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [series, W, height, t0, t1, drops.length, segments.length],
  );

  const ticks = ticksFor(span, plotW).map((v) => v + t0);
  const cursor = hover ?? (selected === null ? null : selected + bin / 2);
  const idx = cursor === null ? null : Math.min(nBins - 1, Math.max(0, Math.floor(cursor / bin + 1e-9)));

  const tFromEvent = (e: PointerEvent<SVGRectElement>) => {
    const r = (e.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect();
    return Math.min(t1 - 0.001, Math.max(t0, t0 + ((e.clientX - r.left - M.l) / plotW) * span));
  };
  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const cur = idx ?? Math.floor(t0 / bin);
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      const next = Math.min(Math.floor((t1 - 1e-6) / bin), Math.max(Math.floor(t0 / bin), cur + (e.key === 'ArrowRight' ? 1 : -1)));
      setHover(next * bin + bin / 2);
    } else if ((e.key === 'Enter' || e.key === ' ') && onSelect && idx !== null) {
      e.preventDefault();
      onSelect(idx * bin);
    } else if (e.key === 'Escape') setHover(null);
  };
  const tipLeft = cursor === null ? 0 : Math.min(W - 196, Math.max(0, x(cursor) + 12));

  return (
    <div
      ref={wrapRef}
      className="relative w-full min-w-0 select-none outline-none focus-visible:ring-2 focus-visible:ring-cobalt focus-visible:ring-offset-4"
      tabIndex={0}
      role="group"
      aria-label={tc.keyboard(ariaLabel, Boolean(onSelect))}
      onKeyDown={onKey}
      onBlur={() => setHover(null)}
    >
      <svg width={W} height={height} role="img" aria-label={ariaLabel} className="block">
        {[0, 0.25, 0.5, 0.75, 1].map((v) => (
          <g key={v}>
            <line x1={M.l} x2={W - M.r} y1={y(v)} y2={y(v)} stroke={v === 0 ? '#C9D0DC' : '#E7EBF1'} strokeWidth={1} />
            <text x={M.l - 8} y={y(v) + 4} textAnchor="end" fontSize={11} fill={TOKENS.muted} className="tabular">
              {formatPct(v, locale)}
            </text>
          </g>
        ))}
        {drops.map((d, i) => (
          <g key={`drop-${i}`}>
            <rect x={x(d.start)} y={M.t} width={Math.max(2, x(d.end) - x(d.start))} height={plotH} fill={TOKENS.marker} opacity={0.16} />
            <line x1={x(d.start)} x2={x(d.start)} y1={M.t - 22} y2={M.t + plotH} stroke="#B98A00" strokeWidth={1} />
            <path d={`M${x(d.start)},${M.t - 22} h14 l-4,5 l4,5 h-14 z`} fill={TOKENS.marker} />
            <text x={x(d.start) + 4} y={M.t - 13.5} fontSize={9.5} fontWeight={700} fill={TOKENS.ink}>
              {i + 1}
            </text>
          </g>
        ))}
        {paths.map((p, i) => (
          <g key={p.id}>
            {!p.dashed && <path d={p.band} fill={p.color} opacity={series.length > 1 ? 0.08 : 0.12} />}
            <path
              d={p.line}
              fill="none"
              stroke={p.color}
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
              strokeDasharray={p.dashed ? '6 4' : undefined}
              pathLength={animate ? 1 : undefined}
              style={animate ? { strokeDasharray: 1, strokeDashoffset: drawn ? 0 : 1, transition: `stroke-dashoffset 1400ms cubic-bezier(.3,.7,.2,1) ${i * 200}ms` } : undefined}
            />
          </g>
        ))}
        {selected !== null && <line x1={x(selected + bin / 2)} x2={x(selected + bin / 2)} y1={M.t} y2={M.t + plotH} stroke={TOKENS.ink} strokeWidth={1.5} />}
        {idx !== null && hover !== null && (
          <g pointerEvents="none">
            <line x1={x(idx * bin + bin / 2)} x2={x(idx * bin + bin / 2)} y1={M.t} y2={M.t + plotH} stroke={TOKENS.ink} strokeWidth={1} opacity={0.5} />
            {series.map((s) => {
              const v = s.curve[idx]?.value;
              return v === null || v === undefined ? null : <circle key={s.id} cx={x(idx * bin + bin / 2)} cy={y(v)} r={4.5} fill={s.color} stroke="#fff" strokeWidth={2} />;
            })}
          </g>
        )}
        {segments.length > 0 && (
          <g>
            {segments
              .filter((s) => s.t1 > t0 && s.t0 < t1)
              .map((s, i) => {
                const x0 = x(s.t0) + (i ? 1 : 0);
                const w = Math.max(0, x(s.t1) - x(s.t0) - (i ? 2 : 1));
                const fixRank = 'fixRank' in s ? s.fixRank : null;
                return (
                  <g key={s.index}>
                    <rect x={x0} y={M.t + plotH + 8} width={w} height={laneH} rx={4} fill={fixRank ? '#FDF1C7' : i % 2 ? '#E9EDF3' : '#F0F3F7'} />
                    {w > 30 && (
                      <text x={x0 + 7} y={M.t + plotH + 8 + 17} fontSize={11.5} fontWeight={600} fill={TOKENS.ink}>
                        {w > 74 ? s.label : s.source === 'scene' ? `${s.index + 1}` : ''}
                      </text>
                    )}
                  </g>
                );
              })}
          </g>
        )}
        {ticks.map((v) => (
          <text key={v} x={x(v)} y={height - 6} fontSize={11} fill={TOKENS.muted} textAnchor={v <= t0 ? 'start' : v >= t1 - 1e-6 ? 'end' : 'middle'} className="tabular">
            {formatTime(v, 0)}
          </text>
        ))}
        <rect
          x={M.l}
          y={M.t}
          width={Math.max(0, plotW)}
          height={plotH + laneH + 8}
          fill="transparent"
          style={{ cursor: onSelect ? 'pointer' : 'crosshair' }}
          onPointerMove={(e) => setHover(tFromEvent(e))}
          onPointerLeave={() => setHover(null)}
          onClick={(e) => onSelect?.(Math.floor(tFromEvent(e as unknown as PointerEvent<SVGRectElement>) / bin) * bin)}
        />
      </svg>
      {idx !== null && hover !== null && (
        <div className="pointer-events-none absolute top-6 z-10 w-[184px] rounded-lg bg-ink px-3 py-2 text-white shadow-lg" style={{ left: tipLeft }} role="status">
          <div className="tabular text-[12px] text-white/75">{formatTime(idx * bin, bin < 1 ? 1 : 0)}</div>
          {series.map((s) => {
            const p = s.curve[idx];
            return (
              <div key={s.id} className="mt-1">
                <div className="flex items-center gap-2">
                  {series.length > 1 && <span className="h-0.5 w-3 rounded" style={{ background: s.color }} />}
                  <span className="text-[16px] font-semibold">{!p || p.value === null ? tc.noData : tc.watching(pct(p.value))}</span>
                </div>
                {p && p.value !== null && (
                  <div className="text-[11.5px] text-white/75">
                    {series.length > 1 ? tc.seriesPrefix(s.label) : ''}
                    {tc.detail({ watching: p.watching, n: p.n, lo: pct(p.lo ?? 0), hi: pct(p.hi ?? 1) })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Legenda — zawsze przy ≥ 2 seriach (§19.4). */
export function ChartLegend({ series }: { series: ChartSeries[] }) {
  if (series.length < 2) return null;
  return (
    <div className="flex flex-wrap gap-4 text-[13px] text-ink">
      {series.map((s) => (
        <span key={s.id} className="inline-flex items-center gap-2">
          <svg width="20" height="4" aria-hidden>
            <line x1="0" y1="2" x2="20" y2="2" stroke={s.color} strokeWidth="3" strokeDasharray={s.dashed ? '5 3' : undefined} />
          </svg>
          {s.label}
        </span>
      ))}
    </div>
  );
}
