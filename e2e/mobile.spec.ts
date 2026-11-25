import { expect, test } from '@playwright/test';
import { DEMO_SPECS, FILLER_IDS } from '../src/demo/demoScene';
import { acceptConsent, downloadSession, expectNoHorizontalScroll, reelStudyLink } from './helpers';

/** Telefon w pionie (iPhone 13, Chromium): badanie rolki 9:16 (§22.2). */
test.describe('widz na telefonie', () => {
  test('zgoda 18+, przygotowanie telefonu i przednia kamera', async ({ page }) => {
    await page.addInitScript(() => {
      const original = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
      navigator.mediaDevices.getUserMedia = (c?: MediaStreamConstraints) => {
        (window as unknown as { __gum: unknown[] }).__gum = [...((window as unknown as { __gum?: unknown[] }).__gum ?? []), c];
        return original(c);
      };
    });
    await page.goto(reelStudyLink());
    await expect(page.getByText('Studio E2E', { exact: true })).toBeVisible();
    await expect(page.getByText(/Dane otrzymuje Studio E2E i są automatycznie usuwane po 90 dniach./)).toBeVisible();
    await expect(page.getByText(/Obraz z kamery nie opuszcza tego urządzenia/)).toBeVisible();
    await expectNoHorizontalScroll(page);
    await acceptConsent(page);
    await expect(page.getByRole('heading', { name: 'Przygotuj telefon' })).toBeVisible();
    await expect(page.getByText('Postaw telefon pionowo')).toBeVisible();
    await expect(page.getByText(/przytrzymaj palec na ekranie/)).toBeVisible();
    await expectNoHorizontalScroll(page);
    await page.getByRole('button', { name: 'Włącz kamerę' }).click();
    await expect(page.getByRole('heading', { name: 'Sprawdźmy kamerę' })).toBeVisible();
    await expect(page.getByText('Podgląd widzisz tylko Ty. Obraz nie jest nagrywany.')).toBeVisible();
    // Sztuczna kamera nie pokazuje twarzy — bez niej nie da się przejść do kalibracji.
    await expect(page.getByText('Nie widzę twarzy: ustaw się przed kamerą')).toBeVisible({ timeout: 60_000 });
    await expect(page.getByRole('button', { name: 'Dalej' })).toBeDisabled();
    await expect.poll(() => page.evaluate(() => JSON.stringify((window as unknown as { __gum?: unknown[] }).__gum ?? []))).toContain('"facingMode":"user"');
  });

  test('poniżej 18 lat badanie się kończy', async ({ page }) => {
    await page.goto(reelStudyLink());
    await page.getByLabel('Twój wiek').selectOption('under18');
    await page.getByLabel('Mam ukończone 18 lat.').check();
    await page.getByLabel(/Zgadzam się na zapisanie/).check();
    await page.getByRole('button', { name: 'Zgadzam się i przechodzę dalej' }).click();
    await expect(page.getByRole('heading', { name: 'To badanie jest dla osób pełnoletnich. Dziękujemy za chęć udziału!' })).toBeVisible();
  });

  test('odmowa dostępu do kamery pokazuje, jak ją włączyć', async ({ page }) => {
    await page.addInitScript(() => {
      navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException('Permission denied', 'NotAllowedError'));
    });
    await page.goto(reelStudyLink());
    await acceptConsent(page);
    await page.getByRole('button', { name: 'Włącz kamerę' }).click();
    await expect(page.getByText('Brak zgody na kamerę. Zezwól na dostęp w ustawieniach przeglądarki i spróbuj ponownie.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Spróbuj ponownie' })).toBeVisible();
  });

  test('rolka na pełnym ekranie bez znacznika, panel pauzy, pytanie i plik sesji', async ({ page }) => {
    await page.goto(`${reelStudyLink()}?sim=1`);
    await expect(page.getByText('Tryb testowy: bez kamery, wzrok symulowany')).toBeVisible();
    await acceptConsent(page);
    const media = page.getByLabel('Materiał', { exact: true });
    await expect(media).toBeVisible();
    const box = await media.boundingBox();
    const vp = page.viewportSize()!;
    expect(box!.width).toBeGreaterThanOrEqual(vp.width - 1);
    expect(box!.height).toBeGreaterThanOrEqual(vp.height - 1);
    await page.waitForTimeout(1200);
    // Widz nie widzi przycisków ani znacznika wzroku.
    await expect(page.getByRole('button')).toHaveCount(0);
    // Przytrzymanie palca przez 1,5 s otwiera panel pauzy.
    await page.mouse.move(vp.width / 2, vp.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(1900);
    await page.mouse.up();
    const panel = page.getByRole('dialog', { name: 'Badanie wstrzymane' });
    await expect(panel).toBeVisible();
    await expect(panel.getByRole('button', { name: 'Zgłoś treść' })).toBeVisible();
    await panel.getByRole('button', { name: 'Wznów' }).click();
    await expect(panel).toBeHidden();
    // Rolka trwa 15 s; po końcu pytanie po obejrzeniu i plik z wynikami do wysłania.
    await expect(page.getByRole('heading', { name: 'Jeszcze jedno pytanie' })).toBeVisible({ timeout: 40_000 });
    await page.getByLabel('Tak', { exact: true }).check();
    await page.getByRole('button', { name: 'Zakończ' }).click();
    await expect(page.getByRole('heading', { name: 'Dziękujemy!' })).toBeVisible();
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Wyślij wyniki do Studio E2E' }).click();
    const file = await download;
    expect(file.suggestedFilename()).toMatch(/^scrollstop-sesja-ses_.+\.json$/);
    const text = await (await file.createReadStream())!.toArray().then((c) => Buffer.concat(c).toString('utf8'));
    const pkg = JSON.parse(text);
    expect(pkg.kind).toBe('attn-session');
    expect(pkg.session.device).toMatchObject({ type: 'mobile', orientation: 'portrait' });
    expect(pkg.session.consent).toMatchObject({ adult: true, processing: true, localOnly: true, lang: 'pl' });
    expect(pkg.session).toMatchObject({ ageBand: '25-34', source: 'simulated', completed: true, answers: { finish: 'yes' } });
    expect(Object.keys(pkg.session.data).sort()).toEqual(['cf', 'it', 'seg', 'st', 'tc', 'un', 'vt', 'vx', 'vy']);
    expect(pkg.session.data.tc.length).toBeGreaterThan(300);
    expect(text).not.toMatch(/data:image|landmark/i);
  });

  test('telefon obrócony poziomo: prośba o pion', async ({ page }) => {
    await page.goto(`${reelStudyLink()}?sim=1`);
    await acceptConsent(page);
    await expect(page.getByLabel('Materiał', { exact: true })).toBeVisible();
    await page.setViewportSize({ width: 844, height: 390 });
    await expect(page.getByText('Obróć telefon pionowo')).toBeVisible();
    await page.setViewportSize({ width: 390, height: 844 });
    await expect(page.getByText('Obróć telefon pionowo')).toBeHidden();
  });

  test('feed na telefonie: przesunięcie w górę i w dół zmienia klip', async ({ page }) => {
    const fillers = FILLER_IDS.map((id) => ({ id, media: { kind: 'demo' as const, demo: id }, duration: DEMO_SPECS[id].duration, width: 1080, height: 1920 }));
    await page.goto(`${reelStudyLink({ kind: 'feed', context: 'feed', platformUi: 'generic', fillers, feed: { items: 4, stopSeconds: 2, capSeconds: 60 }, questions: [] })}?sim=1`);
    await acceptConsent(page);
    await expect(page.getByText('Przesuń w górę, aby zobaczyć następny klip. Dotknij, aby zatrzymać.')).toBeVisible();
    await page.getByRole('button', { name: 'Zaczynam' }).click();
    const vp = page.viewportSize()!;
    const swipe = async (from: number, to: number) => {
      await page.mouse.move(vp.width / 2, from);
      await page.mouse.down();
      await page.mouse.move(vp.width / 2, (from + to) / 2, { steps: 4 });
      await page.mouse.move(vp.width / 2, to, { steps: 4 });
      await page.mouse.up();
    };
    await expect(page.getByLabel('Klip 1 z 4')).toBeVisible();
    await page.waitForTimeout(500);
    await swipe(vp.height * 0.75, vp.height * 0.3);
    await expect(page.getByLabel('Klip 2 z 4')).toBeVisible();
    await page.waitForTimeout(500);
    await swipe(vp.height * 0.3, vp.height * 0.75);
    await expect(page.getByLabel('Klip 1 z 4')).toBeVisible();
    for (const k of [2, 3, 4]) {
      await page.waitForTimeout(450);
      await swipe(vp.height * 0.75, vp.height * 0.3);
      await expect(page.getByLabel(`Klip ${k} z 4`)).toBeVisible();
    }
    await page.waitForTimeout(450);
    await swipe(vp.height * 0.75, vp.height * 0.3);
    await expect(page.getByRole('heading', { name: 'Dziękujemy!' })).toBeVisible();
    const pkg = await downloadSession(page);
    const items = pkg.session.items!;
    expect(items.map((x) => x.exitType)).toEqual(['swipe_next', 'swipe_prev', 'swipe_next', 'swipe_next', 'swipe_next', 'swipe_next']);
    expect(items.map((x) => x.index)).toEqual([0, 1, 0, 1, 2, 3]);
  });
});
