import { expect, type Page } from '@playwright/test';
import { encodeStudyConfig } from '../src/research/link';
import { CONSENT_VERSION, type StudyConfig } from '../src/research/model';

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

/** Link samowystarczalny do badania rolki demo 9:16 (bez serwera). */
export function reelStudyLink(patch: Partial<StudyConfig> = {}): string {
  const config: StudyConfig = {
    projectId: 'prj_e2e',
    projectName: 'Rolka E2E',
    creatorName: 'Studio E2E',
    kind: 'video',
    platform: 'tiktok',
    audio: 'off',
    context: 'fullscreen',
    platformUi: 'none',
    targetDevice: 'mobile',
    variant: { id: 'A', media: { kind: 'demo', demo: 'reel_b' }, mediaName: 'Rolka demo', duration: 15, width: 1080, height: 1920 },
    fillers: [],
    questions: ['finish'],
    ageBands: ['18-24', '25-34', '35-44', '45-54', '55+'],
    screenPlatforms: false,
    consentVersion: CONSENT_VERSION,
    transport: 'package',
    linkToken: 'e2e',
    retentionDays: 90,
    locale: 'pl',
    ...patch,
  };
  return `/#/p/${encodeStudyConfig(config)}`;
}

/** Zgoda dorosłego widza (przedział wieku + dwa potwierdzenia). */
export async function acceptConsent(page: Page, age = '25-34'): Promise<void> {
  await expect(page.getByRole('heading', { name: 'Zaproszenie do krótkiego badania materiału wideo' })).toBeVisible();
  await page.getByLabel('Twój wiek').selectOption(age);
  await page.getByLabel('Mam ukończone 18 lat.').check();
  await page.getByLabel(/Zgadzam się na zapisanie/).check();
  await page.getByRole('button', { name: 'Zgadzam się i przechodzę dalej' }).click();
}

/** Plik sesji z ekranu podziękowania (link samowystarczalny) jako obiekt. */
export async function downloadSession(page: Page): Promise<{ kind: string; session: Record<string, unknown> & { items?: Array<Record<string, unknown>>; data: Record<string, number[]>; choice?: { itemId: string | null } } }> {
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Wyślij wyniki do Studio E2E' }).click();
  const file = await download;
  const text = await (await file.createReadStream())!.toArray().then((c) => Buffer.concat(c as Buffer[]).toString('utf8'));
  return JSON.parse(text);
}
