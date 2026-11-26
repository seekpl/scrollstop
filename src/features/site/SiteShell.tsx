import { useEffect, useState, type ReactNode } from 'react';
import { hrefOf, useRoute, type Route } from '../../app/router';
import { COMPANY, salesEmail } from '../../config/company';
import { useT } from '../../i18n';
import { BrandMark } from '../../ui/BrandMark';
import { btnClass, Icon, LanguageSelect } from '../../ui/kit';

export interface NavItem {
  href: string;
  label: string;
  /** Trasy, na których pozycja menu jest bieżąca (`aria-current`). */
  match?: ReadonlyArray<Route['name']>;
}

const STUDIO_ROUTES: ReadonlyArray<Route['name']> = ['projects', 'new-project', 'project', 'account', 'workspace'];

/**
 * Wspólna powłoka serwisu (§19.5) — strona publiczna, studio, raport z linku, usuwanie danych:
 * znak + nazwa, menu (przycisk 44×44 px), przycisk główny, stopka z właścicielem serwisu.
 * Przełącznik języka w nagłówku od 640 px, na telefonie w menu. Poniżej 370 px przycisk główny
 * tylko w menu (lekcja §24.8). Kontener 1152 px, marginesy 16 px (telefon) / 24 px.
 */
export function SiteShell({
  children,
  nav: navProp,
  cta: ctaProp,
  variant = 'night',
  seo,
}: {
  children: ReactNode;
  nav?: NavItem[];
  cta?: NavItem | null;
  /** „night” — wygląd serwisu (granat z logo); „paper” — jasna powłoka bez granatowego nagłówka. */
  variant?: 'paper' | 'night';
  /** Tytuł karty i opis strony (te same teksty trafiają do plików HTML dla wyszukiwarek). */
  seo?: { title: string; description?: string };
}) {
  const night = variant === 'night';
  const t = useT();
  const route = useRoute();
  const nav = navProp ?? [
    { href: hrefOf({ name: 'sample', sample: 'reel' }), label: t.site.nav.sample, match: ['sample'] },
    { href: hrefOf({ name: 'pricing' }), label: t.site.nav.pricing, match: ['pricing'] },
    { href: hrefOf({ name: 'privacy' }), label: t.site.nav.privacy, match: ['privacy'] },
    { href: hrefOf({ name: 'projects' }), label: t.site.nav.studio, match: STUDIO_ROUTES },
  ];
  const isCurrent = (n: NavItem) => (n.match?.includes(route.name) ? ('page' as const) : undefined);
  const cta = ctaProp === undefined ? { href: hrefOf({ name: 'new-project' }), label: t.site.nav.startFree } : ctaProp;
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const close = () => setOpen(false);
    window.addEventListener('hashchange', close);
    return () => window.removeEventListener('hashchange', close);
  }, []);
  const title = seo?.title ?? t.site.seo.other.title;
  const description = seo?.description;
  useEffect(() => {
    document.title = title;
    if (description) document.querySelector('meta[name="description"]')?.setAttribute('content', description);
  }, [title, description]);
  return (
    <div className={`flex min-h-dvh-safe flex-col ${night ? 'site-theme bg-[var(--l-night)]' : 'bg-paper'}`}>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[90] focus:rounded-lg focus:bg-surface focus:px-3 focus:py-2 focus:ring-2 focus:ring-cobalt">
        {t.ui.skipToContent}
      </a>
      <header className={`no-print sticky top-0 z-40 border-b backdrop-blur ${night ? 'l-night border-white/10 !bg-[var(--l-night)]/80' : 'border-line bg-paper/95'}`}>
        <div className="mx-auto flex h-16 max-w-[1152px] items-center justify-between gap-3 px-4 sm:px-6">
          <a href={hrefOf({ name: 'landing' })} className="min-w-0 rounded-lg" aria-label={t.site.nav.home}>
            <BrandMark tone={night ? 'night' : 'light'} />
          </a>
          {night ? (
            <nav aria-label={t.site.nav.mainNav} className="hidden items-stretch overflow-hidden rounded-[10px] border border-white/15 bg-white/[0.03] lg:flex">
              {nav.map((n, i) => (
                <a key={n.href} href={n.href} aria-current={isCurrent(n)} className={`inline-flex min-h-10 items-center px-4 text-[14px] font-medium hover:bg-white/[0.07] hover:text-white aria-[current=page]:bg-white/[0.1] aria-[current=page]:text-white aria-[current=page]:shadow-[inset_0_-2px_0_var(--l-accent)] ${i ? 'border-l border-white/15' : ''} ${isCurrent(n) ? '' : 'text-white/85'}`}>
                  {n.label}
                </a>
              ))}
            </nav>
          ) : (
            <nav aria-label={t.site.nav.mainNav} className="hidden items-center gap-1 lg:flex">
              {nav.map((n) => (
                <a key={n.href} href={n.href} aria-current={isCurrent(n)} className="rounded-lg px-3 py-2 text-[14.5px] font-semibold text-ink hover:bg-ink/[0.06] aria-[current=page]:bg-ink/[0.06]">
                  {n.label}
                </a>
              ))}
            </nav>
          )}
          <div className="flex shrink-0 items-center gap-2">
            <LanguageSelect className="hidden sm:inline-flex" tone={night ? 'night' : 'light'} />
            {cta && (
              // Otoczka steruje widocznością: `hidden` obok `inline-flex` z btnClass przegrywa w kolejności CSS.
              <span className="hidden min-[370px]:inline-flex">
                <a href={cta.href} className={night ? 'l-btn l-btn-primary !min-h-10 !px-4 !text-[14px]' : btnClass('primary', 'md')}>
                  {cta.label}
                </a>
              </span>
            )}
            <button
              type="button"
              className={`grid h-11 w-11 place-items-center rounded-[10px] ring-1 ring-inset lg:hidden ${night ? 'text-white ring-white/25 hover:bg-white/[0.07]' : 'text-ink ring-field/70 hover:bg-ink/[0.05]'}`}
              aria-expanded={open}
              aria-controls="site-menu"
              aria-label={open ? t.ui.closeMenu : t.ui.openMenu}
              onClick={() => setOpen((o) => !o)}
            >
              <Icon name={open ? 'close' : 'menu'} size={20} />
            </button>
          </div>
        </div>
        {open && (
          <div id="site-menu" className={`border-t lg:hidden ${night ? 'border-white/10' : 'border-line bg-paper'}`}>
            <nav aria-label={t.site.nav.menu} className="mx-auto flex max-w-[1152px] flex-col gap-1 px-4 py-3 sm:px-6">
              {nav.map((n) => (
                <a key={n.href} href={n.href} aria-current={isCurrent(n)} className={`flex min-h-11 items-center rounded-lg px-3 text-[15px] font-semibold ${night ? 'text-white hover:bg-white/[0.07] aria-[current=page]:bg-white/[0.1]' : 'text-ink hover:bg-ink/[0.06] aria-[current=page]:bg-ink/[0.06]'}`}>
                  {n.label}
                </a>
              ))}
              {cta && (
                <a href={cta.href} className={night ? 'l-btn l-btn-primary mt-1 min-[370px]:!hidden' : btnClass('primary', 'md', 'mt-1 min-[370px]:hidden')}>
                  {cta.label}
                </a>
              )}
              <div className="mt-2 sm:hidden">
                <LanguageSelect tone={night ? 'night' : 'light'} />
              </div>
            </nav>
          </div>
        )}
      </header>
      <main id="main" className={night ? 'flex flex-1 flex-col [&>section:last-child]:flex-1' : 'flex-1'}>
        {children}
      </main>
      <SiteFooter night={night} />
    </div>
  );
}

