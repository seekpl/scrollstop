/**
 * Języki interfejsu i badań. MVP: polski i angielski (§18). Polski jest źródłem kształtu słowników.
 * Dodanie języka (de, es, it, pt-BR, fr): wpis tutaj, słownik w `src/i18n/<kod>/`, loader w `index.tsx`,
 * implementacja `ResearchText` — TypeScript i test słowników pilnują kompletności.
 */
export type Locale = 'pl' | 'en';

export const LOCALES: Locale[] = ['pl', 'en'];

/** Nazwy języków w ich własnym brzmieniu (przełącznik języka). */
export const LOCALE_NAMES: Record<Locale, string> = {
  pl: 'Polski',
  en: 'English',
};

/** Znacznik BCP 47 do formatowania dat i liczb. */
export const LOCALE_TAGS: Record<Locale, string> = {
  pl: 'pl-PL',
  en: 'en-US',
};

export const isLocale = (x: unknown): x is Locale => typeof x === 'string' && (LOCALES as string[]).includes(x);

export type Currency = 'PLN' | 'EUR' | 'USD';

/** Waluta według języka (§16.1): pl → PLN, en → USD (z przełącznikiem EUR), pozostałe → EUR. */
export function currencyFor(l: Locale, preferEur = false): Currency {
  if (l === 'pl') return 'PLN';
  if (l === 'en') return preferEur ? 'EUR' : 'USD';
  return 'EUR';
}

/** Skrót punktów procentowych: pl, en „pp”; de „PP” (gdy dojdzie niemiecki). */
export const PP_LABEL: Record<Locale, string> = { pl: 'pp', en: 'pp' };
