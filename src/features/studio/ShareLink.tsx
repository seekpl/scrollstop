import { useEffect, useState } from 'react';
import { absoluteUrl } from '../../app/router';
import { useResearch } from '../../app/research';
import { errorCode } from '../../core/errors';
import { useI18n } from '../../i18n';
import { formatDate } from '../../i18n/format';
import { SHARE_DAYS, type ShareLinkInfo, type ShareLinkStatus } from '../../api/types';
import type { Project } from '../../research/model';
import { planFor } from '../../research/plans';
import { Btn, CopyField, Segmented, Surface } from '../../ui/kit';

type Days = (typeof SHARE_DAYS)[number];

/**
 * Link do raportu dla klienta (§13.2): tylko do odczytu, wygasa po 7/30/90 dniach, w bazie skrót.
 * Pełny adres widać tylko raz, zaraz po utworzeniu.
 */
export function ShareLinkPanel({ project }: { project: Project }) {
  const { t, locale } = useI18n();
  const s = t.studio.share;
  const { api, account, can } = useResearch();
  const [status, setStatus] = useState<ShareLinkStatus | null>(null);
  const [created, setCreated] = useState<ShareLinkInfo | null>(null);
  const [days, setDays] = useState<Days>(30);
  const [error, setError] = useState<string | null>(null);
  const canEdit = account?.role !== 'viewer';
  useEffect(() => {
    if (api.mode !== 'server' || !can.shareLink) return;
    api.shareLinkStatus(project.id).then(setStatus, () => setStatus(null));
  }, [api, project.id, can.shareLink]);
  if (api.mode !== 'server') return null;
  if (!can.shareLink) return <p className="text-[12.5px] text-muted">{s.locked(t.billing.planNames[planFor('shareLink')])}</p>;
  const run = async (fn: () => Promise<void>) => {
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError((t.errors as Record<string, string>)[errorCode(e)] ?? t.errors.unknown);
    }
  };
  return (
    <Surface className="no-print">
      <h3 className="text-[16px] font-semibold text-ink">{s.title}</h3>
      <p className="mt-1 max-w-[70ch] text-[13.5px] text-muted">{s.body}</p>
      {created ? (
        <div className="mt-4 space-y-2">
          <CopyField label={s.link} value={absoluteUrl({ name: 'shared-report', token: created.token })} />
          <p className="text-[13px] text-muted">{s.once(formatDate(created.expiresAt, locale))}</p>
        </div>
      ) : status?.active && status.expiresAt ? (
        <p className="mt-3 text-[14px] text-ink">{s.active(formatDate(status.expiresAt, locale))}</p>
      ) : null}
      {canEdit && (
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <div>
            <div className="mb-2 text-[13.5px] font-semibold">{s.validity}</div>
            <Segmented<`${Days}`> label={s.validity} value={`${days}`} onChange={(v) => setDays(Number(v) as Days)} options={SHARE_DAYS.map((d) => ({ value: `${d}` as `${Days}`, label: t.common.days(d) }))} />
          </div>
          <Btn
            variant="primary"
            onClick={() =>
              void run(async () => {
                const link = await api.createShareLink(project.id, days);
                setCreated(link);
                setStatus({ active: true, expiresAt: link.expiresAt });
              })
            }
          >
            {status?.active ? s.renew : s.create}
          </Btn>
          {status?.active && (
            <Btn
              variant="quiet"
              onClick={() =>
                void run(async () => {
                  await api.revokeShareLink(project.id);
                  setCreated(null);
                  setStatus({ active: false, expiresAt: null });
                })
              }
            >
              {s.revoke}
            </Btn>
          )}
        </div>
      )}
      {error && <p className="mt-3 text-[13.5px] font-semibold text-poor">{error}</p>}
    </Surface>
  );
}
