import type { ReactNode } from 'react';
import { pathOf } from '../../app/router';
import { COMPANY, salesEmail } from '../../config/company';
import { useT } from '../../i18n';
import { SiteShell } from './SiteShell';

function Block({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="border-t border-line pt-8">
      <h2 id={id} className="text-[22px] font-semibold tracking-[-0.01em] text-ink">
        {title}
      </h2>
      <div className="mt-3 space-y-3 text-[15.5px] leading-relaxed text-ink">{children}</div>
    </section>
  );
}

/** Prywatność i zasady etyczne (§17.8): obraz z kamery, co zapisujemy, dostęp i retencja, prawa widza, operator. */
export function PrivacyPage() {
  const t = useT();
  const p = t.site.privacy;
  const email = salesEmail();
  return (
    <SiteShell>
      <article className="mx-auto max-w-[760px] px-4 py-10 sm:px-6 md:py-16">
        <h1 className="text-[34px] font-semibold leading-tight tracking-[-0.03em] text-ink md:text-[42px]">{p.title}</h1>
        <p className="mt-4 text-[17px] leading-relaxed text-ink">{p.lead}</p>
        <p className="mt-2 text-[13.5px] text-muted">{p.draft}</p>
        <div className="mt-10 space-y-10">
          <Block id="camera" title={p.cameraTitle}>
            <p>{p.camera}</p>
          </Block>
          <Block id="saved" title={p.savedTitle}>
            <dl className="space-y-3">
              {p.saved.map((s) => (
                <div key={s.term}>
                  <dt className="font-semibold">{s.term}</dt>
                  <dd className="text-muted">{s.def}</dd>
                </div>
              ))}
            </dl>
            <h3 className="pt-3 text-[17px] font-semibold">{p.notSavedTitle}</h3>
            <ul className="list-disc space-y-1 pl-5 text-muted">
              {p.notSaved.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          </Block>
          <Block id="access" title={p.accessTitle}>
            {p.access.map((x) => (
              <p key={x}>{x}</p>
            ))}
          </Block>
          <Block id="rights" title={p.rightsTitle}>
            <ul className="list-disc space-y-1.5 pl-5">
              {p.rights.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
            <a href={pathOf({ name: 'delete-session', id: null })} className="inline-flex min-h-10 items-center font-semibold text-cobalt underline underline-offset-4">
              {p.deleteLink}
            </a>
          </Block>
          <Block id="cookies" title={p.cookiesTitle}>
            <p>{p.cookies}</p>
          </Block>
          <Block id="ai" title={p.aiTitle}>
            <p>{p.ai}</p>
          </Block>
          <Block id="ethics" title={p.ethicsTitle}>
            <p>{p.ethicsLead}</p>
            <ul className="list-disc space-y-1 pl-5">
              {p.ethics.map((x) => (
                <li key={x}>{x}</li>
              ))}
            </ul>
          </Block>
          <Block id="content" title={p.contentTitle}>
            <p>{p.content}</p>
          </Block>
          <Block id="contact" title={p.contactTitle}>
            {COMPANY.name && COMPANY.address && COMPANY.nip && <p>{p.operator(COMPANY.name, COMPANY.address, COMPANY.nip)}</p>}
            <p>
              {p.contact}{' '}
              <a href={`mailto:${email}`} className="font-semibold text-cobalt underline underline-offset-4">
                {email}
              </a>
              .
            </p>
          </Block>
        </div>
      </article>
    </SiteShell>
  );
}
