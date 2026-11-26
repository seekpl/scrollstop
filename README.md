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
| M5 | Tryb serwerowy (konta, zespoły z rolami i zaproszeniami, media z `Range`, sesje, retencja, usuwanie kodem, linki do raportu), Docker | gotowe |
| M6 | Test w feedzie (gesty, pętle, zatrzymanie scrolla), test miniatury w siatce (spojrzenia, wybór, efekt pozycji), karuzela i slajdy — widz, metryki, raport, kreator | gotowe |
| M7 | Plany i paywall, płatności Stripe (Checkout, portal, podpisany webhook), zamówienie badania z panelem, powroty do dostawcy panelu | gotowe |
| M8 | Rekomendacje AI (kontrakt, walidacja liczb i treści, pamięć podręczna, limity), grafika do udostępnienia 4:5 i 9:16, PDF przez druk | gotowe |
| M9 | Szlif: audyt dostępności WCAG 2.2 AA, podział paczek, regulamin i prywatność, kopie zapasowe, lista startowa | gotowe |

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
| `npm run e2e` | testy E2E (Playwright, Chromium z fałszywą kamerą): tryb lokalny na :4173 i serwerowy na :4174 (`E2E_SERVER=0` pomija serwer) |
| `npm run server:build` | serwer API do jednego pliku `dist-server/main.js` |
| `npm run server:start` | start serwera (zmienne środowiskowe niżej) |
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
- **Klipy demo** (`src/demo/demoScene.ts`): rolka 9:16 w dwóch wersjach początku (A: plansza z logo, B: mocny hook), film 16:9 z 5 scenami, 5 wypełniaczy feedu i 6 miniatur — fotografie z nakładkami rysowanymi na canvasie (napis hooka, napisy, przycisk, logo), deterministyczne, z pseudotekstem zamiast słów (działają w każdym języku).
- **Fotografie demo** (`src/demo/photos/`, `photos.ts`): wygenerowane w Higgsfield (Nano Banana Pro, krajobraz filmu — Soul 2), osoby nie są prawdziwe. Wczytywane leniwie; do czasu wczytania (i w testach) scena rysuje się z kształtów. Klatki raportu i odtwarzanie u widza czekają na wczytanie zdjęć. Strefy zainteresowania i cele wzroku symulacji odpowiadają położeniu twarzy, produktu i przycisku na zdjęciach — po wymianie zdjęcia trzeba je sprawdzić.

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

## Feed, miniatura, karuzela (M6)

- **Test w feedzie** (§4.4): 6 pozycji, badany klip losowo na pozycji 2–5, wypełniacze w losowej kolejności (domyślnie klipy demo, §26.6; można dodać własne wcześniejsze klipy). Telefon: przesunięcie w górę/dół (> 60 px albo > 0,3 px/ms), dotknięcie — pauza; komputer: kółko (suma > 50), ↑/↓, J/K, spacja. Klip po końcu leci od nowa (pętla). Pozycja trwa najwyżej max(3 × długość, 60 s), cały feed domyślnie 3 min. Opcjonalna **neutralna** nakładka (ikony, konto, opis — bez znaków platform). Badanie ślepe: bez pytań po obejrzeniu.
- **Metryki feedu** (`src/research/feed.ts`): zatrzymanie scrolla (zachowanie ≥ T_stop i wzrok ≥ 50% pierwszych 2 s), czas na klipie (mediana, średnia, bootstrap 95%) wobec wypełniaczy, test dwóch proporcji, obejrzenie do końca i pętle, „oglądają, ale nie patrzą”, retencja i momenty przewinięcia. Krzywa, hook, sceny, strefy i heat mapy liczą się na samym badanym klipie (`feedFocus`).
- **Test miniatury** (§4.5): układy „strona główna 3 × 2”, „wyniki wyszukiwania (telefon)”, „siatka profilu”; ta sama geometria komórek u widza i w raporcie (`gridCells`). Ekspozycja 3–10 s, potem „Który film chcesz obejrzeć?”. Metryki (`src/research/grid.ts`): spojrzenie (≥ 3 kolejne próbki w komórce), mediana pierwszego spojrzenia, udział patrzenia, kolejność pierwszych spojrzeń, wybór (deklaracja) i **wskaźnik pozycji** (spojrzenia wobec wypełniaczy na tej samej pozycji). Wypełniacze demo mają neutralne tytuły, żeby tekst nie wyróżniał badanej miniatury.
- **Karuzela i slajdy** (§4.6): 2–20 obrazów; przesunięcie w bok — kolejny obraz, w górę — koniec; slajdy mogą zmieniać się same. Metryki (`src/research/carousel.ts`): zasięg slajdu, czas na slajdzie, uwaga na slajdzie, slajd porzucenia; heat mapa każdego slajdu.
- **Kontrola jakości** sesji z wieloma pozycjami ocenia całą sesję — przewinięcie badanego klipu po sekundzie to wynik, a nie powód odrzucenia.
- **Plan:** feed, miniatura i karuzela są w planie Pro (402 `feature_*`). YouTube działa tylko w teście materiału (`format_media`).
- **Ograniczenia:** strefy zainteresowania na slajdach i własne miniatury‑wypełniacze — w kolejnych etapach.

