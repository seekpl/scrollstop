# ScrollStop

**Badania uwagi widzów dla twórców treści w social media.** ScrollStop pokazuje, w której sekundzie widzowie przestają patrzeć na rolkę, reklamę albo film — zanim go opublikujesz. Widzowie (dorośli, 18+) oglądają materiał w przeglądarce na swoim telefonie lub komputerze, a kamera internetowa szacuje, czy i gdzie patrzą. **Obraz z kamery nie opuszcza urządzenia widza.**

> Nazwa robocza (do zmiany). Kod wewnętrzny `attn` — prefiks kluczy w przeglądarce, baz i formatów plików — nie zmienia się przy zmianie marki. Nazwa, domena i kolory marki są tylko w `src/config/brand.ts`, dane operatora w `src/config/company.ts`.

Pełna specyfikacja produktu: [`docs/prompt-startowy.md`](docs/prompt-startowy.md) (dalej „§” odnosi się do jej rozdziałów).

## Stan prac (kamienie milowe, §25)

| # | Zakres | Stan |
|---|---|---|
| M0 | Narzędzia, marka, platformy, tokeny, `kit.tsx`, i18n pl/en, router, ErrorBoundary, diagnostyka startu, CI | gotowe |
| M1 | Rdzeń pomiaru (port z KidAttention, progi dla dorosłych w `src/core/config.ts`), laboratorium `#/lab` | gotowe |
| M2 | Warstwa badań: krzywa 0,5 s / 1 s, spadki, segmenty, heat mapy, strefy, czytelność, moment marki, A/B/n (Welch, proporcje, Holm), MDE, jakość sesji, wnioski z reguł, symulator panelu | gotowe |
| M3 | Przebieg widza: zgoda 18+, pytania przesiewowe, przygotowanie, kamera, dźwięk, kalibracja, pełny ekran z ochroną przebiegu, pytania po, zakończenie, kolejka wysyłki, kod usunięcia, link samowystarczalny, plik sesji, `?sim=1` | gotowe |
| M4 | Studio (tryb lokalny: projekty, kreator, przygotowanie testu, zbieranie widzów z importem plików, raport, analiza techniczna, konto) i strona publiczna (główna z żywą krzywą, cennik z zamówieniem e-mailem, prywatność, przykładowe raporty) | gotowe |
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

## Warstwa badań (M2)

Kod w `src/research/` działa w przeglądarce i na serwerze (ten sam raport).

- **Format kolumnowy** (`compact.ts`): `tc, vt, seg, it, vx, vy, cf, un, st` — bez współrzędnych ekranu i bez obrazu; walidacja z kodami błędów.
- **Krzywa uwagi** (`attention.ts`): stan widza w przedziałach 0,5 s (do 60 s) albo 1 s, większość rozstrzygających próbek, krótka luka przejmuje stan; przedział Wilsona; spadki (odrzucamy < 8 pp i wolniejsze niż 1,5 pp/s); segmenty i ranking „do poprawy”; utrzymanie hooka @3 s.
- **Strefy** (`aoi.ts`): zasięg probabilistyczny z niepewnością, pierwsze spojrzenie, czytelność napisów (słowa / 3 na s + 0,5 s), strefy zasłonięte przez interfejs platformy, moment marki.
- **Porównanie wersji** (`report.ts`, `statsMath.ts`): Welch na średniej uwadze widza, test dwóch proporcji dla hooka, przy > 2 wersjach każda kontra A z korektą Holma; werdykt tylko przy p < 0,05 i ≥ 15 widzach w każdej wersji; kalkulator MDE.
- **Wnioski** (`insights.ts`): fakt → obserwacja → hipoteza → rekomendacja; teksty w `src/i18n/<język>/research.ts`.
- **Symulator** (`panelSim.ts`): profile uwagi (hazard/recovery), raporty demo z 31 ważnymi widzami na wersję. Sesje symulowane są domyślnie poza raportem.

## Badanie widza (M3)

