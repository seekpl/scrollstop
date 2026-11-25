/** Adres API (tryb serwerowy); pusty w trybie lokalnym. `/` = ten sam serwer co aplikacja. */
export function apiBase(): string {
  const v = import.meta.env.VITE_API_URL;
  return typeof v === 'string' ? v : '';
}
