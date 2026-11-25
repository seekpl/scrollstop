# ScrollStop

**Badania uwagi widzów dla twórców treści w social media.** ScrollStop pokazuje, w której sekundzie widzowie przestają patrzeć na rolkę, reklamę albo film — zanim go opublikujesz. Widzowie (dorośli, 18+) oglądają materiał w przeglądarce na swoim telefonie lub komputerze, a kamera internetowa szacuje, czy i gdzie patrzą. **Obraz z kamery nie opuszcza urządzenia widza.**

> Nazwa robocza (do zmiany). Kod wewnętrzny `attn` — prefiks kluczy w przeglądarce, baz i formatów plików — nie zmienia się przy zmianie marki. Nazwa, domena i kolory marki są tylko w `src/config/brand.ts`, dane operatora w `src/config/company.ts`.

Pełna specyfikacja produktu: [`docs/prompt-startowy.md`](docs/prompt-startowy.md) (dalej „§” odnosi się do jej rozdziałów).

## Stan prac (kamienie milowe, §25)

| # | Zakres | Stan |
|---|---|---|
| M0 | Narzędzia, marka, platformy, tokeny, `kit.tsx`, i18n pl/en, router, ErrorBoundary, diagnostyka startu, CI | gotowe |
| M1 | Rdzeń pomiaru (port z KidAttention, progi dla dorosłych w `src/core/config.ts`), laboratorium `#/lab` | gotowe |
| M2 | Warstwa badań (krzywa, spadki, A/B/n, wnioski, symulator) | w kolejce |
| M3 | Przebieg widza | w kolejce |
| M4 | Studio (tryb lokalny) i strona publiczna | w kolejce |
| M5 | Tryb serwerowy, Docker | w kolejce |
| M6–M9 | Feed, miniatura, karuzela; plany i płatności; AI, grafika, PDF; szlif | w kolejce |

## Uruchomienie

Wymagany Node ≥ 22.5.

```bash
npm install          # kopiuje też pliki WASM MediaPipe do public/mediapipe/wasm
npm run fetch-model  # model Face Landmarker (~3,7 MB) do public/models/
npm run dev
```

| Polecenie | Co robi |
|---|---|
| `npm run typecheck` | TypeScript (`strict`, bez nieużywanych zmiennych) |
| `npm test` | testy jednostkowe (Vitest, jsdom) |
| `npm run build` | build produkcyjny do `dist/` (z service workerem i manifestem z `brand.ts`) |
| `npm run build:ftp` | build ze ścieżkami względnymi do `dist-ftp/` (dowolny katalog na hostingu) |
| `npm run e2e` | testy E2E (Playwright, Chromium z fałszywą kamerą) |
| `npm run check:colors` | kontrast tokenów (WCAG AA) i rozróżnialność kolorów wersji przy daltonizmie |

**Środowisko chmurowe Claude Code:** gdy przeglądarka w kontenerze ma inną wersję niż przypięty Playwright (1.56.1), uruchamiaj E2E z `PW_CHROMIUM_PATH=/opt/pw-browsers/chromium npm run e2e`.

## Konfiguracja (zmienne przy budowaniu)

| Zmienna | Znaczenie |
|---|---|
| `VITE_API_URL` | adres API → tryb serwerowy; bez niej tryb lokalny (wszystko w IndexedDB przeglądarki) |
| `VITE_LOCAL_PLAN` | plan w trybie lokalnym (np. do pilotaży) |
| `VITE_SALES_EMAIL` | e-mail sprzedaży, ma pierwszeństwo przed `company.ts` |
| `VITE_BOOKING_URL` | link „Umów rozmowę” |
| `BASE_PATH` | ścieżka bazowa (GitHub Pages: `/<repo>/`) |

W GitHub Actions te same wartości ustawia się jako zmienne repozytorium `ATTN_API_URL`, `ATTN_SALES_EMAIL`, `ATTN_BOOKING_URL`.

## Architektura w skrócie

