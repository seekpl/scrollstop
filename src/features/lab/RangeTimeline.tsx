import { useRef } from 'react';
import type { Scene } from '../../core/contracts/types';
import { clamp, formatTime } from '../../core/math/util';
import { useT } from '../../i18n';

/** Oś czasu z dwoma uchwytami (klawiatura: strzałki, Shift = 5 s), scenami i polami sekund. */
export function RangeTimeline({ duration, value, onChange, scenes, idPrefix }: { duration: number; value: [number, number]; onChange(v: [number, number]): void; scenes: Scene[]; idPrefix: string }) {
  const t = useT();
  const r = t.lab.timeline;
  const track = useRef<HTMLDivElement>(null);
  const dragging = useRef<0 | 1 | null>(null);
  const d = Math.max(duration, 0.001);
  const pct = (x: number) => `${(clamp(x, 0, d) / d) * 100}%`;
  const MIN = 0.2;
  const timeAt = (clientX: number) => {
    const rect = track.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return 0;
    return clamp((clientX - rect.left) / rect.width, 0, 1) * d;
  };
  const set = (which: 0 | 1, x: number) => {
    if (which === 0) onChange([clamp(x, 0, value[1] - MIN), value[1]]);
    else onChange([value[0], clamp(x, value[0] + MIN, d)]);
  };
  const handle = (which: 0 | 1) => ({
    role: 'slider' as const,
    tabIndex: 0,
    'aria-label': which === 0 ? r.startLabel : r.endLabel,
    'aria-valuemin': 0,
    'aria-valuemax': Math.round(d),
    'aria-valuenow': Math.round(value[which]),
    'aria-valuetext': formatTime(value[which]),
    onPointerDown: (e: React.PointerEvent) => {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      dragging.current = which;
    },
    onPointerMove: (e: React.PointerEvent) => {
      if (dragging.current === which) set(which, timeAt(e.clientX));
    },
    onPointerUp: () => {
      dragging.current = null;
    },
    onKeyDown: (e: React.KeyboardEvent) => {
      const step = e.shiftKey ? 5 : 0.5;
      if (e.key === 'ArrowLeft') set(which, value[which] - step);
      if (e.key === 'ArrowRight') set(which, value[which] + step);
    },
  });
  return (
    <div className="space-y-3">
      <div
        ref={track}
        className="relative h-14 select-none rounded-xl bg-mist"
        onPointerDown={(e) => {
          if (e.target !== e.currentTarget) return;
          const x = timeAt(e.clientX);
          set(Math.abs(x - value[0]) < Math.abs(x - value[1]) ? 0 : 1, x);
        }}
      >
        {scenes.map((s, i) => (
          <div key={s.id} className={`pointer-events-none absolute top-0 h-3 rounded-full ${i % 2 ? 'bg-ink/15' : 'bg-ink/30'}`} style={{ left: pct(s.start), width: `calc(${pct(s.end)} - ${pct(s.start)})` }} />
        ))}
        <div className="pointer-events-none absolute bottom-2 top-4 rounded-lg bg-cobalt/20 ring-2 ring-cobalt" style={{ left: pct(value[0]), width: `calc(${pct(value[1])} - ${pct(value[0])})` }} />
        {([0, 1] as const).map((w) => (
          <div key={w} {...handle(w)} className="absolute bottom-0 top-2 z-10 w-4 -translate-x-1/2 cursor-ew-resize rounded-md bg-cobalt shadow ring-2 ring-white" style={{ left: pct(value[w]) }} />
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-4 text-[14px]">
        <label className="flex items-center gap-2" htmlFor={`${idPrefix}-start`}>
          <span className="font-semibold">{r.start}</span>
          <input id={`${idPrefix}-start`} type="number" step={0.1} min={0} max={d} value={Number(value[0].toFixed(1))} onChange={(e) => set(0, Number(e.target.value))} className="tabular h-9 w-24 rounded-[10px] bg-surface px-2 ring-1 ring-inset ring-field" />
        </label>
        <label className="flex items-center gap-2" htmlFor={`${idPrefix}-end`}>
          <span className="font-semibold">{r.end}</span>
          <input id={`${idPrefix}-end`} type="number" step={0.1} min={0} max={d} value={Number(value[1].toFixed(1))} onChange={(e) => set(1, Number(e.target.value))} className="tabular h-9 w-24 rounded-[10px] bg-surface px-2 ring-1 ring-inset ring-field" />
        </label>
        <span className="tabular text-muted">{r.rangeText(formatTime(value[0]), formatTime(value[1]), (value[1] - value[0]).toFixed(1))}</span>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => onChange([0, d])} className="min-h-8 rounded-[10px] bg-ink/[0.06] px-3 text-[13.5px] font-semibold hover:bg-ink/10">
          {r.whole}
        </button>
        {scenes.map((s, i) => (
          <button
            key={s.id}
            type="button"
            onClick={() => onChange([s.start, s.end])}
            className={`min-h-8 rounded-[10px] px-3 text-[13.5px] font-semibold ${Math.abs(value[0] - s.start) < 0.05 && Math.abs(value[1] - s.end) < 0.05 ? 'bg-ink text-white' : 'bg-ink/[0.06] hover:bg-ink/10'}`}
          >
            {r.scene(i + 1)} <span className="tabular font-normal opacity-75">{formatTime(s.start, 0)}–{formatTime(s.end, 0)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
