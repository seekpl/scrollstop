import { useState } from 'react';
import { hashQuery, pathOf } from '../../app/router';
import { useCapabilities, useResearch } from '../../app/research';
import { bookingUrl, salesEmail } from '../../config/company';
import { errorCode } from '../../core/errors';
import { useI18n } from '../../i18n';
import { formatMoney } from '../../i18n/format';
import { currencyFor, type Currency } from '../../i18n/locales';
import { PANEL, PLAN_IDS, PLANS, PRICING_ITEMS, PRICING_SOON, type PlanId } from '../../research/plans';
import { Badge, Btn, btnClass, Icon, Segmented } from '../../ui/kit';
import { leaveTo } from '../shared/browser';
import { PanelOrderDialog } from '../shared/PanelOrder';
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
      <a href={mailHref} className={btnClass('primary', 'md')}>
        {label}
      </a>
    );
  }
  if (!account) {
    // Najpierw konto, potem powrót do cennika z wybranym planem.
    const next = `${pathOf({ name: 'pricing' })}?plan=${plan}`;
    return (
      <a href={`${pathOf({ name: 'register' })}?next=${encodeURIComponent(next)}`} className={btnClass('primary', 'md')}>
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
      <Btn variant="primary" disabled={busy} onClick={() => void go()}>
        {busy ? p.redirecting : subscribed ? (account.plan === plan ? p.manage : p.changeInPortal) : p.buy(t.billing.planNames[plan])}
      </Btn>
      {error && (
        <>
          <p role="alert" className="text-[13.5px] font-semibold text-poor">
            {error}
          </p>
          <a href={mailHref} className={btnClass('secondary', 'md')}>
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
    <SiteShell>
      <div className="mx-auto max-w-[1152px] px-4 py-10 sm:px-6 md:py-16">
        <h1 className="text-[34px] font-semibold tracking-[-0.03em] text-ink md:text-[44px]">{p.title}</h1>
        <p className="mt-3 max-w-[64ch] text-[16px] leading-relaxed text-muted">{p.lead}</p>
        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Segmented<Interval> label={p.intervalLabel} value={interval} onChange={setInterval} options={[{ value: 'monthly', label: p.monthly }, { value: 'yearly', label: p.yearly }]} />
          {locale === 'en' && <Segmented<'USD' | 'EUR'> label={p.currencyLabel} value={eur ? 'EUR' : 'USD'} onChange={(v) => setEur(v === 'EUR')} options={[{ value: 'USD', label: 'USD' }, { value: 'EUR', label: 'EUR' }]} />}
        </div>

        <ul className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {PLAN_IDS.map((id, i) => {
            const plan = PLANS[id];
            const name = b.planNames[id];
            const price = formatMoney(priceOf(id), locale, cur);
            const per = interval === 'yearly' ? p.perYear : p.perMonth;
            const current = account?.plan === id;
            return (
              <li key={id} className={`flex min-w-0 flex-col rounded-2xl bg-surface p-5 ring-inset sm:p-6 ${highlight === id ? 'ring-2 ring-cobalt' : 'ring-1 ring-line'}`} aria-labelledby={`plan-${id}`}>
                <div className="flex items-center justify-between gap-2">
                  <h2 id={`plan-${id}`} className="text-[20px] font-semibold text-ink">
                    {name}
                  </h2>
                  {current && <Badge tone="good">{p.current}</Badge>}
                </div>
                <p className="mt-1 text-[14px] leading-snug text-muted">{p.taglines[id]}</p>
                <p className="mt-4 flex flex-wrap items-baseline gap-x-1.5">
                  {id === 'free' ? (
                    <span className="text-[28px] font-semibold tracking-[-0.02em] text-ink">{p.free}</span>
                  ) : (
                    <>
                      {plan.fromPrice && <span className="text-[15px] text-muted">{p.from}</span>}
                      <span className="tabular text-[28px] font-semibold tracking-[-0.02em] text-ink">{price}</span>
                      <span className="text-[14px] text-muted">{per}</span>
                    </>
                  )}
                </p>
                <ul className="mt-4 space-y-1 text-[14px] text-ink">
                  <li>{p.limits.projects(plan.limits.activeProjects)}</li>
                  {plan.limits.projectSessions !== null && <li>{p.limits.projectViewers(plan.limits.projectSessions)}</li>}
                  {plan.limits.monthSessions !== null && <li>{p.limits.monthViewers(plan.limits.monthSessions, plan.fromPrice)}</li>}
                  {plan.limits.seats > 1 && <li>{p.limits.seats(plan.limits.seats)}</li>}
                </ul>
                <div className="mt-4 border-t border-line pt-4">
                  {i > 0 && <p className="mb-2 text-[13px] text-muted">{p.everythingIn(b.planNames[PLAN_IDS[i - 1]])}</p>}
                  <ul className="space-y-2">
                    {PRICING_ITEMS[id].map((item) => (
                      <li key={item} className="flex gap-2 text-[14px] leading-snug text-ink">
                        <span className="mt-0.5 shrink-0 text-good">
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
                    <a href={pathOf({ name: 'new-project' })} className={btnClass('secondary', 'md')}>
                      {p.startFree}
                    </a>
                  ) : id === 'agency' ? (
                    <>
                      <a href={mailto(p.mailSubject(name, interval === 'yearly' ? p.yearly : p.monthly), p.mailBody(name, `${p.from} ${price} ${per}`))} className={btnClass('primary', 'md')}>
                        {p.talk(name)}
                      </a>
                      {booking && (
                        <a href={booking} className={btnClass('quiet', 'md')} target="_blank" rel="noopener noreferrer">
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
        {caps && <p className="mt-4 text-[13.5px] text-muted">{billing ? p.cardNote : p.noServer}</p>}

        <section className="mt-14 grid gap-6 rounded-2xl bg-surface p-5 ring-1 ring-line sm:p-8 md:grid-cols-[minmax(0,1fr)_auto] md:items-center" aria-labelledby="panel">
          <div className="min-w-0">
            <h2 id="panel" className="text-[24px] font-semibold tracking-[-0.02em] text-ink">
              {b.panel.title}
            </h2>
            <p className="mt-2 max-w-[64ch] text-[15px] leading-relaxed text-muted">{b.panel.lead}</p>
            <ul className="mt-4 space-y-1.5 text-[14.5px] text-ink">
              {b.panel.points.map((x) => (
                <li key={x} className="flex gap-2">
                  <span className="mt-0.5 shrink-0 text-good">
                    <Icon name="check" size={16} />
                  </span>
                  {x}
                </li>
              ))}
            </ul>
            <p className="mt-4 text-[15px] font-semibold text-ink">{b.panel.priceFrom(panelPrice)}</p>
            <p className="mt-1 text-[13.5px] text-muted">{b.panel.quoteNote}</p>
          </div>
          <Btn variant="primary" size="lg" onClick={() => setPanelOpen(true)}>
            {b.panel.order}
          </Btn>
        </section>
        <PanelOrderDialog open={panelOpen} onClose={() => setPanelOpen(false)} />

        <section className="mt-14" aria-labelledby="faq">
          <h2 id="faq" className="text-[24px] font-semibold tracking-[-0.02em] text-ink">
            {t.site.pricingPage.faqTitle}
          </h2>
          <dl className="mt-6 grid gap-6 md:grid-cols-3">
            {t.site.pricingPage.faq.map((f) => (
              <div key={f.q} className="min-w-0">
                <dt className="text-[16px] font-semibold text-ink">{f.q}</dt>
                <dd className="mt-1.5 text-[15px] leading-relaxed text-muted">{f.a}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>
    </SiteShell>
  );
}