## Tryb serwerowy (M5)

Serwer w `server/` (Node ≥ 22.5, `node:sqlite`, `node:http`, bez frameworka). Ten sam kod raportu i walidacji co w przeglądarce (`src/research/`), więc oba tryby przyjmują dokładnie te same dane.

- **Konta** (§9.7, §15): hasła scrypt, tokeny 32 B (w bazie skrót SHA-256, ważne 30 dni), limity prób logowania i rejestracji, ten sam komunikat dla złego e-maila i hasła.
- **Zespoły** (§9.6): każde konto ma własny zespół; role właściciel / edytor / widz raportu; zaproszenie linkiem (jednorazowe, 7 dni); liczba miejsc według planu. Limity i funkcje zespołu wynikają z **planu właściciela**.
- **Projekty**: budowane od zera z dozwolonych pól (`src/research/project.ts`); funkcje płatne jako 402 `feature_*` (np. strefy, więcej wersji); materiał z serwera musi należeć do tego samego zespołu.
- **Media**: `POST /api/projects/:id/media` (surowe body, strumień na dysk z limitem `MAX_VIDEO_MB` / `MAX_IMAGE_MB`), `GET /api/media/:id` z `Range` (206/416) pod nieodgadywalnym identyfikatorem.
- **Badanie**: `GET /api/study/:token` (przydział wersji A→D, limit planu sprawdzany przed zgodą), `POST /api/study/:token/sessions` (sanitizacja, kontrola jakości, kod usunięcia; symulacje bez limitu), `POST /api/sessions/:id/delete` (kod, porównanie stałoczasowe).
- **Retencja**: sesje wygasają po 30/90/180/365 dniach; usuwanie przy starcie i co godzinę. Usunięcie projektu lub konta kasuje też pliki mediów.
- **Link do raportu** (plan Pro+): `#/r/<token>` — raport **zbiorczy** liczony na serwerze, bez surowych sesji, map spojrzeń i wartości pojedynczych widzów; wygasa po 7/30/90 dniach, można go wyłączyć.
- **Płatności** (M7) i **AI** (M8) — opis niżej; bez kluczy Stripe `/api/billing/*` odpowiada 503 `billing_unavailable`, a cennik pokazuje zamówienie e-mailem; bez `ANTHROPIC_API_KEY` rekomendacje to wnioski z reguł.
- **Linia poleceń**: `node dist-server/main.js set-plan <e-mail> <free|creator|pro|agency>` (faktura, Agency); `node dist-server/main.js backup <plik.sqlite>` (spójna kopia bazy w trakcie działania); `PANEL_SALT=… node dist-server/main.js panel-hash <dostawca> <id…>` (skróty identyfikatorów do rozliczenia z dostawcą panelu).