export function SiteFooter({ night = false }: { night?: boolean }) {
  const t = useT();
  const email = salesEmail();
  return (
    <footer className={`no-print border-t ${night ? 'l-night border-white/10' : 'border-line bg-paper'}`}>
      <div className={`mx-auto flex max-w-[1152px] flex-col gap-3 px-4 py-8 text-[13px] leading-relaxed sm:px-6 ${night ? 'text-white/65' : 'text-muted'}`}>
        <p>{t.site.footer.note}</p>
        {COMPANY.name && COMPANY.address && COMPANY.nip && <p>{t.site.footer.operator(COMPANY.name, COMPANY.address, COMPANY.nip)}</p>}
        <div className="flex flex-wrap items-center gap-x-4">
          <a href={`mailto:${email}`} className={`inline-flex min-h-9 items-center font-semibold underline underline-offset-4 ${night ? 'text-white decoration-white/40 hover:decoration-white' : 'text-ink decoration-field hover:decoration-ink'}`}>
            {t.site.footer.contact}: {email}
          </a>
          <a href={hrefOf({ name: 'privacy' })} className={`inline-flex min-h-9 items-center font-semibold underline underline-offset-4 ${night ? 'text-white decoration-white/40 hover:decoration-white' : 'text-ink decoration-field hover:decoration-ink'}`}>
            {t.site.nav.privacy}
          </a>
          <a href={hrefOf({ name: 'terms' })} className={`inline-flex min-h-9 items-center font-semibold underline underline-offset-4 ${night ? 'text-white decoration-white/40 hover:decoration-white' : 'text-ink decoration-field hover:decoration-ink'}`}>
            {t.site.nav.terms}
          </a>
          <span>{t.site.footer.rights(new Date().getFullYear())}</span>
        </div>
      </div>
    </footer>
  );
}
