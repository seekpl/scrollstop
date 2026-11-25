/**
 * Operator serwisu (Załącznik A, do potwierdzenia): stopka, polityka prywatności i kontakt sprzedaży.
 * `VITE_SALES_EMAIL` ustawiony przy budowaniu ma pierwszeństwo przed adresem poniżej.
 * Nazwa i adres pojawiają się na stronie tylko, gdy są uzupełnione.
 */
export interface Company {
  name: string | null;
  address: string | null;
  nip: string | null;
  email: string;
}

export const COMPANY: Company = {
  name: 'Sebastian Biel', // jednoosobowa działalność; nazwa z rejestru VAT
  address: 'Wąska 5, 32-765 Rzezawa',
  nip: '8681879901',
  email: 'sebastian.biel@me.com', // publiczny na stronie; rozważ adres w domenie produktu (kontakt@…)
};

/**
 * Teksty prawne (regulamin, prywatność): po przeglądzie prawnika ustaw `reviewed: true` (znika notatka
 * „wersja robocza”) i datę wejścia w życie (`effective`, RRRR-MM-DD) — lista startowa, docs/launch-checklist.md.
 */
export const LEGAL: { reviewed: boolean; effective: string | null } = {
  reviewed: false,
  effective: null,
};

/** E-mail sprzedaży: zmienna z budowania albo adres operatora. */
export function salesEmail(): string {
  const fromEnv = typeof import.meta !== 'undefined' ? import.meta.env?.VITE_SALES_EMAIL : undefined;
  return fromEnv && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fromEnv) ? fromEnv : COMPANY.email;
}

/** Link „Umów rozmowę” (opcjonalny). */
export function bookingUrl(): string | null {
  const v = typeof import.meta !== 'undefined' ? import.meta.env?.VITE_BOOKING_URL : undefined;
  return v && /^https:\/\//.test(v) ? v : null;
}
