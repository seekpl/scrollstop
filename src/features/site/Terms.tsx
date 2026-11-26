import { COMPANY, LEGAL, salesEmail } from '../../config/company';
import { useI18n } from '../../i18n';
import { formatDate } from '../../i18n/format';
import { PageIntro } from './PageIntro';
import { SiteShell } from './SiteShell';

/** Data wejścia w życie pod tytułem regulaminu i polityki prywatności. */
export function LegalStatus({ className = '' }: { className?: string }) {
  const { t, locale } = useI18n();
  return <p className={`mt-3 text-[13.5px] ${className}`}>{t.legal.updated(formatDate(`${LEGAL.effective}T12:00:00Z`, locale, { dateStyle: 'long' }))}</p>;
}

/** Regulamin (M9): usługi, konto, obowiązki twórcy, płatności, konsumenci, odpowiedzialność, reklamacje. */
export function TermsPage() {
  const { t } = useI18n();
  const g = t.legal.terms;
  return (
    <SiteShell seo={t.site.seo.terms}>
      <PageIntro title={g.title} lead={g.lead} narrow>
        <LegalStatus className="text-white/60" />
      </PageIntro>
      <article className="l-sage">
        <div className="mx-auto max-w-[808px] px-4 py-12 sm:px-6 md:py-16">
        {COMPANY.name && COMPANY.address && COMPANY.nip && <p className="rounded-[12px] border border-[var(--l-sage-line)] bg-[var(--l-sage-2)] p-5 text-[15.5px] leading-relaxed text-[var(--l-pine)]">{g.operator(COMPANY.name, COMPANY.address, COMPANY.nip, salesEmail())}</p>}
        <div className="mt-10 space-y-10">
          {g.sections.map((s) => (
            <section key={s.id} aria-labelledby={`terms-${s.id}`} className="border-t border-[var(--l-sage-line)] pt-8">
              <h2 id={`terms-${s.id}`} className="text-[24px] font-normal tracking-[-0.02em] text-[var(--l-pine)]">
                {s.title}
              </h2>
              <ol className="mt-3 list-decimal space-y-2 pl-5 text-[15.5px] leading-relaxed text-[var(--l-pine)] marker:text-[var(--l-moss)]">
                {s.items.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ol>
            </section>
          ))}
        </div>
        </div>
      </article>
    </SiteShell>
  );
}
