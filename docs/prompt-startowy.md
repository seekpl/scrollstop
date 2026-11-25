# ScrollStop — prompt startowy nowego projektu

**Badania uwagi widzów dla twórców treści w social media**

> **Nazwa robocza:** ScrollStop (do zmiany, §26). **Kod wewnętrzny:** `attn` — prefiks kluczy w przeglądarce, baz, plików i formatów. Kod wewnętrzny nie zmienia się przy zmianie nazwy marki.
>
> **Źródło:** działający produkt KidAttention (repozytorium `seekpl/kidgaze`, gałąź `claude/adoring-noether-8xckvq`). Przenosimy z niego pomiar wzroku kamerą internetową, statystykę, raport, architekturę dwóch trybów (bez serwera i z serwerem), wdrożenie oraz lekcje z produkcji.
>
> **Co się zmienia:** zamiast producentów treści dla dzieci — **twórcy i zespoły tworzące treści w social media** (rolki, TikTok, Shorts, reklamy, filmy na YouTube, karuzele, prezentacje). Zamiast dzieci oglądających z rodzicem — **dorośli widzowie (18+)**, którzy sami wyrażają zgodę.
>
> **Data:** 24.11.2026.

## Jak używać tego dokumentu

1. Utwórz puste repozytorium i wklej cały dokument jako pierwszą wiadomość w nowej sesji Claude Code.
2. Agent czyta całość przed pierwszą linijką kodu, a potem pracuje kamieniami milowymi z §25. Każdy kamień kończy się testami i commitem.
3. Decyzje właściciela z §26 mają wartości domyślne. Agent pyta tylko wtedy, gdy decyzja blokuje pracę.
4. Kod KidAttention wolno kopiować. §12.6 mówi, co przenieść bez zmian, a co zmienić.

---

## 0. Zasady pracy dla agenta

- **Rola:** działasz jak mały zespół: lider produktu, inżynier full-stack TypeScript, specjalista od eye-trackingu i statystyki, projektant UX/UI oraz osoba od zgodności. Ta ostatnia wskazuje ryzyka prawne i oznacza je do weryfikacji, ale nie udziela porad prawnych.
- **Jakość kodu:** TypeScript w trybie `strict`, bez `any`, z `noUnusedLocals` i `noUnusedParameters`. Na koniec każdego kamienia uruchom: `npm run typecheck`, `npm test`, `npm run build`, `npm run e2e`, a potem zrób commit z opisem.
- **Liczby:** każda liczba w interfejsie pochodzi z danych. Żadnych zmyślonych benchmarków, prognoz zasięgów, „średnich z branży” ani obietnic viralności.
- **Funkcje:** cennik i strona nie pokazują funkcji, których nie ma w kodzie. Funkcja planowana dostaje etykietę „wkrótce” albo nie pojawia się wcale.
- **Prywatność:** to wymóg architektury, nie dodatek. Obraz z kamery nigdy nie opuszcza urządzenia widza. Dane z zewnątrz walidujemy, budując obiekt od zera z dozwolonych pól.
- **Claude API:** przed napisaniem wywołań modelu przeczytaj aktualną dokumentację (skill `claude-api`). Nie zgaduj nazw metod SDK. Model pochodzi z konfiguracji (`AI_MODEL`).
- **Teksty:** wszystkie teksty są w słownikach (§18), nigdy na sztywno w komponentach. Powody odrzucenia i błędy zapisujemy jako **kody**, a tłumaczymy dopiero przy wyświetlaniu.
- **Marka:** nazwa, domena, kolory marki, e-mail sprzedaży i dane operatora są tylko w `src/config/brand.ts` i `src/config/company.ts`.
- **Język kodu:** komentarze i README po polsku (decyzja domyślna, §26), identyfikatory po angielsku.
- **Środowisko chmurowe Claude Code:**
  - Gdy przeglądarka w kontenerze ma inną wersję niż przypięty Playwright, uruchamiaj testy z `PW_CHROMIUM_PATH=/opt/pw-browsers/chromium`. Konfiguracja Playwright czyta tę zmienną jako `executablePath`.
  - Nie zabijaj procesów wzorcem `pkill -f`, który pasuje do własnej powłoki. Kończ procesy po dokładnym PID.
  - Nie dodawaj do gita katalogów `.claude/worktrees` (wpis w `.gitignore`).

---

## 1. Produkt w skrócie

ScrollStop pokazuje twórcom, **w której sekundzie widzowie przestają patrzeć** na rolkę, reklamę albo film — **zanim go opublikują**.

1. Prawdziwi widzowie (własna społeczność twórcy albo płatny panel) oglądają materiał na swoim telefonie lub komputerze, w przeglądarce, bez instalowania aplikacji.
2. Kamera w przeglądarce szacuje, czy widz patrzy na ekran i gdzie. Obraz z kamery nie opuszcza urządzenia.
3. Twórca dostaje:
   - krzywą uwagi sekunda po sekundzie,
   - wynik hooka (pierwsze 3 sekundy),
   - zatrzymanie scrolla w symulowanym feedzie,
   - mapy spojrzeń, sprawdzenie, czy napisy są czytane i czy widać markę,
   - wnioski i rekomendacje w języku montażu (hook, cięcie, napis, CTA),
   - porównanie wersji A/B/C/D.

**Propozycje tekstów na stronę główną:**
- Hasło: „W której sekundzie widzowie przestają patrzeć na Twoją rolkę?”
- Wstęp: „Sprawdź hook, montaż i napisy na prawdziwych widzach, zanim opublikujesz. Widzowie oglądają na swoim telefonie, a Ty dostajesz krzywą uwagi sekunda po sekundzie, mapę spojrzeń i konkretne poprawki. Obraz z kamery nie opuszcza urządzenia widza.”
- Przyciski: „Przetestuj rolkę za darmo” i „Zobacz przykładowy raport”. Pod nimi: „Za darmo: 1 projekt i 5 widzów. Bez karty.”

---

## 2. Problem, dla kogo, czym produkt nie jest

**Problem:**
- Analityka platform przychodzi **po publikacji**, kiedy algorytm już ocenił materiał w pierwszych godzinach.
- Pokazuje, kiedy widzowie odpadają, ale nie **gdzie patrzą** ani **czy w ogóle patrzą**. Ktoś może słuchać rolki z telefonem w kieszeni.
- Wariantów hooka nie da się uczciwie porównać przed publikacją. Niektóre platformy testują miniatury dopiero po publikacji, na żywym ruchu.
- Pytanie znajomych daje deklaracje („fajne”), a nie zachowanie.

**Nasze podejście:** zachowanie (przewinięcie, czas na klipie) i wzrok (patrzy / nie patrzy, gdzie patrzy), przed publikacją, od wielu widzów, sekunda po sekundzie, z przedziałami niepewności.

**Czym produkt NIE jest:**
- predyktorem viralności ani wyświetleń,
- detektorem emocji ani „zaangażowania emocjonalnego”,
- narzędziem do oceniania ludzi, profilowania ani identyfikacji twarzy,
- zamiennikiem analityki platform,
- narzędziem do badania małoletnich (tylko 18+),
- narzędziem do pobierania treści z TikToka czy Instagrama ani do podszywania się pod ich interfejs.

---

## 3. Persony i pytania, na które odpowiadamy

| Persona | Pytania | Musi dostać | Uwagi |
|---|---|---|---|
| **Twórca solo** (TikTok, Reels, Shorts; montuje w CapCut lub Premiere) | Czy hook działa? Gdzie ludzie odpadają? Który z 3 początków wybrać? | Wynik w telefonie, prosto, szybko, tanio. Grafika z wykresem do udostępnienia. | Testuje na własnej społeczności (stronniczość, §4.9). Wszystko musi działać na telefonie. |
| **Social media manager w marce** | Czy materiał trzyma uwagę? Czy widać logo i produkt? | Raport PDF lub link dla przełożonego i klienta. Moment marki, CTA. | Zespół 2–3 osoby. |
| **Performance marketer, agencja** (paid social, reklamy UGC) | Który z 4 hooków wybrać? Czy działa bez dźwięku? Kiedy widz widzi markę? | A/B/C/D, panel grupy docelowej, test w feedzie, eksport danych, logo klienta. | Powtarzalne zlecenia, foldery klientów, faktury. |
| **YouTuber long-form** | Czy intro (pierwsze 30–60 s) trzyma? Która miniatura przyciąga wzrok? | Krzywa intro, test miniatury w siatce. | Materiały 16:9, często długie (testujemy fragmenty). |
| **Edukator, prezenter** (kursy, webinary, LinkedIn) | Kiedy ludzie przestają patrzeć na slajdy? Czy czytają tekst? | Uwaga per slajd, czytelność tekstu, heat mapy slajdów. | Karuzele i slajdy jako obrazy, nagrania jako wideo. |

---

## 4. Typy badań

Każde badanie to **projekt** z 1–4 **wersjami** (A–D). Każdy widz widzi **jedną** wersję: przydział między widzów, równoważony (§13.3).

### 4.1 Test materiału (pełny ekran)

- **Formaty:** 9:16 (rolka), 4:5 i 1:1 (post w feedzie Instagrama, LinkedIn, Facebooka), 16:9 (YouTube, prezentacja). Proporcje przechowujemy jako `width` × `height`. Przy wyświetlaniu stosujemy `object-fit: contain` z czarnymi pasami (§5.9).
- **Długość:** rolki do 3 min. Dłuższe filmy: zalecamy fragment do 10 min, twardy limit 60 min. Kreator podpowiada, że dla YouTube wystarczy często pierwsze 2–5 min.
- **Warunek dźwięku:** `on` (sprawdzamy, że widz słyszy, §10.6), `off` (wideo wyciszone, jak w feedzie) albo `viewer` (jak woli widz; zapisujemy, co wybrał).
- **Urządzenie docelowe:** telefon (domyślnie dla 9:16 i 4:5), komputer (domyślnie dla 16:9) albo dowolne. Materiał 9:16 otwarty na komputerze: ekran z prośbą o telefon i przyciskiem „Kontynuuj na tym komputerze”.
- **Wynik:** pełny raport (§7).

### 4.2 Test hooka

- To A/B/C/D, w którym wersje różnią się tylko **początkiem** (pierwsze 1–10 s). Twórca wgrywa pełne wersje albo jeden wspólny korpus i osobne początki. Wariant z korpusem: sklejanie po stronie klienta przez kolejne odtwarzanie dwóch plików, z ciągłym zegarem.
- Pole `sharedFrom` (sekunda, od której wersje są identyczne) pozwala raportowi porównywać tylko część różną i pokazać, że reszta zachowuje się podobnie.
- **Długość pokazu:** cały materiał albo „początek + 15 s” (skraca sesję i koszt panelu).
- **Raport skupia się na 0–10 s:** uwaga @1 s, @2 s, @3 s, utrzymanie hooka, czas do pierwszego spojrzenia na twarz, tekst i produkt. Rozdzielczość krzywej 0,5 s.

### 4.3 Porównanie wersji A/B/C/D

- Do 4 wersji. Przydział równoważony: kolejny widz dostaje wersję z najmniejszą liczbą sesji.
- **Statystyka:**
  - test t Welcha na średniej uwadze widza (jak w KidAttention),
  - test dwóch proporcji dla utrzymania hooka @3 s,
  - przy więcej niż 2 wersjach porównanie każdej z A i korekta Holma.
- **Werdykt** „wersja X wygrywa” tylko przy p < 0,05 po korekcie i co najmniej **15** ważnych sesjach w każdej porównywanej wersji. W KidAttention było 5; dla twórców podnosimy próg.
- **Kalkulator MDE** (minimalna wykrywalna różnica) przy ustawianiu celu liczby widzów, §5.21.

### 4.4 Test w feedzie (zatrzymanie scrolla)

Główny wyróżnik produktu.

- **Skład feedu:** domyślnie 6 pozycji, czyli 1 testowany klip i 5 wypełniaczy.
  - Wypełniacze: wcześniejsze materiały twórcy (wgrane do projektu) albo licencjonowana biblioteka (§26).
  - Pozycja testowanego klipu losowana z {2, 3, 4, 5}, nigdy pierwsza. Kolejność wypełniaczy losowa. Zapisujemy pozycję.
- **Interakcja jak w aplikacjach z rolkami:**
  - Telefon: przesunięcie w górę o ponad 60 px albo z prędkością ponad 0,3 px/ms → następny; w dół → poprzedni.
  - Komputer: kółko myszy (suma `deltaY` > 50), strzałki ↑/↓, klawisze J/K.
  - Dotknięcie wstrzymuje i wznawia (zapisujemy `pause` i `resume`).
  - Klip po końcu odtwarza się od nowa (zapisujemy `loop`).
- **Dźwięk** według warunku. Przy `on` pierwszy gest widza odblokowuje dźwięk (polityka autoodtwarzania).
- **Interfejs platformy:** opcjonalna, **neutralna** nakładka. Po prawej ikony serca, dymka i strzałki w generycznym stylu, na dole pole opisu (podpis twórcy) i „@nazwa”. **Bez logotypów, kolorów i znaków towarowych platform.**
- **Instrukcja dla widza:** „Przeglądaj tak, jak zwykle przeglądasz rolki. Przewijaj, kiedy chcesz.” Widz nie wie, który klip jest badany (badanie ślepe).
- **Koniec:** po ostatniej pozycji albo po łącznym limicie czasu (domyślnie 3 min). Jedna pozycja trwa najwyżej `max(3 × długość, 60 s)`.
- **Wynik:** zatrzymanie scrolla, czas na klipie, retencja, uwaga, „oglądają, ale nie patrzą”, porównanie z wypełniaczami (§6).

### 4.5 Test miniatury lub okładki

- **Układy:** „YouTube — strona główna (komputer, siatka 3×2)”, „YouTube — wyniki wyszukiwania (telefon, lista)”, „Siatka profilu (3 kolumny)”. Proporcje komórek konfigurowalne.
- W siatce: badana miniatura (jedna wersja na widza) i wypełniacze z tytułami. Pozycja badanej losowana. **Efekt pozycji:** zapisujemy pozycję i pokazujemy wynik z korektą.
- **Ekspozycja:** domyślnie 6 s (3–10 s), potem pytanie „Który film chcesz obejrzeć?” (dotknięcie komórki albo „Żaden”).
- **Strefy:** każda komórka i jej tytuł to automatyczna strefa zainteresowania.
- **Metryki:** udział widzów, którzy spojrzeli na badaną miniaturę; mediana czasu do pierwszego spojrzenia; udział czasu patrzenia; ranking pierwszego spojrzenia; udział wyborów (deklaracja, osobno oznaczona).

### 4.6 Karuzela i slajdy

- **Karuzela:** 2–20 obrazów (4:5, 1:1, 16:9). Widz przesuwa w bok, a „przewinięcie dalej” (w górę) kończy karuzelę.
  - Metryki: zasięg slajdu k (ilu widzów do niego doszło), czas na slajdzie, heat mapa slajdu, strefy tekstowe.
- **Slajdy, prezentacja:** obrazy wyświetlane automatycznie (sekundy na slajd) albo w tempie widza. PDF w późniejszym etapie przez renderowanie w przeglądarce (pdf.js).
  - Metryki: uwaga per slajd, heat mapa, czytelność tekstu.
- Nagranie webinaru to zwykły test materiału (§4.1).

### 4.7 Reklama (paid social)

- To test materiału albo test w feedzie z ustawieniami reklamy:
  - domyślnie dźwięk `off`,
  - gotowe typy stref: logo, produkt, twarz, tekst, CTA, cena i oferta,
  - sprawdzenie napisów (§6.13).
- **Moment marki:** mediana czasu do pierwszego spojrzenia na logo lub produkt; odsetek widzów, którzy spojrzeli na markę do 3 s, do 50% długości i przed odejściem (feed).
- **Zasięg CTA:** odsetek widzów, którzy spojrzeli na CTA lub planszę końcową, liczony spośród tych, którzy dotrwali do jej pojawienia się.

### 4.8 Strefy bezpieczne platform

- Konfiguracja w `src/config/platforms.ts`: proporcje i obszary zasłaniane przez interfejs platformy. Edytor stref i heat mapy mają przełącznik „Pokaż strefy zasłonięte”.
- **Wartości startowe są przybliżone i do sprawdzenia z aktualnymi wytycznymi platform:**

| Platforma | Góra | Dół | Prawa krawędź |
|---|---|---|---|
| TikTok | ~8% | ~22% | ~14% |
| Reels | ~10% | ~20% | ~12% |
| Shorts | ~10% | ~20% | ~13% |

- **Wniosek z reguły:** napis, logo albo CTA w strefie zasłoniętej daje ostrzeżenie w raporcie.

### 4.9 Źródła widzów

- **Własna społeczność** (link w bio, relacji, na Discordzie, w newsletterze): za darmo, ale stronniczo (fani). Raport oznacza ją etykietą „Widzowie z Twojej społeczności — mogą oceniać łagodniej niż obcy”.
- **Panel** (§16.5): widzowie spoza społeczności, dobrani według kryteriów.
- **Mieszane:** raport pokazuje segmenty osobno, gdy w każdym jest co najmniej 10 sesji.

---

## 5. Metodologia pomiaru

Przenosimy z KidAttention bez zmian, z wyjątkiem progów dla dorosłych do strojenia na pilotażu.

### 5.1 Kamera

- `getUserMedia({ audio: false, video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } } })`. Przy wybranym `deviceId`: `{ exact: deviceId }` bez `facingMode`.
- **Błędy na komunikaty:**
  - `NotAllowedError` → brak zgody, z instrukcją włączenia (osobno dla Safari na iOS),
  - `NotFoundError` i `OverconstrainedError` → nie znaleziono kamery,
  - `NotReadableError` → kamera zajęta przez inną aplikację.
- **Jedno źródło klatek na całą aplikację** (`TrackingHub`): strumień zostaje otwarty między widokami, żeby nie pytać ponownie o zgodę i nie gubić ustawionej ekspozycji.
  - Element `<video>` kamery musi być w DOM, inaczej przeglądarka nie dostarcza klatek. Trzymamy go w „doku” 2×2 px z `opacity: 0.01`, a do podglądu przepinamy go do kontenera.
  - FPS liczymy z ostatniej sekundy, czas inferencji jako średnią wykładniczą 0,9 / 0,1. Informacje dla UI co 500 ms.

