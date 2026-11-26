import { useState } from 'react';
import { hashQuery, hrefOf, pathOf } from '../../app/router';
import { useCapabilities, useResearch } from '../../app/research';
import { bookingUrl, salesEmail } from '../../config/company';
import { errorCode } from '../../core/errors';
import { useI18n } from '../../i18n';
import { formatMoney } from '../../i18n/format';
import { currencyFor, type Currency } from '../../i18n/locales';
import { PANEL, PLAN_IDS, PLANS, PRICING_ITEMS, PRICING_SOON, type PlanId } from '../../research/plans';
import { Badge, Icon, Segmented } from '../../ui/kit';
import { leaveTo } from '../shared/browser';
import { PanelOrderDialog } from '../shared/PanelOrder';
import { PageIntro } from './PageIntro';
import { SiteShell } from './SiteShell';

type Interval = 'monthly' | 'yearly';
type PaidPlan = Exclude<PlanId, 'free' | 'agency'>;

const mailto = (subject: string, body?: string) => `mailto:${salesEmail()}?subject=${encodeURIComponent(subject)}${body ? `&body=${encodeURIComponent(body)}` : ''}`;

/** Plan wskazany w adresie (`#/pricing?plan=pro`), np. z paywalla. */
function planFromHash(): PlanId | null {
  const q = new URLSearchParams(window.location.hash.split('?')[1] ?? '').get('plan');
  return (PLAN_IDS as string[]).includes(q ?? '') ? (q as PlanId) : null;
}

/**
 * Zakup planu (§16.4): Stripe Checkout, gdy serwer ma klucze; przy aktywnej subskrypcji portal
 * klienta; bez płatności online — e-mail do sprzedaży. Błąd płatności zawsze z przyciskiem e-mail.
 */
function BuyButton({ plan, interval, label, mailHref, billing }: { plan: PaidPlan; interval: Interval; label: string; mailHref: string; billing: boolean }) {
  const { t, locale } = useI18n();
  const p = t.billing.pricing;
  const { api, account } = useResearch();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!billing) {
    return (
      <a href={mailHref} className="l-btn l-btn-primary l-btn-wrap">
        {label}
      </a>
    );
  }
  if (!account) {
    // Najpierw konto, potem powrót do cennika z wybranym planem.
    const next = `${pathOf({ name: 'pricing' })}?plan=${plan}`;
    return (
      <a href={`${hrefOf({ name: 'register' })}?next=${encodeURIComponent(next)}`} className="l-btn l-btn-primary l-btn-wrap">
        {p.buy(t.billing.planNames[plan])}
      </a>
    );
  }
  const subscribed = account.billing === 'stripe' && (account.planStatus === 'active' || account.planStatus === 'past_due');
  const go = async () => {
    setBusy(true);
    setError(null);
    try {
      const { url } = subscribed ? await api.billingPortal(locale) : await api.checkout(plan, interval, locale);
      leaveTo(url);
    } catch (e) {
      setError((t.errors as Record<string, string>)[errorCode(e)] ?? t.errors.unknown);
      setBusy(false);
    }
  };
  return (
    <>
      <button type="button" className="l-btn l-btn-primary l-btn-wrap disabled:opacity-60" disabled={busy} onClick={() => void go()}>
        {busy ? p.redirecting : subscribed ? (account.plan === plan ? p.manage : p.changeInPortal) : p.buy(t.billing.planNames[plan])}
      </button>
      {error && (
        <>
          <p role="alert" className="text-[13.5px] font-semibold text-poor">
            {error}
          </p>
          <a href={mailHref} className="l-btn l-btn-plain l-btn-wrap">
            {p.orderByMail}
          </a>
        </>
      )}
    </>
  );
}

/**
 * Cennik (§16): waluta według języka (en: USD z przełącznikiem EUR), okres miesięczny lub roczny
 * (10 × cena miesięczna). Kupno przez Stripe albo e-mailem (bez płatności online). Pozycje bez
 * kodu — „wkrótce”. Badanie z panelem: formularz zamówienia.
 */
