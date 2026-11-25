// @vitest-environment node
import { createHmac } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp, panelRefHash } from '../server/app';
import { SignatureError, Stripe, type StripeConfig } from '../server/billing';
import { Db } from '../server/db';
import { RESEARCH_TEXT } from '../src/i18n/research';
import type { Project, ViewerSession } from '../src/research/model';
import { cleanPanelConfig, cleanPid, panelReturnUrl } from '../src/research/panel';
import { demoProject } from '../src/research/panelSim';

const SECRET = 'whsec_test_123';
const SALT = 'sol-panelu-testowa';
const CONFIG: StripeConfig = {
  secretKey: 'sk_test_abc',
  webhookSecret: SECRET,
  prices: { creator_monthly: 'price_cm', creator_yearly: 'price_cy', pro_monthly: 'price_pm', pro_yearly: 'price_py' },
  automaticTax: true,
};

/** Atrapa API Stripe: zapisuje wywołania, subskrypcje z mapy (stan można zmieniać w teście). */
interface StripeCall {
  method: string;
  path: string;
  body: URLSearchParams;
  auth: string | null;
}
const calls: StripeCall[] = [];
const subs = new Map<string, Record<string, unknown>>();
let stripeDown = false;
const fakeFetch = (async (input: string | URL | Request, init?: RequestInit) => {
  const url = new URL(String(input));
  const path = url.pathname.replace(/^\/v1\//, '');
  calls.push({ method: init?.method ?? 'GET', path, body: new URLSearchParams(typeof init?.body === 'string' ? init.body : ''), auth: new Headers(init?.headers).get('Authorization') });
  const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  if (stripeDown) return json(500, { error: { message: 'awaria' } });
  if (path === 'checkout/sessions') return json(200, { id: 'cs_1', url: 'https://checkout.stripe.test/c/cs_1' });
  if (path === 'billing_portal/sessions') return json(200, { id: 'bps_1', url: 'https://billing.stripe.test/p/bps_1' });
  const m = /^subscriptions\/(.+)$/.exec(path);
  if (m && subs.has(m[1])) return json(200, subs.get(m[1]));
  return json(404, { error: { message: 'brak' } });
}) as typeof fetch;

let dir: string;
let db: Db;
let server: Server;
let base: string;
let clock = Date.parse('2026-11-20T10:00:00Z');

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'attn-billing-'));
  db = new Db(join(dir, 'test.sqlite'));
  const app = createApp(db, {
    dataDir: dir,
    appUrl: 'https://app.example/',
    origins: ['https://app.example'],
    adminEmails: ['admin@example.com'],
    maxVideoMb: 1,
    maxImageMb: 1,
    trustProxy: false,
    staticDir: null,
    stripe: new Stripe(CONFIG, fakeFetch),
    panelSalt: SALT,
    now: () => clock,
  });
  server = createServer((req, res) => void app.handler(req, res));
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(() => {
  server.close();
  db.close();
  rmSync(dir, { recursive: true, force: true });
});

interface Res<T> {
  status: number;
  data: T;
}

