import type { ReactNode } from 'react';
import { hrefOf, pathOf } from '../../app/router';
import { useResearch } from '../../app/research';
import { BRAND } from '../../config/brand';
import { useT } from '../../i18n';
import { PageIntro } from '../site/PageIntro';
import { SiteShell } from '../site/SiteShell';

/**
 * Powłoka studia (§9) w układzie całego serwisu: ten sam granatowy nagłówek z menu i stopka co na
 * stronie publicznej, granatowy pas z okruszkami, planem i tytułem, treść na jasnym tle.
 * W druku i PDF widać tylko tytuł i treść (nagłówek, okruszki i kroki są ukryte).
 */
export function StudioShell({
  children,
  crumbs = [],
  title,
  lead,
  actions,
  below,
  printHeader,
}: {
  children: ReactNode;
  crumbs?: Array<{ href?: string; label: string }>;
  title?: string;
  lead?: ReactNode;
  /** Przyciski obok tytułu. */
  actions?: ReactNode;
  /** Treść pod tytułem w pasie (np. kroki projektu). */
  below?: ReactNode;
  /** Nagłówek wydruku (marka i data) — tylko w druku, nad tytułem. */
  printHeader?: ReactNode;
}) {
  const t = useT();
  const s = t.studio.shell;
  const { api, account } = useResearch();
  const plan = account?.workspacePlan ?? 'free';
  const statusDot = account?.planStatus === 'past_due' ? 'bg-[#ff8a8a]' : plan === 'free' ? 'bg-white/40' : 'bg-[#7ee2b0]';
  const chip = 'inline-flex min-h-9 items-center gap-2 rounded-[10px] px-2.5 text-[13.5px] font-semibold text-white/90 ring-1 ring-inset ring-white/20 hover:bg-white/[0.07] hover:text-white';
  return (
    <SiteShell seo={{ title: `${title ?? s.projects} — ${BRAND.name}` }} cta={{ href: hrefOf({ name: 'new-project' }), label: t.studio.projects.new }}>
      <PageIntro
        compact
        title={title}
        lead={lead}
        actions={actions}
        top={
          <>
            {printHeader && <div className="print-only mb-4">{printHeader}</div>}
            <div className="no-print flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
              <nav aria-label={s.breadcrumbs} className="min-w-0 text-[14px]">
                <ol className="flex min-w-0 flex-wrap items-center gap-1.5 text-white/65">
                  <li className="shrink-0">
                    <a href={pathOf({ name: 'projects' })} aria-current={crumbs.length ? undefined : 'page'} className="rounded font-semibold text-white/90 underline-offset-4 hover:text-white hover:underline">
                      {s.projects}
                    </a>
                  </li>
                  {crumbs.map((c) => (
                    <li key={c.label} className="flex min-w-0 items-center gap-1.5">
                      <span aria-hidden>/</span>
                      {c.href ? (
                        <a href={c.href} className="truncate font-semibold text-white/90 underline-offset-4 hover:text-white hover:underline">
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
              <div className="flex flex-wrap items-center gap-2">
                {api.mode === 'server' && account && (
                  <a href={pathOf({ name: 'workspace' })} className={chip}>
                    {t.studio.workspace.title}
                  </a>
                )}
                <a href={pathOf({ name: 'account' })} className={chip}>
                  <span className={`h-2 w-2 rounded-full ${statusDot}`} aria-hidden />
                  {s.plan(t.billing.planNames[plan])}
                </a>
                {api.mode === 'server' && account && (
                  <button
                    type="button"
                    className={chip}
                    onClick={async () => {
                      await api.logout();
                      window.location.hash = '#/login';
                    }}
                  >
                    {s.logout}
                  </button>
                )}
              </div>
            </div>
          </>
        }
      >
        {below && <div className="no-print mt-6">{below}</div>}
      </PageIntro>
      <section className="l-light">
        <div id="studio-main" className="mx-auto max-w-[1152px] px-4 pb-20 pt-8 sm:px-6">
          {api.mode === 'local' && <p className="no-print mb-8 max-w-[96ch] border-l-2 border-cobalt/40 pl-3 text-[13.5px] leading-relaxed text-muted">{s.localBanner}</p>}
          {children}
        </div>
      </section>
    </SiteShell>
  );
}