export function PricingPage() {
  const { t, locale } = useI18n();
  const b = t.billing;
  const p = b.pricing;
  const { account } = useResearch();
  const [interval, setInterval] = useState<Interval>('monthly');
  const caps = useCapabilities();
  const [panelOpen, setPanelOpen] = useState(() => hashQuery().get('panel') === '1');
  const billing = !!caps?.billing;
  const [eur, setEur] = useState(false);
  const cur: Currency = currencyFor(locale, eur);
  const highlight = planFromHash();
  const booking = bookingUrl();
  const priceOf = (id: PlanId) => PLANS[id].monthly[cur] * (interval === 'yearly' ? 10 : 1);
  const panelCur = cur === 'PLN' ? 'PLN' : 'EUR';
  const panelPrice = formatMoney(PANEL.from[panelCur], locale, panelCur);

  return (
    <SiteShell seo={t.site.seo.pricing}>
      <PageIntro title={p.title} lead={p.lead} />
      <section className="l-light" aria-label={p.title}>
      <div className="mx-auto max-w-[1152px] px-4 py-12 sm:px-6 md:py-16">
        <div className="flex flex-wrap items-center gap-3">
          <Segmented<Interval> label={p.intervalLabel} value={interval} onChange={setInterval} options={[{ value: 'monthly', label: p.monthly }, { value: 'yearly', label: p.yearly }]} />
          {locale === 'en' && <Segmented<'USD' | 'EUR'> label={p.currencyLabel} value={eur ? 'EUR' : 'USD'} onChange={(v) => setEur(v === 'EUR')} options={[{ value: 'USD', label: 'USD' }, { value: 'EUR', label: 'EUR' }]} />}
        </div>

        <ul className="mt-8 grid gap-px overflow-hidden rounded-[14px] border border-[var(--l-line)] bg-[var(--l-line)] md:grid-cols-2 xl:grid-cols-4">
          {PLAN_IDS.map((id, i) => {
            const plan = PLANS[id];
            const name = b.planNames[id];
            const price = formatMoney(priceOf(id), locale, cur);
            const per = interval === 'yearly' ? p.perYear : p.perMonth;
            const current = account?.plan === id;
            return (
              <li key={id} className={`flex min-w-0 flex-col bg-[var(--l-light-2)] p-5 sm:p-7 ${highlight === id ? 'relative ring-2 ring-inset ring-[var(--l-accent)]' : ''}`} aria-labelledby={`plan-${id}`}>
                <div className="flex items-center justify-between gap-2">
                  <h2 id={`plan-${id}`} className="text-[22px] font-normal tracking-[-0.02em] text-[var(--l-ink)]">
                    {name}
                  </h2>
                  {current && <Badge tone="good">{p.current}</Badge>}
                </div>
                <p className="mt-1 text-[14px] leading-snug text-[var(--l-muted)]">{p.taglines[id]}</p>
                <p className="mt-4 flex flex-wrap items-baseline gap-x-1.5">
                  {id === 'free' ? (
                    <span className="text-[32px] font-normal tracking-[-0.03em] text-[var(--l-ink)]">{p.free}</span>
                  ) : (
                    <>
                      {plan.fromPrice && <span className="text-[15px] text-[var(--l-muted)]">{p.from}</span>}
                      <span className="tabular text-[32px] font-normal tracking-[-0.03em] text-[var(--l-ink)]">{price}</span>
                      <span className="text-[14px] text-[var(--l-muted)]">{per}</span>
                    </>
                  )}
                </p>
                <ul className="mt-4 space-y-1 text-[14px] text-[var(--l-ink)]">
                  <li>{p.limits.projects(plan.limits.activeProjects)}</li>
                  {plan.limits.projectSessions !== null && <li>{p.limits.projectViewers(plan.limits.projectSessions)}</li>}
                  {plan.limits.monthSessions !== null && <li>{p.limits.monthViewers(plan.limits.monthSessions, plan.fromPrice)}</li>}
                  {plan.limits.seats > 1 && <li>{p.limits.seats(plan.limits.seats)}</li>}
                </ul>
                <div className="mt-4 border-t border-[var(--l-line)] pt-4">
                  {i > 0 && <p className="mb-2 text-[13px] text-[var(--l-muted)]">{p.everythingIn(b.planNames[PLAN_IDS[i - 1]])}</p>}
                  <ul className="space-y-2">
                    {PRICING_ITEMS[id].map((item) => (
                      <li key={item} className="flex gap-2 text-[14px] leading-snug text-[var(--l-ink)]">
                        <span className="mt-0.5 shrink-0 text-[var(--l-accent-deep)]">
                          <Icon name="check" size={16} />
                        </span>
                        <span className="min-w-0">
                          {p.features[item]} {PRICING_SOON.has(item) && <Badge>{p.soon}</Badge>}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="mt-auto flex flex-col gap-2 pt-6">
                  {id === 'free' ? (
                    <a href={hrefOf({ name: 'new-project' })} className="l-btn l-btn-plain l-btn-wrap">
                      {p.startFree}
                    </a>
                  ) : id === 'agency' ? (
                    <>
                      <a href={mailto(p.mailSubject(name, interval === 'yearly' ? p.yearly : p.monthly), p.mailBody(name, `${p.from} ${price} ${per}`))} className="l-btn l-btn-primary l-btn-wrap">
                        {p.talk(name)}
                      </a>
                      {booking && (
                        <a href={booking} className="l-btn l-btn-plain l-btn-wrap" target="_blank" rel="noopener noreferrer">
                          {p.booking}
                        </a>
                      )}
                    </>
                  ) : (
                    <BuyButton plan={id} interval={interval} billing={billing} label={p.order(name)} mailHref={mailto(p.mailSubject(name, interval === 'yearly' ? p.yearly : p.monthly), p.mailBody(name, `${price} ${per}`))} />
                  )}
                </div>
              </li>
            );
          })}
        </ul>
        {caps && <p className="mt-4 text-[13.5px] text-[var(--l-muted)]">{billing ? p.cardNote : p.noServer}</p>}
      </div>
      </section>

      <section className="l-night relative overflow-hidden" aria-labelledby="panel">
        <div aria-hidden className="l-glow pointer-events-none absolute inset-0 opacity-70" />
        <div className="relative mx-auto grid max-w-[1152px] gap-10 px-4 py-16 sm:px-6 md:grid-cols-[minmax(0,1fr)_auto] md:items-center md:py-20">
          <div className="min-w-0">
            <h2 id="panel" className="text-[28px] font-normal leading-tight tracking-[-0.03em] md:text-[36px]">
              {b.panel.title}
            </h2>
            <p className="mt-4 max-w-[62ch] text-[16px] leading-relaxed text-white/75">{b.panel.lead}</p>
            <ul className="mt-6 grid gap-px overflow-hidden rounded-[12px] border border-white/12 bg-white/12 sm:grid-cols-3">
              {b.panel.points.map((x) => (
                <li key={x} className="flex gap-2.5 bg-[color-mix(in_srgb,var(--l-night)_88%,white)] p-4 text-[14.5px] leading-snug text-white/90">
                  <span className="mt-0.5 shrink-0 text-[var(--l-accent)]">
                    <Icon name="check" size={16} />
                  </span>
                  {x}
                </li>
              ))}
            </ul>
            <p className="mt-6 text-[17px] text-white">{b.panel.priceFrom(panelPrice)}</p>
            <p className="mt-1 text-[13.5px] text-white/65">{b.panel.quoteNote}</p>
          </div>
          <button type="button" className="l-btn l-btn-primary" onClick={() => setPanelOpen(true)}>
            {b.panel.order}
          </button>
        </div>
      </section>
      <PanelOrderDialog open={panelOpen} onClose={() => setPanelOpen(false)} />

      <section className="l-light" aria-labelledby="faq">
        <div className="mx-auto max-w-[1152px] px-4 py-16 sm:px-6 md:py-20">
          <h2 id="faq" className="text-[28px] font-normal tracking-[-0.03em] text-[var(--l-ink)] md:text-[34px]">
            {t.site.pricingPage.faqTitle}
          </h2>
          <dl className="mt-8 grid gap-px overflow-hidden rounded-[14px] border border-[var(--l-line)] bg-[var(--l-line)] md:grid-cols-3">
            {t.site.pricingPage.faq.map((f) => (
              <div key={f.q} className="min-w-0 bg-[var(--l-light-2)] p-6">
                <dt className="text-[16px] font-medium text-[var(--l-ink)]">{f.q}</dt>
                <dd className="mt-2 text-[15px] leading-relaxed text-[var(--l-muted)]">{f.a}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>
    </SiteShell>
  );
}