### 5.2 Śledzenie twarzy

- `@mediapipe/tasks-vision` FaceLandmarker z opcjami:
  - `runningMode: 'VIDEO'`, `numFaces: 1`,
  - `outputFaceBlendshapes: true`, `outputFacialTransformationMatrixes: true`,
  - `minFaceDetectionConfidence`, `minFacePresenceConfidence` i `minTrackingConfidence` = 0,5.
- **Delegat GPU,** a przy błędzie automatycznie CPU.
- **Model** `face_landmarker.task` (float16, ok. 3,7 MB) hostowany razem z aplikacją w `public/models/`, pobierany skryptem `npm run fetch-model`. Gdy brak lokalnego, fallback na adres Google Storage. Najpierw zapytanie HEAD i sprawdzenie, czy `content-type` nie jest `text/html`, bo serwer może podać `index.html` zamiast modelu.
- **WASM** kopiowany w `postinstall` do `public/mediapipe/wasm`. Adres bazowy liczony z `new URL(import.meta.env.BASE_URL, location.href)`, żeby paczka działała w dowolnym katalogu (FTP).
- **Znaczniki czasu** do `detectForVideo` muszą **ściśle rosnąć**: `ts = max(t, lastTs + 0.01)`.
- **Czas klatki:** `requestVideoFrameCallback` z `meta.captureTime` (moment naświetlenia klatki, więc próbki nie są przesunięte o czas inferencji). Gdy go nie ma, `presentationTime`.
- **Watchdog:** gdy rVFC nie zadziała w 1500 ms (ukryte wideo w części przeglądarek), pętla `requestAnimationFrame` z `performance.now()`.

### 5.3 Cechy (11 liczb na klatkę)

- **Zasada:** NIE zakładamy, że pozycja irysa to punkt na ekranie. Mapowanie robi indywidualna kalibracja.
- **Punkty MediaPipe:**
  - prawe oko: zewnętrzny 33, wewnętrzny 133, górny 159, dolny 145, EAR [33, 160, 158, 133, 153, 144],
  - lewe oko: 263, 362, 386, 374, EAR [362, 385, 387, 263, 373, 380],
  - irysy: 468–472 i 473–477,
  - nos: 1.
- **Cechy** `[uR, vR, uL, vL, yaw, pitch, roll, scale, cx, cy, open]`:
  - `u` i `v`: przesunięcie środka irysa względem środka oka. Oś pozioma twarzy to wektor od zewnętrznego kącika prawego oka do zewnętrznego kącika lewego (kompensacja przechylenia). Wartości normalizujemy szerokością oka.
  - poza głowy: z macierzy transformacji (kąty Eulera ZYX), a gdy macierzy brak, przybliżenie z geometrii punktów.
  - `scale` = odległość środków irysów / szerokość obrazu (przybliżenie odległości od kamery).
  - `cx`, `cy` = środek oczu w kadrze (0..1).
  - `open` = średnie otwarcie oczu.
- **Mrugnięcie:** z blendshape’ów `eyeBlinkLeft` i `eyeBlinkRight` (maksimum, próg 0,55) albo z EAR (`(0,24 − EAR) / 0,1`). Oczy otwarte, gdy `blink < 0,55` i `EAR > 0,12`.
- **Odległość od kamery (cm)** = `E / (scale · 2 · tan(32,5°))` przy założeniu poziomego kąta widzenia kamery ok. 65°. Tylko do wskazówki „bliżej / dalej”.
  - **Zmiana dla dorosłych:** `E` = 6,3 cm (średni rozstaw źrenic dorosłego). W KidAttention było 5 cm dla dzieci.

### 5.4 Model wzroku (cechy → punkt na ekranie)

- **Standaryzacja z-score,** wartości przycięte do ±6σ, żeby nietypowy obrót głowy nie „wystrzelił” predykcji.
- **Kandydaci:**
  - ważona regresja grzbietowa na bazie wielomianowej 2. stopnia, λ ∈ {0,3; 3}; wyraz wolny regularyzowany 1e-6,
  - model hybrydowy: regresja liniowa (λ = 1) + kernel ridge z jądrem RBF na resztach, γ ∈ {0,3; 1; 3} × λ ∈ {0,03; 0,3}. Jądro `exp(−γ·‖a−b‖²/d)`. Waga próbki wpływa na przekątną: `1 + λ / max(w, 1e-3)`.
- **Wybór:** walidacja krzyżowa leave-one-point-out. Cały punkt kalibracji, łącznie z próbkami dojścia do niego, wypada ze zbioru treningowego. Wybieramy najmniejszy średni błąd euklidesowy.
- **Rozmiar zbioru:** najwyżej 260 próbek treningowych (równomierne przerzedzenie), co najmniej 12, inaczej błąd „Powtórz kalibrację”.
- **Nowość predykcji** (0 = dobrze pokryte danymi, 1 = ekstrapolacja): `1 − ‖L⁻¹k‖²` z modelu jądrowego (jak wariancja w procesie gaussowskim).
- Interfejs `GazePredictor` pozwala później podmienić silnik bez zmian w aplikacji.

### 5.5 Kalibracja

- **Punkty:** 10 pozycji (środek dwa razy, to samo `id`) z marginesem 8% (komputer) albo 13% w poziomie i 10% w pionie (telefon w pionie):
  `(0,5;0,5), (M;M), (0,5;M), (1−M;M), (M;0,5), (0,5;0,5), (1−M;0,5), (M;1−M), (0,5;1−M), (1−M;1−M)`.
- **Harmonogram:**
  - komputer: przejście 800 ms (ease-in-out cubic) + postój 2000 ms, cel 92 px,
  - telefon: 700 ms + 1700 ms, cel 66 px.
- **Próbki:**
  - pierwsze 450 ms postoju pomijamy (wzrok dopiero dochodzi do punktu),
  - próbki z płynnego ruchu celu mają wagę 0,3 i cel opóźniony o 150 ms,
  - próbka tylko przy wykrytej twarzy i otwartych oczach.
- **Powtórka:** jedna dla punktów z mniej niż 8 próbkami postoju albo z rozrzutem cech oczu ponad 2,5 × mediany innych punktów.
- **Test:** 5 nowych punktów (komputer: (0,3;0,3), (0,7;0,28), (0,5;0,62), (0,28;0,75), (0,72;0,72)) albo 4 (telefon: (0,3;0,28), (0,7;0,36), (0,35;0,66), (0,68;0,78)). Błąd = mediana predykcji na punkcie (co najmniej 3 próbki po 450 ms) względem celu. Wynik w % szerokości i wysokości.
- **Jakość:**
  - GOOD przy `x ≤ 8%` i `y ≤ 10%`, FAIR przy `x ≤ 15%` i `y ≤ 17%` (progi z KidAttention dla dzieci), w pozostałych przypadkach POOR.
  - **Dla dorosłych do strojenia na pilotażu.** Spodziewamy się ostrzejszych progów, np. GOOD ≤ 6% / 8%. Cel: GOOD w ≥ 60% sesji na komputerze.
- **Niepewność bazowa:** `σ₀ = max(0,03; hypot(xPct, yPct)/100/√2)`, a bez testu `max(0,03; cvError/√2)`.
- **Poza i skala referencyjna** = mediany z próbek postoju.
- **Wygląd dla dorosłych:** neutralny punkt z kurczącym się pierścieniem zamiast „iskierki” dla dzieci, cichy dźwięk przy zmianie punktu (wyłączony domyślnie), pasek postępu u góry. Na komputerze pełny ekran, ukryty kursor.
- **Przy wyniku POOR:** „Spróbuj jeszcze raz”. Po 2 próbach także „Kontynuuj mimo to”; sesja zostanie odrzucona automatycznie, ale widz nie jest karany.
- **Czas (z testem):** ok. 40 s na komputerze i ok. 35 s na telefonie. Dla dorosłych sprawdzić na pilotażu skrócenie postoju do ok. 1500 ms (wtedy ok. 30 s).

### 5.6 Jakość pojedynczej klatki

- **Brak twarzy** → `no_face` (widz nie patrzy).
- **Mrugnięcie** → `blink` (nie wiadomo).
- **Odchylenie pozy** od kalibracji ponad 25° (yaw) lub 20° (pitch) → `head_pose` (nie patrzy).
- **Zmiana skali** ponad 25% → `distance` (nie wiadomo).
- **Predykcja poza ekranem** z marginesem ponad 10% → `off_screen` (nie patrzy). Wewnątrz marginesu przycinamy do 0..1.
- **Niepewność:** `σ = σ₀ · (1 + 1,5·nowość) · (1 + 0,5·odchyleniePozy) · (1 + 0,5·odchylenieSkali) + drgania`, przycięta do 0,01–0,5. Drgania to odchylenie standardowe punktów z ostatnich 300 ms.
- **Pewność:** `faceScore · (1 − blink) · exp(−σ / 0,25)`. Próbki z pewnością poniżej 0,2 dostają flagę `low_conf` (nie wiadomo).
- **Wskaźnik jakości na żywo** z ostatnich 2 s: GOOD przy ≥ 80% ważnych próbek i średniej pewności ≥ 0,6; FAIR przy ≥ 50% i ≥ 0,35; w pozostałych przypadkach POOR.

### 5.7 Wygładzanie

Tylko do prezentacji (znacznik wzroku w laboratorium). Analizy liczymy na surowych danych.

- Filtr One Euro (Casiez i in., CHI 2012), działa w skali ok. 1000 px.
- Presety: 0 = brak; 1 = `minCutoff 1,5, beta 0,01`; 2 (domyślny) = `1,0 / 0,007`; 3 = `0,5 / 0,003` z medianą z 5 próbek.
- Reset po przerwie ponad 300 ms.

### 5.8 Synchronizacja z materiałem

- **`<video>`:** `requestVideoFrameCallback` zapisuje pary (czas wyświetlenia klatki, `mediaTime`), ostatnie 90. Czas materiału dla chwili T = ostatnia klatka przed T + upływ × prędkość.
  - Zdarzenia: `playing` (nowy odcinek odtwarzania), `pause`, `waiting` (jak pauza), `seeking` (czyści pary), `seeked` (nowy odcinek), `ended`.
- **YouTube** (IFrame API, host `youtube-nocookie.com`): `getCurrentTime()` przychodzi przez postMessage z opóźnieniem i skokami. Zegar liczy górną obwiednię obserwacji z ostatnich 3 s (odpytywanie co 50 ms).
  - Przeskok ponad 1 s → nowy odcinek odtwarzania.
  - Brak postępu ponad 1 s w stanie PLAYING → pauza (buforowanie, reklama).
  - Gotowość odtwarzacza w 20 s, start odtwarzania w 6 s, inaczej komunikat błędu.
- **Zegar ręczny** (`ManualClock`) dla klipów demo rysowanych na canvasie i dla symulacji.
- **Feed i karuzela:** każda pozycja ma własny zegar. Próbki dostają indeks pozycji (kolumna `it`, §11.3).
- **Osadzenia TikToka i Instagrama nie są w MVP źródłem pomiaru:** nie dają stabilnego, dokładnego czasu odtwarzania ani kontroli nad interfejsem i reklamami. Mierzymy tylko na pliku i na YouTube. Przed ewentualnym wsparciem sprawdź aktualne możliwości tych osadzeń.

### 5.9 Współrzędne

- Punkt ekranu (0..1) przeliczamy na obraz materiału: prostokąt obrazu przy `object-fit: contain` daje `vx`, `vy`.
- Poza obrazem (czarne pasy, interfejs feedu) → „patrzy na ekran, ale poza materiałem”.
- Na wspólnym wykresie wersji o różnych proporcjach porównujemy czas, nie położenie.

### 5.10 Kody stanu próbki (zapis kolumnowy)

```ts
export const GazeCode = {
  LOOK: 0,           // wzrok na obrazie materiału (są vx, vy)
  LOOK_OFF_MEDIA: 1, // na ekranie, poza obrazem (pasy, nakładka feedu)
  AWAY: 2,           // brak twarzy, odwrócona głowa, wzrok poza ekranem
  UNKNOWN: 3,        // mrugnięcie, niska pewność, zmiana odległości
  NOT_PLAYING: 4,    // pauza, przewijanie, koniec, przejście między pozycjami feedu
} as const;
```

**Zasada:** najbardziej odporny sygnał kamery to „patrzy / nie patrzy”, nie precyzyjny punkt.

### 5.11 Stan widza w przedziale czasu

- **Rozdzielczość:** 0,5 s dla materiałów do 60 s, 1 s dla dłuższych.
- **Decyduje większość rozstrzygających próbek:** patrzy = LOOK + LOOK_OFF_MEDIA, nie patrzy = AWAY. Wymagane co najmniej 3 rozstrzygające próbki na 1 s (2 na 0,5 s).
- **Luki:** jedna krótka luka bez rozstrzygnięcia (mrugnięcie) przejmuje stan z poprzedniego przedziału. Dłuższe luki zostają `null` (brak danych), nie fałszywe „nie patrzy”.

### 5.12 Krzywa uwagi

- Dla każdego przedziału: udział widzów, którzy patrzą (spośród tych, którzy mają dane), z 95% przedziałem Wilsona (z = 1,96) i liczbą widzów `n`.
- Średnia uwaga materiału = średnia przedziałów z danymi (każdy przedział ma tę samą wagę).
- Wygładzenie do wykrywania spadków: średnia krocząca z okna 3.

### 5.13 Spadki

- Okno wyszukiwania: `W = round(clamp(długość/5; 4; 12))` sekund.
- Szukamy największej różnicy szczyt − dołek na wygładzonej krzywej. Przy remisie wybieramy krótszy, czyli bardziej stromy.
- **Zawężenie** do stromej części: tolerancja `max(0,03; 0,15·spadek)`. Wartości z surowej krzywej, bo wygładzanie przesuwa początek spadku o ok. 1 s.
- **Odrzucamy** spadki poniżej 8 pp i wolniejsze niż 1,5 pp/s (powolne dryfowanie to nie spadek). Najwyżej 3 spadki, bez nakładania się.
- „Utraceni widzowie” = spadek × n.
- **Kontekst spadku:** segment (scena), w którym się zaczyna; `afterCut`, gdy zaczyna się od 0,5 s przed do 1,5 s po cięciu; liczba sekund od początku sceny.

### 5.14 Segmenty

- **Sceny:** gdy są co najmniej 2.
  - Wykrywanie automatyczne: klatki skalowane do 32×18, histogram RGB 4³, odległość = połowa normy L1, cięcie przy odległości ponad 0,35 i scenie co najmniej 1 s, krok `max(0,25 s; długość/1200)`.
  - Na YouTube nie da się odczytać klatek, więc tam podział ręczny albo „równe odcinki”: długości [10, 15, 20, 30, 60, 120, 300, 600] s, najwyżej 12 odcinków.
- **Bez scen — równe przedziały:**
  - do 30 s: co `max(2; round(długość/4))` s,
  - do 120 s: co 10 s,
  - dłużej: `max(15; round(długość/12/5)·5)` s.
  - Końcówka krótsza niż 1/3 przedziału dołącza do poprzedniego.
- **Ranking „do poprawy”:** `wynik = max(0; −zmiana w segmencie) + max(0; średnia materiału − średnia segmentu)`. Kwalifikuje się `wynik ≥ 0,08` przy średniej co najmniej 3 pp poniżej materiału albo zmianie ≤ −10 pp. Najwyżej 3 segmenty.

### 5.15 Heat mapy

- **Ważona estymacja gęstości (KDE):**
  - siatka o dłuższym boku 192 (krótszy proporcjonalnie, np. 108; dla pionu siatka pionowa),
  - jądro gaussowskie σ = `√(0,02² + niepewność²)`, przynajmniej 0,6 komórki,
  - waga próbki = pewność × Δt (Δt ≤ 0,1 s); obliczenia w zasięgu ±3σ.
- **Zbiorcza mapa:** gęstość każdego widza normalizujemy do sumy 1, żeby **każdy widz miał tę samą wagę**. Próbki przerzedzone do 10 Hz (3× szybciej, bez straty jakości).
- **Wyświetlanie:**
  - normalizacja do 99. percentyla (pojedynczy szczyt nie „wypala” mapy),
  - poniżej 0,03 przezroczystość,
  - krycie `0,9 · ((v − 0,03)/(0,45 − 0,03))^0,6`.
- **Paleta:** sekwencyjna, percepcyjnie równa (typu viridis/inferno), **nie tęczowa** (lekcja z przeglądu designu, §24). Legenda „mało spojrzeń → dużo”.

### 5.16 Strefy zainteresowania (AOI)

- **Prostokąt** na obrazie (0..1) aktywny w przedziale czasu. Dla obrazów i slajdów ma numer slajdu.
- **Typy:** twarz, tekst, napisy, produkt, logo, CTA, przedmiot, centralny element.
- **Metryki probabilistyczne:** próbka „wkłada” do strefy czas × prawdopodobieństwo, że wzrok tam był. Prawdopodobieństwo to iloczyn różnic dystrybuant normalnych w x i y, z σ = `max(0,05; niepewność próbki)`.
  - Widz „spojrzał”, gdy suma ≥ 0,2 s.
  - Widz jest liczony, gdy materiał był przed nim co najmniej `min(1 s; 0,5 × okno strefy)`.
  - Wyniki: zasięg z przedziałem Wilsona, udział czasu patrzenia na ekran przypadający na strefę, mediana czasu do pierwszego spojrzenia (pierwsza próbka z prawdopodobieństwem ≥ 0,5).
  - Flaga „mniejsza niż dokładność pomiaru”, gdy bok strefy jest mniejszy niż 0,12.
- **Dla dorosłych:** dolną granicę σ (0,05) stroić na pilotażu.

### 5.17 Kontrola jakości sesji

**Odrzucamy automatycznie (kody):**
- `no_calibration`: sesja z kamery bez kalibracji,
- `poor_calibration`: kalibracja POOR,
- `too_short`: mniej niż 3 s odtwarzania,
- `low_data`: mniej niż 50% przedziałów z rozstrzygniętym stanem,
- `over_limit`: ponad limit planu; sesja zapisana jako odrzucona,
- `manual`: odrzucona ręcznie przez twórcę.

