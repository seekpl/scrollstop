import { expect, test } from '@playwright/test';
import { acceptConsent } from './helpers';
import { adminToken, createDemoProject, registerUi, SERVER, setPlan, uniqueEmail } from './serverHelpers';

/**
 * Plany i płatności (§16, M7) w trybie serwerowym: paywall przy limicie → cennik → Stripe Checkout
 * (atrapa z `e2e/fake-stripe.mjs`, prawdziwy podpisany webhook) → plan aktywny → portal i anulowanie.
 * Zamówienie badania z panelem i powrót widza z panelu do dostawcy.
 */
test.use({ baseURL: SERVER });
test.skip(process.env.E2E_SERVER === '0', 'serwer E2E wyłączony (E2E_SERVER=0)');

test('paywall Free → Stripe Checkout → plan Creator, drugi projekt; portal i anulowanie', async ({ page }) => {
  test.setTimeout(120_000);
  await registerUi(page, uniqueEmail('kupujacy'));
  await createDemoProject(page, 'Pierwszy projekt');

  // Free: drugi aktywny projekt → okno limitu z planem Creator.
  await page.goto('/#/app/new');
  await page.getByRole('tab', { name: 'Klip demo' }).click();
  await page.getByRole('button', { name: 'Użyj: Rolka demo B (15 s, 9:16)' }).click();
  await page.getByLabel('Nazwa projektu').fill('Drugi projekt');
  await page.getByRole('button', { name: 'Utwórz projekt' }).click();
  const paywall = page.getByRole('dialog', { name: 'Limit planu' });
  await expect(paywall.getByText('Zamknij jeden z projektów albo przejdź na wyższy plan.')).toBeVisible();
  await paywall.getByRole('link', { name: /^Plan Creator za 79/ }).click();
  await expect(page).toHaveURL(/#\/pricing\?plan=creator$/);

  // Cennik z włączonymi płatnościami: zakup kartą, notka o Stripe zamiast „płatności nie są włączone”.
  await expect(page.getByText('Płatność kartą przez Stripe, z NIP do faktury.', { exact: false })).toBeVisible();
  const creator = page.getByRole('listitem').filter({ has: page.getByRole('heading', { name: 'Creator' }) });
  await creator.getByRole('button', { name: 'Kup plan Creator' }).click();

  // Strona płatności (atrapa Stripe) → webhook do serwera → powrót do konta.
  await expect(page.getByRole('heading', { name: 'Płatność testowa' })).toBeVisible();
  await expect(page.getByText('Plan: creator')).toBeVisible();
  await page.getByRole('button', { name: 'Zapłać' }).click();
  await expect(page).toHaveURL(/#\/app\/account\?payment=ok$/);
  await expect(page.getByText('Dziękujemy, płatność przyjęta. Plan Creator jest aktywny.')).toBeVisible({ timeout: 15_000 });
  const plan = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Plan i wykorzystanie' }) });
  await expect(plan.getByText('Creator', { exact: true })).toBeVisible({ timeout: 15_000 });
  await expect(plan.getByText(/^Odnowienie: /)).toBeVisible();

  // Limit Creator: drugi projekt przechodzi.
  await createDemoProject(page, 'Drugi projekt');

  // Cennik: bieżący plan i zarządzanie subskrypcją zamiast drugiego zakupu.
  await page.goto('/#/pricing');
  await expect(creator.getByText('Twój plan')).toBeVisible();
  await expect(creator.getByRole('button', { name: 'Zarządzaj subskrypcją' })).toBeVisible();
  await expect(page.getByRole('listitem').filter({ has: page.getByRole('heading', { name: 'Pro' }) }).getByRole('button', { name: 'Zmień plan w portalu płatności' })).toBeVisible();

  // Portal klienta → anulowanie → plan Free.
  await page.goto('/#/app/account');
  await page.getByRole('button', { name: 'Płatności i faktury' }).click();
  await expect(page.getByRole('heading', { name: 'Portal płatności (test)' })).toBeVisible();
  await page.getByRole('button', { name: 'Anuluj subskrypcję' }).click();
  await expect(page).toHaveURL(/#\/app\/account$/);
  await expect(plan.getByText('Free', { exact: true })).toBeVisible();
});

test('niezalogowany: zakup prowadzi przez rejestrację z powrotem do cennika', async ({ page }) => {
  await page.goto('/#/pricing');
  const pro = page.getByRole('listitem').filter({ has: page.getByRole('heading', { name: 'Pro' }) });
  await pro.getByRole('link', { name: 'Kup plan Pro' }).click();
  await expect(page).toHaveURL(/#\/register\?next=/);
  await page.getByLabel('Imię i nazwisko').fill('Ola');
  await page.getByLabel('Firma lub kanał').fill('Kanał');
  await page.getByLabel('E-mail służbowy').fill(uniqueEmail('nowy'));
  await page.getByLabel('Hasło').fill('haslo-testowe-123');
  await page.getByRole('button', { name: 'Załóż konto' }).click();
  await expect(page).toHaveURL(/#\/pricing\?plan=pro$/);
  await expect(page.getByRole('listitem').filter({ has: page.getByRole('heading', { name: 'Pro' }) }).getByRole('button', { name: 'Kup plan Pro' })).toBeVisible();
});

test('zamówienie badania z panelem: walidacja, potwierdzenie, zamówienie u operatora', async ({ page, request }) => {
  await page.goto('/#/pricing');
  await page.getByRole('button', { name: 'Zamów badanie z panelem' }).click();
  const dialog = page.getByRole('dialog', { name: 'Zamów badanie z panelem' });
  await dialog.getByRole('button', { name: 'Wyślij zamówienie' }).click();
  await expect(dialog.getByText('Uzupełnij to pole.')).toHaveCount(2);
  const company = `Marka E2E ${Date.now()}`;
  await dialog.getByLabel('Firma lub nazwa kanału').fill(company);
  await dialog.getByLabel('E-mail kontaktowy').fill('zamowienia@example.com');
  await expect(dialog.getByText('Uzupełnij to pole.')).toHaveCount(0);
  await expect(dialog.getByText(/^Od 590\s?zł przy materiale do 60 s/)).toBeVisible();
  await dialog.getByRole('radio', { name: '50' }).click();
  await expect(dialog.getByText(/^Cena w wycenie \(od 590\s?zł za 30 widzów/)).toBeVisible();
  await dialog.getByLabel('25–34 lata').check();
  await dialog.getByLabel('Kraje').fill('pl, de');
  await dialog.getByLabel('Uwagi').fill('Publikacja w piątek');
  await dialog.getByRole('button', { name: 'Wyślij zamówienie' }).click();
  await expect(dialog.getByText('Dziękujemy! Odezwiemy się w ciągu jednego dnia roboczego z terminem i fakturą.')).toBeVisible();

  const token = await adminToken(request);
  const orders = (await (await request.get('/api/admin/orders', { headers: { Authorization: `Bearer ${token}` } })).json()) as Array<{ doc: { company: string; viewers: number; ageBands: string[]; countries: string[] } }>;
  expect(orders.find((o) => o.doc.company === company)?.doc).toMatchObject({ viewers: 50, ageBands: ['25-34'], countries: ['PL', 'DE'] });
});

test('widz z panelu spoza grupy docelowej wraca do dostawcy (screenout z identyfikatorem)', async ({ page, request }) => {
  const email = uniqueEmail('panel');
  const reg = await request.post('/api/auth/register', { data: { email, password: 'haslo-testowe-123', name: 'Marka', company: 'Marka' } });
  const { token } = (await reg.json()) as { token: string };
  await setPlan(request, email, 'pro');
  const project = (await (
    await request.post('/api/projects', {
      headers: { Authorization: `Bearer ${token}` },
      data: { name: 'Panel', creatorName: 'Marka', kind: 'video', platform: 'tiktok', audio: 'off', targetDevice: 'any', variants: [{ media: { kind: 'demo', demo: 'reel_b' }, mediaName: 'Rolka', duration: 15, width: 1080, height: 1920 }], questions: [], audience: { source: 'panel', ageBands: ['18-24'] }, locale: 'pl' },
    })
  ).json()) as { id: string; linkToken: string };
  const admin = await adminToken(request);
  const set = await request.put(`/api/admin/projects/${project.id}/panel`, {
    headers: { Authorization: `Bearer ${admin}` },
    data: { panel: { provider: 'testpanel', completeUrl: 'https://panel.example.test/complete?rid={PID}', screenoutUrl: 'https://panel.example.test/screenout?rid={PID}', qualityFailUrl: 'https://panel.example.test/quality?rid={PID}' } },
  });
  expect(set.status()).toBe(200);

  await page.route('https://panel.example.test/**', (route) => route.fulfill({ contentType: 'text/html', body: '<h1>Dostawca panelu</h1>' }));
  await page.goto(`/#/s/${project.linkToken}?pid=RID-42`);
  await acceptConsent(page, '45-54');
  await page.waitForURL('https://panel.example.test/screenout?rid=RID-42');
  await expect(page.getByRole('heading', { name: 'Dostawca panelu' })).toBeVisible();
});
