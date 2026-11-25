import { mkdirSync } from 'node:fs';
import { createServer } from 'node:http';
import { join, resolve } from 'node:path';
import { BRAND } from '../src/config/brand';
import { isPlanId } from '../src/research/plans';
import { createApp } from './app';
import { Db } from './db';

/**
 * Serwer API (tryb serwerowy, §12–§15). Konfiguracja wyłącznie przez zmienne środowiskowe (README).
 *
 *   node dist-server/main.js                           — start serwera
 *   node dist-server/main.js set-plan <e-mail> <plan>  — ręczna zmiana planu (faktura, Agency, §13.4)
 */
const env = process.env;
const list = (v: string | undefined) =>
  (v ?? '')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);

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

const app = createApp(db, {
  dataDir,
  appUrl,
  origins,
  adminEmails: list(env.ADMIN_EMAILS).map((e) => e.toLowerCase()),
  maxVideoMb: Number(env.MAX_VIDEO_MB ?? 1024),
  maxImageMb: Number(env.MAX_IMAGE_MB ?? 15),
  trustProxy: env.TRUST_PROXY === '1',
  staticDir: env.STATIC_DIR ? resolve(env.STATIC_DIR) : null,
  log: env.NODE_ENV !== 'test',
});

const server = createServer((req, res) => void app.handler(req, res));
server.requestTimeout = 30 * 60_000; // wgrywanie dużych plików wideo
server.headersTimeout = 60_000;

server.listen(port, env.HOST ?? '0.0.0.0', () => {
  console.info(`[${BRAND.code}] API na porcie ${port}; aplikacja: ${appUrl}; dane: ${dataDir}; statyka: ${env.STATIC_DIR ?? 'brak'}`);
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
