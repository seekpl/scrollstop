import { createHmac, timingSafeEqual } from 'node:crypto';
import type { BillingInterval } from '../src/api/types';
import type { Locale } from '../src/i18n/locales';
import type { PlanId } from '../src/research/plans';

/**
 * Płatności (§16.4): Stripe Checkout i Customer Portal dla planów Creator i Pro. Bez SDK — kilka
 * wywołań REST i ręczna weryfikacja podpisu webhooka (HMAC-SHA256, tolerancja 5 min). Agency
 * i badanie z panelem są sprzedawane na fakturę (kontakt), nie przez Checkout.
 */
export type PaidPlan = Exclude<PlanId, 'free' | 'agency'>;
export const PAID_PLANS: PaidPlan[] = ['creator', 'pro'];

export interface StripeConfig {
  secretKey: string;
  webhookSecret: string;
  prices: Record<`${PaidPlan}_${BillingInterval}`, string>;
  /** Stripe Tax (VAT w UE) — wymaga konfiguracji w panelu Stripe. */
  automaticTax: boolean;
  /** Inny adres API (np. stripe-mock w testach); domyślnie https://api.stripe.com/v1. */
  apiBase?: string;
}

export interface SubscriptionState {
  accountId: string | null;
  customerId: string;
  subscriptionId: string;
  plan: PlanId;
  status: 'active' | 'past_due' | 'canceled' | 'none';
  renewsAt: string | null;
}

export interface StripeSubscription {
  id: string;
  status: string;
  customer: string | { id: string };
  metadata?: Record<string, string>;
  current_period_end?: number;
  items?: { data?: Array<{ price?: { id?: string }; current_period_end?: number }> };
}

export interface StripeEvent {
  id: string;
  type: string;
  data: { object: Record<string, unknown> };
}

type Fetch = typeof fetch;

function form(params: Record<string, string | number | boolean | null | undefined>): string {
  const out = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== null && v !== undefined) out.append(k, String(v));
  return out.toString();
}

export class SignatureError extends Error {}

export class Stripe {
  constructor(
    private readonly cfg: StripeConfig,
    private readonly fetchImpl: Fetch = fetch,
  ) {}

  private get base(): string {
    return (this.cfg.apiBase ?? 'https://api.stripe.com/v1').replace(/\/+$/, '');
  }