async function call<T = Record<string, unknown>>(method: string, path: string, body?: unknown, token?: string, headers: Record<string, string> = {}): Promise<Res<T>> {
  const res = await fetch(base + path, {
    method,
    headers: { ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers },
    body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, data: (text ? JSON.parse(text) : null) as T };
}

const errCode = (r: Res<unknown>) => (r.data as { error?: { code: string } } | null)?.error?.code;

let n = 0;
async function account(email = `kupujacy${++n}@example.com`) {
  const r = await call<{ token: string; account: { id: string } }>('POST', '/api/auth/register', { email, password: 'dlugie-haslo-123', name: `Osoba ${n}`, company: '' });
  expect(r.status).toBe(201);
  return { token: r.data.token, id: r.data.account.id, email };
}

/** Zdarzenie podpisane jak przez Stripe (`t=…,v1=HMAC(t.body)`). */
function signed(event: Record<string, unknown>, opts: { secret?: string; at?: number } = {}) {
  const body = JSON.stringify(event);
  const t = Math.floor((opts.at ?? clock) / 1000);
  const v1 = createHmac('sha256', opts.secret ?? SECRET).update(`${t}.${body}`).digest('hex');
  return { body, headers: { 'Stripe-Signature': `t=${t},v1=${v1}` } };
}

const webhook = (event: Record<string, unknown>, opts: { secret?: string; at?: number } = {}) => {
  const s = signed(event, opts);
  return call<{ received?: boolean; duplicate?: boolean }>('POST', '/api/billing/webhook', s.body, undefined, s.headers);
};

const sub = (id: string, accountId: string, price: string, status: string, plan = 'creator') => ({
  id,
  status,
  customer: 'cus_1',
  metadata: { account_id: accountId, plan },
  items: { data: [{ price: { id: price }, current_period_end: Math.floor(clock / 1000) + 30 * 86400 }] },
});

describe('płatności Stripe (§16.4)', () => {
  it('checkout wysyła plan i konto; webhook z podpisem zmienia plan; idempotencja; portal; anulowanie', async () => {
    expect((await call<{ billing: boolean }>('GET', '/api/health')).data.billing).toBe(true);
    const a = await account();

    // Checkout: tylko Creator i Pro, okres miesięczny albo roczny; bez logowania 401.
    expect((await call('POST', '/api/billing/checkout', { plan: 'creator', interval: 'monthly' })).status).toBe(401);
    expect(errCode(await call('POST', '/api/billing/checkout', { plan: 'agency', interval: 'monthly' }, a.token))).toBe('bad_request');
    expect(errCode(await call('POST', '/api/billing/checkout', { plan: 'pro' }, a.token))).toBe('bad_request');
    const co = await call<{ url: string }>('POST', '/api/billing/checkout', { plan: 'creator', interval: 'yearly', locale: 'en' }, a.token);
    expect(co.data.url).toBe('https://checkout.stripe.test/c/cs_1');
    const req = calls.at(-1)!;
    expect(req.auth).toBe('Bearer sk_test_abc');
    expect(Object.fromEntries(req.body)).toMatchObject({
      mode: 'subscription',
      'line_items[0][price]': 'price_cy',
      client_reference_id: a.id,
      'metadata[account_id]': a.id,
      'subscription_data[metadata][account_id]': a.id,
      'subscription_data[metadata][plan]': 'creator',
      customer_email: a.email,
      'tax_id_collection[enabled]': 'true',
      'automatic_tax[enabled]': 'true',
      locale: 'en',
      success_url: 'https://app.example/#/app/account?payment=ok',
      cancel_url: 'https://app.example/#/app/account?payment=cancelled',
    });

    // Podpis: brak, inny sekret, przeterminowany → 400; plan się nie zmienia.
    const completed = { id: 'evt_1', type: 'checkout.session.completed', data: { object: { id: 'cs_1', mode: 'subscription', subscription: 'sub_1', customer: 'cus_1', client_reference_id: a.id } } };
    expect(errCode(await call('POST', '/api/billing/webhook', JSON.stringify(completed)))).toBe('bad_signature');
    expect(errCode(await webhook(completed, { secret: 'whsec_inny' }))).toBe('bad_signature');
    expect(errCode(await webhook(completed, { at: clock - 10 * 60_000 }))).toBe('bad_signature');
    expect((await call<{ plan: string }>('GET', '/api/me', undefined, a.token)).data.plan).toBe('free');

    // Poprawny podpis: serwer pobiera subskrypcję i ustawia plan z identyfikatora ceny.
    subs.set('sub_1', sub('sub_1', a.id, 'price_cy', 'active'));
    expect((await webhook(completed)).data).toEqual({ received: true });
    const me = (await call<{ plan: string; planStatus: string; planRenewsAt: string; billing: string }>('GET', '/api/me', undefined, a.token)).data;
    expect(me).toMatchObject({ plan: 'creator', planStatus: 'active', billing: 'stripe' });
    expect(me.planRenewsAt).toBe(new Date(clock + 30 * 86_400_000).toISOString());

    // To samo zdarzenie drugi raz: bez ponownego przetwarzania.
    const before = calls.length;
    expect((await webhook(completed)).data).toEqual({ received: true, duplicate: true });
    expect(calls.length).toBe(before);

    // Aktywna subskrypcja: zmiana planu w portalu, nie drugi Checkout.
    expect(errCode(await call('POST', '/api/billing/checkout', { plan: 'pro', interval: 'monthly' }, a.token))).toBe('already_subscribed');
    const portal = await call<{ url: string }>('POST', '/api/billing/portal', { locale: 'pl' }, a.token);
    expect(portal.data.url).toBe('https://billing.stripe.test/p/bps_1');
    expect(Object.fromEntries(calls.at(-1)!.body)).toMatchObject({ customer: 'cus_1', return_url: 'https://app.example/#/app/account', locale: 'pl' });

    // Nieudana płatność → zaległość; zmiana ceny w portalu → Pro (stan z API, nie z treści zdarzenia).
    await webhook({ id: 'evt_2', type: 'invoice.payment_failed', data: { object: { id: 'in_1', customer: 'cus_1' } } });
    expect((await call<{ planStatus: string }>('GET', '/api/me', undefined, a.token)).data.planStatus).toBe('past_due');
    subs.set('sub_1', sub('sub_1', a.id, 'price_pm', 'active', 'pro'));
    await webhook({ id: 'evt_3', type: 'customer.subscription.updated', data: { object: { id: 'sub_1', status: 'past_due' } } });
    expect((await call('GET', '/api/me', undefined, a.token)).data).toMatchObject({ plan: 'pro', planStatus: 'active' });

    // Anulowanie starszej subskrypcji tego klienta nie zdejmuje planu z bieżącej.
    subs.set('sub_0', sub('sub_0', a.id, 'price_cm', 'canceled'));
    await webhook({ id: 'evt_4', type: 'customer.subscription.deleted', data: { object: { id: 'sub_0' } } });
    expect((await call<{ plan: string }>('GET', '/api/me', undefined, a.token)).data.plan).toBe('pro');

    // Konto z aktywną subskrypcją nie da się usunąć bez anulowania.
    expect(errCode(await call('DELETE', '/api/me', undefined, a.token))).toBe('active_subscription');

    // Błąd po stronie Stripe: 500, zdarzenie nie jest zapisane, ponowienie je przetwarza.
    subs.set('sub_1', sub('sub_1', a.id, 'price_pm', 'canceled', 'pro'));
    stripeDown = true;
    const deleted = { id: 'evt_5', type: 'customer.subscription.deleted', data: { object: { id: 'sub_1' } } };
    expect((await webhook(deleted)).status).toBe(500);
    stripeDown = false;
    expect((await webhook(deleted)).data).toEqual({ received: true });
    expect((await call('GET', '/api/me', undefined, a.token)).data).toMatchObject({ plan: 'free', planStatus: 'canceled', planRenewsAt: null });

    // Po anulowaniu można kupić ponownie (z tym samym klientem Stripe).
    expect((await call('POST', '/api/billing/checkout', { plan: 'pro', interval: 'monthly' }, a.token)).status).toBe(200);
    expect(Object.fromEntries(calls.at(-1)!.body)).toMatchObject({ customer: 'cus_1', 'line_items[0][price]': 'price_pm' });
  });

  it('bez ceny dla planu — 503 i ścieżka e-mail; bez subskrypcji portal 409; błąd Stripe 502', async () => {
    const a = await account();
    expect(errCode(await call('POST', '/api/billing/portal', {}, a.token))).toBe('no_subscription');
    const app = createApp(db, { dataDir: dir, appUrl: 'https://app.example/', origins: [], adminEmails: [], maxVideoMb: 1, maxImageMb: 1, trustProxy: false, staticDir: null, stripe: new Stripe({ ...CONFIG, prices: { ...CONFIG.prices, pro_yearly: '' } }, fakeFetch), now: () => clock });
    const s2 = createServer((req, res) => void app.handler(req, res));
    await new Promise<void>((r) => s2.listen(0, '127.0.0.1', r));
    const res = await fetch(`http://127.0.0.1:${(s2.address() as AddressInfo).port}/api/billing/checkout`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${a.token}` }, body: JSON.stringify({ plan: 'pro', interval: 'yearly' }) });
    expect([res.status, ((await res.json()) as { error: { code: string } }).error.code]).toEqual([503, 'billing_unavailable']);
    s2.close();
    stripeDown = true;
    const down = await call('POST', '/api/billing/checkout', { plan: 'creator', interval: 'monthly' }, a.token);
    stripeDown = false;
    expect([down.status, errCode(down)]).toEqual([502, 'billing_failed']);
  });
});

describe('Stripe: podpis i stan subskrypcji', () => {
  const stripe = new Stripe(CONFIG, fakeFetch);
  it('weryfikacja: kilka podpisów v1 (rotacja sekretu), tolerancja 5 minut', () => {
    const body = Buffer.from(JSON.stringify({ id: 'evt_x', type: 'ping', data: { object: {} } }));
    const t = Math.floor(clock / 1000);
    const good = createHmac('sha256', SECRET).update(`${t}.${body.toString()}`).digest('hex');
    expect(stripe.verify(body, `t=${t},v1=${'0'.repeat(64)},v1=${good}`, clock).id).toBe('evt_x');
    expect(() => stripe.verify(body, `t=${t},v1=${good}`, clock + 301_000)).toThrow(SignatureError);
    expect(() => stripe.verify(body, `t=${t}`, clock)).toThrow(SignatureError);
    expect(() => stripe.verify(Buffer.from(`${body.toString()} `), `t=${t},v1=${good}`, clock)).toThrow(SignatureError);
  });

  it('stan: active/trialing → plan, past_due/unpaid → zaległość, incomplete i reszta → Free', () => {
    expect(stripe.stateOf({ id: 's', status: 'trialing', customer: { id: 'cus_9' }, items: { data: [{ price: { id: 'price_pm' } }] } })).toMatchObject({ plan: 'pro', status: 'active', customerId: 'cus_9' });
    expect(stripe.stateOf({ id: 's', status: 'unpaid', customer: 'c', metadata: { plan: 'pro' } })).toMatchObject({ plan: 'pro', status: 'past_due' });
    expect(stripe.stateOf({ id: 's', status: 'incomplete_expired', customer: 'c', items: { data: [{ price: { id: 'price_cm' } }] } })).toMatchObject({ plan: 'free', status: 'canceled' });
    // Pierwsza płatność niedokończona (np. 3D Secure): bez płatnych funkcji do czasu opłacenia.
    expect(stripe.stateOf({ id: 's', status: 'incomplete', customer: 'c', items: { data: [{ price: { id: 'price_pm' } }] } })).toMatchObject({ plan: 'free' });
  });
});

describe('integracja z dostawcą panelu (§16.5)', () => {
  it('adresy powrotu: tylko HTTPS, {PID} zakodowany; identyfikator uczestnika z ograniczonego alfabetu', () => {
    const cfg = cleanPanelConfig({ provider: 'cint', completeUrl: 'https://panel.example/c?rid={PID}&s=1', screenoutUrl: 'https://panel.example/s?rid={PID}', qualityFailUrl: 'https://panel.example/q' });
    expect(cfg).not.toBeNull();
    expect(panelReturnUrl(cfg!, 'complete', 'a/b c')).toBe('https://panel.example/c?rid=a%2Fb%20c&s=1');
    expect(panelReturnUrl(cfg!, 'quality_fail', 'x1')).toBe('https://panel.example/q');
    expect(cleanPanelConfig({ ...cfg, completeUrl: 'http://panel.example/c' })).toBeNull();
    expect(cleanPanelConfig({ ...cfg, screenoutUrl: 'javascript:alert(1)' })).toBeNull();
    expect(cleanPanelConfig({ ...cfg, provider: '<b>' })).toBeNull();
    expect(cleanPid('RID-123_abc')).toBe('RID-123_abc');
    expect(cleanPid('a b')).toBeNull();
    expect(cleanPid('x'.repeat(129))).toBeNull();
    expect(cleanPid(null)).toBeNull();
  });

  it('operator ustawia panel; widz z pid — w bazie tylko skrót z solą, twórca go nie widzi', async () => {
    const creator = await account();
    db.updateAccount(creator.id, { plan: 'pro', plan_status: 'active' });
    const p = (await call<Project>('POST', '/api/projects', { name: 'Panelowy', creatorName: 'Marka', kind: 'video', platform: 'tiktok', audio: 'off', targetDevice: 'mobile', variants: [{ media: { kind: 'demo', demo: 'reel_b' }, mediaName: 'Rolka', duration: 15, width: 1080, height: 1920 }], questions: [], audience: { source: 'panel', ageBands: ['18-24'] }, locale: 'pl' }, creator.token)).data;
    const panel = { provider: 'cint', completeUrl: 'https://panel.example/c?rid={PID}', screenoutUrl: 'https://panel.example/s?rid={PID}', qualityFailUrl: 'https://panel.example/q?rid={PID}' };

    // Twórca nie ustawi adresów przekierowania (pole ignorowane), tylko administrator.
    expect((await call<Project>('PATCH', `/api/projects/${p.id}`, { panel }, creator.token)).data.panel).toBeUndefined();
    expect((await call('PUT', `/api/admin/projects/${p.id}/panel`, { panel }, creator.token)).status).toBe(403);
    const admin = await account('admin@example.com');
    expect(errCode(await call('PUT', `/api/admin/projects/${p.id}/panel`, { panel: { ...panel, completeUrl: 'http://x.example' } }, admin.token))).toBe('bad_panel');
    expect((await call('PUT', `/api/admin/projects/${p.id}/panel`, { panel }, admin.token)).data).toEqual({ panel });
    expect((await call<{ config: { panel: unknown } }>('GET', `/api/study/${p.linkToken}`)).data.config.panel).toEqual(panel);

    const [s, other] = demoProject('reel', RESEARCH_TEXT.pl, { valid: 2, createdAt: new Date(clock).toISOString() }).sessions.map((x, i) => ({ ...x, id: `ses_panel${i}`, variantId: 'A', source: 'webcam' as const, calibration: { quality: 'GOOD' as const, xPct: 5, yPct: 6, points: 9 } }));
    // Próba podrzucenia skrótu w treści sesji — serwer go odrzuca i liczy własny z nagłówka.
    expect((await call('POST', `/api/study/${p.linkToken}/sessions`, { ...s, panel: { provider: 'x', refHash: 'podrobiony' } }, undefined, { 'X-Panel-Ref': 'RID-777' })).status).toBe(201);
    expect((await call('POST', `/api/study/${p.linkToken}/sessions`, other, undefined, { 'X-Panel-Ref': 'bad id; drop table' })).status).toBe(201);

    const mine = (await call<ViewerSession[]>('GET', `/api/projects/${p.id}/sessions`, undefined, creator.token)).data;
    expect(mine).toHaveLength(2);
    expect(mine.every((x) => !('panel' in x))).toBe(true);
    const audit = (await call<{ sessions: Array<{ id: string; refHash: string; provider: string }> }>('GET', `/api/admin/projects/${p.id}/panel`, undefined, admin.token)).data;
    expect(audit.sessions).toEqual([expect.objectContaining({ id: 'ses_panel0', provider: 'cint', refHash: panelRefHash(SALT, 'cint', 'RID-777') })]);
    expect(readFileSync(join(dir, 'test.sqlite')).includes('RID-777')).toBe(false);

    // Wyłączenie integracji.
    await call('PUT', `/api/admin/projects/${p.id}/panel`, { panel: null }, admin.token);
    expect((await call<{ config: Record<string, unknown> }>('GET', `/api/study/${p.linkToken}`)).data.config).not.toHaveProperty('panel');
  });
});
