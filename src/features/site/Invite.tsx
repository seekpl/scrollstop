import { useEffect, useState } from 'react';
import { navigate, pathOf } from '../../app/router';
import { useResearch } from '../../app/research';
import { errorCode } from '../../core/errors';
import { useI18n } from '../../i18n';
import type { InvitePreview } from '../../api/types';
import { btnClass, Btn, Callout } from '../../ui/kit';
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
    <SiteShell>
      <div className="mx-auto max-w-[520px] px-4 py-12 sm:px-6 md:py-16">
        <h1 className="text-[30px] font-semibold tracking-[-0.03em] text-ink">{v.title}</h1>
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
              <Btn variant="primary" size="lg" onClick={() => void accept()} disabled={busy}>
                {v.join}
              </Btn>
            ) : account === null ? (
              <div className="flex flex-col gap-2 min-[420px]:flex-row">
                <a href={`${pathOf({ name: 'login' })}?next=${encodeURIComponent(here)}`} className={btnClass('primary', 'md')}>
                  {v.login}
                </a>
                <a href={`${pathOf({ name: 'register' })}?next=${encodeURIComponent(here)}`} className={btnClass('secondary', 'md')}>
                  {v.register}
                </a>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </SiteShell>
  );
}