**Nie odrzucamy:**
- widza, który przerwał albo przewinął dalej, bo moment odejścia to też wynik,
- sesji symulowanych: oznaczone, nie liczą się do limitów, domyślnie poza raportem.

Twórca może ręcznie odrzucić albo przywrócić sesję.

### 5.18 Poziom próby

| Ważne sesje | Poziom | Znaczenie |
|---|---|---|
| 0 | brak | brak danych |
| 1–9 | podgląd | jeden widz mocno zmienia krzywą; wnioski oznaczone „wstępne” |
| 10–29 | wynik wstępny | kierunek widać, ale decyzje ostrożnie |
| ≥ 30 | wiarygodny | wystarczy do decyzji montażowych |

Dla porównań A/B zalecamy co najmniej 50 sesji na wersję.

### 5.19 Porównanie wersji

- Średnia uwaga każdego widza (udział przedziałów, w których patrzy) i test t Welcha. Rozkład t przez regularyzowaną niekompletną funkcję beta, bez zależności; erf wg Abramowitza i Stegun 7.1.26.
- Utrzymanie hooka @3 s: test dwóch proporcji (z).
- Przy więcej niż 2 wersjach: każda kontra A, korekta Holma.
- Segmenty porównujemy po indeksie sceny (gdy obie wersje mają tę samą strukturę) albo w równych przedziałach krótszej wersji. Największą różnicę w segmencie zgłaszamy, gdy ≥ 5 pp.
- Strefy o tej samej nazwie (bez rozróżniania wielkości liter) porównujemy między wersjami.

### 5.20 Feed: sygnały zachowania

- **Zdarzenia** pozycji: `enter`, `swipe_next`, `swipe_prev`, `pause`, `resume`, `loop`, `end_cap`, `mute`, `unmute`, z czasem od początku sesji.
- **Retencja w czasie klipu** = udział widzów wciąż na klipie w sekundzie t. Widz, który obejrzał do końca, liczy się do końca pierwszej pętli.
- **Uwaga w czasie klipu:** jak w §5.11, liczona tylko, gdy widz jest na klipie.

### 5.21 Kalkulator wielkości próby (MDE)

- Wzór dla dwóch proporcji przy α = 0,05 (dwustronnie) i mocy 80%:
  `n_na_wersję ≈ (1,96 + 0,84)² · [p₁(1−p₁) + p₂(1−p₂)] / (p₁ − p₂)²`.
- W kreatorze: „Przy 30 widzach na wersję wykryjesz różnicę utrzymania hooka od ok. X pp”. X liczony dla p₁ = 0,7.
- Odwrotnie: „Żeby wykryć 10 pp różnicy, potrzebujesz ok. N widzów na wersję”.

### 5.22 Zastrzeżenia (zawsze widoczne w metodzie raportu)

- „Śledzenie wzroku kamerą internetową to szacunek kierunku patrzenia, a nie profesjonalny eye tracker.”
- „Wynik opisuje materiał, a nie widzów. To nie jest ocena psychologiczna.”
- „Kamera internetowa myli się średnio o 5–15% szerokości ekranu (zależnie od urządzenia i światła). Dlatego raport opiera się na sygnale „patrzy / nie patrzy” i dużych obszarach, a każda wartość ma przedział niepewności.” Zakres doprecyzować po pilotażu.

---

## 6. Metryki dla twórców (definicje)

1. **Uwaga (t):** udział widzów patrzących na ekran w przedziale t (§5.12).
2. **Średnia uwaga:** średnia z przedziałów z danymi.
3. **Hook @1 s / @2 s / @3 s:** uwaga w danej sekundzie (wygładzona).
4. **Utrzymanie hooka:** spośród widzów patrzących w 0–0,5 s, odsetek patrzących w 2,5–3,0 s.
5. **Koniec:** średnia uwaga w ostatnich 3 s (dla materiałów ≥ 6 s).
6. **Największy spadek:** z §5.13 (od–do, pp, utraceni widzowie).
7. **Zatrzymanie scrolla** (feed):
   - zachowanie: odsetek widzów, którzy zostali na klipie ≥ T_stop (domyślnie 2,0 s, ustawiane 1–3 s),
   - wzrok: odsetek tych, którzy w pierwszych 2 s patrzyli na klip przez ≥ 50% czasu.
8. **Czas na klipie** (feed): mediana i średnia, z porównaniem do średniej wypełniaczy i przedziałem bootstrap 95%.
9. **Obejrzenie do końca** (feed): odsetek widzów, którzy dotrwali do końca pierwszej pętli. Do tego średnia liczba pętli.
10. **Oglądają, ale nie patrzą** (feed): udział czasu na klipie, w którym wzrok był AWAY. Wskazuje słuchanie bez patrzenia albo rozproszenie.
11. **Retencja (t)** (feed): udział widzów wciąż na klipie.
12. **Zasięg strefy, czas do pierwszego spojrzenia, udział patrzenia:** z §5.16.
13. **Czytelność napisu** (strefa typu tekst lub napisy z liczbą słów `words`):
    - potrzebny czas = `words / 3 słowa na sekundę + 0,5 s` (tempo konfigurowalne 2,5–4),
    - flaga „za krótko na ekranie”, gdy czas ekspozycji strefy jest krótszy niż potrzebny,
    - flaga „mało kto przeczytał”, gdy mediana czasu patrzenia u patrzących < 50% potrzebnego,
    - opcjonalnie później: liczba słów z OCR.
14. **Moment marki:** z §4.7.
15. **Zasięg CTA:** z §4.7.
16. **Miniatura:** prawdopodobieństwo spojrzenia, czas do pierwszego spojrzenia, udział patrzenia, ranking pierwszego spojrzenia, udział wyborów (deklaracja).
17. **Karuzela:** zasięg slajdu, czas na slajdzie, slajd porzucenia.
18. **Deklaracje** (pytania po obejrzeniu): osobna sekcja z etykietą „Deklaracje widzów, nie pomiar”.

---

## 7. Raport

Raport liczymy po stronie klienta z sesji. Ten sam kod raportu (`src/research/report.ts`) działa w przeglądarce i na serwerze (link udostępniania, AI).

**Sekcje w kolejności:**

1. **Nagłówek:**
   - przełącznik przykładów (w raporcie demo),
   - linia próby: „31 widzów, 18–34 lata; telefon 24, komputer 7; dźwięk wyłączony; feed”,
   - odznaki: poziom próby (wiarygodna / wstępny / mała próba / brak danych), źródło widzów, „Przykładowy raport z symulowanego panelu” w demo,
   - wybór wersji (legendy kolorów wersji),
   - ostrzeżenie przy próbie poniżej 30: „31 z 50 widzów. Pasmo wokół krzywej pokazuje, jak bardzo wynik może się jeszcze zmienić”.
2. **Zdanie otwierające** (funkcja `headline()`, też na stronie głównej):
   - spadek: „Największy spadek uwagi wystąpił między 00:06 a 00:09 (scena 2).” + „Odsetek patrzących spada z 91% do 52%, czyli o 39 pp. Średnio przez cały materiał patrzy 78% widzów.”,
   - stabilnie: „Uwaga utrzymuje się stabilnie: średnio patrzy X% widzów.” + „Krzywa nie ma spadków większych niż 10 pp.”,
   - pusto: „Raport pojawi się po pierwszej ważnej sesji.”
3. **Karta hooka:** @1 s, @3 s, utrzymanie hooka, zatrzymanie scrolla (feed), mini-krzywa 0–10 s co 0,5 s.
4. **Wykres uwagi** (i retencji w feedzie):
   - SVG, szerokość mierzona `ResizeObserver` (minimum 240 px), wysokość ok. 280 px,
   - oś Y 0–100% z liniami co 25%, pasmo 95% przedziału, linia 2 px,
   - spadki: żółte chorągiewki z numerem i zakreślony przedział (krycie 16%),
   - pas scen pod wykresem z wyróżnieniem scen „do poprawy”, oś czasu,
   - najechanie: pionowa linia i podpowiedź „X% patrzy; N z M widzów, przedział lo–hi”,
   - klawiatura: strzałki przesuwają kursor po przedziałach, Enter wybiera moment; `role="group"` z opisem obsługi,
   - kliknięcie: panel momentu z klatką, odsetkiem patrzących i heat mapą z okna ±1 s.
   - W feedzie dwie linie: retencja (zachowanie) i uwaga (wzrok), legenda zawsze, etykiety bezpośrednie.
5. **Liczby pod wykresem:** średnio patrzy, po 3 sekundach (podpowiedź „czy początek zatrzymuje”), w ostatnich 3 s, największy spadek (pp i przedział).
6. **„Co poprawić”** (§8): karty wniosków z numerem, wagą (duży problem / do sprawdzenia / działa), przyciskiem „Pokaż 00:07” (przewija wykres i otwiera moment) oraz polami Fakt, Obserwacja, Hipoteza, Rekomendacja.
   - W planie bez rekomendacji: hipoteza i rekomendacja zablokowane z informacją o planie.
   - Przycisk „Opisz rekomendacje językiem montażu (AI)” w wyższym planie.
7. **Sceny lub przedziały:** tabela: scena, czas, średnia (z paskiem), zmiana w trakcie (pp, kolor statusu z kontrastem AA), odznaka „Do poprawy #1”. Na telefonie lista kart zamiast tabeli.
8. **Gdzie patrzą widzowie:** heat mapy scen (miniatura klatki ze środka sceny + mapa), opis „00:00–00:12, patrzy 96%”, legenda palety, przełącznik stref bezpiecznych.
   - Dla YouTube tło to miniatura filmu, nie klatka: informacja „Tłem jest miniatura z YouTube, nie klatka z tej sceny”.
   - Dla pliku z innego serwera bez CORS: „Wczytaj plik, aby zobaczyć klatki”.
9. **Strefy zainteresowania:**
   - tabela: strefa, typ, czas, „Spojrzało widzów” (X%, „N z M”), udział patrzenia, pierwsze spojrzenie („po 1,5 s”), flagi czytelności i strefy zasłoniętej,
   - edytor stref: zaznaczenie prostokąta na klatce przeciągnięciem, typ, nazwa (np. „Twarz”, „Napis HOOK”, „Logo”), od–do (s), liczba słów dla tekstu.
10. **Feed** (jeśli test w feedzie): zatrzymanie scrolla (zachowanie i wzrok), czas na klipie wobec wypełniaczy, obejrzenie do końca, pętle, „oglądają, ale nie patrzą”, rozkład momentów przewinięcia.
11. **Porównanie wersji:**
    - wspólny wykres (kolory wersji stałe: A `#2747D6`, B `#EB6834`, C i D z walidacji palety §19.4),
    - tabela segmentów z różnicą (B − A),
    - strefy porównane,
    - test („Test t Welcha na średniej uwadze widzów: p = 0,023. Różnica jest rozstrzygająca przy p < 0,05 i co najmniej 15 widzach w każdej wersji.”),
    - zdanie werdyktu.
12. **Deklaracje widzów:** odpowiedzi na pytania po obejrzeniu, z etykietą.
13. **Jak liczymy** (zwijane): definicja „patrzy”, liczba sesji (łącznie / w raporcie / odrzucone automatycznie z powodami), jakość kalibracji (dobra / średnia / słaba), zastrzeżenia §5.22, zasady etyczne.
14. **Eksport:**
    - „Pobierz PDF” przez okno drukowania z instrukcją; Free ma znak wodny,
    - **link do raportu** tylko do odczytu, z datą wygaśnięcia (§13),
    - **grafika do udostępnienia** (§7.1),
    - CSV i JSON surowych danych (wyższy plan, §16).

### 7.1 Grafika do udostępnienia (pętla wzrostu)

- Generowana w przeglądarce (canvas) w formatach 1080×1350 (4:5) i 1080×1920 (9:16): wykres uwagi, największy spadek albo wynik hooka, nazwa materiału (opcjonalnie), znak marki i „Zbadane w ScrollStop”.
- Tylko dane zbiorcze. Nigdy dane pojedynczych widzów. Free: grafika ze znakiem wodnym.

### 7.2 Druk i PDF

- `@page { size: A4; margin: 14mm }`, białe tło.
- Klasy `.no-print` (ukrywa przyciski), `.print-break` (nowa strona), `.print-avoid` (bez łamania).
- Znak wodny Free: tekst obrócony o −28°, 64 px, krycie 7%, widoczny tylko w druku.

---

## 8. Wnioski z reguł i rekomendacje AI

### 8.1 Struktura wniosku

```ts
interface Finding {
  id: string;
  kind: 'drop' | 'weak_segment' | 'hook' | 'ending' | 'aoi_missed' | 'text_unread' | 'unsafe_zone'
      | 'brand_late' | 'cta_missed' | 'feed_skip' | 'strong';
  severity: 'high' | 'medium' | 'positive';
  title: string;
  fact: string;               // tylko zmierzone liczby
  observation: string | null; // wzorzec w danych
  hypothesis: string | null;  // możliwa przyczyna, zaznaczona niepewność
  recommendation: string | null; // konkretna zmiana montażowa
  t0: number; t1: number;
  preliminary: boolean;       // próba < 10
}
```

### 8.2 Reguły i progi

| Wniosek | Warunek | Waga |
|---|---|---|
| Spadek | spadek ≥ 10 pp | high, gdy ≥ 20 pp |
| Słaby segment | ranking §5.14 i brak spadku ≥ 10 pp w tym segmencie | high, gdy średnia ≥ 15 pp poniżej materiału |
| Hook | uwaga @3 s poniżej 0,90 (pion) lub 0,85 (poziom), brak innego wniosku w 0–3 s | high, gdy o ponad 15 pp poniżej progu |
| Koniec | ostatnie 3 s ponad 10 pp poniżej średniej | medium |
| Strefa niezauważona | zasięg < 50% przy n ≥ 3 | high, gdy < 30%; dopisek, gdy strefa mała |
| Napis nieprzeczytany | flagi §6.13 | medium (high przy obu flagach) |
| Strefa zasłonięta | tekst, logo lub CTA w strefie zasłoniętej (§4.8) | medium |
| Marka za późno | mediana pierwszego spojrzenia na logo lub produkt > 3 s albo zasięg marki < 50% | medium |
| CTA niezauważone | zasięg CTA < 50% | medium |
| Feed: przewijają | zatrzymanie scrolla niższe niż u wypełniaczy, różnica istotna | high |
| Działa | najlepszy segment ≥ 5 pp powyżej średniej, przy co najmniej 2 segmentach | positive |

**Kolejność:** high, medium, positive. Najwyżej 6 wniosków.

**Wybór rekomendacji przy spadku:**
- spadek w pierwszych 3 s materiału pionowego → „początek”,
- zaraz po cięciu → „otwarcie sceny”,
- ≥ 2 s w głąb sceny → „scena za długa”,
- w pozostałych przypadkach → ogólna.

### 8.3 Przykładowe teksty (pl, w słowniku `research`, funkcje z parametrami)

- **Spadek, tytuł:** „Scena 2: spadek uwagi o 39 pp (00:06–00:09)”.
- **Spadek, fakt:** „Między 00:06 a 00:09 odsetek patrzących spada z 91% do 52% (−39 pp, ok. 12 z 31 widzów).”
- **Początek rolki:**
  - obserwacja: „Spadek zaczyna się w pierwszych sekundach.”,
  - hipoteza: „Pierwszy kadr nie daje powodu, by zostać.”,
  - rekomendacja: „Zacznij od najmocniejszego kadru i obietnicy w pierwszej sekundzie: twarz, akcja albo wynik. Bez intra i logo na start.”
- **Po cięciu:**
  - hipoteza: „Nowe ujęcie nie ma punktu zaczepienia dla wzroku (twarz, ruch, napis).”,
  - rekomendacja: „Otwórz scenę 3 mocniej: zbliżenie, ruch albo krótki napis w pierwszej sekundzie ujęcia.”
- **Scena za długa:**
  - hipoteza: „Scena jest w tym miejscu za długa lub zbyt statyczna.”,
  - rekomendacja: „Skróć scenę 2 o ok. 3 s albo dodaj zmianę kadru (pattern interrupt) przed 00:06.”
- **Napis nieprzeczytany,** rekomendacja: „Zostaw napis na ekranie co najmniej 2,5 s albo skróć go do 5–6 słów; przenieś go w miejsce, w które patrzą widzowie.”
- **Strefa zasłonięta,** rekomendacja: „Przesuń napis wyżej: dolne ok. 20% kadru zasłania opis i przyciski platformy.”
- **Marka za późno,** rekomendacja: „Pokaż produkt lub logo w pierwszych 3 sekundach, najlepiej w ręku albo przy twarzy.”
- **Działa,** rekomendacja: „Zachowaj ten fragment; to dobry wzorzec tempa dla reszty materiału.”
- **A/B, wynik niejasny:** „Średnia uwaga: A 78%, B 81%. Różnica mieści się w granicach niepewności (za mało widzów w jednej z wersji).”
- **A/B, zwycięzca:** „Wersja B utrzymuje uwagę średnio o 9 pp wyżej (86% wobec 77%).” + „Największa różnica: scena 1, wersja B o 17 pp wyżej.”

### 8.4 Kontrakt AI

- **Wejście:** tylko zagregowane metryki:
  - nazwa i format materiału, platforma, długość, liczba widzów, poziom próby,
  - średnia uwaga, @3 s, ostatnie 3 s,
  - krzywa (procenty),
  - spadki (od, do, %, pp, utraceni, n, segment, po cięciu, sekundy w głąb segmentu),
  - segmenty, strefy, metryki feedu i wnioski z reguł.
  - Bez danych osobowych i surowych próbek.