  private async call<T>(method: 'GET' | 'POST', path: string, body?: Record<string, string | number | boolean | null | undefined>): Promise<T> {
    const res = await this.fetchImpl(`${this.base}/${path}`, {
      method,
      headers: { Authorization: `Bearer ${this.cfg.secretKey}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body ? form(body) : undefined,
    });
    const json = (await res.json().catch(() => ({}))) as T & { error?: { message?: string } };
    if (!res.ok) throw new Error(`Stripe ${res.status}: ${json.error?.message ?? 'błąd'}`);
    return json;
  }

  /** Plan z identyfikatora ceny (konfiguracja STRIPE_PRICE_*). */
  planForPrice(priceId: string | undefined): PaidPlan | null {
    for (const [key, id] of Object.entries(this.cfg.prices)) if (id && id === priceId) return key.split('_')[0] as PaidPlan;
    return null;
  }

  hasPrice(plan: PaidPlan, interval: BillingInterval): boolean {
    return !!this.cfg.prices[`${plan}_${interval}`];
  }

  async checkout(input: { accountId: string; email: string; customerId: string | null; plan: PaidPlan; interval: BillingInterval; locale: Locale; successUrl: string; cancelUrl: string }): Promise<string> {
    const price = this.cfg.prices[`${input.plan}_${input.interval}`];
    if (!price) throw new Error(`Brak ceny Stripe dla ${input.plan}/${input.interval}`);
    const session = await this.call<{ url: string }>('POST', 'checkout/sessions', {
      mode: 'subscription',
      'line_items[0][price]': price,
      'line_items[0][quantity]': 1,
      client_reference_id: input.accountId,
      'metadata[account_id]': input.accountId,
      'subscription_data[metadata][account_id]': input.accountId,
      'subscription_data[metadata][plan]': input.plan,
      ...(input.customerId ? { customer: input.customerId, 'customer_update[name]': 'auto', 'customer_update[address]': 'auto' } : { customer_email: input.email }),
      billing_address_collection: 'required',
      'tax_id_collection[enabled]': true,
      ...(this.cfg.automaticTax ? { 'automatic_tax[enabled]': true } : {}),
      locale: input.locale,
      success_url: input.successUrl,
      cancel_url: input.cancelUrl,
    });
    return session.url;
  }

  async portal(customerId: string, returnUrl: string, locale: Locale): Promise<string> {
    const s = await this.call<{ url: string }>('POST', 'billing_portal/sessions', { customer: customerId, return_url: returnUrl, locale });
    return s.url;
  }

  async subscription(id: string): Promise<StripeSubscription> {
    return this.call<StripeSubscription>('GET', `subscriptions/${encodeURIComponent(id)}`);
  }

  /** Weryfikacja nagłówka `Stripe-Signature` (t=…,v1=…) z tolerancją 5 minut. */
  verify(rawBody: Buffer, header: string | undefined, now = Date.now()): StripeEvent {
    if (!header) throw new SignatureError('missing');
    const parts = header.split(',').map((p) => p.trim().split('=') as [string, string]);
    const t = Number(parts.find(([k]) => k === 't')?.[1]);
    const sigs = parts.filter(([k]) => k === 'v1').map(([, v]) => v);
    if (!Number.isFinite(t) || !sigs.length) throw new SignatureError('malformed');
    if (Math.abs(now / 1000 - t) > 300) throw new SignatureError('expired');
    const expected = createHmac('sha256', this.cfg.webhookSecret).update(`${t}.`).update(rawBody).digest();
    const ok = sigs.some((s) => {
      const got = Buffer.from(s, 'hex');
      return got.length === expected.length && timingSafeEqual(got, expected);
    });
    if (!ok) throw new SignatureError('mismatch');
    return JSON.parse(rawBody.toString('utf8')) as StripeEvent;
  }

  /**
   * Stan subskrypcji z obiektu Stripe → plan konta (plan z ceny albo z metadanych). `past_due`
   * i `unpaid` zostawiają plan na czas ponowień płatności; `incomplete` (pierwsza płatność
   * niedokończona), `paused` i zakończone — bez płatnego planu.
   */
  stateOf(sub: StripeSubscription): SubscriptionState {
    const item = sub.items?.data?.[0];
    const meta = sub.metadata?.plan;
    const plan: PaidPlan = this.planForPrice(item?.price?.id) ?? (meta === 'creator' || meta === 'pro' ? meta : 'creator');
    const end = item?.current_period_end ?? sub.current_period_end ?? null;
    const status: SubscriptionState['status'] =
      sub.status === 'active' || sub.status === 'trialing' ? 'active' : sub.status === 'past_due' || sub.status === 'unpaid' ? 'past_due' : 'canceled';
    return {
      accountId: sub.metadata?.account_id ?? null,
      customerId: typeof sub.customer === 'string' ? sub.customer : sub.customer.id,
      subscriptionId: sub.id,
      plan: status === 'canceled' ? 'free' : plan,
      status,
      renewsAt: end ? new Date(end * 1000).toISOString() : null,
    };
  }
}

export function stripeConfigFromEnv(env: NodeJS.ProcessEnv): StripeConfig | null {
  if (!env.STRIPE_SECRET_KEY || !env.STRIPE_WEBHOOK_SECRET) return null;
  return {
    secretKey: env.STRIPE_SECRET_KEY,
    webhookSecret: env.STRIPE_WEBHOOK_SECRET,
    prices: {
      creator_monthly: env.STRIPE_PRICE_CREATOR_MONTHLY ?? '',
      creator_yearly: env.STRIPE_PRICE_CREATOR_YEARLY ?? '',
      pro_monthly: env.STRIPE_PRICE_PRO_MONTHLY ?? '',
      pro_yearly: env.STRIPE_PRICE_PRO_YEARLY ?? '',
    },
    automaticTax: env.STRIPE_AUTOMATIC_TAX === '1',
    ...(env.STRIPE_API_BASE ? { apiBase: env.STRIPE_API_BASE } : {}),
  };
}
