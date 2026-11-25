import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { STORAGE } from '../config/brand';
import { isLocale, LOCALE_NAMES, LOCALE_TAGS, LOCALES, type Locale } from './locales';
import { pl } from './pl';

export * from './locales';

/** Kształt słownika — wyznaczony przez polski; pozostałe języki muszą mieć te same klucze i funkcje. */
export type Messages = typeof pl;

/** Słowniki innych języków ładowane na żądanie (osobne pliki w buildzie). */
const LOADERS: Record<Locale, () => Promise<Messages>> = {
  pl: async () => pl,
  en: () => import('./en').then((m) => m.en),
};

const cache: Partial<Record<Locale, Messages>> = { pl };

export async function loadMessages(locale: Locale): Promise<Messages> {
  const hit = cache[locale];
  if (hit) return hit;
  const m = await LOADERS[locale]();
  cache[locale] = m;
  return m;
}

/** Słownik, jeśli już wczytany (kod synchroniczny, np. serwer po `loadMessages`). */
export const cachedMessages = (locale: Locale): Messages | null => cache[locale] ?? null;

const read = (): string | null => {
  try {
    return localStorage.getItem(STORAGE.lang);
  } catch {
    return null;
  }
};

const store = (l: Locale) => {
  try {
    localStorage.setItem(STORAGE.lang, l);
  } catch {
    /* tryb prywatny: wybór tylko do zamknięcia karty */
  }
};

/**
 * Język interfejsu (§18): `?lang=` w adresie albo w zapytaniu po `#` (zapamiętywany), potem zapisany
 * wybór, potem języki przeglądarki; domyślnie angielski.
 */
export function detectLocale(): Locale {
  if (typeof window === 'undefined') return 'pl';
  const hashQuery = window.location.hash.split('?')[1] ?? '';
  const fromUrl = new URLSearchParams(window.location.search).get('lang') ?? new URLSearchParams(hashQuery).get('lang');
  if (isLocale(fromUrl)) {
    store(fromUrl);
    return fromUrl;
  }
  const saved = read();
  if (isLocale(saved)) return saved;
  const langs = typeof navigator !== 'undefined' ? (navigator.languages?.length ? navigator.languages : [navigator.language]) : [];
  for (const l of langs) {
    const code = (l ?? '').slice(0, 2).toLowerCase();
    if (isLocale(code)) return code;
  }
  return 'en';
}

/** Bieżący język dla kodu spoza Reacta (komunikaty błędów API, formatowanie). */
let current: { locale: Locale; t: Messages } = { locale: 'pl', t: pl };
export const currentLocale = (): Locale => current.locale;
export const currentMessages = (): Messages => current.t;

interface I18nValue {
  locale: Locale;
  t: Messages;
  /** Znacznik do Intl (daty, liczby), np. „pl-PL”. */
  tag: string;
  setLocale(l: Locale): void;
}

const Ctx = createContext<I18nValue>({ locale: 'pl', t: pl, tag: LOCALE_TAGS.pl, setLocale: () => undefined });

/**
 * Dostawca języka. Główny (bez `locale`) zapamiętuje wybór użytkownika i ustawia `lang` dokumentu.
 * Zagnieżdżony z `locale` wymusza język fragmentu (badanie w języku projektu) bez zapisywania wyboru.
 */
export function I18nProvider({ children, locale: forced }: { children: ReactNode; locale?: Locale }) {
  const root = forced === undefined;
  const [locale, setLocaleState] = useState<Locale>(() => forced ?? detectLocale());
  const [loaded, setLoaded] = useState<{ locale: Locale; t: Messages } | null>(() => {
    const l = forced ?? locale;
    const hit = cache[l];
    return hit ? { locale: l, t: hit } : null;
  });

  useEffect(() => {
    if (forced) setLocaleState(forced);
  }, [forced]);

  useEffect(() => {
    let alive = true;
    void loadMessages(locale).then(
      (t) => alive && setLoaded({ locale, t }),
      () => alive && setLoaded({ locale: 'pl', t: pl }),
    );
    return () => {
      alive = false;
    };
  }, [locale]);

  // Kod spoza Reacta (np. formatowanie procentów) widzi nowy język już przy tym renderowaniu (lekcja §24.13).
  if (root && loaded) current = loaded;

  useEffect(() => {
    if (!loaded || !root) return;
    document.documentElement.lang = loaded.locale;
  }, [loaded, root]);

  const setLocale = useCallback(
    (l: Locale) => {
      if (root) store(l);
      setLocaleState(l);
    },
    [root],
  );

  const value = useMemo<I18nValue | null>(
    () => (loaded ? { locale: loaded.locale, t: loaded.t, tag: LOCALE_TAGS[loaded.locale], setLocale } : null),
    [loaded, setLocale],
  );
  // Pierwsze ładowanie słownika innego niż polski trwa ułamek sekundy — bez migania polskim tekstem.
  if (!value) return null;
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useI18n(): I18nValue {
  return useContext(Ctx);
}

/** Słownik bieżącego języka: `const t = useT(); t.site.hero.title`. */
export function useT(): Messages {
  return useContext(Ctx).t;
}

/** Przełącznik języka (lista rozwijana z nazwami języków w ich brzmieniu, ikona globu). */
export function LanguageSelect({ className = '' }: { className?: string }) {
  const { locale, setLocale, t } = useI18n();
  // Widoczność ustawia wywołujący (np. „hidden sm:inline-flex”); domyślnie zawsze widoczny.
  const display = /(^|\s)(hidden|inline-flex|flex)(\s|$)/.test(className) ? '' : 'inline-flex';
  return (
    <label className={`relative items-center ${display} ${className}`}>
      <span className="sr-only">{t.ui.languageLabel}</span>
      <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden className="pointer-events-none absolute left-2 text-muted">
        <circle cx="10" cy="10" r="7.2" fill="none" stroke="currentColor" strokeWidth="1.5" />
        <path d="M2.8 10h14.4M10 2.8c2.2 2.4 2.2 12 0 14.4M10 2.8c-2.2 2.4-2.2 12 0 14.4" fill="none" stroke="currentColor" strokeWidth="1.3" />
      </svg>
      <select
        value={locale}
        onChange={(e) => setLocale(e.target.value as Locale)}
        className="h-9 cursor-pointer appearance-none rounded-[10px] bg-transparent pl-7 pr-2 text-[13.5px] font-semibold text-ink ring-1 ring-inset ring-field hover:ring-ink/50"
      >
        {LOCALES.map((l) => (
          <option key={l} value={l}>
            {LOCALE_NAMES[l]}
          </option>
        ))}
      </select>
    </label>
  );
}
