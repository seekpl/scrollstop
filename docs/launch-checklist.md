# Lista kontrolna startu (M9)

Stan na koniec M9. Pozycje odhaczone są zrobione w kodzie i sprawdzane testami. Pozostałe wymagają decyzji albo kont właściciela (DNS, Stripe na żywo) — kod jest na nie gotowy.

## Gotowe w kodzie

- [x] **Dostępność (WCAG 2.2 AA):** automatyczny audyt axe-core ok. 20 ekranów (strona publiczna, studio, raport z oknami, badanie widza) na komputerze i telefonie — `e2e/a11y.spec.ts`, bez naruszeń. Fokus 3 px, etykiety pól, kontrast odznak ≥ 4,5:1, tabele z podpisem i przewijaniem z klawiatury.
- [x] **Brak poziomego przewijania** przy 320–390 px w pl i en (studio, strona, widz, tryb serwerowy) — E2E.
- [x] **Wydajność:** paczka główna 357 kB (115 kB gzip, wcześniej 770 kB); badanie widza, studio, raporty i laboratorium w osobnych plikach; śledzenie twarzy i słownik angielski na żądanie; model twarzy pobierany tylko w badaniu.
- [x] **Druk i PDF:** białe tło, nagłówek z marką i datą, bez powłoki studia, wykresy w szerokości A4, znak wodny Free — E2E.
- [x] **Bezpieczeństwo serwera:** nagłówki (§15), CORS tylko dla aplikacji, limity zapytań, hasła scrypt, tokeny jako skróty, izolacja zespołów — testy serwera.
- [x] **Płatności:** Stripe Checkout, portal, webhook z podpisem i idempotencją; bez kluczy — zamówienie e-mailem — `tests/billing.test.ts`, `e2e/billing.spec.ts`.
- [x] **AI:** walidacja liczb i treści, pamięć podręczna, limit; bez klucza — wnioski z reguł — `tests/ai.test.ts`, `e2e/ai.spec.ts`.
- [x] **Kopie zapasowe:** `node dist-server/main.js backup <plik.sqlite>` (spójna kopia w trakcie działania) — test serwera.
- [x] **Stan serwera:** `GET /api/health` (`HEALTHCHECK` w obrazie Docker).
- [x] **Teksty prawne:** regulamin (`/terms/`), prywatność z danymi twórców, podmiotami przetwarzającymi i prawami z RODO; właściciel serwisu (Sebastian Biel, NIP 8681879901) w stopce, regulaminie i prywatności; linki w stopce i przy rejestracji.
- [x] **Wyszukiwarki:** strony publiczne pod własnymi adresami (`/pricing/`, `/privacy/`, `/terms/`, `/sample/…`) z tytułem, opisem, adresem kanonicznym i Open Graph; `sitemap.xml` i `robots.txt` generowane przy budowaniu dla https://scroll-stop.com/ (inny adres: zmienna `SITE_URL`).

## Do zrobienia przed startem (właściciel)

### Marka i domena (§21.4, §26.1)
- [x] Domena: scroll-stop.com (`domain` w `src/config/brand.ts`).
- [ ] **W ciągu 15 dni od rejestracji domeny potwierdzić e-mail właściciela** (ICANN) — inaczej rejestrator zawiesza domenę.
- [ ] DNS: serwery nazw na hosting; rekordy A (i AAAA) dla domeny, `www` i `mail`.
- [ ] Certyfikat SSL (Let's Encrypt) po rozejściu się DNS — **kamera działa tylko przez HTTPS**.
- [ ] Sprawdzenie z zewnątrz: `https://dns.google/resolve?name=scroll-stop.com` i RDAP rejestru (status, serwery nazw).
- [ ] Po uruchomieniu: zgłoszenie `https://scroll-stop.com/sitemap.xml` w Google Search Console.
- [ ] Adres kontaktowy w domenie: `email` w `src/config/company.ts` albo `VITE_SALES_EMAIL`.

### Serwer (Docker, §21.1)
- [ ] Zmienne: `APP_URL` (adres z `https://`), `APP_ORIGINS`, `ADMIN_EMAILS`, `TRUST_PROXY=1` za odwrotnym proxy.
- [ ] `PANEL_SALT`: losowa wartość (np. `openssl rand -hex 32`), zapisana w menedżerze haseł; **nie zmieniać po starcie** (skróty uczestników panelu przestałyby pasować).
- [ ] Wolumen `/data` i codzienna kopia poza serwerem, np. w crontab hosta:
  ```bash
  docker exec scrollstop node dist-server/main.js backup /data/backup/attn-$(date +%F).sqlite && rsync -a /var/lib/docker/volumes/scrollstop-data/_data/ backup-host:/kopie/scrollstop/
  ```
  Raz na kwartał: próba odtworzenia kopii na czystym kontenerze.
- [ ] Monitoring `GET /api/health` (np. co 5 min) z powiadomieniem.

### Stripe na żywo (§16.4)
- [ ] Produkty Creator i Pro, ceny miesięczne i roczne (roczna = 10 × miesięczna); waluty PLN/EUR/USD przez `currency_options` ceny. Identyfikatory w `STRIPE_PRICE_*`.
- [ ] Webhook `https://<domena>/api/billing/webhook` ze zdarzeniami `checkout.session.completed`, `customer.subscription.created|updated|deleted`, `invoice.payment_failed`; sekret w `STRIPE_WEBHOOK_SECRET`.
- [ ] Portal klienta: zmiana planu między cenami Creator/Pro, anulowanie z końcem okresu, faktury.
- [ ] Ponawianie nieudanych płatności: po ostatniej próbie **anuluj subskrypcję** (tak opisuje regulamin).
- [ ] VAT: Stripe Tax i `STRIPE_AUTOMATIC_TAX=1`, jeśli sprzedaż trafia do konsumentów w UE; dane firmy na fakturach.
- [ ] Zakup testową kartą w trybie testowym, potem klucze live; adres regulaminu (https://scroll-stop.com/terms/) w ustawieniach Checkout.

### AI (§8.4)
- [ ] `ANTHROPIC_API_KEY` i `AI_MODEL` (domyślnie `claude-opus-5-5`); miesięczny limit wydatków w konsoli Anthropic.

### Prawo (§17)
- [ ] Ocena skutków dla ochrony danych (DPIA) i rejestr czynności przetwarzania.
- [ ] Decyzja o reklamach politycznych (domyślnie nie, §26.7).
- [ ] Umowa powierzenia z hostingiem; potwierdzenie, że Stripe i Anthropic są wskazani jako podmioty przetwarzające.

### Treści i języki (§18)
- [ ] Przegląd tekstów angielskich przez osobę znającą język, szczególnie zgody i prywatności.
- [ ] Kolejne języki (de, es, it, pt-BR, fr) według decyzji §26.2 — architektura gotowa: wpis w `src/i18n/locales.ts`, słowniki `src/i18n/<kod>/`, implementacja `ResearchText`; TypeScript i test słowników pilnują kompletności.

### Pilotaż i ceny (§25, §16.5)
- [ ] Pilotaż: 20–30 dorosłych, 3 urządzenia, 2 warunki światła — strojenie progów kalibracji, dolnej granicy σ stref i zakresu błędu w zastrzeżeniach.
- [ ] Wycena badania z panelem u dostawcy, zanim cena „od 590 zł / 139 €” trafi do kampanii; ceny planów po 10–20 wywiadach z twórcami.
