import { devices, expect, test, type APIRequestContext, type Page } from '@playwright/test';
import { acceptConsent, expectNoHorizontalScroll, PHONE_WIDTHS } from './helpers';

/**
 * Tryb serwerowy (§22.2): konto, link do badania, sesja z telefonu, usunięcie kodem, link do raportu,
 * zespół i wgrywanie materiału. Serwer z pustą bazą startuje z `e2e/start-server.mjs` (port 4174).
 */
const SERVER = 'http://127.0.0.1:4174';
test.use({ baseURL: SERVER });
test.skip(process.env.E2E_SERVER === '0', 'serwer E2E wyłączony (E2E_SERVER=0)');

const PASSWORD = 'haslo-testowe-123';
let seq = 0;
const uniqueEmail = (tag: string) => `${tag}-${Date.now()}-${++seq}@example.com`;

/** Plan ustawiany przez administratora (ADMIN_EMAILS w serwerze testowym). */
async function setPlan(request: APIRequestContext, email: string, plan: 'free' | 'creator' | 'pro' | 'agency') {
  await request.post('/api/auth/register', { data: { email: 'admin@e2e.test', password: 'haslo-admina-123' } });
  const login = await request.post('/api/auth/login', { data: { email: 'admin@e2e.test', password: 'haslo-admina-123' } });
  const { token } = (await login.json()) as { token: string };
  const r = await request.post('/api/admin/plan', { headers: { Authorization: `Bearer ${token}` }, data: { email, plan } });
  expect(r.status()).toBe(200);
}

