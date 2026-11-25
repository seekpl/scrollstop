import { expect, type APIRequestContext, type Page } from '@playwright/test';

/** Wspólne kroki testów trybu serwerowego (serwer E2E z `e2e/start-server.mjs`, port 4174). */
export const SERVER = 'http://127.0.0.1:4174';

export const PASSWORD = 'haslo-testowe-123';
let seq = 0;
export const uniqueEmail = (tag: string) => `${tag}-${Date.now()}-${++seq}@example.com`;

/** Plan ustawiany przez administratora (ADMIN_EMAILS w serwerze testowym). */
export async function setPlan(request: APIRequestContext, email: string, plan: 'free' | 'creator' | 'pro' | 'agency') {
  const token = await adminToken(request);
  const r = await request.post('/api/admin/plan', { headers: { Authorization: `Bearer ${token}` }, data: { email, plan } });
  expect(r.status()).toBe(200);
}

export async function registerUi(page: Page, email: string, name = 'Ala Twórczyni', company = 'Studio E2E') {
  await page.goto('/#/register');
  await page.getByLabel('Imię i nazwisko').fill(name);
  await page.getByLabel('Firma lub kanał').fill(company);
  await page.getByLabel('E-mail służbowy').fill(email);
  await page.getByLabel('Hasło').fill(PASSWORD);
  await page.getByRole('button', { name: 'Załóż konto' }).click();
  await expect(page).toHaveURL(/#\/app$/);
}

export async function createDemoProject(page: Page, name: string): Promise<string> {
  await page.goto('/#/app/new');
  await page.getByRole('tab', { name: 'Klip demo' }).click();
  await page.getByRole('button', { name: 'Użyj: Rolka demo B (15 s, 9:16)' }).click();
  await page.getByLabel('Nazwa projektu').fill(name);
  await page.getByLabel('Nazwa twórcy').fill('Studio E2E');
  await page.getByRole('button', { name: 'Utwórz projekt' }).click();
  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible();
  return new URL(page.url()).hash;
}

let admin: string | null = null;

/**
 * Token administratora (ADMIN_EMAILS serwera testowego), jeden na proces testów — logowanie ma
 * limit prób na adres IP, a wszystkie testy łączą się z 127.0.0.1.
 */
export async function adminToken(request: APIRequestContext): Promise<string> {
  if (admin) return admin;
  await request.post('/api/auth/register', { data: { email: 'admin@e2e.test', password: 'haslo-admina-123' } });
  const login = await request.post('/api/auth/login', { data: { email: 'admin@e2e.test', password: 'haslo-admina-123' } });
  expect(login.status(), 'logowanie administratora').toBe(200);
  admin = ((await login.json()) as { token: string }).token;
  return admin;
}
