import { useMemo, useState, type ReactNode } from 'react';
import { formatTime } from '../../core/math/util';
import { useI18n, type Messages } from '../../i18n';
import { formatNumber, formatPct } from '../../i18n/format';
import { RESEARCH_TEXT } from '../../i18n/research';
import { audienceSegments, filterAudience, SCREENER_FOR, type AudienceSegment } from '../../research/audience';
import { AGE_BANDS, type AgeBand, type Aoi, type Project, type VariantId, type ViewerSession } from '../../research/model';
import { planFor, type Entitlements } from '../../research/plans';
import { buildVariantReport, compareVariants, headline, type VariantReport } from '../../research/report';
import { MIN_VERDICT_SAMPLE, RELIABLE_SAMPLE, reportSessions } from '../../research/sessions';
import { Badge, Callout, Section, Segmented } from '../../ui/kit';
import { SERIES } from '../../ui/tokens';
import { Locked } from '../billing/Locked';
import { AoiPanel } from './AoiPanel';
import { AttentionChart, type ChartSeries } from './AttentionChart';
import { Compare } from './Compare';
import { Findings } from './Findings';
import { useVariantFrames } from './frames';
import { HookCard } from './HookCard';
import { SegmentsTable } from './SegmentsTable';
import { HeatLegend, MomentPanel, SceneHeatmap } from './Visuals';

/** Domyślna nazwa wersji zapisana w danych („Wersja A”) tłumaczona przy wyświetlaniu (§18). */
export function variantLabel(v: { id: string; label: string }, t: Messages): string {
  return /^(Wersja|Version|Versión|Versione)\s[A-D]$/.test(v.label.trim()) ? t.common.version(v.id) : v.label;
}

/** „18–34” z przedziałów wieku widzów w raporcie. */
export function ageSpan(byAge: Partial<Record<AgeBand, number>>): string | null {
  const present = AGE_BANDS.filter((a) => (byAge[a] ?? 0) > 0);
  if (!present.length) return null;
  const lo = present[0].split(/[-+]/)[0];
  const last = present[present.length - 1];
  return last === '55+' ? `${lo}+` : `${lo}–${last.split('-')[1]}`;
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div className="min-w-0">
      <div className="text-[13px] text-muted">{label}</div>
      <div className="tabular mt-1 text-[26px] font-semibold tracking-[-0.02em] text-ink">{value}</div>
      {hint && <div className="text-[12.5px] leading-snug text-muted">{hint}</div>}
    </div>
  );
}

function Watermark() {
  const t = useI18n().t;
  return (
    <div aria-hidden className="print-only pointer-events-none fixed inset-0 z-[70] overflow-hidden">
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 -rotate-[28deg] whitespace-nowrap text-[64px] font-bold text-ink/[0.07]">{t.report.header.watermark}</div>
    </div>
  );
}

/**
 * Raport zbiorczy projektu (§7). Ten sam komponent pokazuje raporty przykładowe na stronie publicznej
 * (`sample`, pełne funkcje) i raport twórcy (edycja stref, rekomendacje AI, eksport).
 */
