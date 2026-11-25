import { useI18n } from '../../i18n';
import { formatPct } from '../../i18n/format';
import type { HookMetrics } from '../../research/report';
import { TOKENS } from '../../ui/tokens';

/** Mini-krzywa 0–10 s co 0,5 s (§7 pkt 3). */
function Mini({ points, label }: { points: HookMetrics['mini']; label: string }) {
  const W = 220;
  const H = 64;
  const n = Math.max(points.length, 1);
  const xs = (i: number) => (i / Math.max(1, n - 1)) * (W - 4) + 2;
  const ys = (v: number) => 4 + (1 - v) * (H - 8);
  let d = '';
  let pen = false;
  points.forEach((p, i) => {
    if (p.value === null) {
      pen = false;
      return;
    }
    d += `${pen ? 'L' : 'M'}${xs(i).toFixed(1)},${ys(p.value).toFixed(1)}`;
    pen = true;
  });
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-16 w-full max-w-[240px]" role="img" aria-label={label}>
      <line x1="2" x2={W - 2} y1={ys(0)} y2={ys(0)} stroke="#C9D0DC" />
      <line x1={xs(Math.min(n - 1, 6))} x2={xs(Math.min(n - 1, 6))} y1="2" y2={H - 2} stroke={TOKENS.marker} strokeWidth="1.5" />
      <path d={d} fill="none" stroke={TOKENS.cobalt} strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

/** Karta hooka (§7 pkt 3): @1 s, @3 s, utrzymanie hooka, zatrzymanie scrolla (feed), mini-krzywa. */
export function HookCard({ hook, stopRate }: { hook: HookMetrics; stopRate?: number | null }) {
  const { t, locale } = useI18n();
  const h = t.report.hook;
  const P = (v: number | null) => formatPct(v, locale);
  const items = [
    { label: h.at1, value: P(hook.at1) },
    { label: h.at3, value: P(hook.at3), hint: h.at3Hint },
    { label: h.retention, value: P(hook.retention), hint: hook.base ? h.retentionHint(hook.retained, hook.base) : undefined },
    ...(stopRate !== undefined ? [{ label: h.scrollStop, value: P(stopRate ?? null), hint: h.scrollStopHint }] : []),
  ];
  return (
    <div className="grid gap-5 rounded-2xl bg-surface p-5 ring-1 ring-line sm:grid-cols-[minmax(0,1fr)_240px] sm:items-center sm:p-6">
      <dl className="grid grid-cols-2 gap-x-6 gap-y-4 lg:grid-cols-4">
        {items.map((it) => (
          <div key={it.label} className="min-w-0">
            <dt className="text-[13px] text-muted">{it.label}</dt>
            <dd className="tabular mt-1 text-[26px] font-semibold tracking-[-0.02em] text-ink">{it.value}</dd>
            {it.hint && <dd className="text-[12.5px] leading-snug text-muted">{it.hint}</dd>}
          </div>
        ))}
      </dl>
      <div>
        <Mini points={hook.mini} label={h.miniLabel} />
        <p className="mt-1 text-[12.5px] text-muted">{h.miniCaption}</p>
      </div>
    </div>
  );
}