- **Wyjście:** JSON Schema `{ insights: [{ title, fact, observation|null, hypothesis|null, recommendation, t0, t1 }] }` (`additionalProperties: false`, wszystkie pola wymagane).
- **Walidacja odpowiedzi:**
  1. najwyżej 6 wniosków; tytuł ≤ 160 znaków, fakt i rekomendacja ≤ 600,
  2. każda liczba w tekście (po zaokrągleniu, także z przecinkiem) musi być w zbiorze dozwolonym: liczby z metryk, części znaczników czasu (00:07 → 0, 7), liczby z tekstów reguł oraz 1, 2, 3, 30,
  3. zakazane treści (wyrażenia regularne w każdym języku): diagnozy i zaburzenia; emocje i stany psychiczne widzów („znudzeni”, „frustracja”, „ekscytacja”, „emocj*”); gwarancje i obietnice („gwarantuje”, „viral”, „milion wyświetleń”, „zwiększy zasięg o”); stereotypy demograficzne,
  4. wniosek niezgodny jest odrzucany i liczony („odrzucono N propozycji z liczbami spoza danych”).
- **Przy odmowie modelu,** przekroczeniu `max_tokens`, błędzie API albo pustym wyniku: wnioski z reguł (`source: 'rules'`). Ten sam format odpowiedzi.
- **Prompt systemowy** (szkic, dopracować):
  > Jesteś analitykiem badań uwagi widzów dla twórców treści w social media. Dostajesz wyłącznie zagregowane metryki z badania wzroku kamerą internetową: krzywą odsetka widzów patrzących na materiał, retencję w feedzie, spadki, sceny, strefy zainteresowania i wnioski z reguł. Pisz rzeczowo, językiem montażysty i twórcy (hook, cięcie, napis, zbliżenie, CTA), w języku podanym w wiadomości. Każdy wniosek rozdziel na fakt (liczby z metryk), obserwację, hipotezę (zaznacz niepewność) i rekomendację (konkretna zmiana montażowa). Używaj wyłącznie liczb z danych. Nie przewiduj wyświetleń, zasięgów ani viralności. Nie przypisuj widzom emocji, cech ani intencji; opisuj materiał i zachowanie wzroku. Przy próbie innej niż „reliable” zaznacz, że wynik jest wstępny. Zwróć 1–5 wniosków od najważniejszego; t0 i t1 to sekundy materiału.
- **Wiadomość użytkownika:** `Język odpowiedzi: <nazwa> (<kod>).\nMetryki badania (JSON):\n<json>`.
- **Wywołanie:** ustrukturyzowany JSON (format odpowiedzi według schematu), średni wysiłek rozumowania, `max_tokens` 16 000, 2 ponowienia, timeout 120 s. Jeśli API ma automatyczny model zapasowy przy odmowie, włącz go. Szczegóły z aktualnej dokumentacji (skill `claude-api`).
- **Serwer:**
  - pamięć podręczna wyniku AI po `sha256(model:język:JSON wejścia)` (tabela `insights_cache`),
  - limit 30 zapytań na godzinę na konto,
  - wymagany plan z rekomendacjami (402 z kodem `feature_recommendations`).
- **W interfejsie:**
  - „Tekst: <model>. AI dostaje tylko policzone metryki…”, z liczbą odrzuconych propozycji,
  - przy braku AI na serwerze: „AI jest niedostępne, pokazujemy rekomendacje z reguł”.

---

## 9. Studio twórcy (panel)

**Ścieżki (hash routing, angielskie):** `#/app`, `#/app/new`, `#/app/p/<id>/prepare|collect|report|technical`, `#/app/account`, `#/app/workspace`.

**Nagłówek panelu:**
- znak marki (na ekranach < 400 px bez nazwy), okruszki „Projekty / <nazwa>”,
- przełącznik języka, plan („Plan Free” z kropką statusu, link do konta), wyloguj (tryb serwerowy).
- W trybie lokalnym pasek informacyjny: „Tryb lokalny: projekty i sesje zapisują się tylko w tej przeglądarce. Link dla widzów działa bez serwera, a wyniki wracają do Ciebie jako pliki sesji.”

### 9.1 Projekty

- Tytuł, opis („Każdy projekt to jeden materiał albo kilka wersji, link dla widzów i raport zbiorczy”), przycisk „Nowy projekt”.
- Linia limitów planu: „Plan Creator: 2 z 5 aktywnych projektów, 41 z 150 widzów w tym miesiącu”.
- **Karta projektu:** ikona formatu (telefon / monitor / siatka), nazwa, meta („Hook, 9:16, TikTok, wersje A–C”), pasek postępu „18 z 30 widzów”, status (zbiera / wstrzymany / zamknięty).
- **Pusty stan:** „Pierwszy projekt zajmuje 2 minuty” + „Utwórz projekt” + „Zobacz przykładowy raport”.

### 9.2 Kreator nowego projektu

Kroki numerowane, wszystko można zmienić później.

1. **Co chcesz sprawdzić?** Karty wyboru:
   - Cały materiał („Krzywa uwagi i sceny do poprawy”),
   - Hook („Który początek zatrzymuje”),
   - Wersje A–D („Widzowie losowo dostają jedną wersję, raport je porównuje”),
   - Test w feedzie („Czy widzowie zatrzymują scroll na Twoim klipie”),
   - Miniatura lub okładka,
   - Karuzela lub slajdy.
2. **Gdzie opublikujesz?** TikTok, Reels, Shorts, post w feedzie Instagrama (4:5 / 1:1), YouTube (16:9), LinkedIn, inne. Wybór ustawia proporcje, strefy bezpieczne i urządzenie docelowe.
3. **Materiał** (dla każdej wersji):
   - zakładki: Wgraj plik / YouTube / Link do pliku / Klip demo,
   - wgrywanie z telefonu (paski postępu, wznawianie przy zerwaniu); limity: wideo MP4, MOV, WebM do `MAX_VIDEO_MB`; obrazy PNG, JPG, WebP do `MAX_IMAGE_MB`,
   - po dodaniu: podsumowanie (rodzaj, długość, proporcje) i „Zmień”,
   - ostrzeżenie, gdy proporcje materiału nie pasują do platformy.
   - **Komunikaty:**
     - „Nie udało się odczytać filmu. Sprawdź, czy link prowadzi bezpośrednio do pliku MP4 lub WebM.”
     - „To nie wygląda na link do filmu z YouTube.”
     - „Film wygląda na prywatny lub usunięty.”
     - „Właściciel prawdopodobnie nie pozwala odtwarzać tego filmu poza YouTube.”
     - „Film musi być dostępny przez HTTPS.”
     - Plik lokalny: „Plik zostaje na tym komputerze. Z takim materiałem badanie działa tylko na tym urządzeniu.”
4. **Warunki:** dźwięk (włączony / wyłączony / jak woli widz), kontekst (pełny ekran / feed / siatka), interfejs platformy (brak / neutralny), urządzenie docelowe. Dla feedu: wypełniacze i T_stop. Dla siatki: układ, ekspozycja, pytanie o wybór.
5. **Widzowie:** źródło (społeczność / panel), przedziały wieku, kraje, pytania przesiewowe (korzystanie z platform), cel liczby widzów (domyślnie 30, przy A/B 50 na wersję) z kalkulatorem MDE, pytania po obejrzeniu (0–3 z gotowej listy).
6. **Nazwy i język:** nazwa projektu („Widzisz ją tylko Ty”), nazwa twórcy lub marki („Widzowie zobaczą ją na ekranie zgody”), język badania („Widzowie zobaczą zgodę i instrukcje w tym języku”).

**Przycisk:** „Utwórz projekt i link do badania”. Długa etykieta łamie się na wąskim ekranie (lekcja §24). Obok powód, dla którego przycisk jest nieaktywny („Dodaj materiał.”, „Podaj nazwę twórcy.”). Podczas wgrywania: „Wgrywam materiał A: 42%”.

**Paywall przy tworzeniu:** 402 `active_projects` → okno planu.

### 9.3 Przygotuj test

- **Link do badania:**
  - pole do skopiowania i **kod QR** (do relacji),
  - „Jeden link dla wszystkich: widzowie dostają wersje A–D po równo”,
  - podpowiedź urządzenia („Widz otwiera link na telefonie trzymanym pionowo”).
- **Badanie na tym urządzeniu:** „Rozpocznij badanie tutaj”. Sesja zapisuje się od razu w projekcie; dobre do sprawdzenia na sobie.
- **Link bez serwera** (tryb lokalny): konfiguracja zakodowana w adresie (§12.4).
  - Instrukcja: „Po badaniu widz pobiera plik z wynikami (tylko współrzędne wzroku) i odsyła go Tobie. Dodasz go w kroku Zbierz widzów.”
  - Przy wersjach A–D osobny link na wersję („Wyślij link A połowie widzów, a link B drugiej połowie”).
  - Plik lokalny: „Materiał jest plikiem na tym komputerze, więc widzowie u siebie go nie zobaczą. Dodaj YouTube albo link do pliku.”
- **Gotowe wiadomości** w języku badania, każda z przyciskiem kopiowania: relacja, opis posta, wiadomość prywatna, Discord, newsletter. Przykład:
  > „Pomóż mi poprawić nową rolkę: obejrzyj ją przed premierą (ok. 2 minuty, w przeglądarce, bez instalowania). Kamera tylko szacuje, gdzie patrzysz, a obraz nie wychodzi z Twojego telefonu. Link: …”
- **Podgląd widza:** „Chcesz zobaczyć, co widzi widz? Przejdź badanie bez kamery” (`?sim=1`, wzrok symulowany, sesja oznaczona jako symulacja).
- **Zbieranie widzów:** Otwarte / Wstrzymane / Zamknięte (przełącznik segmentowy).
- **Materiał i sceny** (dla każdej wersji):
  - karta: film, źródło, długość („poznamy po pierwszej sesji”), sceny jako odznaki „Scena 1: 00:00–00:05”,
  - akcje: „Wykryj sceny automatycznie” (postęp „Analizuję klatki… 40%”), „Podziel na odcinki po 10 s”, pole „cięcie w sekundzie” + „Dodaj cięcie”, „Wyczyść sceny”,
  - komunikaty: YouTube („Klatek filmu z YouTube nie da się analizować w przeglądarce. Dodaj cięcia ręcznie albo podziel film na odcinki.”), CORS („Serwer z filmem nie pozwala odczytać klatek”).
- **Strefy zainteresowania:** edytor (§7, pkt 9) i przełącznik stref zasłoniętych.
- **Ustawienia badania:** nazwa twórcy, język badania, przedziały wieku, cel liczby widzów („Wiarygodna krzywa od 30”), usuwanie sesji po (30 / 90 / 180 / 365 dni, „Automatycznie, bez Twojego udziału”).
- **Usuń projekt:** „Usunąć projekt ze wszystkimi sesjami? Tego nie da się cofnąć.” Przycisk „Usuń projekt i sesje” („Usuwa też dane wszystkich widzów z tego badania”).
- **Plik lokalny po odświeżeniu strony:** „Wybierz ponownie plik «nazwa»”, bo przeglądarka nie pamięta plików między odświeżeniami. Inny plik → ostrzeżenie.

### 9.4 Zbierz widzów

- **Postęp:** „18 z 30 widzów”, „Brakuje 12 widzów do celu” albo „Cel osiągnięty”, pasek z etykietą dostępności.
- **Liczniki:** wszystkie sesje, odrzucone, urządzenia, kalibracja („dobra 14, średnia 3, słaba 1”).
- **Paywall po limicie:**
  - „Masz już pierwszą krzywą uwagi.” + plany i panel,
  - przy limicie miesięcznym: „Link przestał przyjmować sesje.”
- **Pliki sesji od widzów** (tryb lokalny): „Dodaj pliki sesji (.json)” z ikoną wysyłania; każdy plik przechodzi kontrolę jakości. Wynik: „Dodano 5 sesji, pominięto 1 (duplikaty, limit planu albo uszkodzone dane)”.
- **Tabela sesji:** uczestnik (losowy id), wersja, urządzenie, kalibracja (odznaka + błąd %), wiarygodne dane (%), status („W raporcie” / „Odrzucona” + powód przetłumaczony z kodu), akcje („Odrzuć” / „Przywróć”, „Usuń sesję” z potwierdzeniem). Na telefonie karty zamiast tabeli.
- **Pusty stan:** „Nikt jeszcze nie wziął udziału. Wyślij link z kroku Przygotuj test.”

### 9.5 Analiza techniczna

- Tabela sesji z detalami: urządzenie i ekran, błąd kalibracji x/y, liczba próbek, wiarygodne sekundy, „Otwórz w laboratorium” (ścieżka wzroku, fiksacje, statystyki).
- Eksport surowych danych JSON i CSV (plan z `rawExport`). Nazwa pliku `<brand>_<projectId>.json|csv`. CSV: nagłówek metadanych, potem wiersz na próbkę.

### 9.6 Konto i zespół

- **Konto:** plan (odnowienie, zaległa płatność z odnośnikiem do portalu), wykorzystanie, plany, dane (e-mail, imię i nazwisko, firma = domyślna nazwa twórcy), logo do raportu (PNG, JPG, WebP ≤ 150 kB, plan z `clientLogo`).
- **Usuń konto:** wpisanie słowa potwierdzenia: pl „USUŃ”, en „DELETE”, de „LÖSCHEN”, es „ELIMINAR”, it „ELIMINA”. Najpierw anulowanie subskrypcji w portalu.
- **Zespół** (`#/app/workspace`): członkowie (właściciel / edytor / widz raportu), zaproszenie linkiem z tokenem (7 dni), foldery klientów (plan Agency).
- **Po płatności:** „Dziękujemy, płatność przyjęta. Plan będzie aktywny w ciągu kilku sekund.” Po anulowaniu: „Płatność anulowana. Plan się nie zmienił.”

### 9.7 Logowanie i rejestracja (tryb serwerowy)

- Pola: imię i nazwisko, firma lub kanał, e-mail służbowy, hasło (co najmniej 10 znaków).
- Komunikaty po kodach: `invalid_email`, `weak_password`, `exists`, `bad_credentials`.
- Odpowiedź nie zdradza, czy e-mail istnieje (§15).

---

## 10. Przebieg badania dla widza

**Ścieżki:** `#/s/<token>` (serwer), `#/p/<base64url>` (link samowystarczalny), `#/delete/<sessionId>` (usuwanie danych).

**Stany:** `device → consent → screener → prepare → check → sound → calibrate → watch|feed|grid|carousel → questions → finish`.

**Wspólne:**
- Cały przebieg w **języku badania** z projektu (zagnieżdżony provider językowy, §18), niezależnie od przeglądarki widza.
- Duże przyciski (wysokość 56 px), szerokość ekranu do 448 px (zgoda do 672 px), bezpieczne obszary telefonu (`env(safe-area-inset-*)`), `min-height: 100dvh`.

### 10.1 Urządzenie

Materiał pionowy na komputerze: „To badanie jest przygotowane na telefon. Najlepiej otwórz ten sam link na telefonie i trzymaj go pionowo.” + „Kontynuuj na tym komputerze”.

### 10.2 Zgoda (dorosły)

- Nazwa twórcy (akcent), tytuł „Zaproszenie do krótkiego badania materiału wideo”.
- Kroki: przygotowanie (ok. 1 min), kalibracja („śledzisz wzrokiem punkt, ok. 40 s”), oglądanie (ok. X s albo „ok. X min”), [krótkie pytania].
- **Ramka „Co dzieje się z danymi”:**
  - „Kamera służy tylko do określenia, w którą część ekranu patrzysz. **Obraz z kamery nie opuszcza tego urządzenia** i nie jest nigdzie zapisywany.”
  - „Zapisujemy: kierunek wzroku na materiale, czas, jakość pomiaru, przedział wieku, kraj (jeśli podasz) i typ urządzenia, z losowym numerem uczestnika. Nie zapisujemy imienia, kontaktu, nagrań ani punktów twarzy. Dane otrzymuje {twórca} i są automatycznie usuwane po {dni} dniach.”
  - Link „Pełna informacja o prywatności” (nowa karta).
- **Pole wieku** (przedział). Wybór poniżej 18 kończy badanie: „To badanie jest dla osób pełnoletnich. Dziękujemy za chęć udziału!”
- **Pola zgody:**
  - „Mam ukończone 18 lat.”
  - „Zgadzam się na zapisanie opisanych wyżej danych o kierunku wzroku w celu badania materiału. Rozumiem, że obraz z kamery nie opuszcza urządzenia.”
- Przycisk „Zgadzam się i przechodzę dalej” (nieaktywny bez obu zgód). Pod spodem: „Zgodę możesz wycofać w każdej chwili, przerywając badanie. Wtedy nic nie zostanie wysłane.”
- **Zapis zgody:** `{ version, acceptedAt, adult: true, processing: true, localOnly: true, lang }`. Wersja w formacie `RRRR-MM-vN`; zmiana treści zgody = nowa wersja.
- **Tryb testowy:** odznaka „Tryb testowy: bez kamery, wzrok symulowany”.

### 10.3 Pytania przesiewowe

Opcjonalne, tylko listy wyboru, bez pól tekstowych: kraj (lista), jak często oglądasz TikTok / Reels / Shorts / YouTube (codziennie / co tydzień / rzadziej / wcale).

**Nigdy nie pytamy** o zdrowie, poglądy, wyznanie, orientację, pochodzenie. Płeć tylko jako opcja właściciela, wyłączona domyślnie, z „Wolę nie podawać”.

### 10.4 Przygotowanie

- **Telefon:** „Postaw telefon pionowo, np. oparty o kubek”; „Usiądź naprzeciw ekranu, ok. 30–40 cm”; „Światło z przodu, nie okno za plecami”; „Kamera przednia na górze ekranu, nie zasłaniaj jej”.
- **Komputer:** „Usiądź ok. 50–65 cm od ekranu”; światło; „Wycisz powiadomienia”.
- **Ramka:** jak zakończyć badanie (telefon: przytrzymaj ekran 1,5 s; komputer: Esc).
- Przycisk „Włącz kamerę”.

### 10.5 Sprawdzenie kamery

- Podgląd lustrzany (`-scale-x-100`), „Podgląd widzisz tylko Ty. Obraz nie jest nagrywany.”
- **Lista kontrolna co 330 ms:**
  - orientacja (telefon pionowo dla 9:16),
  - twarz widoczna, oczy widoczne,
  - twarz na środku: środek oczu x 0,25–0,75 i y 0,15–0,75 (ostrzeżenie),
  - odległość: telefon 20–55 cm, komputer 45–85 cm; komunikaty „za blisko / za daleko” (ostrzeżenie),
  - jasność: średnia luminancja klatki 32×18 > 70/255, inaczej „Za ciemno” (ostrzeżenie).
