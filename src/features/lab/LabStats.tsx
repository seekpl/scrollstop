import { useMemo, useState } from 'react';
import { detectFixations } from '../../core/analysis/fixations';
import { pathWindow } from '../../core/analysis/gazePath';
import { colorize, computeDensity, normalizeDensity, selectRange } from '../../core/analysis/heatmap';
import { attentionTimeline, computeStats, sessionDuration, type AttentionBin, type Region } from '../../core/analysis/stats';
import { formatTime, mean } from '../../core/math/util';
import { drawHeatmapLayer, drawPoints } from '../../core/render/draw';
import { useT } from '../../i18n';
import { Callout, Surface } from '../../ui/kit';
import { useCanvasFrame } from '../shared/useCanvasFrame';
import { useFrameSource } from './hooks';
import { useLab } from './LabContext';
import { NoSession, SessionBar, Stat } from './parts';

const REGIONS: Region[] = ['left', 'center', 'right'];

export function LabStats() {
  const lab = useLab();
  const t = useT();
  const s = t.lab.stats;
  const session = lab.activeSession;
  const src = useFrameSource(session);
  const duration = session ? sessionDuration(session.samples, session.meta.video.duration) : 0;
  const [selected, setSelected] = useState<number | null>(null);
  const stats = useMemo(() => (session ? computeStats(session.samples) : null), [session]);
  const bins = useMemo(() => (session ? attentionTimeline(session.samples, duration, duration <= 180 ? 1 : duration / 180) : []), [session, duration]);
  const fixations = useMemo(() => (session ? detectFixations(session.samples) : []), [session]);
  const time = selected ?? 0;
  const local = useMemo(() => {
    if (!session || selected === null) return null;
    const d = computeDensity(selectRange(session.samples, time - 2, time + 2));
    return { d, rgba: colorize(normalizeDensity(d)), pts: pathWindow(session.samples, time + 1, 2) };
  }, [session, selected, time]);
  const canvasRef = useCanvasFrame(
    src,
    time,
    (ctx, w, h) => {
      if (!local) return;
      drawHeatmapLayer(ctx, local.rgba, local.d.w, local.d.h, w, h, 0.65);
      drawPoints(ctx, local.pts, w, h);
    },
    [local],
    960,
  );
  if (!session || !stats) return <NoSession />;
  const longest = [...fixations].sort((a, b) => b.duration - a.duration).slice(0, 12);
  return (
    <div className="space-y-6">
      <h1 className="text-[28px] font-semibold tracking-[-0.02em] sm:text-[34px]">{s.title}</h1>
      <SessionBar />
      <Surface>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label={s.watched} value={formatTime(stats.watchedSeconds, 0)} />
          <Stat label={s.tracked} value={formatTime(stats.trackedSeconds, 0)} hint={s.trackedHint(Math.round(stats.validRatio * 100))} />
          <Stat label={s.fixCount} value={fixations.length} />
          <Stat label={s.meanFix} value={fixations.length ? `${mean(fixations.map((f) => f.duration)).toFixed(2)} s` : '–'} />
        </div>
      </Surface>
      <Surface>
        <h2 className="mb-2 text-[17px] font-semibold">{s.chartTitle}</h2>
        <p className="mb-4 max-w-prose text-[14px] text-muted">{s.chartBody}</p>
        <TimelineChart bins={bins} duration={duration} selected={selected} onSelect={setSelected} label={s.chartLabel} />
        <Callout>{t.lab.footer.notAssessment}</Callout>
        {selected !== null && (
          <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
            <div className="overflow-hidden rounded-2xl bg-ink">
              <canvas ref={canvasRef} className="mx-auto block h-auto max-h-[60vh] w-auto max-w-full" role="img" aria-label={s.momentLabel} />
            </div>
            <div className="tabular space-y-2 text-[14px]">
              <div className="text-[22px] font-semibold">{formatTime(time)}</div>
              <p className="text-muted">{s.selectedBody}</p>
              {local && <p>{s.windowSamples(local.d.n)}</p>}
            </div>
          </div>
        )}
      </Surface>
      <div className="grid gap-6 lg:grid-cols-2">
        <Surface>
          <h2 className="mb-3 text-[17px] font-semibold">{s.regionsTitle}</h2>
          <div className="space-y-3">
            {REGIONS.map((r) => (
              <div key={r}>
                <div className="flex justify-between text-[14px]">
                  <span>{t.lab.heatmap.regions[r]}</span>
                  <span className="tabular font-semibold">{Math.round(stats.regionShares[r] * 100)}%</span>
                </div>
                <div className="mt-1 h-3 rounded-full bg-mist">
                  <div className="h-3 rounded-full bg-cobalt" style={{ width: `${stats.regionShares[r] * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
          <p className="mt-6 text-[14px] text-muted">{s.qualityLine(Math.round(stats.qualityShares.GOOD * 100), Math.round(stats.qualityShares.FAIR * 100), Math.round(stats.qualityShares.POOR * 100))}</p>
        </Surface>
        <Surface>
          <h2 className="mb-3 text-[17px] font-semibold">{s.longestTitle}</h2>
          {longest.length === 0 ? (
            <p className="text-[14px] text-muted">{s.noFix}</p>
          ) : (
            <div role="region" aria-label={s.longestTitle} tabIndex={0} className="relative overflow-x-auto">
              <table className="w-full text-left text-[14px]">
                <caption className="sr-only">{s.longestTitle}</caption>
                <thead className="text-muted">
                  <tr>
                    <th className="py-1">#</th>
                    <th>{s.cols.time}</th>
                    <th>X</th>
                    <th>Y</th>
                    <th>{t.lab.path.cols.duration}</th>
                  </tr>
                </thead>
                <tbody>
                  {longest.map((f) => (
                    <tr key={f.id} className="cursor-pointer border-t border-line hover:bg-mist" onClick={() => setSelected(f.start)}>
                      <td className="py-1.5 font-semibold">{f.id}</td>
                      <td>
                        {formatTime(f.start)}–{formatTime(f.end)}
                      </td>
                      <td>{f.x.toFixed(2)}</td>
                      <td>{f.y.toFixed(2)}</td>
                      <td>{f.duration.toFixed(2)} s</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Surface>
      </div>
    </div>
  );
}

function TimelineChart({ bins, duration, selected, onSelect, label }: { bins: AttentionBin[]; duration: number; selected: number | null; onSelect(t: number): void; label: string }) {
  const W = 1000;
  const H = 140;
  const bw = W / Math.max(bins.length, 1);
  return (
    <svg viewBox={`0 0 ${W} ${H + 22}`} className="mb-4 w-full" role="img" aria-label={label}>
      {bins.map((b, i) => {
        const v = b.estimated;
        const x = i * bw;
        return (
          <g key={i} className="cursor-pointer" onClick={() => onSelect((b.t0 + b.t1) / 2)}>
            <rect x={x} y={0} width={bw} height={H} fill="transparent" />
            {v === null ? (
              <rect x={x + bw * 0.15} y={H - 3} width={bw * 0.7} height={3} fill="#C9D0DC" />
            ) : (
              <rect x={x + bw * 0.12} y={H - v * H} width={bw * 0.76} height={Math.max(2, v * H)} rx={Math.min(3, bw / 3)} fill={v > 0.66 ? '#2747D6' : v > 0.33 ? '#7F95EA' : '#C2CCF4'} />
            )}
          </g>
        );
      })}
      {selected !== null && duration > 0 && <line x1={(selected / duration) * W} x2={(selected / duration) * W} y1={0} y2={H} stroke="#F2B705" strokeWidth={3} />}
      {[0, 0.25, 0.5, 0.75, 1].map((p) => (
        <text key={p} x={p * W} y={H + 18} fontSize="12" fill="#5B6478" textAnchor={p === 0 ? 'start' : p === 1 ? 'end' : 'middle'}>
          {formatTime(p * duration, 0)}
        </text>
      ))}
    </svg>
  );
}
