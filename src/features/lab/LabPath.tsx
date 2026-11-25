import { useEffect, useMemo, useState } from 'react';
import { detectFixations } from '../../core/analysis/fixations';
import { pathWindow } from '../../core/analysis/gazePath';
import { selectRange } from '../../core/analysis/heatmap';
import { sessionDuration } from '../../core/analysis/stats';
import { formatTime } from '../../core/math/util';
import { drawFixations, drawGazePath } from '../../core/render/draw';
import { useT } from '../../i18n';
import { Btn, Segmented, Surface } from '../../ui/kit';
import { useCanvasFrame } from '../shared/useCanvasFrame';
import { useFrameSource } from './hooks';
import { useLab } from './LabContext';
import { NoSession, SessionBar } from './parts';

export function LabPath() {
  const lab = useLab();
  const t = useT();
  const p = t.lab.path;
  const session = lab.activeSession;
  const src = useFrameSource(session);
  const duration = session ? sessionDuration(session.samples, session.meta.video.duration) : 0;
  const [time, setTime] = useState(Math.min(10, duration));
  const [win, setWin] = useState('10');
  const [playing, setPlaying] = useState(false);
  const w = Number(win);
  const pts = useMemo(() => (session ? pathWindow(session.samples, time, w) : []), [session, time, w]);
  const fixations = useMemo(() => (session ? detectFixations(selectRange(session.samples, time - w, time)) : []), [session, time, w]);

  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let last = performance.now();
    const step = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      setTime((prev) => {
        const next = prev + dt;
        if (next >= duration) {
          setPlaying(false);
          return duration;
        }
        return next;
      });
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [playing, duration]);

  const canvasRef = useCanvasFrame(
    src,
    time,
    (ctx, cw, ch) => {
      drawFixations(ctx, fixations, cw, ch);
      drawGazePath(ctx, pts, time, w, cw, ch);
    },
    [pts, fixations, w],
  );

  if (!session) return <NoSession />;
  return (
    <div className="space-y-6">
      <h1 className="text-[28px] font-semibold tracking-[-0.02em] sm:text-[34px]">{p.title}</h1>
      <SessionBar />
      <Surface>
        <div className="overflow-hidden rounded-2xl bg-ink">
          <canvas ref={canvasRef} className="mx-auto block h-auto max-h-[70vh] w-auto max-w-full" role="img" aria-label={p.canvasLabel} />
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-4">
          <Btn variant="primary" onClick={() => setPlaying((v) => !v)}>
            {playing ? t.lab.watch.pause : p.play}
          </Btn>
          <input type="range" aria-label={p.moment} className="min-w-[160px] flex-1 accent-cobalt" min={0} max={duration} step={0.1} value={time} onChange={(e) => setTime(Number(e.target.value))} />
          <span className="tabular w-24 text-right font-semibold">{formatTime(time)}</span>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <span className="text-[14px] text-muted">{p.length}</span>
          <Segmented label={p.length} value={win} onChange={setWin} options={['5', '10', '30'].map((s) => ({ value: s, label: t.common.seconds(Number(s)) }))} />
          <span className="text-[14px] text-muted">{p.counts(pts.length, fixations.length)}</span>
        </div>
      </Surface>
      {fixations.length > 0 && (
        <Surface>
          <h2 className="mb-3 text-[17px] font-semibold">{p.fixTitle}</h2>
          <div role="region" aria-label={p.fixTitle} tabIndex={0} className="relative overflow-x-auto">
            <table className="w-full text-left text-[14px]">
              <caption className="sr-only">{p.fixTitle}</caption>
              <thead className="text-muted">
                <tr>
                  <th className="py-1">#</th>
                  <th>{p.cols.from}</th>
                  <th>{p.cols.to}</th>
                  <th>X</th>
                  <th>Y</th>
                  <th>{p.cols.duration}</th>
                </tr>
              </thead>
              <tbody>
                {fixations.map((f, i) => (
                  <tr key={f.id} className="border-t border-line">
                    <td className="py-1.5 font-semibold">{i + 1}</td>
                    <td>{formatTime(f.start)}</td>
                    <td>{formatTime(f.end)}</td>
                    <td>{f.x.toFixed(2)}</td>
                    <td>{f.y.toFixed(2)}</td>
                    <td>{f.duration.toFixed(2)} s</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Surface>
      )}
    </div>
  );
}
