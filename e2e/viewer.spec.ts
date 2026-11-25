import { expect, test } from '@playwright/test';
import { acceptConsent, expectNoHorizontalScroll, reelStudyLink } from './helpers';

test.describe('widz na komputerze', () => {
  test('rolka 9:16 na komputerze: prośba o telefon i „Kontynuuj na tym komputerze”', async ({ page }) => {
    await page.goto(reelStudyLink());
    await expect(page.getByRole('heading', { name: 'To badanie jest przygotowane na telefon' })).toBeVisible();
    await page.getByRole('button', { name: 'Kontynuuj na tym komputerze' }).click();
    await acceptConsent(page);
    await expect(page.getByRole('heading', { name: 'Przygotuj się do oglądania' })).toBeVisible();
    await expect(page.getByText(/naciśnij Esc/)).toBeVisible();
    await page.getByRole('button', { name: 'Włącz kamerę' }).click();
    // MediaPipe na sztucznej kamerze: kamera działa, ale twarzy nie ma.
    await expect(page.getByText('Nie widzę twarzy: ustaw się przed kamerą')).toBeVisible({ timeout: 60_000 });
  });

  test('film 16:9 z dźwiękiem: pytania przesiewowe, test dźwięku, Esc otwiera panel, przerwanie bez wysyłki', async ({ page }) => {
    await page.goto(
      `${reelStudyLink({ targetDevice: 'desktop', audio: 'on', screenPlatforms: true, questions: [], variant: { id: 'A', media: { kind: 'demo', demo: 'video' }, mediaName: 'Film demo', duration: 60, width: 1920, height: 1080 } })}?sim=1`,
    );
    await acceptConsent(page, '35-44');
    await expect(page.getByRole('heading', { name: 'Kilka pytań o Ciebie' })).toBeVisible();
    await page.getByLabel('Kraj').selectOption('PL');
    for (const group of ['TikToka', 'Reels na Instagramie', 'Shorts na YouTube', 'filmy na YouTube']) await page.getByRole('group', { name: `Jak często oglądasz ${group}?` }).getByLabel('Co tydzień').check();
    await page.getByRole('button', { name: 'Dalej' }).click();
    await expect(page.getByRole('heading', { name: 'Sprawdźmy dźwięk' })).toBeVisible();
    await page.getByRole('button', { name: 'Odtwórz dźwięk testowy' }).click();
    await page.getByRole('button', { name: 'Nie słyszę' }).click();
    await page.getByRole('button', { name: 'Nie słyszę' }).click();
    await page.getByRole('button', { name: 'Kontynuuj bez dźwięku' }).click();
    await expect(page.getByLabel('Materiał', { exact: true })).toBeVisible();
    await page.waitForTimeout(1500);
    await page.keyboard.press('Escape');
    await page.getByRole('dialog', { name: 'Badanie wstrzymane' }).getByRole('button', { name: 'Zakończ badanie' }).click();
    await expect(page.getByRole('heading', { name: 'Badanie przerwane' })).toBeVisible();
    await page.getByRole('button', { name: 'Nie wysyłaj' }).click();
    await expect(page.getByText('Nic nie zostało wysłane.')).toBeVisible();
  });

  test('uszkodzony link i materiał tylko na komputerze twórcy', async ({ page }) => {
    await page.goto('/#/p/to-nie-jest-link');
    await expect(page.getByRole('heading', { name: 'Link do badania jest uszkodzony. Poproś twórcę o nowy link.' })).toBeVisible();
    await page.goto(reelStudyLink({ variant: { id: 'A', media: { kind: 'local', fileName: 'x.mp4', fileSize: 10 }, mediaName: 'x.mp4', duration: 10, width: 1080, height: 1920 } }));
    await expect(page.getByRole('heading', { name: 'Ten materiał jest dostępny tylko na komputerze twórcy.' })).toBeVisible();
  });

  test('usuwanie danych kodem: zły kod', async ({ page }) => {
    await page.goto('/#/delete/ses_nieistniejaca');
    await expect(page.getByRole('heading', { name: 'Usuń swoje dane' })).toBeVisible();
    await page.getByLabel('Kod usunięcia').fill('K7QM-4XPA');
    await page.getByRole('button', { name: 'Usuń sesję' }).click();
    await expect(page.getByText('Numer sesji lub kod usunięcia się nie zgadzają. Sprawdź oba pola.')).toBeVisible();
    await expectNoHorizontalScroll(page);
  });
});
