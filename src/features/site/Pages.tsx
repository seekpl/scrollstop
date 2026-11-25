import { useT } from '../../i18n';
import { btnClass } from '../../ui/kit';
import { SiteShell } from './SiteShell';

export function NotFound() {
  const t = useT();
  return (
    <SiteShell>
      <div className="mx-auto max-w-[1152px] px-4 py-20 sm:px-6">
        <h1 className="text-[34px] font-semibold tracking-[-0.02em] text-ink">{t.site.notFound.title}</h1>
        <p className="mt-3 text-[16px] text-muted">{t.site.notFound.body}</p>
        <a href="#/" className={btnClass('primary', 'md', 'mt-6')}>
          {t.site.notFound.home}
        </a>
      </div>
    </SiteShell>
  );
}

/** Widok, który powstaje w kolejnym kamieniu milowym (§0: funkcja planowana nie udaje gotowej). */
export function SoonPage() {
  const t = useT();
  return (
    <SiteShell>
      <div className="mx-auto max-w-[1152px] px-4 py-20 sm:px-6">
        <h1 className="text-[34px] font-semibold tracking-[-0.02em] text-ink">{t.site.soonPage.title}</h1>
        <p className="mt-3 text-[16px] text-muted">{t.site.soonPage.body}</p>
        <a href="#/" className={btnClass('secondary', 'md', 'mt-6')}>
          {t.common.actions.home}
        </a>
      </div>
    </SiteShell>
  );
}
