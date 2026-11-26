import { useMemo } from 'react';
import { hrefOf } from '../../app/router';
import { FORMAT_SAMPLE, type FormatId } from '../../config/formats';
import { useT } from '../../i18n';
import { formatFacts } from '../../research/formatFacts';
import { Icon } from '../../ui/kit';
import { FormatTiles } from './landing/FormatTiles';
import { PageIntro } from './PageIntro';
import { SiteShell } from './SiteShell';

/**
 * Podstrona formatu badania (`/formats/<id>/`): treść pod wyszukiwarki i reklamę — pytania,
 * przebieg badania, zawartość raportu, kiedy warto, najczęstsze pytania (rozwijane; te same
 * pytania trafiają do danych strukturalnych FAQPage w pliku HTML) i odnośniki do innych formatów.
 * Liczby i plany w treści pochodzą z kodu badań (`formatFacts`).
 */
export function FormatPage({ format }: { format: FormatId }) {
  const t = useT();
  const fx = t.formats;
  const facts = useMemo(() => formatFacts((id) => t.billing.planNames[id]), [t]);
  const c = fx.pages[format](facts);
  const sample = FORMAT_SAMPLE[format];
  const h2 = 'text-[26px] font-normal leading-tight tracking-[-0.03em] text-[var(--l-ink)] md:text-[32px]';
  return (
    <SiteShell seo={t.site.seo.formats[format]}>
      <PageIntro title={c.title} lead={c.lead}>
        <div className="mt-8 flex flex-col gap-3 min-[480px]:flex-row min-[480px]:flex-wrap">
          <a href={hrefOf({ name: 'new-project' })} className="l-btn l-btn-primary">
            {c.cta}
          </a>
          <a href={sample ? hrefOf({ name: 'sample', sample }) : hrefOf({ name: 'pricing' })} className="l-btn l-btn-ghost">
            {sample ? fx.label.sample : fx.label.pricing}
          </a>
        </div>
        <p className="mt-4 text-[13.5px] text-white/65">{c.planNote}</p>
      </PageIntro>

      <section className="l-light" aria-labelledby="f-questions">
        <div className="mx-auto max-w-[1152px] px-4 py-14 sm:px-6 md:py-20">
          <h2 id="f-questions" className={h2}>
            {fx.label.questions}
          </h2>
          <ul className="mt-8 grid gap-px overflow-hidden rounded-[12px] border border-[var(--l-line)] bg-[var(--l-line)] sm:grid-cols-2">
            {c.questions.map((q) => (
              <li key={q} className="flex min-w-0 gap-3 bg-[var(--l-light-2)] p-5 text-[16px] leading-relaxed text-[var(--l-ink)] sm:p-6">
                <span aria-hidden className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-[var(--l-accent)]" />
                {q}
              </li>
            ))}
          </ul>

          <h2 id="f-steps" className={`${h2} mt-16 md:mt-20`}>
            {fx.label.steps}
          </h2>
          <ol className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {c.steps.map(([title, body], i) => (
              <li key={title} className="min-w-0 border-t-2 border-[var(--l-ink)] pt-4">
                <span className="text-[13px] font-semibold tabular-nums text-[var(--l-accent-deep)]">{String(i + 1).padStart(2, '0')}</span>
                <h3 className="mt-2 text-[18px] font-medium text-[var(--l-ink)]">{title}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-[var(--l-muted)]">{body}</p>
              </li>
            ))}
          </ol>

          <h2 id="f-report" className={`${h2} mt-16 md:mt-20`}>
            {fx.label.report}
          </h2>
          <ul className="mt-8 grid gap-4 md:grid-cols-2">
            {c.report.map(([title, body]) => (
              <li key={title} className="min-w-0 rounded-[12px] border border-[var(--l-line)] bg-white p-5 sm:p-6">
                <h3 className="text-[18px] font-medium text-[var(--l-ink)]">{title}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-[var(--l-muted)]">{body}</p>
              </li>
            ))}
          </ul>

          <div className="mt-16 grid gap-12 md:mt-20 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
            <div className="min-w-0">
              <h2 id="f-when" className={h2}>
                {fx.label.when}
              </h2>
              <ul className="mt-6 space-y-4">
                {c.when.map((w) => (
                  <li key={w} className="flex gap-3 text-[16px] leading-relaxed text-[var(--l-ink)]">
                    <span aria-hidden className="mt-0.5 shrink-0 text-[var(--l-accent-deep)]">
                      <Icon name="check" size={20} />
                    </span>
                    {w}
                  </li>
                ))}
              </ul>
            </div>
            <div className="min-w-0">
              <h2 id="f-faq" className={h2}>
                {fx.label.faq}
              </h2>
              <div className="mt-6 divide-y divide-[var(--l-line)] border-y border-[var(--l-line)]">
                {c.faq.map(([q, a]) => (
                  <details key={q} className="group">
                    <summary className="flex cursor-pointer list-none items-start justify-between gap-4 py-4 text-[16.5px] font-medium text-[var(--l-ink)] [&::-webkit-details-marker]:hidden">
                      {q}
                      <span aria-hidden className="mt-1 shrink-0 text-[var(--l-muted)] transition-transform group-open:rotate-45">
                        <svg viewBox="0 0 20 20" width="18" height="18" focusable="false">
                          <path d="M10 4v12M4 10h12" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                        </svg>
                      </span>
                    </summary>
                    <p className="pb-5 pr-8 text-[15px] leading-relaxed text-[var(--l-muted)]">{a}</p>
                  </details>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="l-night relative overflow-hidden" aria-labelledby="f-other">
        <div className="relative mx-auto max-w-[1152px] px-4 py-14 sm:px-6 md:py-20">
          <h2 id="f-other" className="text-[26px] font-normal leading-tight tracking-[-0.03em] md:text-[32px]">
            {fx.label.other}
          </h2>
          <FormatTiles exclude={format} className="mt-8" />
        </div>
      </section>

      <section className="l-night relative overflow-hidden border-t border-white/10" aria-labelledby="f-cta">
        <div aria-hidden className="no-print l-glow pointer-events-none absolute inset-0 rotate-180 opacity-80" />
        <div className="relative mx-auto flex max-w-[1152px] flex-col items-start gap-6 px-4 py-14 sm:px-6 md:flex-row md:items-center md:justify-between md:py-20">
          <div className="min-w-0">
            <h2 id="f-cta" className="max-w-[24ch] text-[26px] font-normal leading-tight tracking-[-0.03em] md:text-[32px]">
              {fx.label.ctaTitle}
            </h2>
            <p className="mt-3 max-w-[56ch] text-[15.5px] leading-relaxed text-white/75">{fx.label.ctaLead}</p>
            <p className="mt-2 max-w-[56ch] text-[13.5px] leading-relaxed text-white/65">{fx.label.privacy}</p>
          </div>
          <div className="flex flex-col gap-3 min-[480px]:flex-row">
            <a href={hrefOf({ name: 'new-project' })} className="l-btn l-btn-primary">
              {c.cta}
            </a>
            <a href={hrefOf({ name: 'pricing' })} className="l-btn l-btn-ghost">
              {t.site.nav.pricing}
            </a>
          </div>
        </div>
      </section>
    </SiteShell>
  );
}