- „Dalej” aktywne, gdy kamera działa, orientacja jest dobra, a twarz i oczy są widoczne nieprzerwanie od 800 ms.
- **Błąd kamery:** komunikat + instrukcja odblokowania (iOS: „Ustawienia, Safari, Kamera”) + „Spróbuj ponownie”.

### 10.6 Sprawdzenie dźwięku (warunek `on`)

- Krótki dźwięk testowy + „Słyszę dźwięk” / „Nie słyszę”.
- „Nie słyszę” → instrukcja: przełącznik wyciszenia, głośność, słuchawki. Po 2 próbach „Kontynuuj bez dźwięku”, a sesja dostaje `audio.confirmed = false`.
- Warunek `off`: wideo wyciszone, bez pytania.

### 10.7 Kalibracja

§5.5. Ekran wstępny: „Patrz na punkt i śledź go wzrokiem. Trzymaj telefon nieruchomo. Trwa ok. 40 s.” → „Zaczynamy”.

**Wynik:**
- dobry: „Gotowe. Materiał uruchomi się na pełnym ekranie” + „Odtwórz materiał”,
- słaby: „Pomiar był niedokładny: wzrok mógł uciec z punktu albo urządzenie się poruszyło” + „Spróbuj jeszcze raz” (po 2 próbach także „Kontynuuj mimo to”).

Podczas kalibracji, gdy brak twarzy ponad 700 ms: „Nie widzę Twojej twarzy”.

### 10.8 Oglądanie (pełny ekran)

- Czarne tło, materiał `object-contain`, **bez kontrolek i bez znacznika wzroku**, `controlsList="nodownload nofullscreen noremoteplayback"`, `disablePictureInPicture`, `touch-action: none`, bez menu kontekstowego.
- Warstwa nad materiałem przechwytuje dotyk. Długie przytrzymanie 1500 ms otwiera panel pauzy: „Badanie wstrzymane” / „Wznów” / „Zakończ badanie”.
- **Ochrona przebiegu:**
  - blokada wygaszania ekranu (`wakeLock`, ponawiana po powrocie),
  - `beforeunload` z ostrzeżeniem,
  - przycisk Wstecz (wpis w historii) → panel pauzy,
  - ukrycie karty → pauza, po powrocie „Dotknij, aby wznowić”,
  - Esc → panel,
  - obrót telefonu przy materiale pionowym → pauza i „Obróć telefon pionowo”.
- Autoodtwarzanie zablokowane → „Dotknij, aby zacząć”.
- Strażnik co 500 ms zdejmuje komunikat, gdy odtwarzanie ruszyło.
- **Koniec materiału** → `completed: true`. Przerwanie → `completed: false`.

### 10.9 Feed, siatka, karuzela

§4.4–4.6. Te same ochrony przebiegu. Instrukcje neutralne, bez wskazywania badanego elementu.

### 10.10 Pytania po obejrzeniu

0–3 pytania z gotowej listy, tylko odpowiedzi do wyboru:
- „Czy obejrzał(a)byś to do końca na swoim telefonie?” (Tak / Nie / Nie wiem),
- „Jaka marka pojawiła się w materiale?” (lista: marka z projektu + 3 dystraktory + „Nie pamiętam”),
- „Który film chcesz obejrzeć?” (siatka, §4.5).

### 10.11 Zakończenie

- **Przerwane:** „Badanie przerwane” + „Wyślij zebrane dane” / „Nie wysyłaj” (po wyborze: „Nic nie zostało wysłane”).
- **Ukończone:** wysyłka automatyczna („Wysyłam…”), potem „Dziękujemy!”.
  - **Serwer:** kod usunięcia (8 znaków, np. `K7QM-4XPA`, duża czcionka monospace), numer sesji, link „Usuń swoje dane”.
  - **Błąd sieci:** sesja trafia do kolejki w IndexedDB (`attn-outbox`) i jest ponawiana przy kolejnym otwarciu linku. Do tego przycisk „Wyślij teraz”.
  - **Link samowystarczalny:** „Wyślij wyniki do {twórca}” przez Web Share API z plikiem (`<brand>-session-<id>.json`), a gdy go nie ma, pobranie pliku. Notka, co zawiera plik.
  - **Panel:** przekierowanie na adres ukończenia dostawcy (`complete`, `screenout`, `quality_fail`) z identyfikatorem uczestnika panelu.
- **Badanie z poziomu panelu twórcy** (tryb lokalny): „Wróć do projektu”.

### 10.12 Usuwanie danych przez widza (`#/delete`)

- Pola: numer sesji i kod usunięcia („8 znaków, np. K7QM-4XPA”).
- Wynik: „Sesja została usunięta. Dane tej sesji zniknęły z badania i z raportu.” Zły kod: komunikat po kodzie `bad_code`.
- Notka dla badań bez serwera: „Jeśli wysłałeś plik z wynikami, poproś twórcę o usunięcie pliku i sesji z projektu.”

### 10.13 Badanie niedostępne

Komunikaty po kodach: nie istnieje (`not_found`), zamknięte (`closed`), wstrzymane po limicie planu (`project_sessions`, `month_sessions`), uszkodzony lub niepełny link, materiał dostępny tylko na komputerze twórcy.

---

## 11. Model danych (TypeScript)

### 11.1 Typy podstawowe

```ts
export type Locale = 'pl' | 'en' | 'de' | 'es' | 'it' | 'pt' | 'fr'; // MVP: pl, en
export type Platform = 'tiktok' | 'reels' | 'shorts' | 'instagram_feed' | 'youtube' | 'linkedin' | 'facebook' | 'other';
export type StudyKind = 'video' | 'hook' | 'abn' | 'feed' | 'thumbnail' | 'carousel' | 'slides';
export type AudioMode = 'on' | 'off' | 'viewer';
export type ViewContext = 'fullscreen' | 'feed' | 'grid' | 'carousel';
export type AgeBand = '18-24' | '25-34' | '35-44' | '45-54' | '55+';
export type VariantId = 'A' | 'B' | 'C' | 'D';
export type AoiType = 'face' | 'text' | 'subtitle' | 'product' | 'logo' | 'cta' | 'object' | 'center';
export type DeviceType = 'desktop' | 'tablet' | 'mobile';
export type TrackingQuality = 'GOOD' | 'FAIR' | 'POOR';
export type RejectCode = 'no_calibration' | 'poor_calibration' | 'too_short' | 'low_data' | 'over_limit' | 'manual';

export type MediaSource =
  | { kind: 'hosted'; mediaId: string; url: string; mime: string } // plik na serwerze
  | { kind: 'youtube'; youtubeId: string }                          // 11 znaków [A-Za-z0-9_-]
  | { kind: 'url'; url: string }                                    // HTTPS, bezpośrednio do pliku
  | { kind: 'local'; fileName: string; fileSize: number }           // tylko tryb lokalny, ta przeglądarka
  | { kind: 'demo'; demo: DemoId };

export interface Scene { id: string; start: number; end: number; source: 'auto' | 'manual' }

export interface Aoi {
  id: string; name: string; type: AoiType;
  x: number; y: number; w: number; h: number; // 0..1 na obrazie
  t0: number; t1: number;                     // sekundy materiału
  slide?: number;                             // karuzela, slajdy
  words?: number;                             // tekst, napisy: liczba słów (czytelność)
}

export interface Variant {
  id: VariantId; label: string;           // domyślnie „Wersja A” (tłumaczona przy wyświetlaniu)
  media: MediaSource | null;              // wideo albo miniatura
  slides?: MediaSource[];                 // karuzela, slajdy
  mediaName: string; duration: number;    // 0 = nieznana do pierwszej sesji
  width: number; height: number;          // nominalnie; liczą się proporcje
  scenes: Scene[]; aois: Aoi[];
  sharedFrom?: number;                    // hook: od tej sekundy wersje są identyczne
  title?: string;                         // miniatura: tytuł pod okładką
}

export interface FillerItem { id: string; media: MediaSource; title?: string; duration: number; width: number; height: number }

export interface DeviceInfo {
  type: DeviceType; orientation: 'landscape' | 'portrait';
  screenW: number; screenH: number; dpr: number; touch: boolean;
}
```

### 11.2 Projekt

```ts
export interface Project {
  id: string; workspaceId: string;
  name: string; creatorName: string;      // creatorName widoczny na zgodzie
  kind: StudyKind; platform: Platform;
  audio: AudioMode; context: ViewContext; platformUi: 'none' | 'generic'; caption?: string;
  variants: Variant[];                    // 1–4
  fillers: FillerItem[];                  // feed, siatka
  feed?: { items: number; stopSeconds: number; capSeconds: number };
  grid?: { layout: 'yt_home' | 'yt_search_mobile' | 'profile_grid'; exposureSeconds: number; askChoice: boolean };
  slides?: { mode: 'auto' | 'self'; secondsPerSlide: number };
  questions: QuestionId[];                // 0–3 z gotowej listy
  audience: { source: 'community' | 'panel' | 'mixed'; ageBands: AgeBand[]; countries: string[]; screenPlatforms: boolean };
  targetSessions: number;                 // domyślnie 30
  status: 'collecting' | 'paused' | 'closed';
  linkToken: string;                      // losowy, 16 bajtów base64url
  retentionDays: number;                  // domyślnie 90
  locale: Locale;                         // język badania
  createdAt: string; updatedAt: string;
  counts?: { total: number; valid: number }; // dołączane przez API przy liście
}
```

### 11.3 Sesja widza

```ts
/** Format kolumnowy próbek (mały, łatwy do walidacji). */
export interface CompactSamples {
  tc: number[];  // ms od początku sesji
  vt: number[];  // czas materiału (s, 3 miejsca) albo -1
  seg: number[]; // numer ciągłego odcinka odtwarzania
  it: number[];  // indeks pozycji feedu, siatki, slajdu (-1 = brak; pełny ekran: 0)
  vx: number[];  // ×1000 (0..1000) albo -1
  vy: number[];
  cf: number[];  // pewność ×100
  un: number[];  // niepewność σ ×1000 albo -1
  st: number[];  // GazeCode 0..4
}

export interface ItemLog {
  index: number; itemId: string; role: 'tested' | 'filler'; variantId?: VariantId;
  enterMs: number; exitMs: number | null; exitType: 'swipe_next' | 'swipe_prev' | 'end_cap' | 'finish' | null;
  loops: number; events: Array<{ t: number; type: 'pause' | 'resume' | 'loop' | 'mute' | 'unmute' }>;
}

export interface ViewerSession {
  schemaVersion: '1.0';
  id: string;                  // ses_ + 12 bajtów
  projectId: string; variantId: VariantId;
  participantId: string;       // p_ + 9 bajtów, losowy, niełączony z osobą
  ageBand: AgeBand; country: string | null; screener: Record<string, string>; // tylko wartości z list
  device: DeviceInfo;
  consent: { version: string; acceptedAt: string; adult: true; processing: true; localOnly: true; lang?: Locale };
  source: 'webcam' | 'simulated';
  calibration: { quality: TrackingQuality; xPct: number | null; yPct: number | null; points: number } | null;
  audio: { mode: 'on' | 'off'; confirmed: boolean };
  watchedSeconds: number; mediaDuration: number; completed: boolean;
  items?: ItemLog[];           // feed, siatka, karuzela
  choice?: { itemId: string | null }; // wybór w teście miniatury
  answers: Record<string, string>;    // pytania po obejrzeniu, tylko opcje z listy
  createdAt: string; expiresAt: string; // expiresAt = createdAt + retentionDays
  status: 'valid' | 'rejected'; rejectCode: RejectCode | null; manual: boolean;
  panel?: { provider: string; refHash: string }; // skrót identyfikatora z panelu, do rozliczeń
  data: CompactSamples;
}
```

### 11.4 Konfiguracja badania i plik sesji

```ts
/** Konfiguracja dla widza (z serwera albo zakodowana w linku). */
export interface StudyConfig {
  projectId: string; projectName: string; creatorName: string;
  kind: StudyKind; platform: Platform; audio: AudioMode; context: ViewContext; platformUi: 'none' | 'generic'; caption?: string;
  variant: Pick<Variant, 'id' | 'media' | 'slides' | 'mediaName' | 'duration' | 'width' | 'height' | 'title'>;
  fillers: FillerItem[]; feed?: Project['feed']; grid?: Project['grid']; slides?: Project['slides'];
  questions: QuestionId[]; ageBands: AgeBand[]; screenPlatforms: boolean;
  consentVersion: string;
  transport: 'server' | 'local' | 'package'; // serwer / ta przeglądarka / plik do odesłania
  linkToken: string; retentionDays: number; locale: Locale;
  panel?: { provider: string; completeUrl: string; screenoutUrl: string; qualityFailUrl: string };
}

/** Plik sesji do odesłania twórcy (badanie bez serwera). */
export interface SessionPackage { kind: 'attn-session'; version: 1; session: ViewerSession }
```

**Limity danych:**
- najwyżej 252 000 próbek (2 h przy 35 Hz), materiał do 4 h,
- `tc` ≤ 3 × 4 h w ms, `seg` < 100 000, `vx`/`vy`/`un` ∈ [−1, 1000], `cf` ∈ [0, 100], `st` ∈ [0, 4],
- wszystkie kolumny równej długości, inne pola odrzucane,
- najwyżej 400 scen i 50 stref na wersję; nazwa strefy ≤ 80 znaków, etykieta wersji ≤ 60, nazwa pliku ≤ 200.

---

## 12. Architektura i stos

### 12.1 Stos (wersje jak w KidAttention)

| Obszar | Wybór |
|---|---|
| Frontend | React 19.3, TypeScript 7.0 (`strict`), Vite 8.3, Tailwind 4.3 (`@tailwindcss/vite`, tokeny w `@theme`) |
| Pomiar | `@mediapipe/tasks-vision` 1.1 |
| Czcionki | `@fontsource-variable/*` (lokalnie, bez Google Fonts w produkcji) |
| Testy | Vitest 5 (jsdom 30, Testing Library), Playwright **1.56.1 (przypięty)** |
| Serwer | Node ≥ 22.5 (wbudowane `node:sqlite`, `node:http`, `node:crypto`, `node:zlib`), bez frameworka; budowany Vite (SSR, `noExternal: true`) do jednego pliku `dist-server/main.js` |
| AI | `@anthropic-ai/sdk` |
| Płatności | Stripe przez REST (`fetch`), bez SDK, z weryfikacją podpisu webhooka |
| Routing | **hash** (`#/…`): działa na GitHub Pages i zwykłym hostingu bez reguł przepisywania |

### 12.2 Dwa tryby, jeden interfejs danych (`ResearchApi`)

- **Lokalny** (domyślny, bez `VITE_API_URL`):
  - wszystko w IndexedDB tej przeglądarki (baza `attn-research`, magazyny projektów, sesji i kv),
  - konto „tego urządzenia”, plan z `VITE_LOCAL_PLAN` (domyślnie Free),
  - linki samowystarczalne i pliki sesji,
  - funkcje wymagające serwera rzucają błąd z kodem `local_mode` (tłumaczonym).
- **Serwerowy** (`VITE_API_URL` = adres API albo `/` przy wspólnym serwerze): konta, zespoły, wgrywanie materiałów, linki dla wielu widzów, płatności, AI, linki udostępniania.
- **Interfejs:** `me`, `register`, `login`, `logout`, `updateAccount`, `deleteAccount`, `usage`, `listProjects`, `getProject`, `createProject`, `updateProject`, `deleteProject`, `listSessions`, `setSessionStatus`, `deleteSession`, `importSessions`, `uploadMedia(onProgress)`, `study`, `submitSession`, `deleteSessionByCode`, `checkout`, `billingPortal`, `requestPanel`, `insights(projectId, variantId, locale)`, `createShareLink`, `revokeShareLink`, `sharedReport`, `workspace*`.
- **Błędy:** `ApiError(message, status, code)`. Klient HTTP **tłumaczy komunikat po kodzie** ze słownika `errors`, a nieznany kod pokazuje opis z serwera.

### 12.3 Kolejka wysyłki widza (outbox)

- Nieudane wysłanie: sesja trafia do IndexedDB `attn-outbox` (klucz `pending:<id>`, wraz z tokenem).
- Przy kolejnym otwarciu linku: ciche ponowienie i usunięcie z kolejki.
- Tryb prywatny bez IndexedDB: ponowienie tylko z ekranu końcowego.

### 12.4 Link samowystarczalny (bez serwera)

- `#/p/<base64url(JSON(StudyConfig))>` z `transport: 'package'`. **Fragment adresu nie trafia do serwera.**
- Dekodowanie waliduje strukturę. Komunikaty: „Link do badania jest uszkodzony”, „…niepełny”, „Ten materiał jest dostępny tylko na komputerze twórcy” (dla `local`).
- Router nie dekoduje ładunku jak segmentu URL (base64url).

### 12.5 Kod usunięcia sesji

- 8 znaków z alfabetu bez mylących znaków `ABCDEFGHJKMNPQRSTUVWXYZ23456789`, format `XXXX-XXXX`, `crypto.getRandomValues`.
- Normalizacja (wielkie litery, tylko A–Z i 0–9), w bazie wyłącznie SHA-256 (hex). Porównanie `timingSafeEqual`.
- Pokazywany raz. Ponowne wysłanie tej samej sesji zwraca pusty kod.

### 12.6 Co przenieść z KidAttention

**Bez zmian (z poprawką nazw i typów):**
- `src/core/**`: śledzenie, cechy, model, kalibracja, jakość, filtry, potok próbek, zegary, geometria, analiza (fiksacje, heat mapa, sceny, statystyki), rysowanie, źródła klatek,
- `src/youtube/**`: API, zegar, adresy, proporcje z oEmbed,
- `src/research/{statsMath,heatmap,aoi,compact,sanitize,link}.ts`,
- `src/i18n/{index.tsx,locales.ts,format.ts}`,
- `server/{http,auth}.ts`,
- `pwa/sw.js`, wtyczka service workera w `vite.config.ts`,
- `scripts/{fetch-model,copy-mediapipe-wasm}.mjs`, `public/.htaccess`,
- diagnostyka startu w `index.html`.

