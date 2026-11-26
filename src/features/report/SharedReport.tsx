import { useEffect, useMemo, useState } from 'react';
import { useResearch } from '../../app/research';
import { errorCode } from '../../core/errors';
import { formatTime } from '../../core/math/util';
import { useI18n } from '../../i18n';
import { formatDate, formatPct } from '../../i18n/format';
import { RESEARCH_TEXT } from '../../i18n/research';
import type { VariantId } from '../../research/model';
import { FULL_ACCESS } from '../../research/plans';
import { headline } from '../../research/report';
import { RELIABLE_SAMPLE } from '../../research/sessions';
import type { SharedReport } from '../../research/share';
import { Badge, Callout, Section } from '../../ui/kit';
import { SERIES } from '../../ui/tokens';
import { PageIntro } from '../site/PageIntro';
import { SiteShell } from '../site/SiteShell';
import { AoiPanel } from './AoiPanel';
import { AttentionChart } from './AttentionChart';
import { Compare } from './Compare';
import { Findings } from './Findings';
import { HookCard } from './HookCard';
import { ageSpan, Stat, variantLabel } from './ReportView';
import { SegmentsTable } from './SegmentsTable';

/**
 * Raport udostępniony linkiem (§13.2): tylko dane zbiorcze policzone na serwerze — bez surowych
 * sesji, map spojrzeń i wartości pojedynczych widzów. Do odczytu, bez logowania.
 */
