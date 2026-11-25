import { useMemo } from 'react';
import { pathOf, SAMPLE_IDS, type SampleId } from '../../app/router';
import { useI18n } from '../../i18n';
import { RESEARCH_TEXT } from '../../i18n/research';
import { demoProject } from '../../research/panelSim';
import { FULL_ACCESS } from '../../research/plans';
import { Badge, btnClass } from '../../ui/kit';
import { ReportView } from '../report/ReportView';
import { SiteShell } from './SiteShell';

/** Przykładowe raporty (§7, §22.2): rolka A/B i film z symulowanego panelu, pełne funkcje bez znaku wodnego. */
export function SamplePage({ sample }: { sample: SampleId }) {
  const { t, locale } = useI18n();
  const s = t.site.samplePage;
  const demo = useMemo(() => (sample === 'feed' ? null : demoProject(sample, RESEARCH_TEXT[locale], { createdAt: '2026-01-01T00:00:00.000Z' })), [sample, locale]);
  const tabs = (
    <nav aria-label={s.tabsLabel} className="flex flex-wrap gap-1 rounded-xl bg-ink/[0.05] p-1">
      {SAMPLE_IDS.map((id) =>
        id === 'feed' ? (
          <span key={id} className="inline-flex min-h-9 items-center gap-2 rounded-lg px-3 text-[13.5px] font-semibold text-muted" aria-disabled="true">
            {s.tabs[id]} <Badge>{t.common.soon}</Badge>
          </span>
        ) : (
          <a key={id} href={pathOf({ name: 'sample', sample: id })} aria-current={sample === id ? 'page' : undefined} className={`inline-flex min-h-9 items-center rounded-lg px-3 text-[13.5px] font-semibold ${sample === id ? 'bg-surface text-ink shadow-sm ring-1 ring-line' : 'text-muted hover:text-ink'}`}>
            {s.tabs[id]}
          </a>
        ),
      )}
    </nav>
  );
  return (
    <SiteShell>
      <div className="mx-auto max-w-[1152px] px-4 py-10 sm:px-6 md:py-14">
        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="min-w-0">
            <h1 className="text-[30px] font-semibold tracking-[-0.03em] text-ink md:text-[38px]">{s.title}</h1>
            <p className="mt-2 max-w-[64ch] text-[15.5px] leading-relaxed text-muted">{s.lead}</p>
          </div>
          <a href={pathOf({ name: 'new-project' })} className={btnClass('primary', 'md', 'shrink-0')}>
            {s.cta}
          </a>
        </div>
        {demo ? (
          <ReportView project={{ ...demo.project, locale }} sessions={demo.sessions} can={FULL_ACCESS} sample sampleSwitch={tabs} />
        ) : (
          <div className="space-y-6">
            {tabs}
            <p className="text-[15px] text-muted">{s.feedSoon}</p>
          </div>
        )}
      </div>
    </SiteShell>
  );
}
