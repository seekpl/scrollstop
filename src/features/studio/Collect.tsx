import { useEffect, useState } from 'react';
import { pathOf } from '../../app/router';
import { useResearch } from '../../app/research';
import { errorCode } from '../../core/errors';
import { useI18n } from '../../i18n';
import type { Usage } from '../../api/types';
import { decodePackage } from '../../research/compact';
import type { ViewerSession } from '../../research/model';
import { PLANS, sessionBlock } from '../../research/plans';
import { assessSession } from '../../research/sessions';
import { Badge, Btn, Callout, Dialog, Empty, Icon, Meter, Section } from '../../ui/kit';
import { variantLabel } from '../report/ReportView';
import { PaywallDialog } from './Paywall';
import type { ProjectCtx } from './ProjectPage';

/** Zbierz widzów (§9.4): postęp, liczniki, paywall po limicie, import plików sesji, tabela sesji. */
export function Collect({ project, sessions, reload }: ProjectCtx) {
  const { t, locale } = useI18n();
  const c = t.studio.collect;
  const { api, account } = useResearch();
  const [usage, setUsage] = useState<Usage | null>(null);
  const [imported, setImported] = useState<{ imported: number; skipped: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<ViewerSession | null>(null);
  const [paywall, setPaywall] = useState(false);
  useEffect(() => {
    void api.usage().then(setUsage);
  }, [api, sessions]);
  const real = sessions.filter((s) => s.source !== 'simulated');
  const valid = real.filter((s) => s.status === 'valid').length;
  const rejected = real.length - valid;
  const plan = account?.workspacePlan ?? 'free';
  const block = usage ? sessionBlock(plan, { projectSessions: real.length, monthSessions: usage.monthSessions }) : null;
  const byDevice = (d: ViewerSession['device']['type']) => real.filter((s) => s.device.type === d).length;
  const byQuality = (q: 'GOOD' | 'FAIR' | 'POOR') => real.filter((s) => s.calibration?.quality === q).length;
  const missing = Math.max(0, project.targetSessions - valid);
  const labels = Object.fromEntries(project.variants.map((v) => [v.id, variantLabel(v, t)]));

  const importFiles = async (files: FileList) => {
    setError(null);
    const parsed: unknown[] = [];
    let broken = 0;
    for (const f of [...files]) {
      try {
        parsed.push(decodePackage(await f.text()));
      } catch {
        broken++;
      }
    }
    try {
      const r = await api.importSessions(project.id, parsed);
      setImported({ imported: r.imported, skipped: r.skipped + broken });
      await reload();
    } catch (e) {
      setError((t.errors as Record<string, string>)[errorCode(e)] ?? t.errors.unknown);
    }
  };
  const restoreHint = (s: ViewerSession) => (s.status === 'rejected' && s.rejectCode !== 'manual' ? assessSession(s).status === 'rejected' : false);

  return (
    <div className="space-y-10">
      <Section title={c.progressTitle}>
        <div className="space-y-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="tabular text-[24px] font-semibold">{c.progress(valid, project.targetSessions)}</span>
            <span className="text-[14px] text-muted">{missing > 0 ? c.missing(missing) : c.done}</span>
          </div>
          <Meter value={valid} max={project.targetSessions} label={c.progress(valid, project.targetSessions)} />
          <dl className="grid grid-cols-2 gap-4 pt-2 text-[14px] sm:grid-cols-4">
            <div>
              <dt className="text-muted">{c.counters.all}</dt>
              <dd className="tabular text-[18px] font-semibold">{real.length}</dd>
            </div>
            <div>
              <dt className="text-muted">{c.counters.rejected}</dt>
              <dd className="tabular text-[18px] font-semibold">{rejected}</dd>
            </div>
            <div>
              <dt className="text-muted">{c.counters.devices}</dt>
              <dd className="text-[14px] font-semibold">{c.devices(byDevice('mobile'), byDevice('desktop'), byDevice('tablet'))}</dd>
            </div>
            <div>
              <dt className="text-muted">{c.counters.calibration}</dt>
              <dd className="text-[14px] font-semibold">{c.calibration(byQuality('GOOD'), byQuality('FAIR'), byQuality('POOR'))}</dd>
            </div>
          </dl>
        </div>
      </Section>

      {block && (
        <Callout
          tone="warn"
          title={block === 'project_sessions' ? c.paywall.firstCurve : c.paywall.monthLimit}
          action={
            <Btn variant="primary" size="sm" onClick={() => setPaywall(true)}>
              {c.paywall.options}
            </Btn>
          }
        >
          {block === 'month_sessions' ? c.paywall.monthBody(PLANS[plan].limits.monthSessions ?? 0) : c.paywall.firstBody}
        </Callout>
      )}

      {api.mode === 'local' && (
        <Section title={c.importTitle}>
          <p className="mb-3 max-w-[70ch] text-[14px] text-muted">{c.importBody}</p>
          <label className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-[10px] bg-surface px-4 text-[14px] font-semibold ring-1 ring-inset ring-field/70 hover:ring-ink/50">
            <Icon name="upload" size={17} />
            {c.importButton}
            <input type="file" accept=".json,application/json" multiple className="sr-only" onChange={(e) => e.target.files && void importFiles(e.target.files)} />
          </label>
          {imported && (
            <p className="mt-3 text-[14px]" role="status">
              {c.importResult(imported.imported, imported.skipped)}
            </p>
          )}
          {error && <p className="mt-3 text-[14px] font-semibold text-poor">{error}</p>}
        </Section>
      )}

      <Section title={c.tableTitle}>
        {sessions.length === 0 ? (
          <Empty title={c.emptyTitle}>
            {c.emptyBody}{' '}
            <a className="font-semibold text-cobalt underline" href={pathOf({ name: 'project', id: project.id, step: 'prepare' })}>
              {t.studio.project.steps.prepare}
            </a>
          </Empty>
        ) : (
          <>
            <ul className="space-y-3 md:hidden">
              {sessions.map((s) => (
                <li key={s.id} className="rounded-2xl bg-surface p-4 ring-1 ring-line">
                  <SessionSummary s={s} variant={labels[s.variantId]} />
                  <SessionActions s={s} onDelete={() => setConfirm(s)} onToggle={async () => (await api.setSessionStatus(project.id, s.id, s.status === 'valid' ? 'rejected' : 'valid'), reload())} willStayRejected={restoreHint(s)} />
                </li>
              ))}
            </ul>
            <div role="region" aria-label={c.tableTitle} tabIndex={0} className="hidden relative overflow-x-auto rounded-2xl bg-surface ring-1 ring-line md:block">
              <table className="w-full min-w-[760px] text-left text-[14px]">
                <caption className="sr-only">{c.tableTitle}</caption>
                <thead className="text-[12.5px] text-muted">
                  <tr className="border-b border-line">
                    {[c.cols.participant, c.cols.version, c.cols.device, c.cols.calibration, c.cols.data, c.cols.status, ''].map((h, i) => (
                      <th key={i} className="px-4 py-3 font-semibold">
                        {h || <span className="sr-only">{c.cols.actions}</span>}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sessions.map((s) => (
                    <tr key={s.id} className="border-b border-line align-top last:border-0">
                      <td className="px-4 py-3 font-mono text-[12.5px]">
                        {s.participantId}
                        {s.source === 'simulated' && (
                          <div className="mt-1">
                            <Badge>{t.common.simulated}</Badge>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">{labels[s.variantId]}</td>
                      <td className="px-4 py-3">{t.common.devices[s.device.type]}</td>
                      <td className="px-4 py-3">{s.calibration ? <QualityBadge s={s} /> : '–'}</td>
                      <td className="tabular px-4 py-3">{new Intl.NumberFormat(locale === 'pl' ? 'pl-PL' : 'en-US', { style: 'percent', maximumFractionDigits: 0 }).format(assessSession(s).determinateShare)}</td>
                      <td className="px-4 py-3">
                        <Status s={s} />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <SessionActions s={s} onDelete={() => setConfirm(s)} onToggle={async () => (await api.setSessionStatus(project.id, s.id, s.status === 'valid' ? 'rejected' : 'valid'), reload())} willStayRejected={restoreHint(s)} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Section>
      <Dialog open={confirm !== null} onClose={() => setConfirm(null)} title={c.deleteTitle}>
        <p className="text-[15px]">{c.deleteBody}</p>
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <Btn onClick={() => setConfirm(null)}>{t.common.actions.cancel}</Btn>
          <Btn
            variant="danger"
            onClick={async () => {
              if (confirm) await api.deleteSession(project.id, confirm.id);
              setConfirm(null);
              await reload();
            }}
          >
            {c.deleteConfirm}
          </Btn>
        </div>
      </Dialog>
      <PaywallDialog reason={paywall ? block : null} onClose={() => setPaywall(false)} target={project.targetSessions} project={project} />
    </div>
  );
}

function QualityBadge({ s }: { s: ViewerSession }) {
  const { t, locale } = useI18n();
  const q = s.calibration?.quality ?? 'POOR';
  const err = s.calibration?.xPct !== null && s.calibration?.xPct !== undefined ? ` ${new Intl.NumberFormat(locale === 'pl' ? 'pl-PL' : 'en-US', { maximumFractionDigits: 1 }).format(s.calibration.xPct)}%` : '';
  return <Badge tone={q === 'GOOD' ? 'good' : q === 'FAIR' ? 'fair' : 'poor'}>{`${t.common.quality[q]}${err}`}</Badge>;
}

function Status({ s }: { s: ViewerSession }) {
  const { t } = useI18n();
  const c = t.studio.collect;
  return s.status === 'valid' ? <Badge tone="good">{c.inReport}</Badge> : <Badge tone="poor">{`${c.rejected}: ${s.rejectCode ? t.studio.rejectCodes[s.rejectCode] : ''}`}</Badge>;
}

function SessionSummary({ s, variant }: { s: ViewerSession; variant: string }) {
  const { t } = useI18n();
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-[12.5px]">{s.participantId}</span>
        {s.source === 'simulated' && <Badge>{t.common.simulated}</Badge>}
      </div>
      <div className="flex flex-wrap items-center gap-2 text-[13.5px] text-muted">
        <span>{variant}</span>
        <span>{t.common.devices[s.device.type]}</span>
        {s.calibration && <QualityBadge s={s} />}
        <Status s={s} />
      </div>
    </div>
  );
}

function SessionActions({ s, onDelete, onToggle, willStayRejected }: { s: ViewerSession; onDelete(): void; onToggle(): Promise<unknown>; willStayRejected: boolean }) {
  const { t } = useI18n();
  const c = t.studio.collect;
  return (
    <div className="mt-3 flex flex-wrap justify-end gap-1 md:mt-0">
      <Btn size="sm" variant="quiet" onClick={() => void onToggle()} title={willStayRejected ? c.restoreHint : undefined}>
        {s.status === 'valid' ? c.reject : c.restore}
      </Btn>
      <Btn size="sm" variant="quiet" onClick={onDelete} aria-label={c.deleteAria(s.participantId)}>
        <Icon name="trash" size={16} />
      </Btn>
    </div>
  );
}
