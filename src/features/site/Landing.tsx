import { hrefOf } from '../../app/router';
import { useT } from '../../i18n';
import { Icon } from '../../ui/kit';
import { FormatArt, ProblemIcon, type FormatId } from './landing/art';
import { AttentionStory } from './landing/AttentionStory';
import { RevealText } from './landing/RevealText';
import { SampleTabs } from './landing/SampleTabs';
import { StepCascade } from './landing/StepCascade';
import { SiteShell } from './SiteShell';

const FORMATS: FormatId[] = ['reel', 'video', 'feed', 'thumbnail', 'carousel', 'versions'];

/**
 * Strona główna w wyglądzie z nagrania referencyjnego: granat z logo z kobaltową poświatą, ukośny
 * schemat kroków, pas formatów, zakładki z przykładowymi raportami, jasne sekcje z tekstem
 * ujawnianym przy przewijaniu i krzywa uwagi rysowana z danych. Treść i liczby pochodzą ze
 * słownika i z symulowanego panelu. Ten sam układ (nagłówek, pas z tytułem, stopka) mają podstrony i studio.
 */
export function LandingPage() {
  const t = useT();
  const h = t.site.hero;
  const l = t.site.landing;
  return (
    <SiteShell seo={t.site.seo.landing}>
      {/* Pierwszy ekran */}
      <section className="l-night relative -mt-16 overflow-hidden pt-16">
        <div aria-hidden className="l-glow pointer-events-none absolute inset-0" />
        <div aria-hidden className="l-grid pointer-events-none absolute inset-0" />
        <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-[var(--l-night)]" />
        <div className="relative mx-auto grid max-w-[1152px] gap-12 px-4 pb-10 pt-12 sm:px-6 md:pt-20 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)] lg:items-center lg:gap-8 lg:pb-14 lg:pt-24">
          <div className="min-w-0">
            <h1 className="max-w-[21ch] text-[38px] font-normal leading-[1.05] tracking-[-0.035em] min-[400px]:text-[42px] md:text-[54px]">
              <span className="l-sweep l-sweep-white">{h.titleStart}</span> <span className="l-sweep l-sweep-accent">{h.titleEnd}</span>
            </h1>
            <p className="mt-6 max-w-[54ch] text-[16.5px] leading-relaxed text-white/75 md:text-[17.5px]">{h.lead}</p>
            <div className="mt-8 flex flex-col gap-3 min-[480px]:flex-row min-[480px]:flex-wrap">
              <a href={hrefOf({ name: 'new-project' })} className="l-btn l-btn-primary">
                {h.ctaPrimary}
              </a>
              <a href={hrefOf({ name: 'sample', sample: 'reel' })} className="l-btn l-btn-ghost">
                {h.ctaSample}
              </a>
            </div>
            <p className="mt-4 text-[13.5px] text-white/60">{h.freeNote}</p>
          </div>
          <StepCascade steps={l.steps} label={l.stepsLabel} />
        </div>

        <div className="relative mx-auto max-w-[1152px] px-4 pb-16 sm:px-6 md:pb-20">
          <h2 className="sr-only">{l.formatsLabel}</h2>
          <ul className="grid grid-cols-2 gap-px overflow-hidden rounded-[12px] border border-white/12 bg-white/12 sm:grid-cols-3 lg:grid-cols-6">
            {FORMATS.map((f) => (
              <li key={f} className="flex min-h-[132px] min-w-0 flex-col justify-between gap-3 bg-[color-mix(in_srgb,var(--l-night)_88%,white)] p-4 transition-colors hover:bg-[color-mix(in_srgb,var(--l-night)_80%,white)]">
                <span className="self-center">
                  <FormatArt id={f} />
                </span>
                <span className="text-[14px] font-medium text-white/90">{l.formats[f]}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <SampleTabs />

      {/* Problem */}
      <section className="l-light" aria-labelledby="problem">
        <div className="mx-auto max-w-[1152px] px-4 py-16 sm:px-6 md:py-24">
          <div className="mx-auto max-w-[820px] text-center">
            <p className="text-[14px] font-semibold text-[var(--l-accent-deep)]">{l.problemLabel}</p>
            <RevealText id="problem" tone="light" text={l.problemTitle} className="mt-3 text-[28px] font-normal leading-[1.15] tracking-[-0.03em] sm:text-[38px]" />
          </div>
          <ul className="mt-12 grid gap-px overflow-hidden rounded-[12px] border border-[var(--l-line)] bg-[var(--l-line)] md:grid-cols-3">
            {l.problems.map((p, i) => (
              <li key={p} className="flex min-w-0 flex-col gap-5 bg-[var(--l-light-2)] p-6 sm:p-7">
                <ProblemIcon i={i} />
                <p className="max-w-[40ch] text-[15.5px] leading-relaxed text-[var(--l-ink)]">{p}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Rozwiązanie */}
      <section className="l-haze border-t border-[var(--l-line)]" aria-labelledby="answer">
        <div className="mx-auto max-w-[860px] px-4 py-16 text-center sm:px-6 md:py-24">
          <p className="text-[14px] font-semibold text-[var(--l-accent-deep)]">{l.answerLabel}</p>
          <RevealText id="answer" tone="light" text={l.answerTitle} className="mt-3 text-[28px] font-normal leading-[1.15] tracking-[-0.03em] sm:text-[38px]" />
          <p className="mx-auto mt-6 max-w-[62ch] text-[16px] leading-relaxed text-[var(--l-muted)]">{l.answerBody}</p>
          <a href="#krzywa" onClick={(e) => (e.preventDefault(), document.getElementById('krzywa')?.scrollIntoView({ behavior: 'smooth' }))} className="mx-auto mt-8 grid h-11 w-11 place-items-center rounded-full text-[var(--l-ink)] ring-1 ring-inset ring-[var(--l-line)] hover:bg-white/60" aria-label={l.answerNext}>
            <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden focusable="false">
              <path d="M10 3v13M4.5 10.5L10 16l5.5-5.5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </a>
        </div>
      </section>

      <AttentionStory />

      {/* Prywatność */}
      <section className="l-night relative overflow-hidden" aria-labelledby="privacy">
        <div className="relative mx-auto grid max-w-[1152px] gap-10 px-4 py-16 sm:px-6 md:grid-cols-2 md:py-24">
          <div className="min-w-0">
            <h2 id="privacy" className="text-[28px] font-normal leading-tight tracking-[-0.03em] md:text-[36px]">
              {l.privacyTitle}
            </h2>
            <p className="mt-5 max-w-[56ch] text-[16px] leading-relaxed text-white/75">{l.privacyBody}</p>
            <a href={hrefOf({ name: 'privacy' })} className="mt-6 inline-flex min-h-10 items-center font-semibold text-[var(--l-accent)] underline decoration-[var(--l-accent)]/40 underline-offset-4 hover:decoration-[var(--l-accent)]">
              {l.privacyLink}
            </a>
          </div>
          <div className="min-w-0 rounded-[12px] border border-white/12 bg-white/[0.03] p-6 sm:p-8">
            <h2 className="text-[20px] font-medium">{l.notTitle}</h2>
            <ul className="mt-5 space-y-4">
              {l.not.map((x) => (
                <li key={x} className="flex gap-3 text-[15.5px] leading-relaxed text-white/85">
                  <span className="mt-0.5 shrink-0 text-[var(--l-accent)]">
                    <Icon name="close" size={18} />
                  </span>
                  {x}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Zachęta */}
      <section className="l-night relative overflow-hidden border-t border-white/10" aria-labelledby="cta">
        <div aria-hidden className="l-glow pointer-events-none absolute inset-0 rotate-180 opacity-80" />
        <div className="relative mx-auto flex max-w-[1152px] flex-col items-start gap-6 px-4 py-16 sm:px-6 md:flex-row md:items-center md:justify-between md:py-20">
          <h2 id="cta" className="max-w-[22ch] text-[28px] font-normal leading-tight tracking-[-0.03em] md:text-[36px]">
            {l.ctaTitle}
          </h2>
          <div className="flex flex-col gap-3 min-[480px]:flex-row">
            <a href={hrefOf({ name: 'new-project' })} className="l-btn l-btn-primary">
              {h.ctaPrimary}
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