| Zmienna serwera | Znaczenie (domyślnie) |
|---|---|
| `DATA_DIR` | baza `attn.sqlite` i katalog `media/` (`./data`) |
| `PORT`, `HOST` | `8787`, `0.0.0.0` |
| `APP_URL` | adres aplikacji (linki) |
| `APP_ORIGINS` | originy z dostępem do API (CORS), po przecinku; domyślnie origin `APP_URL` |
| `STATIC_DIR` | zbudowany frontend do serwowania z tego samego adresu |
| `ADMIN_EMAILS` | administratorzy (zamówienia, ręczna zmiana planu) |
| `MAX_VIDEO_MB`, `MAX_IMAGE_MB` | limity plików (`1024`, `15`) |
| `TRUST_PROXY` | `1` za odwrotnym proxy (IP do limitów z `X-Forwarded-For`) |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | płatności online; bez nich — zamówienie e-mailem |
| `STRIPE_PRICE_{CREATOR,PRO}_{MONTHLY,YEARLY}` | identyfikatory cen w Stripe (brak ceny → 503 dla tego wariantu) |
| `STRIPE_AUTOMATIC_TAX` | `1` — Stripe Tax (VAT w UE, wymaga konfiguracji w Stripe) |
| `STRIPE_API_BASE` | inny adres API Stripe (np. stripe-mock); domyślnie `https://api.stripe.com/v1` |
| `PANEL_SALT` | sól skrótu identyfikatora uczestnika panelu; bez niej skrótu nie zapisujemy |
| `ANTHROPIC_API_KEY`, `AI_MODEL` | rekomendacje AI (domyślnie `claude-opus-5-5`); bez klucza — wnioski z reguł |

Frontend w trybie serwerowym: build z `VITE_API_URL` (adres API albo `/` przy wspólnym serwerze).

## Plany, płatności i panel (M7)

- **Jedno źródło zasad:** `src/research/plans.ts` — limity, uprawnienia, ceny i pozycje cennika. Serwer egzekwuje je odpowiedziami 402 (`feature_*`, limity), interfejs pokazuje paywall (okno „Limit planu”, karty „Dostępne od planu …”).
- **Stripe** (`server/billing.ts`, bez SDK — kilka wywołań REST): Checkout (`mode=subscription`, cena z `STRIPE_PRICE_*`, `client_reference_id`, `metadata[account_id]`, `subscription_data[metadata][account_id|plan]`, NIP do faktury, opcjonalnie Stripe Tax), powrót na `#/app/account?payment=ok|cancelled`; portal klienta (karta, faktury, zmiana planu, anulowanie). Przy aktywnej subskrypcji drugi Checkout dostaje 409 `already_subscribed` — zmiana planu idzie przez portal.
- **Webhook** `POST /api/billing/webhook`: podpis `Stripe-Signature` (HMAC-SHA256, tolerancja 5 min, kilka podpisów `v1` przy rotacji sekretu), idempotencja po `event.id` (zdarzenie zapisujemy dopiero po przetworzeniu — błąd → Stripe ponowi). Obsługiwane: `checkout.session.completed`, `customer.subscription.created|updated|deleted` (stan zawsze pobierany z API, bo zdarzenia mogą przyjść w innej kolejności; plan z identyfikatora ceny albo z metadanych), `invoice.payment_failed` → zaległość. Anulowanie starszej subskrypcji nie zdejmuje planu z bieżącej.
- **Konfiguracja w panelu Stripe:** produkty Creator i Pro z cenami miesięczną i roczną (10 × miesięczna); endpoint webhooka `https://<domena>/api/billing/webhook` z pięcioma zdarzeniami powyżej; w ustawieniach portalu klienta — zmiana planu między cenami Creator/Pro, anulowanie, faktury.
- **Bez Stripe** (tryb lokalny albo serwer bez kluczy): przyciski zakupu otwierają e-mail do sprzedaży z tematem i ceną, nigdy techniczny komunikat. Błąd płatności (np. awaria Stripe, 502 `billing_failed`) zawsze pokazuje też przycisk „Zamów e-mailem”.
- **Badanie z panelem** (§16.5): formularz (firma, NIP, e-mail, 30/50/100 widzów, wiek, kraje, korzystanie z platform, uwagi, podsumowanie z ceną „od”) w cenniku, w oknie limitu i w projekcie z widzami z panelu. Serwer zapisuje zamówienie (`GET /api/admin/orders`), bez serwera powstaje e-mail z podsumowaniem. Cena tylko „od 590 zł / 139 € za 30 widzów” — większe próby są wyceniane indywidualnie.
- **Integracja z dostawcą panelu:** operator ustawia adresy powrotu projektu: `PUT /api/admin/projects/:id/panel` z `{ "panel": { "provider", "completeUrl", "screenoutUrl", "qualityFailUrl" } }` (tylko HTTPS; `{PID}` w adresie zastępujemy identyfikatorem uczestnika; `{ "panel": null }` wyłącza). Twórca tych adresów nie ustawia — to przekierowanie widza poza serwis. Dostawca wysyła widzów na `https://<domena>/#/s/<token>?pid=<identyfikator>`. Po badaniu: ważna sesja → `complete`, odrzucona przez kontrolę jakości → `quality_fail`, wiek poza grupą albo poniżej 18 lat → `screenout`. Identyfikator trafia do serwera tylko w nagłówku `X-Panel-Ref` i jest zapisywany wyłącznie jako HMAC-SHA256 z `PANEL_SALT`; twórca go nie widzi, operator rozlicza się przez `GET /api/admin/projects/:id/panel` i `panel-hash`. W trybie testowym (`?sim=1`) nie ma przekierowań.
- **Testy:** `tests/billing.test.ts` (Checkout, podpis, idempotencja, zmiana i anulowanie planu, panel ze skrótem), `e2e/billing.spec.ts` (paywall → Checkout → plan → portal → anulowanie na atrapie Stripe z `e2e/fake-stripe.mjs`, zamówienie panelu, powrót widza do dostawcy).

