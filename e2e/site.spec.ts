import { expect, test } from '@playwright/test';
import { expectNoHorizontalScroll } from './helpers';

test.describe('strona publiczna', () => {
  test('strona główna po polsku: żywa krzywa z danych, przyciski, operator w stopce', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto('/');
    await expect(page).toHaveTitle(/^ScrollStop/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('W której sekundzie widzowie przestają patrzeć na Twoją rolkę?');
    await expect(page.getByRole('link', { name: 'Przetestuj rolkę za darmo' }).first()).toHaveAttribute('href', '#/app/new');
    await expect(page.getByText('Przykład: krzywa uwagi rolki demo, symulowany panel 31 widzów')).toBeVisible();
    await expect(page.getByRole('img', { name: /Pionowy klip demo/ })).toBeVisible();
    // Klip i krzywa się animują: etykieta „Patrzy …” zmienia się w czasie (bez reduced motion).
    const label = page.getByText(/^Patrzy \d+\s?%$/);
    const first = await label.textContent();
    await expect.poll(async () => label.textContent(), { timeout: 8_000 }).not.toBe(first);
    await expect(page.getByRole('link', { name: /^Kontakt: / })).toHaveAttribute('href', /^mailto:/);
    await expect(page.getByText(/Serwis prowadzi Sebastian Biel, .*NIP 8681879901\./)).toBeVisible();
    await expectNoHorizontalScroll(page);
    expect(errors).toEqual([]);
  });

  test('strona po angielsku z ?lang=en', async ({ page }) => {
    await page.goto('/?lang=en');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('At which second do viewers stop watching your reel?');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.getByText('Example: attention curve of a demo reel, simulated panel of 31 viewers')).toBeVisible();
  });

  test('cennik w walucie języka z działającymi przyciskami zamówienia', async ({ page }) => {
    await page.goto('/#/pricing');
    const creator = page.getByRole('listitem').filter({ has: page.getByRole('heading', { name: 'Creator' }) });
    await expect(creator.getByText(/^79\s?zł$/)).toBeVisible();
    await expect(creator.getByRole('link', { name: 'Zamów plan Creator' })).toHaveAttribute('href', /^mailto:.+\?subject=Zam%C3%B3wienie%20planu%20Creator/);
    await expect(page.getByText('Płatności online nie są jeszcze włączone.', { exact: false })).toBeVisible();
    await expect(page.getByText('wkrótce').first()).toBeVisible();
    await expectNoHorizontalScroll(page);
    // Badanie z panelem bez serwera: formularz → e-mail z podsumowaniem (§16.5).
    await page.getByRole('button', { name: 'Zamów badanie z panelem' }).click();
    const dialog = page.getByRole('dialog', { name: 'Zamów badanie z panelem' });
    await expect(dialog.getByText(/^Od 590\s?zł przy materiale do 60 s/)).toBeVisible();
    await expectNoHorizontalScroll(page);
    await dialog.getByLabel('Firma lub nazwa kanału').fill('Marka');
    await dialog.getByLabel('E-mail kontaktowy').fill('kontakt@marka.pl');
    await dialog.getByRole('button', { name: 'Przygotuj e-mail z zamówieniem' }).click();
    await expect(dialog.getByText(/^Otworzyliśmy wiadomość e-mail z podsumowaniem/)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await page.goto('/?lang=en#/pricing');
    const pro = page.getByRole('listitem').filter({ has: page.getByRole('heading', { name: 'Pro' }) });
    await expect(pro.getByText('$49')).toBeVisible();
    await page.getByRole('radio', { name: 'EUR' }).click();
    await expect(pro.getByText('€49')).toBeVisible();
  });

  test('prywatność z danymi operatora', async ({ page }) => {
    await page.goto('/#/privacy');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Prywatność i zasady etyczne');
    await expect(page.getByText('Operator: Sebastian Biel, Wąska 5, 32-765 Rzezawa, NIP 8681879901.')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Co zapisujemy' })).toBeVisible();
    await expectNoHorizontalScroll(page);
  });

  test('przykładowe raporty: rolka A/B i film', async ({ page }) => {
    await page.goto('/#/sample/reel');
    await expect(page.getByText('Przykładowy raport z symulowanego panelu')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Porównanie wersji A/B' })).toBeVisible();
    await expectNoHorizontalScroll(page);
    await page.getByRole('link', { name: 'Film na YouTube' }).click();
    await expect(page.getByRole('link', { name: 'Film na YouTube' })).toHaveAttribute('aria-current', 'page');
    await expect(page.getByText('Przykładowy raport z symulowanego panelu')).toBeVisible();
    await expectNoHorizontalScroll(page);
  });

  test('nagłówek: poniżej 370 px przycisk główny tylko w menu', async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 780 });
    await page.goto('/');
    const header = page.getByRole('banner');
    await expect(header.getByRole('link', { name: 'Przetestuj za darmo' })).toBeHidden();
    await header.getByRole('button', { name: 'Otwórz menu' }).click();
    await expect(page.getByRole('navigation', { name: 'Menu' }).getByRole('link', { name: 'Przetestuj za darmo' })).toBeVisible();
    await page.setViewportSize({ width: 390, height: 780 });
    await page.goto('/#/pricing');
    await expect(page.getByRole('banner').getByRole('link', { name: 'Przetestuj za darmo' }).first()).toBeVisible();
  });

  test('404 dla nieznanego adresu', async ({ page }) => {
    await page.goto('/#/nie-ma-takiej');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Nie ma takiej strony');
  });
});
