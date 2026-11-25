/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Adres API serwera; bez niego aplikacja działa w trybie lokalnym (§12.2). */
  readonly VITE_API_URL?: string;
  /** Plan w trybie lokalnym (np. do pilotaży). */
  readonly VITE_LOCAL_PLAN?: string;
  /** E-mail sprzedaży; ma pierwszeństwo przed `company.ts`. */
  readonly VITE_SALES_EMAIL?: string;
  /** Link „Umów rozmowę”. */
  readonly VITE_BOOKING_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