## Rekomendacje AI, grafika, PDF (M8)

- **Kontrakt** (`src/research/aiContract.ts`, §8.4): model dostaje wyłącznie zagregowane metryki (`buildAiInput`: materiał, krzywa w procentach, spadki, sceny, strefy, moment marki, feed, miniatura, karuzela, wnioski z reguł) — bez identyfikatorów, odpowiedzi widzów i surowych próbek. Odpowiedź w schemacie JSON (`AI_OUTPUT_SCHEMA`, wszystkie pola wymagane).
- **Walidacja odpowiedzi:** najwyżej 6 wniosków; tytuł ≤ 160 znaków, pozostałe pola ≤ 600; czasy w zakresie materiału; każda liczba w tekście (po zaokrągleniu, także z przecinkiem) musi wystąpić w danych wejściowych, w znacznikach czasu albo w tekstach reguł; zakazane treści (`FORBIDDEN_PATTERNS`: diagnozy, emocje widzów, obietnice zasięgu, stereotypy) w pl, en i kilku kolejnych językach. Odrzucone propozycje są liczone i pokazywane („Odrzucono N propozycji…”).
- **Wywołanie** (`server/ai.ts`, SDK `@anthropic-ai/sdk`): model z `AI_MODEL`, ustrukturyzowany JSON (`output_config.format`), średni wysiłek, `max_tokens` 16 000, 2 ponowienia, timeout 120 s; dla modeli, które to obsługują, automatyczny model zapasowy przy odmowie (`fallbacks: "default"`). Przy odmowie, `max_tokens`, błędzie API, złym JSON albo samych odrzuconych propozycjach — wnioski z reguł w tym samym formacie.
- **Serwer:** wymagany plan z rekomendacjami (402 `feature_recommendations`); pamięć podręczna po `sha256(model:język:JSON wejścia)` w `insights_cache` (te same dane nie kosztują drugi raz); limit 30 zapytań do modelu na godzinę na konto. `GET /api/health` mówi interfejsowi, czy AI jest włączone (bez AI: „AI jest niedostępne, pokazujemy rekomendacje z reguł”). Tekst AI jest podpisany nazwą modelu.
- **Grafika do udostępnienia** (§7.1): w raporcie twórcy, rysowana w przeglądarce na płótnie (`src/features/report/shareImage.ts`) w formatach 1080×1350 (post 4:5) i 1080×1920 (relacja 9:16, treść poza pasami zasłanianymi przez aplikacje): wykres uwagi, wynik hooka, średnia albo największy spadek z zaznaczonym fragmentem, opcjonalnie nazwa materiału, znak marki i „Zbadane w ScrollStop”. Tylko dane zbiorcze. Free — znak wodny. Pobranie PNG albo udostępnienie przez Web Share.
- **PDF** (§7.2): przez okno drukowania — A4, margines 14 mm, białe tło, nagłówek z marką i datą, bez przycisków i powłoki studia, wykresy skalowane do szerokości strony, sekcje zwijane rozwinięte na czas druku, znak wodny w Free.
- **Testy:** `tests/ai.test.ts` (wejście bez danych widzów, walidacja liczb i treści, limity, zapytanie do API, powrót do reguł, plan, pamięć podręczna, limit), `tests/shareImage.test.ts` (dwa formaty, dane zbiorcze, znak wodny), E2E: `e2e/ai.spec.ts` (prawdziwe SDK na atrapie API z `e2e/fake-anthropic.mjs`), grafika w dwóch formatach i wydruk w `e2e/studio.spec.ts`.

