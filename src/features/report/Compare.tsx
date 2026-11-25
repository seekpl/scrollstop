import { useI18n } from '../../i18n';
import { formatNumber, formatPct, formatPp } from '../../i18n/format';
import type { VariantReport, VariantsComparison } from '../../research/report';
import { SERIES } from '../../ui/tokens';
import { AttentionChart, ChartLegend, type ChartSeries } from './AttentionChart';

/** Porównanie wersji (§7 pkt 11): wspólny wykres, tabela wersji z testami, segmenty, strefy, werdykt. */
/** Porównanie wersji; wystarczą krzywe wersji (raport udostępniany linkiem nie ma danych widzów). */
export type ComparisonView = Omit<VariantsComparison, 'reports'> & { reports: ReadonlyArray<Pick<VariantReport, 'variantId' | 'curve' | 'duration'>> };

export function Compare({ cmp, labels }: { cmp: ComparisonView; labels: Record<string, string> }) {
  const { t, locale } = useI18n();
  const tc = t.report.compare;
  const P = (v: number | null) => formatPct(v, locale);
  const pv = (p: number | null) => (p === null ? '–' : p < 0.001 ? `< ${formatNumber(0.001, locale, 3)}` : formatNumber(p, locale, 3));
  const series: ChartSeries[] = cmp.reports.map((r) => ({ id: r.variantId, label: labels[r.variantId], curve: r.curve, color: SERIES[r.variantId] }));
  const duration = Math.max(...cmp.reports.map((r) => r.duration));
  return (
    <div className="space-y-6">
      <p className="max-w-[72ch] text-[16px] leading-relaxed text-ink">{cmp.summary}</p>
      <div className="min-w-0 rounded-2xl bg-surface p-4 ring-1 ring-line sm:p-5">
        <ChartLegend series={series} />
        <div className="mt-3">
          <AttentionChart series={series} duration={duration} ariaLabel={tc.chartLabel} />
        </div>
      </div>
      <div className="relative overflow-x-auto rounded-2xl bg-surface ring-1 ring-line">
        <table className="w-full min-w-[560px] text-left text-[14px]">
          <caption className="sr-only">{tc.tableCaption}</caption>
          <thead className="text-[12.5px] text-muted">
            <tr className="border-b border-line">
              <th className="px-4 py-3 font-semibold">{tc.version}</th>
              <th className="px-4 py-3 font-semibold">{tc.viewers}</th>
              <th className="px-4 py-3 font-semibold">{cmp.window ? tc.meanWindow : tc.mean}</th>
              <th className="px-4 py-3 font-semibold">{tc.diff}</th>
              <th className="px-4 py-3 font-semibold">{tc.retention}</th>
              <th className="px-4 py-3 font-semibold">{tc.p}</th>
            </tr>
          </thead>
          <tbody>
            {cmp.rows.map((r) => (
              <tr key={r.id} className="border-b border-line last:border-0">
                <td className="px-4 py-3 font-semibold text-ink">
                  <span className="mr-2 inline-block h-2.5 w-2.5 rounded-full align-middle" style={{ background: SERIES[r.id] }} aria-hidden />
                  {labels[r.id]}
                  {cmp.verdict === r.id && <span className="ml-2 rounded-md bg-good/10 px-2 py-0.5 text-[12px] text-good">{tc.winner}</span>}
                </td>
                <td className="px-4 py-3 text-ink">{r.viewers}</td>
                <td className="px-4 py-3 font-semibold text-ink">{P(r.mean)}</td>
                <td className="px-4 py-3 text-ink">{r.diff === null ? '–' : formatPp(r.diff, locale)}</td>
                <td className="px-4 py-3 text-ink">{P(r.hookRetention)}</td>
                <td className="px-4 py-3 text-ink">{r.welchAdj === null ? '–' : pv(r.welchAdj)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {cmp.testLine && <p className="text-[13px] leading-relaxed text-muted">{cmp.testLine}</p>}
      {cmp.hookLine && <p className="-mt-4 text-[13px] leading-relaxed text-muted">{cmp.hookLine}</p>}
      <div className="relative overflow-x-auto rounded-2xl bg-surface ring-1 ring-line">
        <table className="w-full min-w-[480px] text-left text-[14px]">
          <caption className="sr-only">{tc.segmentsCaption}</caption>
          <thead className="text-[12.5px] text-muted">
            <tr className="border-b border-line">
              <th className="px-4 py-3 font-semibold">{tc.segment}</th>
              {cmp.reports.map((r) => (
                <th key={r.variantId} className="px-4 py-3 font-semibold">
                  {r.variantId}
                </th>
              ))}
              <th className="px-4 py-3 font-semibold">{cmp.reports.length === 2 ? tc.diffBA : tc.diffMax}</th>
            </tr>
          </thead>
          <tbody>
            {cmp.segments.map((s) => (
              <tr key={s.label} className="border-b border-line last:border-0">
                <td className="px-4 py-3 font-semibold text-ink">{s.label}</td>
                {s.values.map((v, i) => (
                  <td key={i} className="px-4 py-3 text-ink">
                    {P(v)}
                  </td>
                ))}
                <td className={`px-4 py-3 font-semibold ${s.diff !== null && Math.abs(s.diff) >= 0.05 ? 'text-ink' : 'text-muted'}`}>{s.diff === null ? '–' : formatPp(s.diff, locale)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {cmp.aois.length > 0 && (
        <div className="relative overflow-x-auto rounded-2xl bg-surface ring-1 ring-line">
          <table className="w-full min-w-[420px] text-left text-[14px]">
            <caption className="px-4 pt-3 text-left text-[13px] font-semibold text-muted">{tc.aoisCaption}</caption>
            <thead className="text-[12.5px] text-muted">
              <tr className="border-b border-line">
                <th className="px-4 py-3 font-semibold">{tc.zone}</th>
                {cmp.reports.map((r) => (
                  <th key={r.variantId} className="px-4 py-3 font-semibold">
                    {r.variantId}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {cmp.aois.map((a) => (
                <tr key={a.name} className="border-b border-line last:border-0">
                  <td className="px-4 py-3 font-semibold text-ink">{a.name}</td>
                  {a.values.map((v, i) => (
                    <td key={i} className="px-4 py-3 text-ink">
                      {P(v)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
