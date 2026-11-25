import { mkdirSync } from 'node:fs';
import { createServer } from 'node:http';
import { join, resolve } from 'node:path';
import { BRAND } from '../src/config/brand';
import { isPlanId } from '../src/research/plans';
import { createClaudeGenerator, DEFAULT_AI_MODEL } from './ai';
import { createApp, panelRefHash } from './app';
import { Stripe, stripeConfigFromEnv } from './billing';
import { Db } from './db';

/**
 * Serwer API (tryb serwerowy, §12–§15). Konfiguracja wyłącznie przez zmienne środowiskowe (README).
 *
 *   node dist-server/main.js                           — start serwera
 *   node dist-server/main.js set-plan <e-mail> <plan>  — ręczna zmiana planu (faktura, Agency, §13.4)
 *   node dist-server/main.js panel-hash <dostawca> <id…> — skróty identyfikatorów uczestników panelu
 *                                                         (porównanie z listą od dostawcy, §16.5)
 */
const env = process.env;
const list = (v: string | undefined) =>
  (v ?? '')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);

if (process.argv[2] === 'panel-hash') {
  const [provider, ...ids] = process.argv.slice(3);
  if (!env.PANEL_SALT || !provider || !ids.length) {
    console.error('Użycie: PANEL_SALT=… panel-hash <dostawca> <id> [id…]');
    process.exit(1);
  }
  for (const id of ids) console.info(`${id}\t${panelRefHash(env.PANEL_SALT, provider, id)}`);
  process.exit(0);
}

const dataDir = resolve(env.DATA_DIR ?? './data');
mkdirSync(dataDir, { recursive: true });
const db = new Db(join(dataDir, `${BRAND.code}.sqlite`));

if (process.argv[2] === 'set-plan') {
  const [email, plan] = process.argv.slice(3);
  const row = email ? db.accountByEmail(email) : undefined;
  if (!row || !isPlanId(plan)) {
    console.error('Użycie: set-plan <e-mail> <free|creator|pro|agency>');
    process.exit(1);
  }
  db.updateAccount(row.id, { plan, plan_status: plan === 'free' ? 'none' : 'active' });
  console.info(`Plan konta ${email}: ${plan}`);
  db.close();
  process.exit(0);
}

const port = Number(env.PORT ?? 8787);
const appUrl = env.APP_URL ?? `http://localhost:${port}/`;
const origins = list(env.APP_ORIGINS).length ? list(env.APP_ORIGINS) : [new URL(appUrl).origin];
const stripeConfig = stripeConfigFromEnv(env);
if (!env.PANEL_SALT) console.warn(`[${BRAND.code}] brak PANEL_SALT — identyfikatory uczestników panelu nie będą zapisywane`);

const app = createApp(db, {
  dataDir,
  appUrl,
  origins,
  adminEmails: list(env.ADMIN_EMAILS).map((e) => e.toLowerCase()),
  maxVideoMb: Number(env.MAX_VIDEO_MB ?? 1024),
  maxImageMb: Number(env.MAX_IMAGE_MB ?? 15),
  trustProxy: env.TRUST_PROXY === '1',
  staticDir: env.STATIC_DIR ? resolve(env.STATIC_DIR) : null,
  stripe: stripeConfig ? new Stripe(stripeConfig) : null,
  panelSalt: env.PANEL_SALT || null,
  ai: env.ANTHROPIC_API_KEY ? createClaudeGenerator({ apiKey: env.ANTHROPIC_API_KEY, model: env.AI_MODEL || DEFAULT_AI_MODEL }) : null,
  log: env.NODE_ENV !== 'test',
});

const server = createServer((req, res) => void app.handler(req, res));
server.requestTimeout = 30 * 60_000; // wgrywanie dużych plików wideo
server.headersTimeout = 60_000;

server.listen(port, env.HOST ?? '0.0.0.0', () => {
  console.info(`[${BRAND.code}] API na porcie ${port}; aplikacja: ${appUrl}; dane: ${dataDir}; statyka: ${env.STATIC_DIR ?? 'brak'}; płatności: ${stripeConfig ? 'Stripe' : 'e-mail'}; AI: ${env.ANTHROPIC_API_KEY ? env.AI_MODEL || DEFAULT_AI_MODEL : 'reguły'}`);
});

const purge = () => {
  const n = app.purge();
  if (n) console.info(`[${BRAND.code}] usunięto ${n} sesji po okresie przechowywania`);
};
purge();
const timer = setInterval(purge, 60 * 60_000);

const shutdown = () => {
  clearInterval(timer);
  server.close(() => {
    db.close();
    process.exit(0);
  });
  setTimeout(() => process.exit(0), 5000).unref();
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
