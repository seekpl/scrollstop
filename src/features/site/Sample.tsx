import { useMemo } from 'react';
import { hrefOf, SAMPLE_IDS, type SampleId } from '../../app/router';
import { useI18n } from '../../i18n';
import { RESEARCH_TEXT } from '../../i18n/research';
import { demoFeedProject } from '../../research/formatSim';
import { demoProject } from '../../research/panelSim';
import { FULL_ACCESS } from '../../research/plans';
import { ReportView } from '../report/ReportView';
import { PageIntro } from './PageIntro';
import { SiteShell } from './SiteShell';

/** Przykładowe raporty (§7, §22.2): rolka A/B i film z symulowanego panelu, pełne funkcje bez znaku wodnego. */
export function SamplePage({ sample }: { sample: SampleId }) {
  const { t, locale } = useI18n();
  const s = t.site.samplePage;
  const demo = useMemo(() => {
    const opts = { createdAt: '2026-01-01T00:00:00.000Z' };
    return sample === 'feed' ? demoFeedProject(RESEARCH_TEXT[locale], opts) : demoProject(sample, RESEARCH_TEXT[locale], opts);
  }, [sample, locale]);
  const tabs = (
    <nav aria-label={s.tabsLabel} className="mt-8 grid grid-cols-3 overflow-hidden rounded-[12px] border border-white/15 sm:inline-grid sm:w-auto">
      {SAMPLE_IDS.map((id, i) => (
        <a
          key={id}
          href={hrefOf({ name: 'sample', sample: id })}
          aria-current={sample === id ? 'page' : undefined}
          className={`flex min-h-12 min-w-0 items-center justify-center px-3 text-center text-[13.5px] font-semibold leading-tight sm:px-5 sm:text-[14.5px] ${i ? 'border-l border-white/15' : ''} ${sample === id ? 'bg-[var(--l-light-2)] text-[var(--l-ink)]' : 'bg-white/[0.03] text-white/80 hover:bg-white/[0.08] hover:text-white'}`}
        >
          {s.tabs[id]}
        </a>
      ))}
    </nav>
  );
  return (
    <SiteShell seo={t.site.seo.sample[sample]}>
      <PageIntro title={s.title} lead={s.lead}>
        <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
          {tabs}
          <a href={hrefOf({ name: 'new-project' })} className="l-btn l-btn-primary w-fit">
            {s.cta}
          </a>
        </div>
      </PageIntro>
      <section className="l-light">
        <div className="mx-auto max-w-[1152px] px-4 py-10 sm:px-6 md:py-14">
          <ReportView key={sample} project={{ ...demo.project, locale }} sessions={demo.sessions} can={FULL_ACCESS} sample />
        </div>
      </section>
    </SiteShell>
  );
}