**Zmienić:**
- `research/model.ts` (§11), `attention.ts` (rozdzielczość 0,5 s, feed), `sessions.ts` (kody odrzuceń), `report.ts` (hook, feed, A/B/n z korektą Holma), `insights.ts` (nowe reguły), `aiContract.ts` (nowe wejście i zakazy), `plans.ts` (§16), `panelSim.ts` (profile social),
- wszystkie słowniki,
- serwer (zespoły, media, linki udostępniania, panel),
- przebieg widza (dorośli),
- strona, raport i studio (nowe sekcje).

**Nie przenosić:** progów kalibracji dla dzieci (zastąpić strojonymi dla dorosłych), „iskierki”, czcionki Nunito dla ekranów dziecka, tekstów o dzieciach i rodzicach.

### 12.7 Struktura katalogów

```
src/
  config/       brand.ts (nazwa, kod wewnętrzny, kolory marki), company.ts (operator, e-mail sprzedaży), platforms.ts (proporcje, strefy zasłonięte)
  core/         contracts, tracking, estimation, calibration, quality, filters, pipeline, time, geometry, analysis, render, math
  research/     model, compact, attention, feed, grid, carousel, sessions, report, insights, aiContract, aoi, heatmap, statsMath, plans, sanitize, link, panelSim, text
  api/          types, index, local, localStore, http
  app/          Root, router, research (kontekst danych), ErrorBoundary
  features/
    site/       Landing, Pages (cennik, prywatność, usuwanie danych, 404), SiteShell
    studio/     Shell, Projects, NewProject, Prepare, Collect, ProjectPage, Technical, Account, Workspace, MediaPicker, AoiEditor
    report/     ReportView, AttentionChart, HookCard, FeedMetrics, GridReport, CarouselReport, Findings, Visuals, AoiPanel, SegmentsTable, ShareCard, frames
    viewer/     ViewerApp, Consent, Screener, CameraCheck, SoundCheck, Calibration, WatchFullscreen, WatchFeed, WatchGrid, WatchCarousel, Questions, Finish, outbox
    billing/    Pricing, Paywall, PanelOrder
    lab/        narzędzia techniczne zespołu (podgląd na żywo, kalibracja, heat mapa, ścieżka wzroku, statystyki)
  i18n/         index.tsx, locales.ts, format.ts, labels.ts, research.ts, pl/, en/, …
  demo/         demoScene (proceduralne klipy), simulator
  ui/           kit.tsx (komponenty), primitives
  youtube/      api, clock, url, aspect
server/         main, app, db, http, auth, billing, ai
pwa/sw.js
public/         .htaccess, manifest.webmanifest, favicon.svg, icons/, models/ (pobierany), mediapipe/wasm (kopiowany)
scripts/        fetch-model.mjs, copy-mediapipe-wasm.mjs
tests/  e2e/  docs/
```

---

## 13. API serwera

### 13.1 Zasady

- Ścieżki `/api/*`, JSON. Własny mały router (wzorce `:param` → `[A-Za-z0-9_-]+`).
- Odpowiedzi 201 dla utworzonych zasobów, błędy `{ error: { message, code } }`.
- W logu: `METODA wzorzec status ms` (bez IP, tokenów i treści).

### 13.2 Endpointy

| Metoda i ścieżka | Opis |
|---|---|
| `GET /api/health` | `{ ok, time, billing, ai }` (healthcheck kontenera) |
| `POST /api/auth/register` | konto + token; limit 20/15 min/IP |
| `POST /api/auth/login` | limit 20/15 min/IP i 10/15 min/e-mail; ten sam komunikat dla złego e-maila i hasła |
| `POST /api/auth/logout` | usuwa token |
| `GET`, `PATCH`, `DELETE /api/me` | konto; usunięcie kaskadowo (projekty, sesje, pliki); 409, gdy aktywna subskrypcja |
| `GET /api/usage` | aktywne projekty, sesje w miesiącu (`RRRR-MM`) |
| `GET`, `POST /api/projects` | lista (z licznikami) i tworzenie (402 `active_projects`) |
| `GET`, `PATCH`, `DELETE /api/projects/:id` | projekt; PATCH sanitizuje wersje, sceny i strefy; strefy i funkcje płatne sprawdzane po planie (402 `feature_*`) |
| `GET /api/projects/:id/sessions` | sesje bez wygasłych |
| `PATCH`, `DELETE /api/projects/:id/sessions/:sid` | status (powód `manual`), usunięcie |
| `POST /api/projects/:id/import` | pliki sesji (do 500 na raz, do 128 MB); duplikaty i limit → pominięte |
| `POST /api/projects/:id/media` | wgranie wideo lub obrazu: surowe body z `Content-Type`; strumień na dysk z limitem; 415 dla złego typu; 413 przy przekroczeniu; plik `med_<15 bajtów>` |
| `GET /api/media/:id` | publiczne pod nieodgadywalnym id; obsługa `Range` (206, 416), `Accept-Ranges`, `Cross-Origin-Resource-Policy: cross-origin`, `Cache-Control: private, max-age=3600` |
| `POST /api/projects/:id/variants/:v/insights` | rekomendacje AI lub reguły (§8.4) |
| `POST`, `DELETE /api/projects/:id/share` | link do raportu tylko do odczytu (token, wygaśnięcie 7/30/90 dni, w bazie skrót) |
| `GET /api/share/:token` | **zbiorczy** raport policzony na serwerze (bez surowych sesji) |
| `GET /api/study/:token` | konfiguracja dla widza; przydział wersji z najmniejszą liczbą sesji; powody niedostępności (`not_found`, `closed`, `project_sessions`, `month_sessions`); limit 240/10 min/IP |
| `POST /api/study/:token/sessions` | sesja widza (do 40 MB); sanitizacja; ponowna ocena jakości; kod usunięcia; limit 60/h/IP; symulowane nie liczą się do limitu |
| `POST /api/sessions/:id/delete` | usunięcie kodem; limit 10/15 min/IP; zły kod → 404 `bad_code` |
| `POST /api/billing/checkout`, `/portal`, `/webhook` | §16.4 |
| `POST /api/orders/panel` | zamówienie panelu; limit 10/h/IP |
| `GET /api/admin/orders`, `POST /api/admin/plan` | administracja (e-maile z `ADMIN_EMAILS`) |
| `GET`, `POST /api/workspaces`, `…/members`, `…/invites` | zespół: role owner / editor / viewer, zaproszenia tokenem |

### 13.3 Przydział wersji

- Wersja z najmniejszą liczbą sesji, przy remisie kolejność A→D.
- Wersja z materiałem `local` jest niedostępna dla widzów spoza urządzenia twórcy.

### 13.4 Linia poleceń serwera

`node dist-server/main.js set-plan <e-mail> <plan>`: ręczna zmiana planu (faktura, Agency).

---

## 14. Baza danych (SQLite, `node:sqlite`)

- `pragma journal_mode = wal; pragma foreign_keys = on;` Projekty jako dokumenty JSON, próbki sesji skompresowane **gzipem** w BLOB.
- **Tabele:**
  - `accounts(id, email unique, name, company, password_hash, plan, plan_status, plan_renews_at, stripe_customer_id, stripe_subscription_id, is_admin, logo, created_at)`
  - `auth_tokens(token_hash pk, account_id → accounts on delete cascade, created_at, expires_at)`, TTL 30 dni
  - `workspaces(id, name, owner_id, created_at)`, `members(workspace_id, account_id, role, created_at)`, `invites(token_hash, workspace_id, role, expires_at)`
  - `projects(id, workspace_id, account_id, link_token unique, status, doc, created_at, updated_at)` + indeks po koncie lub zespole
  - `sessions(id, project_id → projects cascade, variant_id, status, meta (JSON bez próbek), samples (gzip), deletion_hash, created_at, expires_at)` + indeksy `project_id`, `expires_at`
  - `media(id, account_id, project_id, mime, size, file, created_at)`
  - `share_links(token_hash pk, project_id cascade, created_by, expires_at, created_at)`
  - `orders(id, account_id, kind, doc, status 'new', created_at)`
  - `insights_cache(key pk, doc, created_at)`
  - `stripe_events(id pk, received_at)`, idempotencja webhooków
- **Retencja:** zadanie co godzinę i przy starcie usuwa sesje z `expires_at ≤ teraz`. Usuwanie konta i projektu kasuje też pliki mediów z dysku.

---

## 15. Bezpieczeństwo

- **Hasła:** scrypt `N = 2^15, r = 8, p = 1`, klucz 32 B, sól 16 B, `maxmem` 64 MB, NFKC. Format `scrypt$N$r$p$sól$skrót`.
  - Przy nieistniejącym e-mailu i tak liczymy skrót („burn”), żeby czas odpowiedzi nie zdradzał, czy konto istnieje.
- **Tokeny:** 32 losowe bajty base64url, w bazie SHA-256. Hasło 10–200 znaków. E-mail `^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,24}$`.
- **Limity treści:** auth 16 KB, insights 4 KB, sesja 40 MB, import 128 MB, media `MAX_VIDEO_MB` (domyślnie 1024) i `MAX_IMAGE_MB` (domyślnie 15).
- **Serwer HTTP:** `requestTimeout` 30 min (duże pliki), `headersTimeout` 60 s.
- **CORS:** tylko originy z `APP_ORIGINS` (domyślnie origin `APP_URL`). Zasoby publiczne (media) z `*`.
- **Nagłówki:** `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy: camera=(self), microphone=()`. Pliki z hashem w nazwie: `Cache-Control: public, max-age=31536000, immutable`; `index.html`: `no-cache`.
- **Walidacja wejścia:** obiekt budowany od zera z dozwolonych pól. Teksty czyszczone ze znaków kontrolnych i przycinane.
  - Zgoda musi mieć wszystkie potwierdzenia i wersję ≤ 32 znaki. Identyfikatory `^[A-Za-z0-9_-]{1,64}$`. Daty ISO ≤ 40 znaków. YouTube id 11 znaków. Adresy `https?://` ≤ 2000 znaków.
- **Statyka:** ochrona przed wyjściem poza katalog (`resolve` + prefiks), nieznana ścieżka → `index.html`.
- **Stripe:** weryfikacja podpisu, idempotencja, `client_reference_id` = id konta.
- **Panel:** identyfikator uczestnika z panelu tylko jako skrót SHA-256 z solą serwera (`PANEL_SALT`). Twórca go nie widzi.

---

## 16. Plany, cennik, paywall, płatności, panel

### 16.1 Zasady

- Ceny netto, bez planu dożywotniego. Widzowie nie płacą niczego.
- Te same reguły egzekwuje serwer (limity sesji, funkcje) i interfejs (paywall). Jedno źródło: `src/research/plans.ts`.
- **Waluta według języka:** pl → PLN (format własny: grupowanie tysięcy zawsze, także 4-cyfrowych, spacja nierozdzielająca, „zł”); de, es, it, fr, pt → EUR (`Intl`); en → USD z przełącznikiem EUR.
- **Bez serwera** przyciski zakupu otwierają e-mail do sprzedaży (`mailto:` z tematem) z `src/config/company.ts`. **Nigdy techniczny komunikat zamiast przycisku** (lekcja §24).

### 16.2 Propozycja planów (do walidacji wywiadami i kosztami panelu)

| Plan | Cena miesięcznie | Limity | Funkcje |
|---|---|---|---|
| **Free** | 0 | 1 aktywny projekt, 5 widzów w projekcie | krzywa uwagi, hook @3 s, przykładowe raporty, znak wodny |
| **Creator** | 79 zł / 19 € / 19 $ | 5 projektów, 150 widzów miesięcznie | + heat mapy, wnioski i sceny do poprawy, A/B (2 wersje), PDF i grafika bez znaku wodnego |
| **Pro** | 199 zł / 49 € / 49 $ | 20 projektów, 600 widzów miesięcznie, 3 osoby | + A/B/C/D, test w feedzie, test miniatury, karuzela i slajdy, strefy i czytelność napisów, rekomendacje AI, link do raportu dla klienta |
| **Agency** | od 790 zł / 189 € / 199 $ | bez limitu projektów, od 2500 widzów miesięcznie, 10 osób | + foldery klientów, logo klienta w raporcie, eksport surowych danych, umowa powierzenia, faktura, opiekun |

- Rocznie: 2 miesiące gratis (cena roczna = 10 × miesięczna).
- **Uprawnienia** (klucze): `aggregateHeatmaps`, `findings`, `recommendations`, `maxVariants` (1 / 2 / 4 / 4), `feed`, `thumbnail`, `carousel`, `aoi`, `textCheck`, `shareLink`, `shareImageClean`, `watermark`, `rawExport`, `clientLogo`, `clientFolders`, `seats`.
- `planFor(feature)` zwraca najtańszy plan z funkcją. `upgradeTarget(plan, reason)` zwraca kolejny plan.

### 16.3 Paywall

- **Limit sesji w projekcie (Free)** → link wstrzymuje przyjmowanie **przed** zgodą widza („Badanie jest wstrzymane”).
  - W panelu: „Masz już pierwszą krzywą uwagi. Zbierz 30 widzów, aby zobaczyć wiarygodny wynik: panel od … albo plan Creator za … / mies.”
- **Limit miesięczny:** „Wykorzystano limit 150 widzów w tym miesiącu. Link wstrzymał przyjmowanie nowych sesji.”
- **Limit projektów:** „Zamknij jeden z projektów albo przejdź na wyższy plan.”
- **Zablokowana funkcja w raporcie:** karta „Dostępne od planu Pro (199 zł)” + „Odblokuj w planie Pro”.

### 16.4 Stripe

- **Checkout:** `mode: subscription`, cena z `STRIPE_PRICE_<PLAN>_<MONTHLY|YEARLY>`, `client_reference_id`, `metadata[account_id]`, `subscription_data[metadata][account_id|plan]`, `tax_id_collection[enabled]=true`, `automatic_tax` gdy `STRIPE_AUTOMATIC_TAX=1`.
  - Powrót: `#/app/account?payment=ok|cancelled`.
- **Portal klienta:** faktury, karta, anulowanie.
- **Webhook:**
  - `checkout.session.completed` (pobranie subskrypcji),
  - `customer.subscription.created|updated|deleted` (plan z identyfikatora ceny albo z metadanych),
  - `invoice.payment_failed` → `past_due`,
  - idempotencja po `event.id`.
- **Bez kluczy Stripe:** 503 `billing_unavailable` („Płatności online nie są jeszcze włączone. Napisz do nas, wystawimy fakturę”) i przycisk e-mail.

### 16.5 Badanie z panelem

- **Oferta:** 30, 50 albo 100 widzów z grupy docelowej (wiek, kraj, korzystanie z platform). Raport w 2–5 dni roboczych. Cena zależna od kryteriów i długości.
  - Propozycja: od 590 zł / 139 € za 30 widzów przy materiale do 60 s; dopłata za widza.
  - **Do wyceny u dostawcy panelu przed publikacją.**
- **Formularz:** firma, NIP (do faktury), e-mail kontaktowy, liczba widzów, kryteria, uwagi („np. termin publikacji, długość materiału, wersje”), suma.
  - Tryb serwerowy: zamówienie w bazie i potwierdzenie „Odezwiemy się w ciągu jednego dnia roboczego z terminem i fakturą”.
  - Bez serwera: e-mail z podsumowaniem.
  - Płatność przelewem (50% z góry) albo kartą jednorazowo (decyzja §26).
- **Integracja z dostawcą:** parametr identyfikatora uczestnika w linku (zapis tylko jako skrót, §15), adresy powrotu `complete`, `screenout`, `quality_fail`. **Nie obiecuj terminu, którego rekrutacja nie dotrzyma.**

---

## 17. Prywatność, RODO, AI Act, etyka, zasady treści

### 17.1 Co zapisujemy, a czego nie

| Zapisujemy | Nie zapisujemy |
|---|---|
| losowy identyfikator uczestnika i sesji | obrazu i nagrań z kamery |
| przedział wieku, kraj (opcjonalnie), odpowiedzi z list | punktów twarzy (landmarków), biometrii |
| czas materiału, kierunek wzroku na obrazie (0–1, ok. 30×/s), pewność i jakość | imienia, nazwiska, e-maila, telefonu widza |
| typ urządzenia, orientację, rozmiar okna | lokalizacji, IP w sesji (IP przetwarzane chwilowo do limitów zapytań) |
| wersję zgody, czas, język | emocji, ocen osoby |

### 17.2 Role i zgoda

- **Administrator danych z badania:** twórca lub marka wskazana na ekranie zgody.
- **Podmiot przetwarzający:** operator serwisu (wzór umowy powierzenia, plan Agency). Przy panelu operator może być współadministratorem rekrutacji. **Do potwierdzenia przez prawnika.**
- **Podstawa:** zgoda widza (18+), wersjonowana, zapisana z sesją, z prawem do wycofania (przerwanie) i usunięcia (kod).
- Zalecana ocena skutków (DPIA) przed startem.

### 17.3 Retencja

Domyślnie 90 dni (do wyboru 30 / 90 / 180 / 365), usuwanie automatyczne co godzinę. Usunięcie projektu lub konta usuwa sesje i pliki.

### 17.4 AI Act i biometria

- Produkt **nie rozpoznaje emocji** ani nie identyfikuje osób. Rozpoznawanie emocji jest w AI Act zakazane w części zastosowań (miejsce pracy, edukacja), a w innych obciążone obowiązkami. Pominięcie go upraszcza zgodność.
- Punkty twarzy służą wyłącznie do szacowania kierunku wzroku, lokalnie, bez zapisu i bez celu identyfikacji.
- Teksty AI są oznaczone jako wygenerowane (nazwa modelu).
- **Wszystko powyżej do weryfikacji prawnej.**

### 17.5 Zasady etyczne (strona prywatności)

ScrollStop pomaga tworzyć materiały, które widzowie rzeczywiście oglądają. Nie obsługujemy zastosowań, które:
- badają osoby poniżej 18 lat,
- oceniają, profilują albo porównują pojedynczych widzów, sugerują diagnozy lub stany psychiczne,
- rozpoznają emocje,
- badają widzów bez ich wiedzy albo w miejscu pracy i szkole,
- sprzedają dane albo kontakty widzów,
- testują treści wprowadzające w błąd lub szkodliwe (§17.6).