export function SharedReportPage({ token }: { token: string }) {
  const { t, locale } = useI18n();
  const tr = t.report;
  const ts = tr.shared;
  const { api } = useResearch();
  const [data, setData] = useState<SharedReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [variantId, setVariantId] = useState<VariantId>('A');
  const [selected, setSelected] = useState<number | null>(null);
  useEffect(() => {
    if (api.mode !== 'server') {
      setError(t.errors.local_mode);
      return;
    }
    api.sharedReport(token, locale).then(
      (d) => {
        setData(d);
        setError(null);
      },
      (e) => setError((t.errors as Record<string, string>)[errorCode(e)] ?? t.errors.unknown),
    );
  }, [api, token, locale, t]);
  const report = data ? (data.reports.find((r) => r.variantId === variantId) ?? data.reports[0]) : null;
  const labels = useMemo(() => Object.fromEntries((data?.project.variants ?? []).map((v) => [v.id, variantLabel(v, t)])) as Record<VariantId, string>, [data, t]);
  const P = (v: number | null) => formatPct(v, locale);

  if (!data || !report)
    return (
      <SiteShell nav={[]} cta={null}>
        <PageIntro compact title={ts.title} />
        <section className="l-light">
          <div className="mx-auto max-w-[1152px] px-4 py-10 sm:px-6">
            {error && (
              <div className="max-w-xl">
                <Callout tone="warn">{error}</Callout>
              </div>
            )}
          </div>
        </section>
      </SiteShell>
    );

  const rt = RESEARCH_TEXT[data.locale];
  const head = headline(report, rt);
  const sm = report.sessions;
  const age = ageSpan(sm.byAge);
  const devices = (['mobile', 'desktop', 'tablet'] as const).filter((d) => sm.byDevice[d] > 0).map((d) => tr.header.deviceCount[d](sm.byDevice[d]));
  const sampleLine = [tr.header.viewers(report.viewers) + (age ? `, ${tr.header.age(age)}` : ''), devices.join(', '), report.viewers ? (sm.audioOn > sm.audioOff ? tr.header.soundOn : tr.header.soundOff) : null].filter(Boolean);
  const variant = data.project.variants.find((v) => v.id === report.variantId) ?? data.project.variants[0];
  const answers = data.answers[report.variantId] ?? {};
  const biggest = report.drops[0];
  const jump = (sec: number) => setSelected(Math.floor(sec / report.bin) * report.bin);

  return (
    // Raport dla klienta: układ serwisu bez menu i przycisku głównego (link otwiera osoba spoza studia).
    <SiteShell nav={[]} cta={null}>
      <PageIntro
        compact
        title={data.project.name}
        lead={<span className="text-[13.5px]">{sampleLine.join('; ')}</span>}
        top={
          <div className="flex flex-wrap items-center justify-between gap-4">
            <p className="text-[13.5px] text-white/70">{ts.kicker(data.project.creatorName, formatDate(data.expiresAt, locale))}</p>
            {data.logo && <img src={data.logo} alt={ts.logoAlt(data.project.creatorName)} className="h-12 w-auto rounded-lg bg-white p-1.5" />}
          </div>
        }
      />
      <section className="l-light">
        <article className="mx-auto min-w-0 max-w-[1152px] space-y-12 px-4 py-10 sm:px-6 md:py-14">
          <header className="space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={report.level === 'reliable' ? 'good' : report.level === 'none' ? 'neutral' : 'fair'}>{tr.header.level[report.level]}</Badge>
              {report.viewers > 0 && <Badge tone="info">{sm.panel >= sm.community ? tr.header.sourcePanel : tr.header.sourceCommunity}</Badge>}
            </div>
            <h2 className="max-w-[30ch] text-[24px] font-semibold leading-[1.15] tracking-[-0.02em] text-ink sm:text-[30px]">{head.lead}</h2>
            {head.detail && <p className="max-w-[68ch] text-[16px] leading-relaxed text-muted">{head.detail}</p>}
            {data.project.variants.length > 1 && (
              <div role="radiogroup" aria-label={tr.header.versionPicker} className="inline-flex max-w-full flex-wrap gap-1 rounded-[10px] bg-ink/[0.05] p-1 text-[13.5px]">
                {data.project.variants.map((v) => (
                  <button key={v.id} type="button" role="radio" aria-checked={v.id === report.variantId} onClick={() => (setVariantId(v.id), setSelected(null))} className={`inline-flex min-h-9 items-center gap-2 rounded-lg px-3 font-semibold ${v.id === report.variantId ? 'bg-surface text-ink ring-1 ring-line' : 'text-muted hover:text-ink'}`}>
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: SERIES[v.id] }} aria-hidden />
                    {labels[v.id]}
                  </button>
                ))}
              </div>
            )}
            {report.viewers > 0 && report.viewers < RELIABLE_SAMPLE && <Callout tone="warn">{tr.header.smallSample(report.viewers, data.project.targetSessions)}</Callout>}
          </header>

          {report.viewers > 0 && (
            <Section title={tr.hook.title} aside={tr.hook.aside}>
              <HookCard hook={report.hook} />
            </Section>
          )}

          <Section title={tr.chart.title} aside={tr.chart.aside}>
            <div className="min-w-0 space-y-5">
              <div className="min-w-0 rounded-2xl bg-surface p-4 ring-1 ring-line sm:p-5">
                <AttentionChart series={[{ id: report.variantId, label: labels[report.variantId], curve: report.curve, color: SERIES[report.variantId] }]} duration={report.duration} segments={report.segments} drops={report.drops} selected={selected} onSelect={setSelected} ariaLabel={tr.chart.aria(labels[report.variantId])} />
                <p className="mt-3 text-[12.5px] text-muted">{ts.chartNote}</p>
              </div>
              <dl className="grid grid-cols-2 gap-x-6 gap-y-5 lg:grid-cols-4">
                <Stat label={tr.numbers.mean} value={P(report.meanAttention)} />
                <Stat label={tr.numbers.after3} value={P(report.hook.at3)} hint={tr.numbers.after3Hint} />
                <Stat label={tr.numbers.last3} value={P(report.endAttention)} />
                <Stat label={tr.numbers.biggestDrop} value={biggest ? `−${Math.round(biggest.delta * 100)} pp` : '–'} hint={biggest ? `${formatTime(Math.floor(biggest.start), 0)}–${formatTime(Math.ceil(biggest.end), 0)}` : tr.numbers.noDrop} />
              </dl>
            </div>
          </Section>

          <Section title={tr.findings.title}>
            <Findings findings={report.findings} onJump={jump} can={FULL_ACCESS} />
          </Section>

          {report.segments.length > 0 && report.viewers > 0 && (
            <Section title={report.segments[0].source === 'scene' ? tr.segments.titleScenes : tr.segments.titleIntervals}>
              <SegmentsTable segments={report.segments} onJump={jump} />
            </Section>
          )}

          {report.aois.length > 0 && (
            <Section title={tr.aoi.title} aside={tr.aoi.aside}>
              <AoiPanel results={report.aois} aois={[]} src={null} duration={report.duration} width={variant.width} height={variant.height} platform={data.project.platform} />
            </Section>
          )}

          {data.comparison && (
            <Section title={tr.compare.title(data.reports.length)}>
              <Compare cmp={data.comparison} labels={labels} />
            </Section>
          )}

          {Object.keys(answers).length > 0 && (
            <Section title={tr.answers.title}>
              <dl className="space-y-4">
                {Object.entries(answers).map(([q, counts]) => {
                  const total = Object.values(counts).reduce((a, b) => a + b, 0);
                  return (
                    <div key={q}>
                      <dt className="text-[14.5px] font-semibold text-ink">{(t.viewer.questions.text as Record<string, string>)[q] ?? q}</dt>
                      <dd className="mt-2 flex flex-wrap gap-2">
                        {Object.entries(counts).map(([a, n]) => (
                          <span key={a} className="rounded-lg bg-surface px-3 py-1.5 text-[13.5px] ring-1 ring-line">
                            {tr.answers.option(a === 'brand' ? data.project.creatorName : ((t.viewer.questions.finishOptions as Record<string, string>)[a] ?? (a === 'none' ? t.viewer.questions.dontRemember : a)), formatPct(n / total, locale), n)}
                          </span>
                        ))}
                      </dd>
                    </div>
                  );
                })}
              </dl>
            </Section>
          )}

          <p className="border-t border-line pt-6 text-[13px] leading-relaxed text-muted">{ts.note}</p>
        </article>
      </section>
    </SiteShell>
  );
}
