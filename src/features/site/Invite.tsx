import { useEffect, useState } from 'react';
import { hrefOf, navigate, pathOf } from '../../app/router';
import { useResearch } from '../../app/research';
import { errorCode } from '../../core/errors';
import { useI18n } from '../../i18n';
import type { InvitePreview } from '../../api/types';
import { Callout } from '../../ui/kit';
import { BRAND } from '../../config/brand';
import { PageIntro } from './PageIntro';
import { SiteShell } from './SiteShell';

/** Zaproszenie do zespołu (§9.6): podgląd zespołu i roli, dołączenie po zalogowaniu. */
export function InvitePage({ token }: { token: string }) {
  const { t } = useI18n();
  const v = t.site.invite;
  const { api, account, refreshAccount } = useResearch();
  const [info, setInfo] = useState<InvitePreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const msg = (e: unknown) => (t.errors as Record<string, string>)[errorCode(e)] ?? t.errors.unknown;
  useEffect(() => {
    if (api.mode !== 'server') return;
    api.inviteInfo(token).then(setInfo, (e) => setError(msg(e)));
  }, [api, token]);
  const here = pathOf({ name: 'invite', token });
  const accept = async () => {
    setBusy(true);
    try {
      await api.acceptInvite(token);
      await refreshAccount();
      navigate(pathOf({ name: 'projects' }));
    } catch (e) {
      setError(msg(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <SiteShell seo={{ title: `${v.title} — ${BRAND.name}` }}>
      <PageIntro title={v.title} narrow />
      <section className="l-sage">
      <div className="mx-auto max-w-[808px] px-4 py-10 sm:px-6 md:py-14">
      <div className="max-w-[520px] rounded-[14px] border border-[var(--l-sage-line)] bg-[var(--l-sage-2)] p-6 sm:p-8 [&_.text-muted]:text-[var(--l-moss)]">
        {api.mode !== 'server' ? (
          <p className="mt-3 text-[15px] text-muted">{t.errors.local_mode}</p>
        ) : error ? (
          <div className="mt-5">
            <Callout tone="warn">{error}</Callout>
          </div>
        ) : info ? (
          <div className="mt-4 space-y-5">
            <p className="text-[16px] leading-relaxed text-ink">{v.body(info.workspaceName, t.studio.workspace.roles[info.role])}</p>
            <p className="text-[13.5px] text-muted">{v.roleHint[info.role]}</p>
            {account ? (
              <button type="button" className="l-btn l-btn-mint disabled:opacity-60" onClick={() => void accept()} disabled={busy}>
                {v.join}
              </button>
            ) : account === null ? (
              <div className="flex flex-col gap-2 min-[420px]:flex-row">
                <a href={`${hrefOf({ name: 'login' })}?next=${encodeURIComponent(here)}`} className="l-btn l-btn-mint">
                  {v.login}
                </a>
                <a href={`${hrefOf({ name: 'register' })}?next=${encodeURIComponent(here)}`} className="l-btn l-btn-pine">
                  {v.register}
                </a>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
      </div>
      </section>
    </SiteShell>
  );
}
