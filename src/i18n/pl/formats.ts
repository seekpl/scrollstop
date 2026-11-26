import { BRAND } from '../../config/brand';
import type { FormatFacts } from '../../research/formatFacts';

/** Treść podstrony formatu badania (`/formats/<id>/`). Liczby i plany przychodzą z `FormatFacts`. */
export interface FormatContent {
  /** Nagłówek H1 (z główną frazą). */
  title: string;
  lead: string;
  /** Od którego planu działa format. */
  planNote: string;
  cta: string;
  questions: string[];
  steps: Array<[string, string]>;
  report: Array<[string, string]>;
  when: string[];
  faq: Array<[string, string]>;
}

/**
 * Podstrony formatów badań: treść pod wyszukiwarki i reklamę. Zasady: konkretnie, bez obietnic
 * wyników, każda liczba z danych (`FormatFacts`), uczciwie o tym, co mierzy kamera.
 */
export const formats = {
  label: {
    questions: 'Na jakie pytania odpowiada',
    steps: 'Jak przebiega badanie',
    report: 'Co dostajesz w raporcie',
    when: 'Kiedy warto',
    faq: 'Najczęstsze pytania',
    other: 'Inne formaty badań',
    sample: 'Zobacz przykładowy raport',
    pricing: 'Zobacz cennik',
    tile: (name: string) => `${name} — dowiedz się więcej`,
    ctaTitle: 'Sprawdź materiał, zanim zobaczy go algorytm',
    ctaLead: `Pierwszy projekt w ${BRAND.name} jest za darmo. Bez karty, bez instalowania aplikacji przez widzów.`,
    privacy: 'Obraz z kamery zostaje na urządzeniu widza. Badamy wyłącznie dorosłych, za ich zgodą.',
  },
  pages: {
    reel: (f: FormatFacts): FormatContent => ({
      title: 'Test rolki 9:16 przed publikacją',
      lead: 'Sprawdź rolkę na TikTok, Instagram Reels albo YouTube Shorts na prawdziwych widzach, zanim zobaczy ją algorytm. Widzowie oglądają na swoich telefonach, a Ty dostajesz krzywą uwagi sekunda po sekundzie, ocenę hooka i listę scen do poprawy.',
      planNote: `Krzywa uwagi i hook w planie ${f.plan.free}. Heat mapy i wnioski od planu ${f.plan.heatmaps}.`,
      cta: 'Przetestuj rolkę',
      questions: [
        'Czy pierwsza sekunda zatrzymuje widza, czy hook trzeba przebudować?',
        'W której sekundzie widzowie odwracają wzrok i na jakiej scenie?',
        'Czy widzowie czytają napisy, patrzą na produkt, czy tylko na twarz?',
        'Czy napisy i przycisk nie chowają się pod interfejsem TikToka, Reels albo Shorts?',
      ],
      steps: [
        ['Dodaj rolkę', 'Wgraj plik MP4, MOV lub WebM albo wklej link. Wybierz platformę: od niej zależą strefy zasłaniane przez przyciski i opis.'],
        ['Wyślij link widzom', 'Widz otwiera link w przeglądarce telefonu, bez instalowania aplikacji. Wyraża zgodę i przechodzi krótką kalibrację wzroku.'],
        ['Widzowie oglądają jak w aplikacji', 'Rolka leci na pełnym ekranie, z dźwiękiem albo bez. Na koniec widz odpowiada na jedno do trzech krótkich pytań.'],
        ['Czytasz raport', `Pierwszy kształt krzywej widać po kilku osobach. Wiarygodny wynik daje ${f.reliable} widzów.`],
      ],
      report: [
        ['Krzywa uwagi', 'Odsetek widzów patrzących na ekran w każdej pół sekundzie, z pasmem niepewności zależnym od liczby osób.'],
        ['Hook po 1 i 3 sekundach', 'Ilu widzów patrzy na starcie i ilu z nich wciąż patrzy po trzech sekundach.'],
        ['Sceny do poprawy', 'Spadki uwagi przypisane do scen, od największego, z konkretną wskazówką, co zmienić.'],
        ['Heat mapy i strefy', `Gdzie patrzą widzowie w każdej scenie: twarz, napis, produkt, przycisk. Heat mapy od planu ${f.plan.heatmaps}, strefy od planu ${f.plan.aoi}.`],
      ],
      when: [
        'Przed publikacją rolki reklamowej albo współpracy, za którą odpowiadasz przed marką.',
        'Gdy masz dwa pomysły na początek i chcesz wiedzieć, który zatrzymuje więcej osób.',
        'Gdy statystyki platformy pokazują spadek, ale nie mówią, co go powoduje.',
      ],
      faq: [
        ['Czy widzowie muszą instalować aplikację?', 'Nie. Badanie działa w przeglądarce telefonu lub komputera. Widz potrzebuje kamery i zgody przeglądarki na jej użycie.'],
        ['Czy nagrywacie twarze widzów?', 'Nie. Obraz z kamery jest przetwarzany na urządzeniu widza i od razu znika. Do raportu trafia tylko szacowany kierunek wzroku, bez zdjęć i nagrań.'],
        ['Ilu widzów potrzebuję?', `Pierwszy kształt krzywej widać po kilku osobach. Wiarygodna krzywa zaczyna się od ${f.reliable} widzów, a raport pokazuje, jak bardzo wynik może się jeszcze zmienić.`],
        ['Jak dokładny jest pomiar kamerą?', 'Kamera internetowa szacuje wzrok z dokładnością kilku procent szerokości ekranu. Dlatego raport mówi o scenach i strefach, a nie o pojedynczych słowach.'],
      ],
    }),
    video: (f: FormatFacts): FormatContent => ({
      title: 'Test filmu 16:9 przed publikacją na YouTube',
      lead: 'Zobacz, w którym momencie dłuższego filmu widzowie przestają patrzeć: we wstępie, przy wykresie, w przebitkach czy przy wezwaniu do działania. Badanie działa na komputerze i telefonie, z pliku albo z filmu na YouTube.',
      planNote: `Krzywa uwagi w planie ${f.plan.free}. Heat mapy od planu ${f.plan.heatmaps}, czytelność napisów od planu ${f.plan.text}.`,
      cta: 'Przetestuj film',
      questions: [
        'Czy wstęp utrzymuje widza do pierwszego konkretu?',
        'Które sceny i przebitki tracą uwagę widzów?',
        'Czy widzowie czytają tytuły, wykresy i napisy na ekranie?',
        'Czy końcowe wezwanie do działania ktoś jeszcze ogląda?',
      ],
      steps: [
        ['Dodaj film', 'Wgraj plik albo wklej adres filmu na YouTube. Ustaw, czy widzowie oglądają z dźwiękiem.'],
        ['Wyślij link widzom', 'Widz ogląda w przeglądarce na komputerze lub telefonie, po zgodzie i krótkiej kalibracji wzroku.'],
        ['Widzowie oglądają jak zwykle', 'Film leci na pełnym ekranie. Sesje bez wiarygodnego pomiaru odpadają w automatycznej kontroli jakości.'],
        ['Czytasz raport', 'Krzywa uwagi przez cały film, sceny z największymi spadkami i heat mapy kluczowych momentów.'],
      ],
      report: [
        ['Krzywa uwagi przez cały film', 'Ilu widzów patrzy w każdej chwili, także wtedy, gdy film leci, a widz już patrzy gdzie indziej.'],
        ['Momenty spadku', 'Fragmenty, w których uwaga spada najszybciej, z czasem i sceną.'],
        ['Heat mapy scen', `Na co patrzą widzowie przy wykresach, planszach i rozmowie. Od planu ${f.plan.heatmaps}.`],
        ['Tytuły i napisy', `Czy widzowie zdążą przeczytać tekst na ekranie. Od planu ${f.plan.text}.`],
      ],
      when: [
        'Przed premierą filmu, nad którym pracowało kilka osób, gdy nie chcesz zgadywać, co skrócić.',
        'Gdy retencja w YouTube Studio spada w tym samym miejscu w kolejnych filmach.',
        'Gdy przygotowujesz film reklamowy albo szkoleniowy i liczy się każda minuta.',
      ],
      faq: [
        ['Czy mogę zbadać film, który jest już na YouTube?', 'Tak. Wklejasz adres filmu, a widzowie oglądają go w odtwarzaczu YouTube osadzonym w badaniu.'],
        ['Czym to się różni od retencji w YouTube Studio?', 'Retencja mówi, kiedy widz zamknął film. Badanie pokazuje też, kiedy film leci, a widz nie patrzy, i na co patrzy w kadrze. Wynik masz przed publikacją, a nie po niej.'],
        ['Ilu widzów potrzebuję?', `Wiarygodna krzywa zaczyna się od ${f.reliable} widzów. Możesz zaprosić własną społeczność albo zamówić badanie z panelem dobranych widzów.`],
        ['Czy widzowie muszą mieć kamerę?', 'Tak, kierunek wzroku szacuje kamera w przeglądarce. Obraz zostaje na urządzeniu widza i nie jest zapisywany.'],
      ],
    }),
    feed: (f: FormatFacts): FormatContent => ({
      title: 'Test w feedzie: czy Twój klip zatrzyma scroll',
      lead: `Widz przewija feed z ${f.feedItems} klipów, a Twój pojawia się między innymi postami. Sprawdzasz to, co decyduje o zasięgu: czy klip zatrzymuje przewijanie i jak długo widz na nim zostaje w porównaniu z resztą feedu.`,
      planNote: `Od planu ${f.plan.feed}.`,
      cta: 'Przetestuj klip w feedzie',
      questions: [
        'Ilu widzów zatrzymuje przewijanie na Twoim klipie?',
        'Czy zostają na nim dłużej niż na pozostałych postach?',
        'W której sekundzie najczęściej przewijają dalej?',
        'Czy oglądają, ale nie patrzą: klip leci, a wzrok jest gdzie indziej?',
      ],
      steps: [
        ['Dodaj klip i tło feedu', 'Twój klip trafia między inne posty: neutralne klipy demo albo Twoje wcześniejsze materiały. Możesz włączyć nakładkę z ikonami i opisem, bez znaków platform.'],
        ['Widz przewija jak w aplikacji', 'Na telefonie przesuwa palcem, na komputerze kółkiem myszy lub strzałkami. Nie wie, który klip jest badany.'],
        ['Kolejność jest losowa', `Badany klip trafia na losową pozycję od 2. do ${f.feedItems - 1}., pozostałe posty układają się w losowej kolejności. Wynik nie zależy od miejsca w feedzie.`],
        ['Czytasz raport', 'Zatrzymanie scrolla, czas na klipie wobec pozostałych postów i momenty przewinięcia.'],
      ],
      report: [
        ['Zatrzymanie scrolla', `Odsetek widzów, którzy zostali na klipie co najmniej ${f.feedStop} s i patrzyli na niego przez większość tego czasu.`],
        ['Czas na klipie', 'Mediana i średnia z przedziałem ufności, porównane z pozostałymi klipami feedu i testem istotności.'],
        ['Przewinięcia', 'W której sekundzie widzowie przesuwają dalej i ilu obejrzało klip do końca.'],
        ['Oglądają, ale nie patrzą', 'Ile czasu klip leci, gdy wzrok widza jest poza ekranem.'],
      ],
      when: [
        'Gdy chcesz wiedzieć, czy początek klipu wygra z resztą feedu, a nie tylko z pustym ekranem.',
        'Przed kampanią płatną, w której płacisz za każde wyświetlenie.',
        'Gdy rolka dobrze wypada w zwykłym teście, a chcesz sprawdzić ją w warunkach przewijania.',
      ],
      faq: [
        ['Czym test w feedzie różni się od zwykłego testu rolki?', 'W zwykłym teście widz ogląda tylko Twój materiał. W feedzie klip konkuruje z innymi postami, więc widać, czy zatrzymuje przewijanie.'],
        ['Czy widz wie, który klip badamy?', 'Nie. Badanie jest ślepe: klip ma losową pozycję, a po przewinięciu feedu nie ma pytań o konkretny materiał.'],
        ['Jakie posty są obok mojego klipu?', 'Domyślnie neutralne klipy demo. Możesz dodać własne wcześniejsze materiały, żeby feed przypominał Twój profil.'],
        ['Czy to działa na komputerze?', 'Tak. Na telefonie widz przesuwa palcem, na komputerze używa kółka myszy albo strzałek.'],
      ],
    }),
    thumbnail: (f: FormatFacts): FormatContent => ({
      title: 'Test miniatury YouTube: czy przyciąga wzrok',
      lead: `Widz przez ${f.gridExposure} sekund patrzy na siatkę filmów z Twoją miniaturą, a potem wybiera, co chce obejrzeć. Wiesz, czy miniatura łapie wzrok szybciej niż sąsiednie i czy ktoś chce kliknąć właśnie ją.`,
      planNote: `Od planu ${f.plan.thumbnail}.`,
      cta: 'Przetestuj miniaturę',
      questions: [
        'Czy widz w ogóle zauważa Twoją miniaturę w siatce?',
        'Jak szybko pada na nią pierwsze spojrzenie?',
        'Którą miniaturę widzowie chcą obejrzeć?',
        'Czy wynik zależy od samej miniatury, czy od jej miejsca w siatce?',
      ],
      steps: [
        ['Dodaj miniaturę', 'Wgraj obraz i wybierz układ: strona główna z siatką 3 × 2, wyniki wyszukiwania na telefonie albo siatka profilu.'],
        ['Widz patrzy na siatkę', `Siatka jest widoczna przez ${f.gridExposure} s (do ustawienia od ${f.gridMin} do ${f.gridMax} s), jak przy przeglądaniu strony z filmami.`],
        ['Widz wybiera film', 'Potem odpowiada, który film chce obejrzeć. Pozostałe miniatury mają neutralne tytuły, żeby tekst nie wyróżniał Twojej.'],
        ['Czytasz raport', 'Spojrzenia, czas do pierwszego spojrzenia, udział w patrzeniu i wybory widzów.'],
      ],
      report: [
        ['Spojrzenia', 'Ilu widzów zatrzymało wzrok na Twojej miniaturze.'],
        ['Pierwsze spojrzenie', 'Mediana czasu od pokazania siatki. Im krócej, tym szybciej miniatura łapie uwagę.'],
        ['Udział w patrzeniu i kolejność', 'Jaką część czasu widzowie patrzą na Twoją miniaturę i którą z kolei oglądają ją jako pierwszą.'],
        ['Wybór i wskaźnik pozycji', 'Ilu widzów chce obejrzeć film i jak miniatura wypada wobec innych na tej samej pozycji w siatce.'],
      ],
      when: [
        'Przed publikacją filmu, w który włożyłeś dużo pracy.',
        'Gdy wahasz się między projektami miniatury i chcesz decyzji opartej na wzroku widzów, a nie na głosowaniu w zespole.',
        'Gdy film ma dobrą retencję, ale mało wyświetleń ze strony głównej i wyszukiwania.',
      ],
      faq: [
        ['Czy widz wie, którą miniaturę badamy?', 'Nie. Twoja miniatura stoi w siatce między innymi, a ich tytuły są neutralne, więc nic jej nie wyróżnia.'],
        ['Co oznacza „spojrzenie” w raporcie?', 'Wzrok widza zatrzymał się na miniaturze przez kilka kolejnych pomiarów, a nie tylko po niej przemknął.'],
        ['Czy wybór widza to to samo co kliknięcie?', 'Nie. To deklaracja po obejrzeniu siatki. Dlatego raport pokazuje osobno, na co widz patrzył, i osobno, co wybrał.'],
        ['Czy mogę porównać kilka miniatur?', `Tak. Do ${f.maxVariants} miniatur w jednym badaniu (od planu ${f.plan.variants4}), a raport zestawia je na tych samych miarach.`],
      ],
    }),
    carousel: (f: FormatFacts): FormatContent => ({
      title: 'Test karuzeli: do którego slajdu dochodzą widzowie',
      lead: 'Sprawdź karuzelę na Instagram albo LinkedIn, zanim ją opublikujesz. Widzisz, do którego obrazu dochodzą widzowie, ile czasu zostają na każdym slajdzie i gdzie przestają przesuwać.',
      planNote: `Od planu ${f.plan.carousel}.`,
      cta: 'Przetestuj karuzelę',
      questions: [
        'Czy okładka zachęca do przesunięcia na drugi slajd?',
        'Na którym slajdzie widzowie kończą przeglądanie?',
        'Ile czasu zostają na każdym obrazie i czy patrzą na tekst?',
        'Czy slajd z wezwaniem do działania ktoś w ogóle widzi?',
      ],
      steps: [
        ['Dodaj slajdy', 'Wgraj obrazy w kolejności karuzeli. Możesz też ustawić automatyczną zmianę slajdów, jak w relacjach.'],
        ['Widz przegląda jak w aplikacji', 'Przesuwa slajdy palcem albo strzałkami i sam decyduje, kiedy skończyć.'],
        ['Pomiar dla każdego slajdu', 'Badanie zapisuje, który slajd jest na ekranie, jak długo i czy widz na niego patrzy.'],
        ['Czytasz raport', 'Zasięg, czas i miejsce porzucenia dla każdego slajdu po kolei.'],
      ],
      report: [
        ['Zasięg slajdów', 'Ilu widzów doszło do każdego obrazu i ilu obejrzało całą karuzelę.'],
        ['Czas na slajdzie', 'Mediana czasu na każdym slajdzie, czyli gdzie widzowie się zatrzymują, a gdzie przelatują.'],
        ['Kończy tutaj', 'Na którym slajdzie widzowie najczęściej przestają przesuwać.'],
        ['Patrzy', 'Jaką część czasu na slajdzie wzrok widza jest na obrazie.'],
      ],
      when: [
        'Przed publikacją karuzeli edukacyjnej, w której najważniejsza treść jest na dalszych slajdach.',
        'Gdy karuzele mają dużo wyświetleń, ale mało zapisów i udostępnień.',
        'Gdy chcesz sprawdzić, czy okładka i drugi slajd prowadzą widza dalej.',
      ],
      faq: [
        ['Czy to działa dla karuzeli na LinkedInie?', 'Tak. Badanie pokazuje slajdy jako obrazy, niezależnie od platformy, na której je opublikujesz.'],
        ['Czy widz musi przejść przez wszystkie slajdy?', 'Nie. Sam decyduje, kiedy skończyć, tak jak w aplikacji. Właśnie to pokazuje raport.'],
        ['Czy mogę zbadać slajdy z automatyczną zmianą?', 'Tak. Ustawiasz czas wyświetlania, a raport pokazuje, na co widzowie patrzą na każdym slajdzie.'],
        ['Ilu widzów potrzebuję?', `Pierwsze różnice widać po kilku osobach, wiarygodny wynik daje ${f.reliable} widzów.`],
      ],
    }),
    versions: (f: FormatFacts): FormatContent => ({
      title: `Test A/B wideo: porównaj do ${f.maxVariants} wersji`,
      lead: 'Porównaj dwa do czterech początków tej samej rolki albo całe wersje materiału na tych samych miarach. Każdy widz ogląda jedną wersję, a raport pokazuje, która dłużej utrzymuje uwagę i czy różnica jest istotna.',
      planNote: `Dwie wersje od planu ${f.plan.variants2}, do ${f.maxVariants} od planu ${f.plan.variants4}.`,
      cta: 'Porównaj wersje',
      questions: [
        'Który hook zatrzymuje więcej widzów w pierwszych sekundach?',
        'Która wersja montażu utrzymuje uwagę do końca?',
        'Czy różnica między wersjami jest istotna, czy to przypadek?',
        'Gdzie dokładnie wersje się rozjeżdżają?',
      ],
      steps: [
        ['Dodaj wersje', `Wgraj od dwóch do ${f.maxVariants} wersji. W teście hooka różnią się tylko początkiem, w teście wersji całym materiałem.`],
        ['Wyślij jeden link', 'Każdy widz dostaje jedną wersję, a widzowie rozkładają się po równo między wersje. Nikt nie porównuje ich świadomie.'],
        ['Widzowie oglądają', 'Pomiar jest taki sam dla wszystkich wersji: krzywa uwagi, hook, sceny i strefy.'],
        ['Czytasz werdykt', `Werdykt pojawia się od ${f.verdict} widzów w każdej wersji. Przy teście A/B zalecamy ${f.recommendedAb} na wersję.`],
      ],
      report: [
        ['Krzywe uwagi na jednym wykresie', 'Wszystkie wersje obok siebie, w stałych kolorach, z miejscem, w którym zaczynają się różnić.'],
        ['Średnia uwaga i różnica', 'Średni odsetek patrzących w każdej wersji i różnica wobec wersji A.'],
        ['Istotność', 'Test t Welcha dla średniej uwagi widzów, z wartością p i jasnym werdyktem.'],
        ['Segmenty i strefy', 'Porównanie fragment po fragmencie oraz ilu widzów spojrzało na te same strefy w każdej wersji.'],
      ],
      when: [
        'Gdy masz dwa pomysły na pierwsze trzy sekundy i nie chcesz zgadywać.',
        'Przed kampanią, w której ta sama reklama ma kilka wersji montażu.',
        'Gdy zespół spiera się o wersję, a potrzebujesz decyzji opartej na danych.',
      ],
      faq: [
        ['Czym różni się test hooka od testu wersji?', 'W teście hooka wersje różnią się tylko początkiem, a dalej są identyczne. W teście wersji porównujesz całe materiały.'],
        ['Czy jeden widz ogląda wszystkie wersje?', 'Nie. Każdy widz ogląda jedną wersję, a kolejne osoby trafiają do wersji z najmniejszą liczbą widzów. Dzięki temu nikt nie ocenia wersji świadomie ani nie ogląda powtórki.'],
        ['Ilu widzów potrzebuję?', `Werdykt od ${f.verdict} widzów w każdej wersji. Przy małych różnicach lepiej mieć ${f.recommendedAb} na wersję, a raport pokaże, jeśli różnica jest za mała, by ją rozstrzygnąć.`],
        ['Czy to zastępuje test A/B na platformie?', 'To test przed publikacją. Pozwala wybrać wersję, zanim wydasz budżet na emisję i zanim algorytm oceni słabszą.'],
      ],
    }),
  },
};
