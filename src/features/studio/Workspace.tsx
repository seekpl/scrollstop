import { useCallback, useEffect, useState } from 'react';
import { absoluteUrl } from '../../app/router';
import { useResearch } from '../../app/research';
import { errorCode } from '../../core/errors';
import { useI18n } from '../../i18n';
import { formatDate } from '../../i18n/format';
import type { InviteInfo, MemberInfo, Role, WorkspaceInfo } from '../../api/types';
import { PLANS } from '../../research/plans';
import { Badge, Btn, Callout, CopyField, Field, inputClass, Section, Segmented } from '../../ui/kit';
import { StudioShell } from './Shell';

type InviteRole = Exclude<Role, 'owner'>;

/** Zespół (§9.6): zespoły konta, członkowie z rolami, zaproszenia linkiem (7 dni), limit miejsc planu. */
export function WorkspacePage() {
  const { t, locale } = useI18n();
  const w = t.studio.workspace;
  const { api, account, refreshAccount } = useResearch();
  const [list, setList] = useState<WorkspaceInfo[]>([]);
  const [members, setMembers] = useState<MemberInfo[]>([]);
  const [invite, setInvite] = useState<InviteInfo | null>(null);
  const [role, setRole] = useState<InviteRole>('editor');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const server = api.mode === 'server';
  const current = list.find((x) => x.id === account?.workspaceId) ?? null;
  const owner = current?.role === 'owner';
  const msg = (e: unknown) => (t.errors as Record<string, string>)[errorCode(e)] ?? t.errors.unknown;

  const load = useCallback(async () => {
    if (!server || !account) return;
    try {
      const ws = await api.workspaces();
      setList(ws);
      setMembers(await api.members(account.workspaceId));
      setName(ws.find((x) => x.id === account.workspaceId)?.name ?? '');
    } catch (e) {
      setError(msg(e));
    }
  }, [api, account, server]);
  useEffect(() => {
    void load();
  }, [load]);

  const act = async (fn: () => Promise<unknown>) => {
    setError(null);
    try {
      await fn();
      await refreshAccount();
      await load();
    } catch (e) {
      setError(msg(e));
    }
  };

  if (!server)
    return (
      <StudioShell crumbs={[{ label: w.title }]} title={w.title} lead={w.serverOnly}>
        {null}
      </StudioShell>
    );
  const seats = current ? PLANS[current.plan].limits.seats : 1;
  return (
    <StudioShell crumbs={[{ label: w.title }]} title={w.title} lead={w.lead}>
      <div className="space-y-10">
        {error && <Callout tone="warn">{error}</Callout>}

        {list.length > 1 && (
          <Section title={w.switchTitle}>
            <ul className="space-y-2">
              {list.map((x) => (
                <li key={x.id} className="flex flex-wrap items-center gap-3 rounded-xl bg-surface p-3 ring-1 ring-line">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold text-ink">{x.name}</span>
                    <span className="text-[13px] text-muted">{w.meta(w.roles[x.role], t.billing.planNames[x.plan], x.members)}</span>
                  </span>
                  {x.id === account?.workspaceId ? <Badge tone="good">{w.current}</Badge> : <Btn size="sm" onClick={() => void act(() => api.switchWorkspace(x.id))}>{w.switch}</Btn>}
                </li>
              ))}
            </ul>
          </Section>
        )}

        {current && (
          <Section title={w.membersTitle} aside={w.seats(members.length, seats)}>
            <ul className="divide-y divide-line rounded-2xl bg-surface ring-1 ring-line">
              {members.map((m) => (
                <li key={m.accountId} className="flex flex-wrap items-center gap-3 p-4">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold text-ink">{m.name || m.email}</span>
                    <span className="block truncate text-[13px] text-muted">{m.email}</span>
                  </span>
                  {owner && m.role !== 'owner' ? (
                    <Segmented<InviteRole> label={w.roleLabel(m.email)} value={m.role === 'viewer' ? 'viewer' : 'editor'} onChange={(r) => void act(() => api.setMemberRole(current.id, m.accountId, r))} options={(['editor', 'viewer'] as const).map((r) => ({ value: r, label: w.roles[r] }))} />
                  ) : (
                    <Badge tone={m.role === 'owner' ? 'info' : 'neutral'}>{w.roles[m.role]}</Badge>
                  )}
                  {m.role !== 'owner' && (owner || m.accountId === account?.id) && (
                    <Btn size="sm" variant="quiet" onClick={() => void act(() => api.removeMember(current.id, m.accountId))}>
                      {m.accountId === account?.id ? w.leave : w.remove}
                    </Btn>
                  )}
                </li>
              ))}
            </ul>
          </Section>
        )}

        {current && owner && (
          <Section title={w.inviteTitle}>
            <div className="max-w-2xl space-y-4">
              <p className="text-[14px] text-muted">{w.inviteBody}</p>
              <div className="flex flex-wrap items-end gap-3">
                <div>
                  <div className="mb-2 text-[13.5px] font-semibold">{w.inviteRole}</div>
                  <Segmented<InviteRole> label={w.inviteRole} value={role} onChange={setRole} options={(['editor', 'viewer'] as const).map((r) => ({ value: r, label: w.roles[r] }))} />
                </div>
                <Btn variant="primary" disabled={members.length >= seats} onClick={() => void act(async () => setInvite(await api.createInvite(current.id, role)))}>
                  {w.createInvite}
                </Btn>
              </div>
              {members.length >= seats && <p className="text-[13.5px] text-muted">{t.errors.seats}</p>}
              {invite && (
                <div className="space-y-2">
                  <CopyField label={w.inviteLink(w.roles[invite.role])} value={absoluteUrl({ name: 'invite', token: invite.token })} />
                  <p className="text-[13px] text-muted">{w.inviteNote(formatDate(invite.expiresAt, locale))}</p>
                </div>
              )}
            </div>
          </Section>
        )}

        {current && owner && (
          <Section title={w.nameTitle}>
            <div className="flex max-w-xl flex-wrap items-end gap-3">
              <div className="min-w-0 flex-1">
                <Field label={w.name}>{(id) => <input id={id} className={inputClass} value={name} maxLength={120} onChange={(e) => setName(e.target.value)} />}</Field>
              </div>
              <Btn onClick={() => void act(() => api.renameWorkspace(current.id, name))} disabled={!name.trim() || name === current.name}>
                {t.common.actions.save}
              </Btn>
            </div>
          </Section>
        )}
      </div>
    </StudioShell>
  );
}
