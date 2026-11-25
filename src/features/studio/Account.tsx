import { useEffect, useState } from 'react';
import { pathOf } from '../../app/router';
import { useResearch } from '../../app/research';
import { salesEmail } from '../../config/company';
import { errorCode } from '../../core/errors';
import { useI18n } from '../../i18n';
import { formatDate } from '../../i18n/format';
import type { Usage } from '../../api/types';
import { PLANS } from '../../research/plans';
import { Badge, btnClass, Btn, Callout, Dialog, Field, inputClass, PageHeader, Section, Surface } from '../../ui/kit';
import { leaveTo } from '../shared/browser';
import { StudioShell } from './Shell';

/** Słowa potwierdzenia usunięcia konta (§9.6). */
export const DELETE_WORDS: Record<string, string> = { pl: 'USUŃ', en: 'DELETE', de: 'LÖSCHEN', es: 'ELIMINAR', it: 'ELIMINA' };

/** Konto (§9.6): plan i wykorzystanie, dane, logo do raportu, usunięcie konta (wpisanie słowa). */
export function AccountPage() {
  const { t, locale } = useI18n();
  const a = t.studio.account;
  const { api, account, can, refreshAccount } = useResearch();
  const [usage, setUsage] = useState<Usage | null>(null);
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [saved, setSaved] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [word, setWord] = useState('');
  const [error, setError] = useState<string | null>(null);
  const payment = new URLSearchParams(window.location.hash.split('?')[1] ?? '').get('payment');
  useEffect(() => {
    void api.usage().then(setUsage);
  }, [api]);
  // Powrót z płatności: plan zmienia webhook Stripe — odświeżamy konto, aż zmiana dotrze (do ~45 s).
  const activated = account?.billing === 'stripe' && account.planStatus === 'active';
  useEffect(() => {
    if (payment !== 'ok' || activated) return;
    let n = 0;
    const timer = setInterval(() => {
      if (++n > 15) clearInterval(timer);
      void refreshAccount();
    }, 3000);
    return () => clearInterval(timer);
  }, [payment, activated, refreshAccount]);
  useEffect(() => {
    if (account) {
      setName(account.name);
      setCompany(account.company);
    }
  }, [account]);
  if (!account) return <StudioShell title={a.title}>{null}</StudioShell>;
  const plan = PLANS[account.plan];
  const save = async () => {
    await api.updateAccount({ name: name.trim().slice(0, 120), company: company.trim().slice(0, 120) });
    await refreshAccount();
    setSaved(true);
  };
  const uploadLogo = async (f: File) => {
    setError(null);
    if (!/^image\/(png|jpeg|webp)$/.test(f.type)) return setError(t.errors.unsupported_type);
    if (f.size > 150 * 1024) return setError(a.logoTooBig);
    const url = await new Promise<string>((res) => {
      const r = new FileReader();
      r.onload = () => res(String(r.result));
      r.readAsDataURL(f);
    });
    await api.updateAccount({ logo: url });
    await refreshAccount();
  };
  const remove = async () => {
    try {
      await api.deleteAccount();
      window.location.hash = '#/';
      window.location.reload();
    } catch (e) {
      setError((t.errors as Record<string, string>)[errorCode(e)] ?? t.errors.unknown);
    }
  };
  return (
    <StudioShell crumbs={[{ label: a.title }]} title={a.title}>
      <div className="space-y-10">
        <PageHeader title={a.title} />
        {payment === 'ok' && <Callout title={activated ? a.paymentActive(t.billing.planNames[account.plan]) : a.paymentOk} />}
        {payment === 'cancelled' && <Callout tone="warn" title={a.paymentCancelled} />}
        <Section title={a.planTitle}>
          <Surface>
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-[20px] font-semibold">{t.billing.planNames[plan.id]}</span>
              {account.planStatus === 'past_due' && <Badge tone="poor">{a.pastDue}</Badge>}
            </div>
            {account.planRenewsAt && account.planStatus === 'active' && <p className="mt-1 text-[14px] text-muted">{a.renews(formatDate(account.planRenewsAt, locale))}</p>}
            {account.planStatus === 'past_due' && account.billing === 'stripe' && <p className="mt-1 text-[14px] text-poor">{a.pastDueBody}</p>}
            {account.billing === 'manual' && (
              <p className="mt-1 text-[14px] text-muted">
                {a.manualBilling}{' '}
                <a className="font-semibold text-cobalt underline underline-offset-4" href={`mailto:${salesEmail()}`}>
                  {salesEmail()}
                </a>
              </p>
            )}
            {usage && <p className="mt-2 text-[14px] text-muted">{t.studio.projects.limits(t.billing.planNames[plan.id], usage.activeProjects, plan.limits.activeProjects, usage.monthSessions, plan.limits.monthSessions)}</p>}
            <div className="mt-4 flex flex-wrap gap-2">
              <a href={pathOf({ name: 'pricing' })} className={btnClass('primary', 'md')}>
                {a.changePlan}
              </a>
              {api.mode === 'server' && account.billing === 'stripe' && (
                <Btn
                  onClick={async () => {
                    try {
                      leaveTo((await api.billingPortal(locale)).url);
                    } catch (e) {
                      setError((t.errors as Record<string, string>)[errorCode(e)] ?? t.errors.unknown);
                    }
                  }}
                >
                  {a.portal}
                </Btn>
              )}
            </div>
          </Surface>
        </Section>
        <Section title={a.dataTitle}>
          <div className="grid max-w-2xl gap-4 sm:grid-cols-2">
            {api.mode === 'server' && <Field label={a.email}>{(id) => <input id={id} className={inputClass} value={account.email} readOnly />}</Field>}
            <Field label={a.name}>{(id) => <input id={id} className={inputClass} value={name} maxLength={120} onChange={(e) => (setName(e.target.value), setSaved(false))} />}</Field>
            <Field label={a.company} hint={a.companyHint}>
              {(id, d) => <input id={id} aria-describedby={d} className={inputClass} value={company} maxLength={120} onChange={(e) => (setCompany(e.target.value), setSaved(false))} />}
            </Field>
          </div>
          <div className="mt-4 flex items-center gap-3">
            <Btn variant="primary" onClick={() => void save()}>
              {a.save}
            </Btn>
            {saved && (
              <span className="text-[14px] text-good" role="status">
                {a.saved}
              </span>
            )}
          </div>
        </Section>
        <Section title={a.logoTitle}>
          {can.clientLogo ? (
            <div className="flex flex-wrap items-center gap-4">
              {account.logo && <img src={account.logo} alt={a.logoAlt} className="h-12 w-auto rounded bg-surface p-1 ring-1 ring-line" />}
              <label className="inline-flex min-h-10 cursor-pointer items-center rounded-[10px] px-4 text-[14px] font-semibold ring-1 ring-inset ring-field/70">
                {a.logoPick}
                <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(e) => e.target.files?.[0] && void uploadLogo(e.target.files[0])} />
              </label>
              <span className="text-[13px] text-muted">{a.logoHint}</span>
            </div>
          ) : (
            <Callout tone="locked">{a.logoLocked(t.billing.planNames.agency)}</Callout>
          )}
        </Section>
        <Section title={a.deleteTitle}>
          <p className="mb-3 max-w-[70ch] text-[14px] text-muted">{api.mode === 'local' ? a.deleteBodyLocal : a.deleteBody}</p>
          <Btn variant="danger" onClick={() => setConfirm(true)}>
            {a.delete}
          </Btn>
          {error && <p className="mt-3 text-[14px] font-semibold text-poor">{error}</p>}
        </Section>
      </div>
      <Dialog open={confirm} onClose={() => setConfirm(false)} title={a.deleteTitle}>
        <Field label={a.typeWord(DELETE_WORDS[locale] ?? 'DELETE')}>{(id) => <input id={id} className={inputClass} value={word} onChange={(e) => setWord(e.target.value)} autoComplete="off" />}</Field>
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <Btn onClick={() => setConfirm(false)}>{t.common.actions.cancel}</Btn>
          <Btn variant="danger" disabled={word.trim().toUpperCase() !== (DELETE_WORDS[locale] ?? 'DELETE')} onClick={() => void remove()}>
            {a.delete}
          </Btn>
        </div>
      </Dialog>
    </StudioShell>
  );
}
