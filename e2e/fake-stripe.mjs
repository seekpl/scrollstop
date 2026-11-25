// Atrapa Stripe dla testów E2E (§22.2): API (Checkout, portal klienta, subskrypcje) i dwie strony
// (płatność, portal). Webhooki podpisane jak przez Stripe (HMAC-SHA256 z `t.body`) wysyłamy do
// serwera aplikacji — ten sam kod co na produkcji, tylko inny adres API (`STRIPE_API_BASE`).
import { createHmac } from 'node:crypto';
import { createServer } from 'node:http';

export function startFakeStripe({ port, secret, webhookUrl }) {
  const base = `http://127.0.0.1:${port}`;
  const sessions = new Map();
  const subs = new Map();
  let seq = 0;

  const send = async (type, object) => {
    const body = JSON.stringify({ id: `evt_e2e_${++seq}`, type, data: { object } });
    const t = Math.floor(Date.now() / 1000);
    const v1 = createHmac('sha256', secret).update(`${t}.${body}`).digest('hex');
    const r = await fetch(webhookUrl, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Stripe-Signature': `t=${t},v1=${v1}` }, body });
    if (!r.ok) console.error(`[fake-stripe] webhook ${type}: HTTP ${r.status}`);
  };
  const json = (res, status, body) => {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(body));
  };
  const page = (res, title, body) => {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`<!doctype html><html lang="pl"><meta charset="utf-8"><title>${title}</title><body style="font-family:sans-serif;padding:24px"><h1>${title}</h1>${body}</body></html>`);
  };
  const form = (req) =>
    new Promise((resolve) => {
      let s = '';
      req.on('data', (c) => (s += c));
      req.on('end', () => resolve(new URLSearchParams(s)));
    });
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', base);
    const path = url.pathname;
    let m;
    if (req.method === 'POST' && path === '/v1/checkout/sessions') {
      const f = await form(req);
      const id = `cs_e2e_${++seq}`;
      sessions.set(id, {
        accountId: f.get('client_reference_id'),
        plan: f.get('subscription_data[metadata][plan]'),
        price: f.get('line_items[0][price]'),
        customer: f.get('customer') ?? `cus_e2e_${seq}`,
        successUrl: f.get('success_url'),
        cancelUrl: f.get('cancel_url'),
      });
      return json(res, 200, { id, url: `${base}/pay/${id}` });
    }
    if (req.method === 'POST' && path === '/v1/billing_portal/sessions') {
      const f = await form(req);
      return json(res, 200, { id: `bps_e2e_${++seq}`, url: `${base}/portal/${f.get('customer')}?return=${encodeURIComponent(f.get('return_url') ?? '')}` });
    }
    if (req.method === 'GET' && (m = /^\/v1\/subscriptions\/(.+)$/.exec(path))) {
      const sub = subs.get(m[1]);
      return sub ? json(res, 200, sub) : json(res, 404, { error: { message: 'No such subscription' } });
    }
    if ((m = /^\/pay\/(.+)$/.exec(path))) {
      const s = sessions.get(m[1]);
      if (!s) return json(res, 404, { error: { message: 'No such session' } });
      if (req.method === 'GET') return page(res, 'Płatność testowa', `<p>Plan: ${esc(s.plan)}</p><form method="post"><button>Zapłać</button></form><p><a href="${esc(s.cancelUrl)}">Wróć bez płacenia</a></p>`);
      const id = `sub_e2e_${++seq}`;
      subs.set(id, { id, status: 'active', customer: s.customer, metadata: { account_id: s.accountId, plan: s.plan }, items: { data: [{ price: { id: s.price }, current_period_end: Math.floor(Date.now() / 1000) + 30 * 86400 }] } });
      await send('checkout.session.completed', { id: m[1], mode: 'subscription', subscription: id, customer: s.customer, client_reference_id: s.accountId });
      res.writeHead(303, { Location: s.successUrl });
      return res.end();
    }
    if ((m = /^\/portal\/(.+)$/.exec(path))) {
      const back = url.searchParams.get('return') || '/';
      if (req.method === 'GET') return page(res, 'Portal płatności (test)', `<form method="post"><button>Anuluj subskrypcję</button></form><p><a href="${esc(back)}">Wróć</a></p>`);
      for (const sub of subs.values()) {
        if (sub.customer !== m[1] || sub.status !== 'active') continue;
        sub.status = 'canceled';
        await send('customer.subscription.deleted', { id: sub.id, status: 'canceled' });
      }
      res.writeHead(303, { Location: back });
      return res.end();
    }
    json(res, 404, { error: { message: 'Not found' } });
  });
  server.listen(port, '127.0.0.1');
  return server;
}
