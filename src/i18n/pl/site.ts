import { BRAND } from '../../config/brand';

/** Strona publiczna: nagłówek, stopka, strona główna, „w budowie”, 404. */
export const site = {
  meta: {
    title: `${BRAND.name} — w której sekundzie widzowie przestają patrzeć?`,
  },
  nav: {
    home: 'Strona główna',
    pricing: 'Cennik',
    privacy: 'Prywatność',
    sample: 'Przykładowy raport',
    login: 'Zaloguj się',
    studio: 'Studio',
    startFree: 'Przetestuj za darmo',
    menu: 'Menu',
    mainNav: 'Nawigacja główna',
  },
  hero: {
    title: 'W której sekundzie widzowie przestają patrzeć na Twoją rolkę?',
    lead: 'Sprawdź hook, montaż i napisy na prawdziwych widzach, zanim opublikujesz. Widzowie oglądają na swoim telefonie, a Ty dostajesz krzywą uwagi sekunda po sekundzie, mapę spojrzeń i konkretne poprawki. Obraz z kamery nie opuszcza urządzenia widza.',
    ctaPrimary: 'Przetestuj rolkę za darmo',
    ctaSample: 'Zobacz przykładowy raport',
    freeNote: 'Za darmo: 1 projekt i 5 widzów. Bez karty.',
  },
  building: {
    badge: 'W budowie',
    title: 'Pracujemy nad pierwszą wersją',
    body: 'Budujemy narzędzie do badania uwagi widzów przed publikacją: krzywą uwagi, wynik hooka, test w feedzie i mapy spojrzeń. Strona zmienia się z każdym etapem prac.',
    points: [
      'Widzowie oglądają w przeglądarce, bez instalowania aplikacji.',
      'Kamera tylko szacuje, gdzie patrzy widz. Obraz nie opuszcza urządzenia.',
      'Badamy materiał, a nie ludzi. Tylko dorośli widzowie, za ich zgodą.',
    ],
    contact: 'Chcesz przetestować wcześniej? Napisz do nas',
  },
  footer: {
    operator: (name: string, address: string, nip: string) => `Serwis prowadzi ${name}, ${address}, NIP ${nip}.`,
    contact: 'Kontakt',
    rights: (year: number) => `© ${year} ${BRAND.name}`,
    note: 'Szacowanie kierunku wzroku kamerą internetową. Obraz z kamery nie opuszcza urządzenia widza.',
  },
  notFound: {
    title: 'Nie ma takiej strony',
    body: 'Adres mógł się zmienić albo zawiera literówkę.',
    home: 'Wróć na stronę główną',
  },
  soonPage: {
    title: 'Ta część jeszcze powstaje',
    body: 'Ten widok pojawi się w jednym z kolejnych etapów prac.',
  },
};