- **Adresy:** `#/s/<token>` (link projektu), `#/p/<base64url>` (link samowystarczalny — konfiguracja we fragmencie adresu, nie trafia do serwera), `#/delete/<sessionId>` (usuwanie danych kodem).
- **Przebieg:** urządzenie → zgoda (18+, wersjonowana) → pytania przesiewowe (opcjonalne, tylko listy) → przygotowanie → sprawdzenie kamery → dźwięk (gdy warunek `on`/`viewer`) → kalibracja → oglądanie → pytania po → zakończenie. Cały przebieg w języku badania z projektu.
- **Oglądanie:** bez kontrolek i bez znacznika wzroku; panel pauzy po przytrzymaniu 1,5 s (Esc na komputerze) z „Zgłoś treść”; blokada wygaszania ekranu, ostrzeżenie przy wyjściu, Wstecz → panel, ukrycie karty → pauza, obrót telefonu przy materiale pionowym → prośba o pion.
- **Zakończenie:** przerwane → wybór, czy wysłać; ukończone → wysyłka automatyczna, a przy błędzie sieci kolejka w IndexedDB `attn-outbox`; link samowystarczalny → plik `scrollstop-sesja-<id>.json` przez Web Share API albo pobranie.
- **Tryb testowy** `?sim=1`: bez kamery, wzrok symulowany, sesja oznaczona jako symulacja (poza raportem i limitami).

## Studio i strona publiczna (M4)

- **Adresy studia:** `#/app` (projekty), `#/app/new` (kreator), `#/app/p/<id>/prepare|collect|report|technical`, `#/app/account`, `#/app/workspace` (zespół — w trybie serwerowym, M5).
- **Kreator** (6 kroków): rodzaj badania (film, hook, wersje A–D; feed, miniatura i karuzela oznaczone „wkrótce” do M6), platforma, materiał każdej wersji (plik, YouTube, link HTTPS, klip demo), warunki, widzowie z kalkulatorem MDE, nazwy i język badania.
- **Przygotuj test:** w trybie lokalnym „Rozpocznij badanie tutaj” (sesja od razu w projekcie) i **link bez serwera** z kodem QR (osobny link na wersję; plik z komputera twórcy nie trafi do widzów — komunikat). Gotowe wiadomości w języku badania, próba bez kamery (`?sim=1`), status zbierania, sceny (wykrywanie, odcinki, cięcia ręczne), strefy, ustawienia, usunięcie projektu. Przy widzach z panelu — zamówienie e-mailem z podsumowaniem projektu.
- **Zbierz widzów:** postęp do celu (sesje symulowane się nie liczą), liczniki, paywall po limicie planu, **import plików sesji** (`.json` od widzów; każdy przechodzi sanityzację i kontrolę jakości, duplikaty i limit planu są pomijane), tabela sesji (na telefonie karty) z odrzucaniem, przywracaniem i usuwaniem.
- **Raport:** ten sam komponent co raporty przykładowe; segmenty widzów (regularni użytkownicy platformy publikacji według pytań przesiewowych, panel / społeczność od 10 sesji w każdej grupie, §4.9); PDF przez drukowanie (znak wodny w planie Free); surowe dane JSON/CSV w planie z `rawExport`.
- **Analiza techniczna:** urządzenie, ekran, błąd kalibracji x/y, liczba próbek, wiarygodne sekundy; „Otwórz w laboratorium” przenosi sesję do `#/lab`.
- **Strona publiczna:** główna (żywa krzywa uwagi nad pionowym klipem demo — liczona z symulowanego panelu, nie wpisana na sztywno), `#/pricing` (waluta według języka, en: USD/EUR, okres roczny = 10 × miesięczna; zamówienie przez `mailto:` — płatności online w M7), `#/privacy` (§17.8, dane operatora z `company.ts`), `#/sample/reel|video` (feed w M6).
- **Uczciwy cennik:** pozycje cennika, których jeszcze nie ma w kodzie, są w `PRICING_SOON` (`src/research/plans.ts`) i pokazują się z etykietą „wkrótce”. Usuń klucz z tej listy w kamieniu milowym, który dostarcza funkcję.

## Wdrożenie

1. **GitHub Pages** (tryb lokalny): workflow „CI & Pages” buduje z `BASE_PATH=/<repo>/`. Jednorazowo: Settings → Pages → Source: GitHub Actions.
2. **FTP** (tryb lokalny): `npm run fetch-model && npm run build:ftp`, usuń `dist-ftp/models/.gitkeep`, wgraj **całą** zawartość razem z ukrytym `.htaccess`. Workflow buduje też artefakt `scrollstop-ftp`. Kamera działa tylko przez HTTPS.
3. **Docker** (tryb serwerowy): od M5.

## Prywatność

Obraz z kamery jest przetwarzany wyłącznie w przeglądarce widza (MediaPipe, WASM i model hostowane razem z aplikacją). Zapisujemy tylko kierunek wzroku na materiale, czas, jakość pomiaru, przedział wieku i typ urządzenia, z losowym identyfikatorem. Szczegóły: §17.
