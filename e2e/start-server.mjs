// Tryb serwerowy do testów E2E (§22.2): buduje aplikację z VITE_API_URL=/ i serwer, potem uruchamia
// API z pustą bazą w katalogu tymczasowym. Konto administratora (plan testów) z ADMIN_EMAILS.
import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const run = (args, env = {}) => {
  const r = spawnSync('npx', args, { stdio: 'inherit', env: { ...process.env, ...env } });
  if (r.status !== 0) process.exit(r.status ?? 1);
};
run(['vite', 'build', '--outDir', 'dist-e2e/server', '--emptyOutDir'], { VITE_API_URL: '/' });
run(['vite', 'build', '--config', 'vite.server.config.ts', '--outDir', 'dist-e2e/api', '--emptyOutDir']);

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
    NODE_ENV: 'test',
    NODE_NO_WARNINGS: '1',
  },
});
const stop = () => child.kill('SIGTERM');
process.on('SIGTERM', stop);
process.on('SIGINT', stop);
child.on('exit', (code) => process.exit(code ?? 0));