### 17.6 Zasady treści

- Twórca oświadcza, że ma prawa do materiału i że materiał jest zgodny z zasadami (bez treści seksualnych, przemocy, mowy nienawiści, oszustw; reklamy polityczne według decyzji §26).
- Widz ma przycisk „Zgłoś treść” w panelu pauzy: przerwanie, zgłoszenie do moderacji, projekt wstrzymany do wyjaśnienia.
- Wypełniacze feedu: tylko z licencją.

### 17.7 Cookies i analityka

- Bez cookies śledzących. `localStorage` tylko dla języka (`attn-lang`) i tokenu logowania (`attn-token`).
- **Na stronach widza nie ma żadnej analityki zewnętrznej.** Na stronie publicznej i w studiu opcjonalnie analityka bez cookies, hostowana u siebie.

### 17.8 Strona prywatności (sekcje)

Tytuł „Prywatność i zasady etyczne”, wstęp („ScrollStop bada materiały, a nie ludzi”), obraz z kamery, co zapisujemy (lista definicji), kto ma dostęp i jak długo, prawa widza (wycofanie, kod usunięcia z linkiem, „widz nie dostaje wyniku o sobie”), kontakt i operator (dane z `company.ts`), zasady etyczne.

---

## 18. Język i wersje językowe

- **MVP:** polski i angielski. Architektura gotowa na de, es, it, pt-BR, fr.
- **Słowniki:** `src/i18n/<język>/<przestrzeń>.ts`.
  - Przestrzenie: `common`, `errors`, `research`, `ui`, `site`, `billing`, `studio`, `report`, `viewer`.
  - **Polski wyznacza kształt typu:** `type Messages = typeof pl`, bez adnotacji i bez `as const`. Inne języki: `export const site: Messages['site'] = { … }`, więc TypeScript pilnuje kompletności.
  - Teksty z liczbami to funkcje z typowanymi parametrami. Odmiana: `plural(n, jeden, kilka, wiele)` dla polskiego, `n === 1` dla angielskiego.
- **Ładowanie:** polski w paczce głównej, pozostałe na żądanie (dynamiczny import, osobne pliki).
- **`I18nProvider`:**
  - **Główny:** wykrywa język (kolejność: `?lang=` w adresie lub w zapytaniu po `#` → zapisany wybór → `navigator.languages` → `en`), zapisuje wybór z `?lang=`, ustawia `<html lang>`. Bieżący słownik ustawia **już podczas renderowania** dla kodu spoza Reacta (`currentMessages()`, `currentLocale()`).
  - **Zagnieżdżony** z `locale`: wymusza język badania bez zapisywania wyboru.
  - Pierwsze ładowanie innego języka nie renderuje nic przez ułamek sekundy, żeby uniknąć mignięcia polskim.
- **Przełącznik języka:** lista rozwijana z nazwami w danym języku (Polski, English, …), ikona globu. W nagłówku strony widoczny od 640 px, na telefonie w menu.
- **Formatowanie:**
  - procenty przez `Intl` (de, es: „84 %” ze spacją nierozdzielającą, pl, en, it: „84%”),
  - daty przez `toLocaleString(tag)`,
  - pieniądze §16.1,
  - punkty procentowe: pl „pp”, en „pp”, de „PP”.
- **Domyślne nazwy wersji** („Wersja A”, „Version A”, „Versión A”, „Versione A”) zapisane w danych są **tłumaczone przy wyświetlaniu**. Własne nazwy zostają.
- **Kody zamiast tekstów** w danych: powody odrzucenia, błędy API, powody niedostępności badania.
- **Raport:** teksty wniosków z interfejsu `ResearchText` (osobna implementacja na język: `scene(n)`, `seg(ref, przypadek)`, `findings.*`, `ab.*`, `demo.*`, `sampleLevel`). Serwer liczy raport w języku z zapytania (`{ lang }`).
- **Ton:**
  - pl: „Ty”, zwięźle,
  - en: „you”,
  - de: „Sie”, Tarif zamiast Plan,
  - es: „tú”, «cudzysłowy», „sin IVA”,
  - it: „tu”, „IVA esclusa”.
  - Słowa potwierdzenia usunięcia z §9.6.
- **Testy:**
  - każdy słownik ma te same klucze i typy co polski,
  - w słownikach obcych nie ma polskich znaków (ą, ć, ę, ł, ń, ś, ź, ż),
  - mniej niż 8% tekstów identycznych z polskim,
  - raport w każdym języku bez polskich wtrąceń.
- **Uwaga:** tłumaczenia maszynowe przed kampanią dać do sprawdzenia osobie znającej język, szczególnie zgodę i prywatność.

---

## 19. Design system i dostępność

### 19.1 Tokeny (wartości sprawdzone w KidAttention)

Nowa marka może zmienić akcent, ale **każda zmiana koloru wymaga ponownego sprawdzenia kontrastu.**

| Token | Wartość | Zastosowanie i kontrast |
|---|---|---|
| `paper` | `#f4f6f9` | tło stron |
| `surface` | `#ffffff` | karty |
| `mist` | `#eef2f7` | tło widoku widza |
| `ink` | `#1f2a44` | tekst; 13,2:1 na `paper` |
| `muted` | `#5b6478` | tekst drugorzędny; 5,5:1 na `paper`, 5,9:1 na białym |
| `line` | `#d8dee9` | tylko dekoracyjne obramowania (1,35:1) |
| `field` | `#8a93a6` | obramowania pól formularzy; 3,1:1 na białym (WCAG 1.4.11) |
| `cobalt` (akcent) | `#2747d6` | przyciski główne; biały tekst 7,1:1 |
| `cobalt-dark` | `#1d36a8` | najechanie |
| `marker` | `#f2b705` | znaczniki spadków, tło „do poprawy”; **nigdy tekst** (1,8:1) |
| `good` | `#12784f` | status pozytywny; tekst 5,5:1 na białym i ≥ 4,5:1 na tle odznaki 10% |
| `fair` | `#8f5c00` | status „do sprawdzenia”; 5,7:1 |
| `poor` | `#c03636` | błąd, problem; 5,5:1 |
| `series-b` | `#eb6834` | wersja B na wykresach |

### 19.2 Typografia

- **Czcionka:** jedna rodzina grotesk dla całego produktu (w KidAttention: Instrument Sans Variable w UI; Nunito tylko dla dzieci, tu niepotrzebna). Ładowana lokalnie.
- **Skala:** nagłówek strony głównej 38 px (telefon) / 56 px (komputer), interlinia 1,04, `letter-spacing −0,035em`, najwyżej 21 znaków w linii. H1 panelu 28 / 34 px. Sekcje 21–28 px. Tekst 14–17 px. Pomocniczy 12,5–13 px (minimum 12 px).
- `h1`, `h2`, `h3`: `overflow-wrap: break-word; hyphens: auto` (długie złożenia, np. niemieckie). Liczby w tabelach `tabular-nums`.

### 19.3 Komponenty (`ui/kit.tsx`)

- **Przyciski:** `Btn` i `LinkBtn` w wariantach primary / secondary / quiet / danger, rozmiary sm 32, md 40, lg 48 px, promień 10 px.
  - Długie etykiety mogą się łamać (`min-h`, `whitespace-normal`).
  - Etykiety to czasowniki: „Utwórz projekt”, „Zamów plan Pro”; nigdy „OK” ani „Wyślij formularz”.
- **Pozostałe:**
  - `PageHeader`, `Section` (tytuł + podpis po prawej), `Surface` (karta 16 px promienia),
  - `Badge` (neutral / good / fair / poor / info, tło 10% koloru),
  - `Callout` (info / warn / locked), `Field` (etykieta widoczna zawsze, podpowiedź, błąd przez `aria-describedby`),
  - pole 40 px z obramowaniem `field` i fokusem 2 px `cobalt`,
  - `ChoiceCards` (karty radiowe), `Stepper` (kroki projektu z licznikiem), `Meter` (postęp),
  - `Dialog` (pułapka fokusu, przywrócenie fokusu, Esc), `CopyField`, `LanguageSelect`.
- **Ikony** (SVG 20×20, linia): check, alert, lock, phone, monitor, copy, download, **upload** (do wgrywania, nie mylić z pobieraniem), play, flag, trash, qr.

### 19.4 Wykresy i dane

- Jedna oś Y. Legenda zawsze przy ≥ 2 seriach. Etykiety bezpośrednie przy ≤ 4. Linie 2 px. Siatka stonowana. Podpowiedź po najechaniu. Tabela jako alternatywa (dostępność).
- **Kolory wersji w stałej kolejności:** A `#2747D6`, B `#EB6834`, C i D dobrać i **sprawdzić skryptem** pod kątem daltonizmu (ΔE ≥ 8 między sąsiednimi) i kontrastu.
- Kolor tekstu zawsze z tokenów tekstu, nigdy kolor serii.
- Heat mapy: §5.15 (sekwencyjna paleta, legenda).

### 19.5 Układ i responsywność

- Najpierw telefon. Sprawdzane szerokości: 320, 360, 375, 390, 414, 768, 1024, 1366, 1440 we **wszystkich** językach.
- **Brak poziomego przewijania** porównywany z szerokością **ekranu urządzenia**, nie z `innerWidth`. Telefon poszerza układ do najszerszego elementu, więc `innerWidth` kłamie (lekcja §24).
- Dzieci siatki z wykresem mają `min-w-0`. Tabele szersze niż ekran w kontenerze `overflow-x: auto`, a na telefonie karty zamiast tabel.
- **Nagłówek strony:** znak + nazwa, menu (przycisk 44×44 px), przycisk główny. Poniżej 370 px przycisk główny tylko w menu. Linki stopki z polem dotyku ≥ 36 px na telefonie.
- Treść do ~80 znaków w linii. Kontener 1152 px, marginesy 16 px (telefon) / 24 px.

### 19.6 Dostępność (WCAG 2.2 AA)

- Kontrast tekstu ≥ 4,5:1, elementów interfejsu ≥ 3:1.
- Widoczny fokus (`outline` 3 px `cobalt`, odstęp 2 px). Pełna obsługa klawiaturą (wykres, edytor stref: także przez pola liczbowe).
- `prefers-reduced-motion` skraca animacje do 0,01 ms.
- Etykiety pól zawsze widoczne. Podpowiedzi tylko jako format. Błędy mówią, jak naprawić, i nie obwiniają użytkownika.
- Cele dotyku ≥ 44 px dla głównych akcji na telefonie, minimum 24 px.
- Opisy alternatywne wykresów i heat map, `role="img"` z `aria-label`. Tabele z `caption`.

### 19.7 Kierunek wizualny (do decyzji projektanta)

- Produkt dla twórców może być żywszy niż KidAttention, ale bez szablonowych chwytów: bez kremowego tła z terakotą, bez neonowej zieleni na czerni, bez kart z identycznym cieniem, bez napisów WIELKIMI LITERAMI nad każdym nagłówkiem.
- Jeden element zapamiętywalny: na stronie głównej **żywa krzywa uwagi nad pionowym klipem** jako pierwszy ekran. Reszta spokojna.
- Teksty w zdaniach („Przetestuj rolkę”), aktywne czasowniki, bez wykrzykników.

---

## 20. PWA i wydajność

- **Manifest:** nazwa i krótka nazwa z `brand.ts`, `start_url` i `scope` `./`, `display: standalone`, kolory motywu, ikony 192, 512 i maskowalna 512, kategorie business i productivity.
- **Service worker** (`pwa/sw.js` + wtyczka Vite):
  - lista plików powłoki (JS, CSS, czcionki) i wersja = pierwsze 12 znaków SHA-256 nazw plików, wstawiane przy budowaniu w miejsce `= __VERSION__;` i `= __PRECACHE__;`,
  - instalacja: zapis powłoki + `skipWaiting`; aktywacja: usunięcie starych wersji + `clients.claim`,
  - nawigacja: najpierw sieć, bez sieci zapisana powłoka,
  - statyka (`assets`, `icons`, `mediapipe`, `models`, favicon, manifest): najpierw pamięć podręczna,
  - **nigdy** w pamięci podręcznej: `/api/`, żądania z `Authorization` albo `Range`, inne domeny (YouTube, CDN filmów), dane sesji, obraz z kamery.
- **Podział paczek:** śledzenie twarzy (dynamiczny import przy starcie kamery), słowniki innych języków, laboratorium. Model 3,7 MB pobierany tylko w badaniu.
- **Heat mapy z formatu kolumnowego** bez rozwijania próbek do obiektów, przerzedzenie do 10 Hz.

---

## 21. Wdrożenie

### 21.1 Tryby

1. **GitHub Pages** (tryb lokalny, darmowo):
   - workflow „CI & Pages” (Node 22, `npm ci`, testy, build, build serwera, E2E na Chromium, artefakt raportu Playwright przy błędzie),
   - publikacja z `BASE_PATH=/<repo>/`. Jednorazowo: Settings → Pages → Source: GitHub Actions,
   - zmienne repozytorium: `ATTN_API_URL`, `ATTN_SALES_EMAIL`, `ATTN_BOOKING_URL`.
2. **Zwykły hosting przez FTP** (tryb lokalny):
   - `npm run fetch-model && npm run build:ftp` (`vite build --base ./ --outDir dist-ftp`, ścieżki względne, działa w dowolnym katalogu), usuń `models/.gitkeep`,
   - wgraj **całą zawartość** łącznie z ukrytym `.htaccess`. Workflow buduje też artefakt `<brand>-ftp`.
3. **Docker** (tryb serwerowy, jeden kontener):
   - wieloetapowo na `node:22-bookworm-slim`: `npm ci`, `fetch-model`, build z `VITE_API_URL=/`, build serwera,
   - obraz końcowy: użytkownik `node`, wolumen `/data`, port 8787, `HEALTHCHECK` na `/api/health`,
   - za proxy: `TRUST_PROXY=1`.

### 21.2 `.htaccess` (hosting z Apache)

- `Options -Indexes`, `DirectoryIndex index.html`.
- Typy MIME: `.webmanifest` → `application/manifest+json`, `.wasm` → `application/wasm`, `.task` → `application/octet-stream`, `.js`/`.mjs` → `text/javascript`, `utf-8`.
- Nagłówki jak w §15.
- Cache: `index.html`, `sw.js`, `manifest` bez cache; pliki z hashem 1 rok immutable.
- Kompresja `DEFLATE`.
- Zakomentowane przekierowanie http → https, do włączenia **po** uruchomieniu SSL.

### 21.3 Diagnostyka startu (`index.html`)

- Skrypt zbiera błędy wczytania plików i wyjątki.
- Gdy po 4 s od `load` aplikacja nic nie wyrenderowała, pokazuje w języku przeglądarki: „Aplikacja się nie uruchomiła” + najczęstsze przyczyny po FTP (brak folderu `assets`, pliki w innym katalogu niż `index.html`, brak `.htaccess` lub zły typ `.js`, bardzo stara przeglądarka) + szczegóły.
- Do tego `ErrorBoundary` w aplikacji z komunikatem i przyciskami „Odśwież” i „Strona główna”.

### 21.4 Lista kontrolna domeny (lekcje z KidAttention)

1. **Potwierdź e-mail właściciela domeny w ciągu 15 dni** od rejestracji lub zmiany danych (wymóg ICANN). Bez tego rejestrator zawiesza domenę („verification hold”): serwery nazw zmieniają się na `*.verification-hold.suspended-domain.com`, które wskazują na 127.0.0.1. Przeglądarka pokazuje wtedy `ERR_CONNECTION_REFUSED`, choć pliki i strefa DNS w panelu są poprawne.
2. **Serwery nazw** domeny u rejestratora wskazują na hosting. **Rekordy A** dla domeny, `www` i `mail` (i AAAA, jeśli są) wskazują na serwer.
3. **Certyfikat Let's Encrypt** dopiero po rozejściu się DNS. Bez rekordów `www` i `mail` wystawienie dla nich się nie uda. **Kamera wymaga HTTPS.**
4. **Sprawdzenie z zewnątrz:** publiczny DNS (np. `dns.google/resolve?name=…`) i RDAP rejestru (`rdap.verisign.com/com/v1/domain/…`): status, serwery nazw, rejestrator.
5. **Biała strona** po wgraniu → diagnostyka startu (§21.3).

### 21.5 Zmienne środowiskowe

- **Klient (podczas budowania):**
  - `VITE_API_URL`: tryb serwerowy,
  - `VITE_LOCAL_PLAN`: plan w trybie lokalnym, np. do pilotaży,
  - `VITE_SALES_EMAIL`: ma pierwszeństwo przed `company.ts`,
  - `VITE_BOOKING_URL`: przycisk „Umów rozmowę”,
  - `BASE_PATH`.
- **Serwer:**
  - `DATA_DIR` (`./data`), `PORT` (8787), `HOST` (`0.0.0.0`), `APP_URL`, `APP_ORIGINS`, `PUBLIC_URL`, `ADMIN_EMAILS`,
  - `MAX_VIDEO_MB` (1024), `MAX_IMAGE_MB` (15), `TRUST_PROXY`, `STATIC_DIR`,
  - `ANTHROPIC_API_KEY`, `AI_MODEL`,
  - `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_{CREATOR,PRO}_{MONTHLY,YEARLY}`, `STRIPE_AUTOMATIC_TAX`,
  - `PANEL_SALT`.
- **Sekrety nigdy w repozytorium.**

---

## 22. Testy i Definition of Done

### 22.1 Testy jednostkowe (Vitest, jsdom)

