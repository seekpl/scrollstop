import { BRAND } from '../../config/brand';

/**
 * Teksty prawne (M9): regulamin i uzupełnienie polityki prywatności o dane twórców. Wersja robocza
 * do przeglądu prawnika (§17); notatka „wersja robocza” znika po ustawieniu `COMPANY.legalReviewed`.
 */
export const legal = {
  draft: 'Wersja robocza do przeglądu prawnego.',
  updated: (date: string) => `Obowiązuje od ${date}.`,
  terms: {
    title: 'Regulamin',
    lead: `Zasady korzystania z ${BRAND.name}: kto świadczy usługę, co obejmuje, ile kosztuje i jak zgłosić problem.`,
    operator: (name: string, address: string, nip: string, email: string) => `Serwis ${BRAND.name} prowadzi ${name}, ${address}, NIP ${nip} (dalej: operator). Kontakt: ${email}.`,
    sections: [
      {
        id: 'definitions',
        title: '1. Pojęcia',
        items: [
          `Serwis — aplikacja ${BRAND.name} w przeglądarce: strona publiczna, studio twórcy, badanie widza i laboratorium.`,
          'Twórca — osoba lub firma, która przygotowuje badanie materiału i odbiera raport.',
          'Widz — pełnoletnia osoba, która dobrowolnie ogląda materiał w ramach badania.',
          'Konto — konto twórcy w trybie serwerowym, zakładane adresem e-mail i hasłem.',
          'Plan — zakres funkcji i limitów opisany w cenniku (Free, Creator, Pro, Agency).',
          'Badanie z panelem — usługa doboru widzów spoza społeczności twórcy, wyceniana indywidualnie.',
        ],
      },
      {
        id: 'services',
        title: '2. Usługi',
        items: [
          'Serwis szacuje kamerą internetową widza, czy i gdzie widz patrzy na materiał, i przedstawia twórcy wyniki zbiorcze: krzywą uwagi, spadki, sceny, heat mapy, strefy i porównania wersji.',
          'Obraz z kamery jest przetwarzany wyłącznie w przeglądarce widza i nie jest wysyłany ani zapisywany.',
          'Tryb lokalny działa bez konta: projekty i sesje zostają w przeglądarce twórcy. Tryb z kontem przechowuje projekty, materiały i sesje na serwerze operatora.',
          'Wyniki są szacunkiem opartym na kamerze internetowej, o dokładności zależnej od urządzenia, światła i liczby widzów. Raport pokazuje niepewność wyniku. Serwis nie przewiduje wyświetleń ani zasięgów.',
          'Rekomendacje opisane przez AI są oznaczone nazwą modelu, powstają wyłącznie z policzonych metryk i mają charakter pomocniczy.',
        ],
      },
      {
        id: 'technical',
        title: '3. Wymagania techniczne',
        items: [
          'Aktualna przeglądarka (Chrome, Edge, Safari albo Firefox) z włączonym JavaScriptem i dostępem do internetu.',
          'U widza: kamera i zgoda przeglądarki na jej użycie. Badanie działa wyłącznie przez połączenie szyfrowane (HTTPS).',
        ],
      },
      {
        id: 'account',
        title: '4. Konto',
        items: [
          'Konto zakłada osoba pełnoletnia, podając prawdziwy adres e-mail. Za bezpieczeństwo hasła odpowiada właściciel konta.',
          'Właściciel może zaprosić do zespołu osoby z rolą edytora albo widza raportu; liczba miejsc zależy od planu.',
          'Konto można usunąć w każdej chwili w ustawieniach. Usunięcie konta usuwa projekty, sesje i pliki. Aktywną subskrypcję należy wcześniej anulować w portalu płatności.',
        ],
      },
      {
        id: 'creator',
        title: '5. Obowiązki twórcy',
        items: [
          'Twórca oświadcza, że ma prawa do materiałów, które wgrywa albo wskazuje, i że materiał nie zawiera treści seksualnych, przemocy, mowy nienawiści, oszustw ani reklam politycznych.',
          'Twórca bada wyłącznie osoby pełnoletnie i nie wykorzystuje serwisu do zastosowań wykluczonych w zasadach etycznych (m.in. badanie bez wiedzy widza, w miejscu pracy lub szkole, ocena pojedynczych osób, rozpoznawanie emocji).',
          'Twórca jest administratorem danych z własnego badania i jego nazwa widnieje na ekranie zgody. Operator przetwarza te dane w imieniu twórcy; umowę powierzenia przetwarzania operator udostępnia na prośbę (w planie Agency jest częścią oferty).',
          'Po zgłoszeniu treści przez widza operator może wstrzymać projekt do czasu wyjaśnienia.',
        ],
      },
      {
        id: 'payments',
        title: '6. Plany i płatności',
        items: [
          'Ceny w cenniku są cenami netto; do faktury doliczamy VAT według przepisów. Plan Free jest bezpłatny.',
          'Plany Creator i Pro są subskrypcją miesięczną albo roczną opłacaną kartą przez Stripe. Subskrypcja odnawia się automatycznie; anulujesz ją w portalu płatności i działa do końca opłaconego okresu.',
          'Plan Agency i badanie z panelem rozliczamy na podstawie faktury; badanie z panelem wymaga wyceny i potwierdzenia terminu, płatność przelewem (50% z góry).',
          'Gdy płatność kartą się nie powiedzie, Stripe ponawia ją przez kilka dni i plan działa w tym czasie. Jeśli płatność się nie uda, subskrypcja zostaje anulowana, a konto wraca do planu Free bez utraty danych.',
        ],
      },
      {
        id: 'consumers',
        title: '7. Konsumenci',
        items: [
          'Konsument oraz przedsiębiorca na prawach konsumenta może odstąpić od umowy zawartej na odległość w ciągu 14 dni bez podania przyczyny, pisząc na adres kontaktowy operatora.',
          'Jeżeli na wyraźne żądanie konsumenta świadczenie usługi rozpoczęło się przed upływem tego terminu, konsument płaci za okres do chwili odstąpienia. Postanowienia regulaminu nie ograniczają praw konsumenta wynikających z przepisów.',
        ],
      },
      {
        id: 'liability',
        title: '8. Odpowiedzialność i dostępność',
        items: [
          'Operator dba o ciągłość działania serwisu, ale może go czasowo wyłączyć na czas prac technicznych.',
          'Wobec przedsiębiorców odpowiedzialność operatora jest ograniczona do kwoty opłat zapłaconych za ostatnie 12 miesięcy i nie obejmuje utraconych korzyści.',
          'Decyzje montażowe i publikacyjne podejmuje twórca; wyniki badania są wskazówką, a nie gwarancją efektu.',
        ],
      },
      {
        id: 'complaints',
        title: '9. Reklamacje',
        items: ['Reklamację można złożyć e-mailem na adres kontaktowy operatora, opisując problem i wskazując konto lub projekt.', 'Operator odpowiada w ciągu 14 dni.'],
      },
      {
        id: 'changes',
        title: '10. Zmiany i prawo właściwe',
        items: [
          'O zmianie regulaminu operator informuje posiadaczy kont e-mailem co najmniej 14 dni wcześniej; kto się nie zgadza, może usunąć konto przed wejściem zmian w życie.',
          'Do umów stosuje się prawo polskie. Spory z przedsiębiorcami rozstrzyga sąd właściwy dla siedziby operatora; konsument może skorzystać z sądu właściwego według przepisów ogólnych.',
        ],
      },
    ],
  },
  privacyExtra: {
    creatorsTitle: 'Dane twórców (konta)',
    creators: [
      'Przy koncie zapisujemy e-mail, imię lub nazwę, nazwę firmy, skrót hasła (nigdy samo hasło), plan i historię płatności, a także projekty i wgrane materiały.',
      'Podstawą jest umowa o świadczenie usługi (art. 6 ust. 1 lit. b RODO), obowiązki podatkowe przy fakturach (lit. c) oraz prawnie uzasadniony interes przy bezpieczeństwie i limitach zapytań (lit. f).',
      'Dane konta przechowujemy do jego usunięcia; dokumenty księgowe przez okres wymagany przepisami podatkowymi.',
    ],
    processorsTitle: 'Komu powierzamy dane',
    processors: [
      'Hosting serwera, na którym działają konta, projekty i sesje.',
      'Stripe — płatności kartą i faktury subskrypcji (dane płatnika, bez danych widzów).',
      'Anthropic — opis rekomendacji przez AI, gdy twórca z niego skorzysta; model dostaje wyłącznie policzone metryki zbiorcze, bez danych osobowych twórcy i widzów.',
    ],
    gdprTitle: 'Twoje prawa',
    gdpr: [
      'Masz prawo dostępu do swoich danych, ich sprostowania, usunięcia, ograniczenia przetwarzania, przeniesienia i sprzeciwu.',
      'Masz prawo wnieść skargę do Prezesa Urzędu Ochrony Danych Osobowych.',
      'Widz, którego dane dotyczą badania twórcy, może też skontaktować się z twórcą wskazanym na ekranie zgody albo usunąć sesję kodem usunięcia.',
    ],
  },
};
