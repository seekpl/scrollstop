// Tryb serwerowy do testów E2E (§22.2): buduje aplikację z VITE_API_URL=/ i serwer, potem uruchamia
// API z pustą bazą w katalogu tymczasowym. Konto administratora (plan testów) z ADMIN_EMAILS.
// Płatności: atrapa Stripe na porcie 4175 (API, strony płatności i portalu, podpisane webhooki).
import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startFakeStripe } from './fake-stripe.mjs';

const run = (args, env = {}) => {
  const r = spawnSync('npx', args, { stdio: 'inherit', env: { ...process.env, ...env } });
  if (r.status !== 0) process.exit(r.status ?? 1);
};
run(['vite', 'build', '--outDir', 'dist-e2e/server', '--emptyOutDir'], { VITE_API_URL: '/' });
run(['vite', 'build', '--config', 'vite.server.config.ts', '--outDir', 'dist-e2e/api', '--emptyOutDir']);

const WEBHOOK_SECRET = 'whsec_e2e_test';
const stripe = startFakeStripe({ port: 4175, secret: WEBHOOK_SECRET, webhookUrl: 'http://127.0.0.1:4174/api/billing/webhook' });

const child = spawn(process.execPath, ['dist-e2e/api/main.js'], {
  stdio: 'inherit',
  env: {
    ...process.env,
    PORT: '4174',
    HOST: '127.0.0.1',
    DATA_DIR: mkdtempSync(join(tmpdir(), 'attn-e2e-')),
    STATIC_DIR: 'dist-e2e/server',
    APP_URL: 'http://127.0.0.1:4174/',
    ADMIN_EMAILS: 'admin@e2e.test',
    MAX_VIDEO_MB: '5',
    STRIPE_SECRET_KEY: 'sk_test_e2e',
    STRIPE_WEBHOOK_SECRET: WEBHOOK_SECRET,
    STRIPE_PRICE_CREATOR_MONTHLY: 'price_creator_m',
    STRIPE_PRICE_CREATOR_YEARLY: 'price_creator_y',
    STRIPE_PRICE_PRO_MONTHLY: 'price_pro_m',
    STRIPE_PRICE_PRO_YEARLY: 'price_pro_y',
    STRIPE_API_BASE: 'http://127.0.0.1:4175/v1',
    PANEL_SALT: 'e2e-panel-salt',
    NODE_ENV: 'test',
    NODE_NO_WARNINGS: '1',
  },
});
const stop = () => {
  stripe.close();
  child.kill('SIGTERM');
};
process.on('SIGTERM', stop);
process.on('SIGINT', stop);
child.on('exit', (code) => {
  stripe.close();
  process.exit(code ?? 0);
});