export function ReportView({
  project,
  sessions: allSessions,
  can,
  sample = false,
  sampleSwitch,
  onSaveAois,
  actions,
}: {
  project: Project;
  sessions: ViewerSession[];
  can: Entitlements;
  sample?: boolean;
  sampleSwitch?: ReactNode;
  onSaveAois?(variantId: VariantId, aois: Aoi[]): Promise<void>;
  actions?: ReactNode;
}) {
  const { t, locale } = useI18n();
  const rt = RESEARCH_TEXT[locale];
  const tr = t.report;
  const P = (v: number | null) => formatPct(v, locale);
  // Segment widzów (§4.9): wszyscy, regularni użytkownicy platformy publikacji, panel / społeczność.
  const segments = useMemo(() => audienceSegments(allSessions, project.platform, { includeSimulated: sample }), [allSessions, project.platform, sample]);
  const [audienceChoice, setAudience] = useState<AudienceSegment>('all');
  const audience = segments.includes(audienceChoice) ? audienceChoice : 'all';
  const sessions = useMemo(() => filterAudience(allSessions, audience, project.platform), [allSessions, audience, project.platform]);
  const screenerName = SCREENER_FOR[project.platform];
  const [variantId, setVariantId] = useState<VariantId>(project.variants[0].id);
  const [selected, setSelected] = useState<number | null>(null);
  const variant = project.variants.find((v) => v.id === variantId) ?? project.variants[0];
  const reports = useMemo(() => project.variants.map((v) => buildVariantReport(project, v, sessions, rt, { includeSimulated: sample })), [project, sessions, rt, sample]);
  const report = reports.find((r) => r.variantId === variant.id) ?? reports[0];
  const labels = Object.fromEntries(project.variants.map((v) => [v.id, variantLabel(v, t)])) as Record<VariantId, string>;
  const withData = reports.filter((r) => r.viewers > 0);
  const cmp = withData.length >= 2 && withData.length === reports.length ? compareVariants(reports, rt, { sharedFrom: project.kind === 'hook' ? variant.sharedFrom : undefined, formatP: (p) => (p < 0.001 ? `< ${formatNumber(0.001, locale, 3)}` : formatNumber(p, locale, 3)) }) : null;
  const src = useVariantFrames(variant);
  const validData = useMemo(() => reportSessions(sessions.filter((s) => s.variantId === variant.id), { includeSimulated: sample }).map((s) => s.data), [sessions, variant.id, sample]);
  const head = headline(report, rt);
  const vertical = variant.height > variant.width;
  const [showUnsafe, setShowUnsafe] = useState(false);
  const sm = report.sessions;
  const age = ageSpan(sm.byAge);
  const devices = (['mobile', 'desktop', 'tablet'] as const).filter((d) => sm.byDevice[d] > 0).map((d) => tr.header.deviceCount[d](sm.byDevice[d]));
  const sampleLine = [
    tr.header.viewers(report.viewers) + (age ? `, ${tr.header.age(age)}` : ''),
    devices.join(', '),
    report.viewers ? (sm.audioOn > sm.audioOff ? tr.header.soundOn : tr.header.soundOff) : null,
    t.common.contexts[project.context],
  ].filter(Boolean);
  const biggest = report.drops[0];
  const jump = (sec: number) => {
    setSelected(Math.floor(sec / report.bin) * report.bin);
    document.getElementById('report-chart')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };
  const series: ChartSeries[] = [{ id: report.variantId, label: labels[report.variantId], curve: report.curve, color: SERIES[report.variantId] }];
  const answers = useMemo(() => {
    const own = reportSessions(sessions.filter((s) => s.variantId === variant.id), { includeSimulated: sample });
    const out: Record<string, Record<string, number>> = {};
    for (const s of own) for (const [q, a] of Object.entries(s.answers)) (out[q] ??= {})[a] = (out[q]?.[a] ?? 0) + 1;
    return out;
  }, [sessions, variant.id, sample]);

  return (
    <article className="min-w-0 space-y-12">
      {can.watermark && !sample && <Watermark />}
      <header className="space-y-5">
        {sampleSwitch}
        <p className="text-[13.5px] text-muted">{sampleLine.join('; ')}</p>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={report.level === 'reliable' ? 'good' : report.level === 'none' ? 'neutral' : 'fair'}>{tr.header.level[report.level]}</Badge>
          {report.viewers > 0 && <Badge tone="info">{sm.panel >= sm.community ? tr.header.sourcePanel : tr.header.sourceCommunity}</Badge>}
          {sample && <Badge tone="marker">{tr.header.sampleBadge}</Badge>}
        </div>
        <h2 className="max-w-[30ch] text-[26px] font-semibold leading-[1.12] tracking-[-0.025em] text-ink sm:text-[34px]">{head.lead}</h2>
        {head.detail && <p className="max-w-[68ch] text-[16px] leading-relaxed text-muted">{head.detail}</p>}
        {segments.length > 1 && (
          <div className="no-print">
            <Segmented<AudienceSegment>
              label={tr.audience.label}
              value={audience}
              onChange={setAudience}
              options={segments.map((x) => ({ value: x, label: x === 'platform' && screenerName ? tr.audience.platform(t.viewer.screener.platforms[screenerName]) : tr.audience[x === 'platform' ? 'all' : x] }))}
            />
          </div>
        )}
        {project.variants.length > 1 && (
          <div role="radiogroup" aria-label={tr.header.versionPicker} className="no-print inline-flex max-w-full flex-wrap gap-1 rounded-[10px] bg-ink/[0.05] p-1 text-[13.5px]">
            {project.variants.map((v) => (
              <button key={v.id} type="button" role="radio" aria-checked={v.id === variant.id} onClick={() => setVariantId(v.id)} className={`inline-flex min-h-9 items-center gap-2 rounded-lg px-3 font-semibold ${v.id === variant.id ? 'bg-surface text-ink ring-1 ring-line' : 'text-muted hover:text-ink'}`}>
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: SERIES[v.id] }} aria-hidden />
                {labels[v.id]}
              </button>
            ))}
          </div>
        )}
        {report.viewers > 0 && report.viewers < RELIABLE_SAMPLE && <Callout tone="warn">{tr.header.smallSample(report.viewers, project.targetSessions)}</Callout>}
        {sample && report.sessions.byQuality.NONE === 0 && <p className="text-[12.5px] text-muted">{tr.header.sampleNote}</p>}
        {actions}
      </header>

      {report.viewers > 0 && (
        <Section title={tr.hook.title} aside={tr.hook.aside}>
          <HookCard hook={report.hook} />
        </Section>
      )}

      <Section id="report-chart" title={tr.chart.title} aside={tr.chart.aside}>
        <div className="min-w-0 space-y-5">
          <div className="min-w-0 rounded-2xl bg-surface p-4 ring-1 ring-line sm:p-5">
            <AttentionChart series={series} duration={report.duration} segments={report.segments} drops={report.drops} selected={selected} onSelect={setSelected} ariaLabel={tr.chart.aria(labels[report.variantId])} />
            <p className="mt-3 text-[12.5px] text-muted">{tr.chart.note}</p>
          </div>
          {selected !== null && <MomentPanel src={src} sessions={validData} t={selected} point={report.curve[Math.round(selected / report.bin)]} width={variant.width} height={variant.height} onClose={() => setSelected(null)} />}
          <dl className="grid grid-cols-2 gap-x-6 gap-y-5 lg:grid-cols-4">
            <Stat label={tr.numbers.mean} value={P(report.meanAttention)} />
            <Stat label={tr.numbers.after3} value={P(report.hook.at3)} hint={tr.numbers.after3Hint} />
            <Stat label={tr.numbers.last3} value={P(report.endAttention)} />
            <Stat label={tr.numbers.biggestDrop} value={biggest ? `−${Math.round(biggest.delta * 100)} pp` : '–'} hint={biggest ? `${formatTime(Math.floor(biggest.start), 0)}–${formatTime(Math.ceil(biggest.end), 0)}` : tr.numbers.noDrop} />
          </dl>
        </div>
      </Section>

      <Section title={tr.findings.title} aside={report.findings.some((f) => f.preliminary) ? tr.findings.preliminaryAside : undefined}>
        <Findings findings={report.findings} onJump={jump} projectId={sample ? undefined : project.id} variantId={sample ? undefined : variant.id} can={can} />
      </Section>

      {report.segments.length > 0 && report.viewers > 0 && (
        <Section title={report.segments[0].source === 'scene' ? tr.segments.titleScenes : tr.segments.titleIntervals}>
          <SegmentsTable segments={report.segments} onJump={jump} />
        </Section>
      )}

      {report.viewers > 0 && (
        <Section title={tr.visuals.title} aside={tr.visuals.aside}>
          {can.aggregateHeatmaps ? (
            <div className="space-y-4">
              <div className="no-print flex flex-wrap items-center justify-between gap-3">
                <HeatLegend />
                <label className="flex items-center gap-2 text-[13.5px] font-semibold">
                  <input type="checkbox" className="h-4 w-4 accent-cobalt" checked={showUnsafe} onChange={(e) => setShowUnsafe(e.target.checked)} />
                  {tr.visuals.showUnsafe}
                </label>
              </div>
              {src?.kind === 'image' && <Callout>{tr.visuals.youtubeNote}</Callout>}
              {src?.kind === 'placeholder' && variant.media?.kind === 'url' && <Callout>{tr.visuals.corsNote}</Callout>}
              <div className={`grid gap-5 ${vertical ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5' : 'sm:grid-cols-2 lg:grid-cols-3'}`}>
                {report.segments.map((s) => (
                  <SceneHeatmap key={s.index} src={src} sessions={validData} t0={s.t0} t1={s.t1} label={s.label} mean={s.mean} width={variant.width} height={variant.height} aois={variant.aois} unsafe={showUnsafe ? project.platform : null} />
                ))}
              </div>
            </div>
          ) : (
            <Locked plan={planFor('aggregateHeatmaps')} title={tr.visuals.locked} />
          )}
        </Section>
      )}

      {report.viewers > 0 && (
        <Section title={tr.aoi.title} aside={tr.aoi.aside}>
          {can.aoi || variant.aois.length > 0 ? (
            <AoiPanel results={report.aois} aois={variant.aois} src={src} duration={report.duration} width={variant.width} height={variant.height} platform={project.platform} onSave={can.aoi && onSaveAois ? (a) => onSaveAois(variant.id, a) : undefined} />
          ) : (
            <Locked plan={planFor('aoi')} title={tr.aoi.locked} />
          )}
          {report.brand && report.brand.n > 0 && (
            <p className="mt-4 text-[14px] text-ink">{tr.aoi.brandLine(report.brand.firstLookMedian === null ? null : formatNumber(report.brand.firstLookMedian, locale, 1), P(report.brand.by3s), P(report.brand.reach))}</p>
          )}
        </Section>
      )}

      {cmp && (
        <Section title={tr.compare.title(reports.length)} aside={tr.compare.aside(MIN_VERDICT_SAMPLE)}>
          {can.maxVariants >= reports.length || sample ? <Compare cmp={cmp} labels={labels} /> : <Locked plan={planFor(reports.length > 2 ? 'variants4' : 'variants2')} title={tr.compare.title(reports.length)} />}
        </Section>
      )}

      {Object.keys(answers).length > 0 && (
        <Section title={tr.answers.title}>
          <Callout>{tr.answers.label}</Callout>
          <dl className="mt-4 space-y-4">
            {Object.entries(answers).map(([q, counts]) => {
              const total = Object.values(counts).reduce((a, b) => a + b, 0);
              return (
                <div key={q}>
                  <dt className="text-[14.5px] font-semibold text-ink">{(t.viewer.questions.text as Record<string, string>)[q] ?? q}</dt>
                  <dd className="mt-2 flex flex-wrap gap-2">
                    {Object.entries(counts).map(([a, n]) => (
                      <span key={a} className="rounded-lg bg-surface px-3 py-1.5 text-[13.5px] ring-1 ring-line">
                        {tr.answers.option(a === 'brand' ? project.creatorName : (t.viewer.questions.finishOptions as Record<string, string>)[a] ?? (a === 'none' ? t.viewer.questions.dontRemember : a), formatPct(n / total, locale), n)}
                      </span>
                    ))}
                  </dd>
                </div>
              );
            })}
          </dl>
        </Section>
      )}

      <Methods report={report} />
    </article>
  );
}

