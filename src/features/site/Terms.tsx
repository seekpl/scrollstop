import { COMPANY, LEGAL, salesEmail } from '../../config/company';
import { useI18n } from '../../i18n';
import { formatDate } from '../../i18n/format';
import { SiteShell } from './SiteShell';

/** Notatka pod nagłówkiem tekstu prawnego: wersja robocza do przeglądu albo data wejścia w życie. */
export function LegalStatus() {
  const { t, locale } = useI18n();
  if (!LEGAL.reviewed) return <p className="mt-2 text-[13.5px] text-muted">{t.legal.draft}</p>;
  return LEGAL.effective ? <p className="mt-2 text-[13.5px] text-muted">{t.legal.updated(formatDate(`${LEGAL.effective}T12:00:00Z`, locale, { dateStyle: 'long' }))}</p> : null;
}

/** Regulamin (M9): usługi, konto, obowiązki twórcy, płatności, konsumenci, odpowiedzialność, reklamacje. */
export function TermsPage() {
  const { t } = useI18n();
  const g = t.legal.terms;
  return (
    <SiteShell>
      <article className="mx-auto max-w-[760px] px-4 py-10 sm:px-6 md:py-16">
        <h1 className="text-[34px] font-semibold leading-tight tracking-[-0.03em] text-ink md:text-[42px]">{g.title}</h1>
        <p className="mt-4 text-[17px] leading-relaxed text-ink">{g.lead}</p>
        <LegalStatus />
        {COMPANY.name && COMPANY.address && COMPANY.nip && <p className="mt-6 text-[15.5px] leading-relaxed text-ink">{g.operator(COMPANY.name, COMPANY.address, COMPANY.nip, salesEmail())}</p>}
        <div className="mt-10 space-y-10">
          {g.sections.map((s) => (
            <section key={s.id} aria-labelledby={`terms-${s.id}`} className="border-t border-line pt-8">
              <h2 id={`terms-${s.id}`} className="text-[22px] font-semibold tracking-[-0.01em] text-ink">
                {s.title}
              </h2>
              <ol className="mt-3 list-decimal space-y-2 pl-5 text-[15.5px] leading-relaxed text-ink">
                {s.items.map((x) => (
                  <li key={x}>{x}</li>
                ))}
              </ol>
            </section>
          ))}
        </div>
      </article>
    </SiteShell>
  );
}
