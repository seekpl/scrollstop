import { pathOf } from '../../app/router';
import { useT } from '../../i18n';
import { btnClass, Icon } from '../../ui/kit';
import { HeroDemo } from './HeroDemo';
import { SiteShell } from './SiteShell';

/** Strona główna (§1, §19.7): hasło z żywą krzywą nad klipem, jak to działa, raport, prywatność. Reszta spokojna. */
export function LandingPage() {
  const t = useT();
  const h = t.site.hero;
  const l = t.site.landing;
  return (
    <SiteShell>
      <section className="mx-auto grid max-w-[1152px] gap-10 px-4 pb-14 pt-10 sm:px-6 md:grid-cols-[minmax(0,1fr)_300px] md:items-center md:gap-14 md:pb-20 md:pt-16">
        <div className="min-w-0">
          <h1 className="max-w-[20ch] text-[34px] font-semibold leading-[1.05] tracking-[-0.035em] text-ink min-[400px]:text-[40px] md:text-[56px]">{h.title}</h1>
          <p className="mt-5 max-w-[62ch] text-[16px] leading-relaxed text-muted md:text-[17px]">{h.lead}</p>
          <div className="mt-7 flex flex-col gap-3 min-[480px]:flex-row min-[480px]:flex-wrap">
            <a href={pathOf({ name: 'new-project' })} className={btnClass('primary', 'lg')}>
              {h.ctaPrimary}
            </a>
            <a href={pathOf({ name: 'sample', sample: 'reel' })} className={btnClass('secondary', 'lg')}>
              {h.ctaSample}
            </a>
          </div>
          <p className="mt-3 text-[13.5px] text-muted">{h.freeNote}</p>
        </div>
        <HeroDemo />
      </section>

      <section className="border-t border-line bg-surface" aria-labelledby="how">
        <div className="mx-auto max-w-[1152px] px-4 py-14 sm:px-6 md:py-20">
          <h2 id="how" className="text-[26px] font-semibold tracking-[-0.02em] text-ink md:text-[32px]">
            {l.howTitle}
          </h2>
          <ol className="mt-8 grid gap-8 md:grid-cols-3">
            {l.how.map((s, i) => (
              <li key={s.title} className="min-w-0">
                <span className="tabular text-[14px] font-semibold text-cobalt">{String(i + 1).padStart(2, '0')}</span>
                <h3 className="mt-2 text-[18px] font-semibold text-ink">{s.title}</h3>
                <p className="mt-2 max-w-[48ch] text-[15px] leading-relaxed text-muted">{s.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="border-t border-line" aria-labelledby="report">
        <div className="mx-auto max-w-[1152px] px-4 py-14 sm:px-6 md:py-20">
          <h2 id="report" className="text-[26px] font-semibold tracking-[-0.02em] text-ink md:text-[32px]">
            {l.reportTitle}
          </h2>
          <dl className="mt-8 grid gap-x-10 gap-y-7 sm:grid-cols-2 lg:grid-cols-3">
            {l.report.map((r) => (
              <div key={r.title} className="min-w-0 border-l-2 border-cobalt/70 pl-4">
                <dt className="text-[16.5px] font-semibold text-ink">{r.title}</dt>
                <dd className="mt-1.5 text-[15px] leading-relaxed text-muted">{r.body}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-8 max-w-[80ch] text-[14px] text-muted">{l.accuracyNote}</p>
        </div>
      </section>

      <section className="bg-ink text-white" aria-labelledby="privacy">
        <div className="mx-auto grid max-w-[1152px] gap-10 px-4 py-14 sm:px-6 md:grid-cols-2 md:py-20">
          <div className="min-w-0">
            <h2 id="privacy" className="text-[26px] font-semibold tracking-[-0.02em] md:text-[32px]">
              {l.privacyTitle}
            </h2>
            <p className="mt-4 max-w-[60ch] text-[15.5px] leading-relaxed text-white/80">{l.privacyBody}</p>
            <a href={pathOf({ name: 'privacy' })} className="mt-5 inline-flex min-h-10 items-center gap-2 font-semibold text-white underline decoration-white/40 underline-offset-4 hover:decoration-white">
              {l.privacyLink}
              <Icon name="arrow-right" size={16} />
            </a>
          </div>
          <div className="min-w-0">
            <h2 className="text-[20px] font-semibold">{l.notTitle}</h2>
            <ul className="mt-4 space-y-3">
              {l.not.map((x) => (
                <li key={x} className="flex gap-3 text-[15.5px] leading-relaxed text-white/85">
                  <span className="mt-0.5 shrink-0 text-white/60">
                    <Icon name="close" size={18} />
                  </span>
                  {x}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="border-b border-line" aria-labelledby="cta">
        <div className="mx-auto flex max-w-[1152px] flex-col items-start gap-5 px-4 py-14 sm:px-6 md:flex-row md:items-center md:justify-between md:py-16">
          <h2 id="cta" className="max-w-[26ch] text-[24px] font-semibold tracking-[-0.02em] text-ink md:text-[28px]">
            {l.ctaTitle}
          </h2>
          <div className="flex flex-col gap-3 min-[480px]:flex-row">
            <a href={pathOf({ name: 'new-project' })} className={btnClass('primary', 'lg')}>
              {h.ctaPrimary}
            </a>
            <a href={pathOf({ name: 'pricing' })} className={btnClass('secondary', 'lg')}>
              {t.site.nav.pricing}
            </a>
          </div>
        </div>
      </section>
    </SiteShell>
  );
}
