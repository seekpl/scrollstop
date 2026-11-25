import { expect, type Page } from '@playwright/test';

/**
 * Strona mieści się w szerokości ekranu (brak poziomego przewijania, §19.5). Telefon poszerza układ
 * do najszerszego elementu, więc `innerWidth` kłamie — porównujemy z szerokością ekranu urządzenia (lekcja §24.6).
 */
export async function expectNoHorizontalScroll(page: Page): Promise<void> {
  const scroll = await page.evaluate(() => Math.max(document.documentElement.scrollWidth, document.body.scrollWidth));
  const screen = page.viewportSize()?.width ?? 0;
  expect(scroll, `szerokość strony ${scroll}px > ekran ${screen}px`).toBeLessThanOrEqual(screen + 1);
}

/** Szerokości telefonów sprawdzane we wszystkich językach (§22.2). */
export const PHONE_WIDTHS = [320, 360, 390] as const;