Przenieść z KidAttention i rozszerzyć:
- **Fiksacje:** wykrywanie, brak w losowym błądzeniu, krótkie mrugnięcie nie przerywa.
- **Kalibracja:** kolejność 10 pozycji, płynny ruch celu, pomijanie pierwszych ms i wagi, model przewiduje nowe punkty mimo ruchu głowy, nowość rośnie daleko od danych, za mało próbek, punkty do powtórzenia, progi jakości, podsumowanie w metadanych.
- **Próbki:** x/y w 0–1 albo null; brak twarzy nie daje punktu; mrugnięcie i odwrócona głowa wstrzymują pomiar; niska pewność nie jest ważna; predykcja poza ekranem odrzucona; wskaźnik jakości; wygładzanie.
- **Cechy:** poza z macierzy; przesunięcie irysa zwiększa `u`.
- **Heat mapa:** maksimum tam, gdzie patrzono; niepewność rozmywa; przezroczyste tło; pusty zakres; każdy widz ma tę samą wagę.
- **Format kolumnowy:** tylko dozwolone pola, odrzucenie pól dodatkowych (np. obrazu), pakiet sesji.
- **Uwaga:** większość decyduje, krótka luka przejmuje stan; przedział Wilsona; największy spadek; przedziały rolki; **rozdzielczość 0,5 s**.
- **Jakość sesji:** odrzucenie POOR i braku danych; odejście to nie odrzucenie.
- **Strefy:** prawdopodobieństwo z niepewnością, zasięg; **czytelność napisu**.
- **Plany i limity:** Free 1 projekt i 5 widzów; limity miesięczne; uprawnienia zgodne z cennikiem.
- **Raport:** rolka 9:16 (spadek po cięciu, sceny, rekomendacje), poziom próby, A/B; **Holm, test proporcji, MDE**.
- **Welch:** wartość p.
- **Feed:** zatrzymanie scrolla, retencja, „oglądają, ale nie patrzą”, porównanie z wypełniaczami.
- **Miniatura:** losowanie pozycji, metryki pierwszego spojrzenia.
- **AI:** tylko liczby z metryk, zakazane słowa w 2+ językach, powrót do reguł przy odmowie.
- **Języki:** §18.
- **Zegary:** interpolacja czasu, czas przechwycenia klatki, pauza i przewinięcie; zegar YouTube (opóźnione odczyty, pauza, przewinięcie, buforowanie jak pauza); współrzędne z czarnymi pasami.
- **YouTube:** rozpoznawanie linków, kody błędów, oEmbed.
- **Eksport:** JSON i CSV.
- **Serwer:**
  - rejestracja bez zdradzania e-maila, paywall 402, izolacja projektów,
  - funkcje płatne, konfiguracja linku, wymagana zgoda i tylko dozwolone pola,
  - usuwanie kodem, retencja, media z `Range`,
  - Stripe (checkout, webhook z podpisem), AI 402 i reguły bez klucza,
  - usunięcie konta kaskadowo, CORS tylko dla aplikacji,
  - **linki udostępniania** (wygaśnięcie, brak surowych danych), **role w zespole**, **wymóg 18+**.

### 22.2 E2E (Playwright)

- **Przeglądarka:** Chromium z `--use-fake-device-for-media-stream --use-fake-ui-for-media-stream --autoplay-policy=no-user-gesture-required`, `serviceWorkers: 'block'`.
- **Dwa serwery w konfiguracji:** podgląd builda (tryb lokalny, port 4173) i serwer z API na tymczasowym katalogu danych (port 4174).
- **Projekty:** desktop 1366×860 i telefon (iPhone 13 na Chromium).
- **Scenariusze:**
  - strona w każdym języku (`?lang=`), przełącznik języka z zapamiętaniem, cennik w walucie języka z działającymi przyciskami zamówienia (`mailto:`),
  - przykładowe raporty (wideo, rolka, feed),
  - prywatność z danymi operatora,
  - widz na telefonie: przygotowanie, przednia kamera, odmowa kamery z instrukcją, pełny ekran bez znacznika, panel pauzy, zakończenie, plik sesji, obrót poziomo → prośba o pion,
  - **feed:** przewijanie i zdarzenia; **miniatura:** wybór,
  - twórca: projekt, link, próba bez kamery (`?sim=1`), import plików, paywall, raport,
  - serwer: konto, link, sesja z telefonu, usunięcie kodem, link udostępniania,
  - PWA: manifest, service worker bez danych w pamięci podręcznej,
  - **brak poziomego przewijania** na wszystkich stronach przy 320, 360 i 390 px we wszystkich językach (porównanie z `page.viewportSize().width`).

### 22.3 Definition of Done (każda funkcja)

- Typy bez błędów, testy jednostkowe i E2E zielone, build i build serwera przechodzą.
- Teksty w słownikach we wszystkich językach MVP.
- Sprawdzone na telefonie (320–414 px) i komputerze. Brak poziomego przewijania. Kontrast AA.
- Bez nowych danych osobowych poza §17.1. Walidacja wejścia po stronie serwera.
- README zaktualizowane (funkcja, konfiguracja, ograniczenia).
- Zrzut ekranu nowego widoku sprawdzony wzrokowo.

---

## 23. Treści demonstracyjne i symulator

- **Klipy demo rysowane proceduralnie na canvasie** (bez licencji):
  - „Rolka demo 15 s, 9:16”: postać mówiąca do kamery (stylizowana twarz), duży napis hooka u góry, produkt w ręku w 6–9 s, CTA na końcu,
  - „Film demo 60 s, 16:9”: 5 scen z cięciami,
  - 5 krótkich wypełniaczy feedu,
  - 6 miniatur.
  - Deterministyczne (ta sama klatka dla tego samego czasu), z funkcją celu wzroku do symulacji.
- **Symulator widzów:** profil uwagi = szansa na sekundę, że widz odwróci wzrok (`hazard(t)`), i że wróci (`recovery(t)`).
  - Próbkowanie 30 Hz, deterministyczne ziarno (mulberry32).
  - Stałe przesunięcie widza ~N(0; 0,04/0,05), szum ~N(0; 0,03/0,035), mrugnięcie co 4,3 s przez 0,15 s.
  - Pewność ~0,8 ± 0,08, niepewność 0,05 + |N(0; 0,02)|, wzrok podąża za celem sceny (współczynnik 0,25 na klatkę).
  - **Profile social:** wyraźny spadek w 1–2 s dla słabego hooka (wersja A) i mniejszy dla mocnego (wersja B); spadek w środkowej scenie; powrót po zmianie kadru; zachowanie w feedzie (przewinięcie zależne od hooka).
  - Urządzenia: mieszanka telefonów (390×844, dpr 3) i komputerów.
- **Przykładowe raporty** na stronie publicznej (`#/sample/reel`, `#/sample/video`, `#/sample/feed`): z symulowanego panelu 31 widzów, z odznaką „Przykładowy raport z symulowanego panelu”. Pełne funkcje odblokowane w podglądzie.
- **Zdanie z raportu na stronie głównej:** z `headline()` przykładu, z prawdziwych danych symulacji.

---

## 24. Lekcje z KidAttention (pułapki do uniknięcia)

1. **Nazwa marki w jednym miejscu.** Zmiana KidGaze → KidAttention dotknęła ~60 plików. Kod wewnętrzny (`attn`) oddzielnie od marki: klucze w przeglądarce, bazy i format plików nie zmieniają się przy zmianie nazwy, więc dane użytkowników przetrwają.
2. **Kody zamiast tekstów w danych.** Powody odrzucenia zapisane po polsku wymagały mapowania przy wyświetlaniu. Od początku zapisuj kody.
3. **Błędy serwera tłumacz po kodzie po stronie klienta.** To samo w trybie lokalnym (helper `fail(code, status, fallback)`).
4. **Kontrast statusów:** pierwotne kolory miały 3,4:1 i nie przechodziły AA. Ramki pól miały 1,35:1. Sprawdzaj skryptem.
5. **Wykres w siatce CSS bez `min-w-0`** rozpychał stronę na telefonie do 776 px we wszystkich językach. Startowa szerokość wykresu trzymała kolumnę.
6. **Test poziomego przewijania porównujący z `innerWidth` nie wykrył problemu,** bo telefon poszerza układ. Porównuj z szerokością ekranu urządzenia.
7. **Długie słowa** (de „Aufmerksamkeitsabfall”) wychodziły poza ekran przy 320 px. Dzielenie wyrazów w nagłówkach.
8. **Nagłówek przy dłuższej nazwie marki** nie mieścił się przy 360 px w es i it. Ukrywaj drugorzędne przyciski poniżej ~370 px, przenoś je do menu, sprawdzaj każdy język.
9. **Cennik bez serwera nie miał żadnego przycisku zakupu** (komunikat techniczny). Zawsze ścieżka kontaktu (e-mail z konfiguracji).
10. **Nie reklamuj funkcji, których nie ma.** Cennik obiecywał „Benchmarki” i „API”, których nie było.
11. **Teksty muszą zgadzać się z zasadami.** Plan Free obiecywał „Wyniki każdego dziecka osobno”, sprzecznie z „raport opisuje film, nie osobę”.
12. **Paleta heat mapy:** tęczowa (niebieski → zielony → żółty → czerwony) jest myląca dla daltonistów. Używaj sekwencyjnej.
13. **Procenty według języka** (`Intl`; de, es ze spacją nierozdzielającą). Ustawiaj bieżący język dla kodu spoza Reacta już podczas renderowania, nie w efekcie.
14. **Ikona „pobierz” na przycisku wgrywania** myliła. Ikony muszą znaczyć akcję.
15. **Domena zawieszona po 15 dniach** bez potwierdzenia e-maila (§21.4). Kosztowało to kilka dni szukania przyczyny w plikach.
16. **Biała strona po FTP** bez informacji. Diagnostyka startu w `index.html` i ścieżki względne.
17. **Service worker nie może trzymać danych:** API, `Range`, `Authorization`, inne domeny pomijamy.
18. **MediaPipe:** ściśle rosnące znaczniki czasu, `captureTime` z rVFC, watchdog rAF, GPU z fallbackiem na CPU, model lokalnie z fallbackiem zdalnym. Serwer może zwrócić `index.html` zamiast modelu, więc sprawdzaj `content-type`.
19. **Zegar YouTube:** `getCurrentTime()` jest opóźniony i skokowy, więc górna obwiednia z 3 s, przeskok i zacięcie jako zdarzenia.
20. **Wideo kamery musi być w DOM,** inaczej brak klatek. Jeden hub kamery na całą aplikację.
21. **E2E w kontenerze z inną wersją Chromium:** `PW_CHROMIUM_PATH`.
22. **Słowa potwierdzenia usunięcia** i dane prawne wymagają przeglądu przez osobę znającą język przed startem.

---

## 25. Kamienie milowe i kryteria akceptacji

| # | Zakres | Gotowe, gdy |
|---|---|---|
| **M0** | Repozytorium, narzędzia (TS, Vite, Tailwind, Vitest, Playwright), `brand.ts`, `company.ts`, `platforms.ts`, tokeny, `kit.tsx`, i18n (pl, en), router, ErrorBoundary, diagnostyka startu, CI | CI zielone; strona „w budowie” w pl i en; test kompletności słowników |
| **M1** | Rdzeń pomiaru (port `core/`), laboratorium (podgląd, kalibracja, oglądanie z markerem, heat mapa, ścieżka, statystyki, eksport), progi dla dorosłych jako konfiguracja | Testy rdzenia zielone; kalibracja na żywo działa na komputerze i telefonie; laboratorium pokazuje jakość |
| **M2** | Warstwa badań: model danych, format kolumnowy (+ `it`), krzywa 0,5 s / 1 s, spadki, segmenty, heat mapy, strefy, czytelność napisów, A/B/n (Welch, proporcje, Holm), MDE, jakość sesji, wnioski z reguł, symulator, raporty demo | Testy jednostkowe zielone; raport demo rolki liczy się z symulacji |
| **M3** | Przebieg widza (zgoda 18+, pytania, przygotowanie, kamera, dźwięk, kalibracja, pełny ekran, pytania po, koniec, outbox, kod usunięcia, link samowystarczalny, plik sesji, `?sim=1`) | E2E telefonu i komputera zielone z fałszywą kamerą |
| **M4** | Studio w trybie lokalnym (projekty, kreator, przygotuj, zbierz z importem, raport, techniczne) + strona publiczna (główna, cennik z e-mailem, prywatność, przykłady) | E2E twórcy zielone; brak przewijania 320–390 px |
| **M5** | Tryb serwerowy (konta, zespoły, media z `Range`, sesje, retencja, usuwanie kodem, linki udostępniania), Docker | Testy serwera zielone; kontener przechodzi healthcheck; E2E serwera |
| **M6** | Test w feedzie, test miniatury, karuzela i slajdy (widz i raport) | E2E feedu i miniatury; metryki zgodne z testami jednostkowymi |
| **M7** | Plany, paywall, Stripe, zamówienie panelu, integracja z dostawcą (adresy powrotu) | Test webhooka z podpisem; paywall w E2E |
| **M8** | Rekomendacje AI (kontrakt, walidacja, pamięć podręczna, limity), grafika do udostępnienia, PDF | Testy walidacji AI; grafika generuje się w 2 formatach |
| **M9** | Szlif: przegląd dostępności, wydajność, kolejne języki, teksty prawne (do przeglądu prawnika), lista kontrolna startu (domena, SSL, DNS, Stripe na żywo, kopie zapasowe `/data`) | Przegląd UX bez błędów krytycznych; lista kontrolna odhaczona |

**Pilotaż przed startem:** 20–30 dorosłych na 3 urządzeniach i w 2 warunkach światła, żeby nastroić progi kalibracji, dolną granicę σ stref i zakres błędu w zastrzeżeniach (§5.5, §5.16, §5.22).

---

## 26. Otwarte decyzje właściciela (z wartościami domyślnymi)

1. **Nazwa i domena:** robocza „ScrollStop”. Kandydaci: ScrollStop, HookLab, Watchline, FirstSeconds. Przed wyborem sprawdzić znaki towarowe (EUIPO, UPRP) i domeny. Opcjonalnie wspólna marka z KidAttention jako linią dla dzieci.
2. **Języki startowe:** pl i en.
3. **Waluty:** pl PLN, en USD (z przełącznikiem EUR), reszta EUR.
4. **Ceny:** §16.2, do walidacji 10–20 wywiadami z twórcami i wyceną panelu.
5. **Dostawca panelu:** w MVP brak integracji, zamówienie e-mailem i obsługa ręczna. Potem integracja przez adresy powrotu.
6. **Wypełniacze feedu:** w MVP materiały twórcy i klipy demo. Licencjonowana biblioteka później.
7. **Zasady treści:** czy przyjmujemy reklamy polityczne (domyślnie nie).
8. **Płatność za panel:** przelew 50% z góry (jak w KidAttention) albo karta jednorazowo przez Stripe (domyślnie przelew).
9. **Wspólny kod z KidAttention:** na start kopia `core/` i części `research/`. Później wspólny pakiet albo monorepo, żeby poprawki pomiaru nie rozjechały się.
10. **Język komentarzy i README:** polski (jak w KidAttention); angielski, jeśli planowani są zagraniczni współpracownicy.
11. **Hosting trybu serwerowego:** Docker na VPS z kopią zapasową wolumenu `/data`. Strona publiczna może zostać na Pages lub FTP.
12. **Retencja domyślna:** 90 dni.
13. **Pytania po obejrzeniu:** domyślnie jedno („Czy obejrzał(a)byś do końca?”).

---

## 27. Słownik pojęć

- **Materiał:** testowany film, klip, miniatura, karuzela albo slajdy.
- **Wersja:** wariant materiału (A–D). Każdy widz widzi jedną.
- **Widz (uczestnik):** dorosła osoba biorąca udział w badaniu. Ma losowy identyfikator.
- **Twórca:** właściciel projektu (osoba, marka, agencja).
- **Sesja:** jedno badanie jednego widza.
- **Uwaga:** udział widzów patrzących na ekran w danym momencie.
- **Retencja:** udział widzów wciąż na klipie (feed, zachowanie).
- **Hook:** pierwsze sekundy materiału. Utrzymanie hooka: §6.
- **Zatrzymanie scrolla:** pozostanie na klipie ≥ T_stop (zachowanie) albo patrzenie w pierwszych 2 s (wzrok).
- **Spadek:** szybka utrata uwagi w krótkim przedziale (§5.13).
- **Segment:** scena albo równy przedział czasu.
- **Strefa (AOI):** prostokąt na obrazie w przedziale czasu, np. twarz, napis, logo.
- **Kalibracja:** ok. 40 s śledzenia punktu (z testem), po których model mapuje oczy na ekran.
- **Poziom próby:** podgląd / wstępny / wiarygodny (§5.18).
- **Tryb lokalny / serwerowy:** §12.2.
- **Link samowystarczalny:** konfiguracja badania zakodowana w adresie, bez serwera.
- **Plik sesji:** wynik widza do odesłania twórcy w trybie lokalnym.
- **Kod usunięcia:** 8 znaków, którymi widz sam usuwa swoją sesję.

---

## Załącznik A. Dane operatora (jak w KidAttention, do potwierdzenia)

`src/config/company.ts`:

```ts
export const COMPANY = {
  name: 'Sebastian Biel',              // jednoosobowa działalność; nazwa z rejestru VAT
  address: 'Wąska 5, 32-765 Rzezawa',
  nip: '8681879901',
  email: 'sebastian.biel@me.com',      // e-mail sprzedaży i kontaktu w sprawie danych (publiczny na stronie)
};
```

- Stopka: „Serwis prowadzi {name}, {address}, NIP {nip}.” i link „Kontakt: {email}”.
- Polityka prywatności: sekcja „Kontakt i operator serwisu”.
- Adres e-mail w linkach jest publiczny, więc może przyciągać spam. Rozważ osobny adres w domenie produktu (np. `kontakt@…`).

## Załącznik B. Format plików i nazwy

- **Plik sesji:**
  - pobierana nazwa: `<brand>-session-<sessionId>.json` (pl: `<brand>-sesja-…`),
  - znacznik formatu `kind: 'attn-session'`, `version: 1`,
  - import przyjmuje każdy `.json` i sprawdza znacznik oraz walidację kolumn.
- **Eksport surowy:** `<brand>_<projectId>.json` (projekt + sesje), `<brand>_<projectId>.csv` (nagłówek metadanych, wiersz na próbkę).
- **Identyfikatory:**
  - konto `acc_` + 9 B, projekt `prj_` + 9 B, sesja `ses_` + 12 B, uczestnik `p_` + 9 B, media `med_` + 15 B,
  - token linku 16 B, token logowania 32 B; wszystkie losowe (`crypto`), base64url.
- **Klucze w przeglądarce:** `attn-lang`, `attn-token`. Bazy IndexedDB: `attn-research`, `attn-outbox`, `attn-lab`.
