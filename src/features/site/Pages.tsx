import { hrefOf } from '../../app/router';
import { useT } from '../../i18n';
import { PageIntro } from './PageIntro';
import { SiteShell } from './SiteShell';

export function NotFound() {
  const t = useT();
  return (
    <SiteShell>
      <PageIntro title={t.site.notFound.title} lead={t.site.notFound.body}>
        <a href={hrefOf({ name: 'landing' })} className="l-btn l-btn-primary mt-8">
          {t.site.notFound.home}
        </a>
      </PageIntro>
      <div className="h-24" />
    </SiteShell>
  );
}

/** Widok, który powstaje w kolejnym kamieniu milowym (§0: funkcja planowana nie udaje gotowej). */
export function SoonPage() {
  const t = useT();
  return (
    <SiteShell>
      <PageIntro title={t.site.soonPage.title} lead={t.site.soonPage.body}>
        <a href={hrefOf({ name: 'landing' })} className="l-btn l-btn-ghost mt-8">
          {t.common.actions.home}
        </a>
      </PageIntro>
      <div className="h-24" />
    </SiteShell>
  );
}
