import { formatTime } from '../../core/math/util';
import { useI18n } from '../../i18n';
import { formatPct, formatPp } from '../../i18n/format';
import type { SegmentStat } from '../../research/report';

/**
 * Sceny lub przedziały (§7 pkt 7): tabela na komputerze, karty na telefonie. Pełni też rolę
 * tabelarycznej alternatywy wykresu (dostępność).
 */
export function SegmentsTable({ segments, onJump }: { segments: SegmentStat[]; onJump?(t: number): void }) {
  const { t, locale } = useI18n();
  const ts = t.report.segments;
  const isScenes = segments[0]?.source === 'scene';
  const P = (v: number | null) => formatPct(v, locale);
  const change = (c: number | null) => (c === null ? '–' : formatPp(c, locale));
  return (
    <>
      <ul className="divide-y divide-line rounded-2xl bg-surface ring-1 ring-line sm:hidden">
        {segments.map((s) => (
          <li key={s.index}>
            <button type="button" className="flex w-full items-center gap-3 px-4 py-3 text-left" onClick={() => onJump?.(s.t0)}>
              <span className="min-w-0 flex-1">
                <span className="block text-[14.5px] font-semibold text-ink">{s.label}</span>
                <span className="tabular block text-[12.5px] text-muted">{ts.mobileMeta(isScenes ? `${formatTime(s.t0, 0)}–${formatTime(s.t1, 0)}` : null, change(s.change))}</span>
                {s.fixRank !== null && <span className="mt-1 inline-block rounded-md bg-marker/25 px-2 py-0.5 text-[12px] font-semibold text-ink">{ts.fixRank(s.fixRank)}</span>}
              </span>
              <span className="tabular text-[18px] font-semibold text-ink">{P(s.mean)}</span>
            </button>
          </li>
        ))}
      </ul>
      <div className="hidden relative overflow-x-auto rounded-2xl bg-surface ring-1 ring-line sm:block">
        <table className="w-full min-w-[520px] text-left text-[14px]">
          <caption className="sr-only">{isScenes ? ts.captionScenes : ts.captionIntervals}</caption>
          <thead className="text-[12.5px] text-muted">
            <tr className="border-b border-line">
              <th className="px-4 py-3 font-semibold">{isScenes ? ts.scene : ts.interval}</th>
              {isScenes && <th className="px-4 py-3 font-semibold">{ts.time}</th>}
              <th className="px-4 py-3 font-semibold">{ts.mean}</th>
              <th className="px-4 py-3 font-semibold">{ts.change}</th>
              <th className="px-4 py-3 font-semibold">
                <span className="sr-only">{ts.fix}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {segments.map((s) => (
              <tr key={s.index} className={`border-b border-line last:border-0 ${onJump ? 'cursor-pointer hover:bg-ink/[0.03]' : ''}`} onClick={() => onJump?.(s.t0)}>
                <td className="px-4 py-3 font-semibold text-ink">{s.label}</td>
                {isScenes && (
                  <td className="px-4 py-3 text-muted">
                    {formatTime(s.t0, 0)}–{formatTime(s.t1, 0)}
                  </td>
                )}
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className="w-12 font-semibold text-ink">{P(s.mean)}</span>
                    <span className="hidden h-1.5 w-28 overflow-hidden rounded-full bg-cobalt/15 md:block" aria-hidden>
                      <span className="block h-full rounded-full bg-cobalt" style={{ width: `${(s.mean ?? 0) * 100}%` }} />
                    </span>
                  </div>
                </td>
                <td className={`px-4 py-3 font-semibold ${s.change !== null && s.change <= -0.1 ? 'text-poor' : s.change !== null && s.change >= 0.05 ? 'text-good' : 'text-ink'}`}>{change(s.change)}</td>
                <td className="px-4 py-3 text-right">{s.fixRank !== null && <span className="inline-flex items-center rounded-md bg-marker/25 px-2 py-0.5 text-[12px] font-semibold text-ink">{ts.fixRank(s.fixRank)}</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
