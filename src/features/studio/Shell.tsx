import { useEffect, type ReactNode } from 'react';
import { pathOf } from '../../app/router';
import { useResearch } from '../../app/research';
import { BRAND } from '../../config/brand';
import { useT } from '../../i18n';
import { BrandMark } from '../../ui/BrandMark';
import { Btn, LanguageSelect } from '../../ui/kit';

/**
 * Powłoka studia (§9): znak marki (na ekranach < 400 px bez nazwy), okruszki, przełącznik języka,
 * plan z kropką statusu, wylogowanie (tryb serwerowy) i pasek informacyjny trybu lokalnego.
 */
export function StudioShell({ children, crumbs = [], title }: { children: ReactNode; crumbs?: Array<{ href?: string; label: string }>; title?: string }) {
  const t = useT();
  const s = t.studio.shell;
  const { api, account } = useResearch();
  useEffect(() => {
    document.title = `${title ?? s.projects} — ${BRAND.name}`;
  }, [title, s.projects]);
  const plan = account?.plan ?? 'free';
  const statusDot = account?.planStatus === 'past_due' ? 'bg-poor' : plan === 'free' ? 'bg-field' : 'bg-good';
  return (
    <div className="min-h-dvh-safe bg-paper">
      <a href="#studio-main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[90] focus:rounded-lg focus:bg-surface focus:px-3 focus:py-2 focus:ring-2 focus:ring-cobalt">
        {t.ui.skipToContent}
      </a>
      <header className="border-b border-line bg-paper">
        <div className="mx-auto flex min-h-16 max-w-[1152px] flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2 sm:px-6">
          <a href="#/" className="shrink-0 rounded-lg" aria-label={t.site.nav.home}>
            <BrandMark hideNameBelow400 />
          </a>
          <nav aria-label={s.breadcrumbs} className="order-last w-full min-w-0 text-[14px] sm:order-none sm:w-auto sm:flex-1">
            <ol className="flex min-w-0 items-center gap-1.5 text-muted">
              <li className="shrink-0">
                <a href={pathOf({ name: 'projects' })} className="rounded font-semibold text-ink hover:underline">
                  {s.projects}
                </a>
              </li>
              {crumbs.map((c) => (
                <li key={c.label} className="flex min-w-0 items-center gap-1.5">
                  <span aria-hidden>/</span>
                  {c.href ? (
                    <a href={c.href} className="truncate font-semibold text-ink hover:underline">
                      {c.label}
                    </a>
                  ) : (
                    <span className="truncate" aria-current="page">
                      {c.label}
                    </span>
                  )}
                </li>
              ))}
            </ol>
          </nav>
          <div className="ml-auto flex shrink-0 items-center gap-2">
            <LanguageSelect className="hidden sm:inline-flex" />
            <a href={pathOf({ name: 'account' })} className="inline-flex min-h-9 items-center gap-2 rounded-[10px] px-2.5 text-[13.5px] font-semibold text-ink ring-1 ring-inset ring-field/70 hover:bg-ink/[0.04]">
              <span className={`h-2 w-2 rounded-full ${statusDot}`} aria-hidden />
              {s.plan(t.billing.planNames[plan])}
            </a>
            {api.mode === 'server' && account && (
              <Btn
                size="sm"
                variant="quiet"
                onClick={async () => {
                  await api.logout();
                  window.location.hash = '#/login';
                }}
              >
                {s.logout}
              </Btn>
            )}
          </div>
        </div>
      </header>
      {api.mode === 'local' && (
        <div className="border-b border-cobalt/15 bg-cobalt/[0.05]">
          <p className="mx-auto max-w-[1152px] px-4 py-2.5 text-[13.5px] leading-relaxed text-ink sm:px-6">{s.localBanner}</p>
        </div>
      )}
      <main id="studio-main" className="mx-auto max-w-[1152px] px-4 pb-20 pt-8 sm:px-6">
        {children}
      </main>
      <div className="mx-auto max-w-[1152px] px-4 pb-8 sm:hidden">
        <LanguageSelect />
      </div>
    </div>
  );
}
