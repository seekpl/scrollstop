/** Teksty komponentów bazowych (src/ui/kit.tsx) i ekranów awaryjnych. */
export const ui = {
  close: 'Zamknij',
  languageLabel: 'Język strony',
  openMenu: 'Otwórz menu',
  closeMenu: 'Zamknij menu',
  skipToContent: 'Przejdź do treści',
  loading: 'Wczytuję…',
  copyDone: 'Skopiowano do schowka',
  copyFailed: 'Nie udało się skopiować. Zaznacz tekst i skopiuj ręcznie.',
  stepOf: (i: number, n: number) => `Krok ${i} z ${n}`,
  errorBoundary: {
    title: 'Ta strona się nie wyświetliła',
    body: 'Odśwież stronę. Jeśli komunikat wróci, przekaż poniższy opis błędu osobie, która wdrażała aplikację.',
  },
};