/** „Jak liczymy” (§7 pkt 13, §5.22): definicja „patrzy”, liczba sesji, kalibracja, zastrzeżenia, zasady. */
function Methods({ report }: { report: VariantReport }) {
  const { t } = useI18n();
  const m = t.report.methods;
  const s = report.sessions;
  const rejected = Object.entries(s.rejectedBy)
    .filter(([, n]) => (n ?? 0) > 0)
    .map(([code, n]) => `${(t.studio.rejectCodes as Record<string, string>)[code] ?? code}: ${n}`);
  return (
    <section className="print-avoid">
      <details className="group rounded-2xl bg-surface ring-1 ring-line">
        <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between px-5 text-[17px] font-semibold text-ink">
          {m.title}
          <span className="text-muted group-open:rotate-180" aria-hidden>
            ▾
          </span>
        </summary>
        <div className="space-y-4 px-5 pb-5 text-[14.5px] leading-relaxed text-ink">
          <p>{m.looking}</p>
          <p>{m.sessions(s.total, s.valid, s.rejected)}</p>
          {rejected.length > 0 && <p className="text-muted">{m.rejectedBy(rejected.join(', '))}</p>}
          <p>{m.calibration(s.byQuality.GOOD, s.byQuality.FAIR, s.byQuality.POOR)}</p>
          <p>{m.resolution(report.bin === 0.5)}</p>
          <ul className="list-disc space-y-1 pl-5 text-muted">
            {m.disclaimers.map((d) => (
              <li key={d}>{d}</li>
            ))}
          </ul>
          <p className="text-muted">{m.ethics}</p>
        </div>
      </details>
    </section>
  );
}