## Szlif i start (M9)

- **Dostępność:** `e2e/a11y.spec.ts` sprawdza axe-core (WCAG 2.2 AA) ok. 20 ekranów na komputerze i telefonie; każde naruszenie zatrzymuje test z listą elementów.
- **Wydajność:** strona publiczna w paczce głównej, a badanie widza, studio, raporty i laboratorium jako osobne pliki (`React.lazy` w `src/app/Root.tsx`); wczytywanie fragmentu pokazuje komunikat dopiero po 400 ms.
- **Teksty prawne:** regulamin `/terms/` i polityka prywatności `/privacy/` (dane widzów i twórców, podmioty przetwarzające, prawa z RODO) w słowniku `legal`; właściciel serwisu i data wejścia w życie — `COMPANY` i `LEGAL` w `src/config/company.ts`.
- **Języki:** zgodnie z decyzją §26.2 startujemy z pl i en; kolejne języki dodaje się bez zmian w kodzie aplikacji (lista w `docs/launch-checklist.md`).
- **Lista startowa:** [`docs/launch-checklist.md`](docs/launch-checklist.md) — co jest gotowe w kodzie i co zostaje właścicielowi (DNS, SSL, Stripe na żywo, kopie `/data`, pilotaż).

## Wdrożenie

1. **GitHub Pages** (tryb lokalny): workflow „CI & Pages” buduje z `BASE_PATH=/<repo>/`. Jednorazowo: Settings → Pages → Source: GitHub Actions.
2. **FTP** (tryb lokalny): `npm run fetch-model && npm run build:ftp`, usuń `dist-ftp/models/.gitkeep`, wgraj **całą** zawartość razem z ukrytym `.htaccess`. Workflow buduje też artefakt `scrollstop-ftp`. Kamera działa tylko przez HTTPS.
3. **Docker** (tryb serwerowy, jeden kontener: aplikacja + API + SQLite):
   ```bash
   docker build -t scrollstop .
   docker run -p 8787:8787 -v scrollstop-data:/data -e APP_URL=https://twoja-domena.pl/ scrollstop
   ```
   Obraz: `node:22-bookworm-slim`, użytkownik `node`, wolumen `/data` (kopie zapasowe!), port 8787, `HEALTHCHECK` na `/api/health`. Za proxy z TLS: `-e TRUST_PROXY=1`. Przykład z wolumenem: `docker-compose.yml`. W sieci z inspekcją TLS (proxy firmowe) certyfikat CA podaje się na czas budowania jako sekret: `docker build --secret id=extra_ca,src=ca.crt …` — nie trafia do obrazu.

## Prywatność

Obraz z kamery jest przetwarzany wyłącznie w przeglądarce widza (MediaPipe, WASM i model hostowane razem z aplikacją). Zapisujemy tylko kierunek wzroku na materiale, czas, jakość pomiaru, przedział wieku i typ urządzenia, z losowym identyfikatorem. Szczegóły: §17.