async function registerUi(page: Page, email: string, name = 'Ala Twórczyni', company = 'Studio E2E') {
  await page.goto('/#/register');
  await page.getByLabel('Imię i nazwisko').fill(name);
  await page.getByLabel('Firma lub kanał').fill(company);
  await page.getByLabel('E-mail służbowy').fill(email);
  await page.getByLabel('Hasło').fill(PASSWORD);
  await page.getByRole('button', { name: 'Załóż konto' }).click();
  await expect(page).toHaveURL(/#\/app$/);
}

async function createDemoProject(page: Page, name: string): Promise<string> {
  await page.goto('/#/app/new');
  await page.getByRole('tab', { name: 'Klip demo' }).click();
  await page.getByRole('button', { name: 'Użyj: Rolka demo B (15 s, 9:16)' }).click();
  await page.getByLabel('Nazwa projektu').fill(name);
  await page.getByLabel('Nazwa twórcy').fill('Studio E2E');
  await page.getByRole('button', { name: 'Utwórz projekt' }).click();
  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible();
  return new URL(page.url()).hash;
}

test('konto, link do badania, sesja z telefonu, usunięcie kodem i link do raportu', async ({ page, browser, request }) => {
  test.setTimeout(150_000);
  // Studio bez logowania przekierowuje do logowania z powrotem.
  await page.goto('/#/app');
  await expect(page).toHaveURL(/#\/login\?next=/);
  const email = uniqueEmail('tworca');
  await registerUi(page, email);
  await expect(page.getByText('Pierwszy projekt zajmuje 2 minuty')).toBeVisible();
  await setPlan(request, email, 'pro');
  await page.reload();
  await expect(page.getByRole('link', { name: 'Plan Pro' })).toBeVisible();

  const prepare = await createDemoProject(page, 'Rolka na serwerze');
  const link = await page.getByLabel('Link dla widzów', { exact: true }).inputValue();
  expect(link).toMatch(/^http:\/\/127\.0\.0\.1:4174\/#\/s\/[A-Za-z0-9_-]+$/);
  await expect(page.getByRole('img', { name: 'Kod QR z linkiem do badania' })).toBeVisible();

  // Widz na telefonie: osobna przeglądarka, bez konta, wzrok symulowany.
  const phone = await browser.newContext({ ...devices['iPhone 13'], serviceWorkers: 'block', locale: 'pl-PL' });
  const p = await phone.newPage();
  await p.goto(`${link}?sim=1`);
  await acceptConsent(p);
  await expect(p.getByRole('heading', { name: 'Jeszcze jedno pytanie' })).toBeVisible({ timeout: 40_000 });
  await p.getByLabel('Tak', { exact: true }).check();
  await p.getByRole('button', { name: 'Zakończ' }).click();
  await expect(p.getByRole('heading', { name: 'Dziękujemy!' })).toBeVisible();
  const code = (await p.getByTestId('deletion-code').textContent())!.trim();
  expect(code).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/);

  // Twórca widzi sesję (symulacja) w kroku „Zbierz widzów”.
  const collect = `/${prepare.replace(/prepare$/, 'collect')}`;
  await page.goto(collect);
  await expect(page.getByRole('table').getByText('Symulacja')).toBeVisible();

  // Link do raportu dla klienta: tylko odczyt, dane zbiorcze.
  await page.goto(`/${prepare.replace(/prepare$/, 'report')}`);
  await page.getByRole('button', { name: 'Utwórz link' }).click();
  const shareUrl = await page.getByLabel('Link do raportu', { exact: true }).inputValue();
  expect(shareUrl).toMatch(/#\/r\/[A-Za-z0-9_-]+$/);
  const client = await browser.newContext({ serviceWorkers: 'block', locale: 'pl-PL' });
  const c = await client.newPage();
  await c.goto(shareUrl);
  await expect(c.getByRole('heading', { level: 1, name: 'Rolka na serwerze' })).toBeVisible();
  await expect(c.getByText(/^Raport udostępniony przez: Studio E2E/)).toBeVisible();
  await expectNoHorizontalScroll(c);

  // Widz usuwa swoje dane kodem — sesja znika z projektu.
  await p.getByRole('link', { name: 'Usuń swoje dane' }).click();
  await p.getByLabel('Kod usunięcia').fill(code);
  await p.getByRole('button', { name: 'Usuń sesję' }).click();
  await expect(p.getByText('Sesja została usunięta. Dane tej sesji zniknęły z badania i z raportu.')).toBeVisible();
  await page.goto(collect);
  await expect(page.getByText('Nikt jeszcze nie wziął udziału')).toBeVisible();

  // Wyłączony link do raportu przestaje działać.
  await page.goto(`/${prepare.replace(/prepare$/, 'report')}`);
  await page.getByRole('button', { name: 'Wyłącz link' }).click();
  await c.reload();
  await expect(c.getByText('Link do raportu wygasł albo został wyłączony. Poproś autora o nowy link.')).toBeVisible();
  await phone.close();
  await client.close();
});

test('zespół: zaproszenie edytora, wspólne projekty i wgrywanie materiału z Range', async ({ page, browser, request }) => {
  test.setTimeout(120_000);
  const owner = uniqueEmail('wlasciciel');
  await registerUi(page, owner, 'Ola Właścicielka', 'Marka E2E');
  await setPlan(request, owner, 'pro');
  await page.goto('/#/app/workspace');
  await expect(page.getByRole('heading', { level: 1, name: 'Zespół' })).toBeVisible();
  await expect(page.getByText('Miejsca: 1 z 3')).toBeVisible();
  await page.getByRole('button', { name: 'Utwórz link zaproszenia' }).click();
  const invite = await page.getByLabel(/^Link zaproszenia/).inputValue();
  expect(invite).toMatch(/#\/invite\/[A-Za-z0-9_-]+$/);

  // Edytor: zaproszenie → rejestracja → powrót do zaproszenia → dołączenie.
  const other = await browser.newContext({ serviceWorkers: 'block', locale: 'pl-PL' });
  const e = await other.newPage();
  await e.goto(invite);
  await expect(e.getByText('Zespół „Marka E2E” zaprasza Cię jako: Edytor.')).toBeVisible();
  await e.getByRole('link', { name: 'Załóż konto' }).click();
  await e.getByLabel('Imię i nazwisko').fill('Edek Edytor');
  await e.getByLabel('E-mail służbowy').fill(uniqueEmail('edytor'));
  await e.getByLabel('Hasło').fill(PASSWORD);
  await e.getByRole('button', { name: 'Załóż konto' }).click();
  await expect(e).toHaveURL(/#\/invite\//);
  await e.getByRole('button', { name: 'Dołącz do zespołu' }).click();
  await expect(e).toHaveURL(/#\/app$/);
  await expect(e.getByRole('link', { name: 'Plan Pro' })).toBeVisible();

  // Edytor wgrywa plik (MP4) — projekt w zespole właściciela, materiał na serwerze.
  await e.goto('/#/app/new');
  await e.getByLabel(/Wybierz plik wideo/).setInputFiles({ name: 'rolka.mp4', mimeType: 'video/mp4', buffer: Buffer.alloc(64 * 1024, 7) });
  await e.getByLabel('Nazwa projektu').fill('Rolka z pliku');
  await e.getByLabel('Nazwa twórcy').fill('Marka E2E');
  await e.getByRole('button', { name: 'Utwórz projekt' }).click();
  await expect(e.getByRole('heading', { level: 1, name: 'Rolka z pliku' })).toBeVisible();
  await expect(e.getByText(/rolka\.mp4 · plik na serwerze/)).toBeVisible();
  const token = await e.evaluate(() => localStorage.getItem('attn-token'));
  const projectId = new URL(e.url()).hash.split('/')[3];
  const project = (await (await request.get(`/api/projects/${projectId}`, { headers: { Authorization: `Bearer ${token}` } })).json()) as { variants: Array<{ media: { url: string } }> };
  const range = await request.get(project.variants[0].media.url, { headers: { Range: 'bytes=0-99' } });
  expect(range.status()).toBe(206);
  expect(range.headers()['content-range']).toBe(`bytes 0-99/${64 * 1024}`);

  // Właściciel widzi projekt edytora i dwóch członków.
  await page.goto('/#/app');
  await expect(page.getByText('Rolka z pliku')).toBeVisible();
  await page.goto('/#/app/workspace');
  await expect(page.getByText('Miejsca: 2 z 3')).toBeVisible();
  await other.close();
});

test('ekrany trybu serwerowego bez poziomego przewijania przy 320–390 px (pl i en)', async ({ page, request }) => {
  test.setTimeout(150_000);
  const email = uniqueEmail('waski');
  await registerUi(page, email, 'Bardzo Długie Imię i Nazwisko Twórczyni', 'Kanał o bardzo długiej nazwie do testu');
  await setPlan(request, email, 'pro');
  await page.reload();
  await expect(page.getByRole('link', { name: 'Plan Pro' })).toBeVisible();
  const prepare = await createDemoProject(page, 'Projekt o długiej nazwie na wąski ekran telefonu');
  await page.goto(`/${prepare.replace(/prepare$/, 'report')}`);
  await page.getByRole('button', { name: 'Utwórz link' }).click();
  const shareUrl = await page.getByLabel('Link do raportu', { exact: true }).inputValue();
  const shared = new URL(shareUrl).hash;
  await page.goto('/#/app/workspace');
  await page.getByRole('button', { name: 'Utwórz link zaproszenia' }).click();
  const invite = new URL(await page.getByLabel(/^Link zaproszenia/).inputValue()).hash;
  for (const lang of ['pl', 'en']) {
    for (const width of PHONE_WIDTHS) {
      await page.setViewportSize({ width, height: 800 });
      for (const path of [`/${prepare}`, `/${prepare.replace(/prepare$/, 'report')}`, '/#/app/workspace', '/#/app/account', `/${shared}`, `/${invite}`]) {
        await page.goto(`${path}?lang=${lang}`);
        await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible();
        await page.waitForTimeout(120);
        await expectNoHorizontalScroll(page);
      }
    }
  }
  // Strony logowania i rejestracji bez konta.
  await page.evaluate(() => localStorage.removeItem('attn-token'));
  for (const width of PHONE_WIDTHS) {
    await page.setViewportSize({ width, height: 800 });
    for (const path of ['/#/login', '/#/register']) {
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await expectNoHorizontalScroll(page);
    }
  }
});

test('feed z kreatora (Pro): klipy demo jako wypełniacze, widz przewija na telefonie', async ({ page, browser, request }) => {
  test.setTimeout(150_000);
  const email = uniqueEmail('feed');
  await registerUi(page, email);
  await setPlan(request, email, 'pro');
  await page.reload();
  await expect(page.getByRole('link', { name: 'Plan Pro' })).toBeVisible();
  await page.goto('/#/app/new');
  await page.getByRole('radio', { name: /Test w feedzie/ }).click();
  await expect(page.getByRole('tab', { name: 'YouTube' })).toHaveCount(0);
  await page.getByRole('tab', { name: 'Klip demo' }).click();
  await page.getByRole('button', { name: 'Użyj: Rolka demo B (15 s, 9:16)' }).click();
  await expect(page.getByText(/^Domyślnie 5 klipów demo/)).toBeVisible();
  await page.getByLabel('Podpis pod klipem').fill('Trzy rzeczy przed publikacją');
  await page.getByLabel('Nazwa projektu').fill('Rolka w feedzie');
  await page.getByLabel('Nazwa twórcy').fill('Studio E2E');
  await page.getByRole('button', { name: 'Utwórz projekt' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Rolka w feedzie' })).toBeVisible();
  const link = await page.getByLabel('Link dla widzów', { exact: true }).inputValue();
  const collect = `/${new URL(page.url()).hash.replace(/prepare$/, 'collect')}`;

  const phone = await browser.newContext({ ...devices['iPhone 13'], serviceWorkers: 'block', locale: 'pl-PL' });
  const p = await phone.newPage();
  await p.goto(`${link}?sim=1`);
  await acceptConsent(p);
  await p.getByRole('button', { name: 'Zaczynam' }).click();
  await expect(p.getByText('@studio_e2e').or(p.getByText('@kadr.dnia')).first()).toBeVisible();
  const vp = p.viewportSize()!;
  for (let k = 1; k <= 6; k++) {
    await expect(p.getByLabel(`Klip ${k} z 6`)).toBeVisible();
    await p.waitForTimeout(500);
    await p.mouse.move(vp.width / 2, vp.height * 0.75);
    await p.mouse.down();
    await p.mouse.move(vp.width / 2, vp.height * 0.5, { steps: 4 });
    await p.mouse.move(vp.width / 2, vp.height * 0.3, { steps: 4 });
    await p.mouse.up();
  }
  await expect(p.getByRole('heading', { name: 'Dziękujemy!' })).toBeVisible();
  await page.goto(collect);
  await expect(page.getByRole('table').getByText('Symulacja')).toBeVisible();
  await phone.close();
});