- **Frontend:** React 19, TypeScript 7 (`strict`), Vite 8, Tailwind 4 (tokeny w `@theme`, `src/index.css`), routing przez `#/…` (działa na Pages i FTP bez przepisywania adresów).
- **Teksty:** wyłącznie w słownikach `src/i18n/<język>/<przestrzeń>.ts`. Polski wyznacza typ (`type Messages = typeof pl`), angielski musi mieć te same klucze — pilnuje tego TypeScript i test. Dane zapisują **kody** (błędy, powody odrzucenia), tłumaczone przy wyświetlaniu.
- **Kolory:** tokeny z kontrastem sprawdzonym testem (`tests/colors.test.ts`). Kolory wersji A–D: `#2747D6`, `#EB6834`, `#0B8F8F`, `#8A1F4A` — najmniejsza różnica ΔE00 między nimi 18,9 przy protanopii, deuteranopii i tritanopii.
- **Platformy:** proporcje, urządzenie docelowe i przybliżone strefy zasłaniane przez interfejs w `src/config/platforms.ts` (**do sprawdzenia z aktualnymi wytycznymi platform**).
- **Diagnostyka startu:** gdy aplikacja nie wystartuje w 4 s (np. niekompletne wgranie przez FTP), `index.html` pokazuje przyczyny w języku przeglądarki; błędy renderowania łapie `ErrorBoundary`.

## Pomiar (M1)

- **Rdzeń** (`src/core/`): MediaPipe Face Landmarker (GPU z fallbackiem na CPU, model i WASM hostowane z aplikacją), 11 cech na klatkę, indywidualny model wzroku (ridge / kernel ridge, walidacja leave-one-point-out), kalibracja 10 punktów + test, jakość próbek i niepewność, wygładzanie One Euro (tylko do prezentacji), zegary odtwarzania (wideo, YouTube, ręczny).
- **Progi dla dorosłych** są w jednym miejscu: `src/core/config.ts` (rozstaw źrenic 6,3 cm, progi kalibracji GOOD ≤ 6%/8%, FAIR ≤ 13%/15%, harmonogram dla komputera i telefonu, odległości). To wartości startowe — **do strojenia na pilotażu** (20–30 dorosłych, 3 urządzenia, 2 warunki światła).
- **Laboratorium** (`#/lab`): podgląd kamery z punktami oczu i diagnostyką, kalibracja na pełnym ekranie, oglądanie z markerem wzroku (kamera, symulacja albo mysz), heat mapa (paleta sekwencyjna inferno/viridis, nie tęczowa), ścieżka wzroku z fiksacjami, statystyki, eksport JSON/CSV/PNG. Sesje laboratorium zostają w bazie `attn-lab` tej przeglądarki.
- **Klipy demo** (`src/demo/demoScene.ts`): rolka 9:16 w dwóch wersjach początku (A: plansza z logo, B: mocny hook), film 16:9 z 5 scenami, 5 wypełniaczy feedu i 6 miniatur — rysowane na canvasie, deterministyczne, z pseudotekstem zamiast słów (działają w każdym języku).

## Wdrożenie

1. **GitHub Pages** (tryb lokalny): workflow „CI & Pages” buduje z `BASE_PATH=/<repo>/`. Jednorazowo: Settings → Pages → Source: GitHub Actions.
2. **FTP** (tryb lokalny): `npm run fetch-model && npm run build:ftp`, usuń `dist-ftp/models/.gitkeep`, wgraj **całą** zawartość razem z ukrytym `.htaccess`. Workflow buduje też artefakt `scrollstop-ftp`. Kamera działa tylko przez HTTPS.
3. **Docker** (tryb serwerowy): od M5.

## Prywatność

Obraz z kamery jest przetwarzany wyłącznie w przeglądarce widza (MediaPipe, WASM i model hostowane razem z aplikacją). Zapisujemy tylko kierunek wzroku na materiale, czas, jakość pomiaru, przedział wieku i typ urządzenia, z losowym identyfikatorem. Szczegóły: §17.
