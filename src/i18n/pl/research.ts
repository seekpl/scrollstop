import { plural } from '../../core/math/util';
import type { ResearchText, SegForm, SegmentRef } from '../../research/text';

function seg(s: SegmentRef, form: SegForm): string {
  if (s.kind === 'scene') return form === 'nom' ? `Scena ${s.n}` : form === 'gen' ? `sceny ${s.n}` : `w scenie ${s.n}`;
  return form === 'nom' ? `Fragment ${s.range}` : form === 'gen' ? `fragmentu ${s.range}` : `we fragmencie ${s.range}`;
}
const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

/** Teksty analityczne po polsku (§8.3). */
export const research: ResearchText = {
  scene: (n) => `Scena ${n}`,
  seg,
  version: (id) => `Wersja ${id}`,
  sampleLevel: {
    none: 'Brak ważnych sesji.',
    preview: 'Podgląd: jeden widz mocno zmienia krzywą, wnioski są wstępne.',
    indicative: 'Wynik wstępny: kierunek widać, ale decyzje podejmuj ostrożnie. Wiarygodna krzywa od 30 widzów.',
    reliable: 'Próba wystarczająca do decyzji montażowych.',
  },
  headline: {
    empty: 'Raport pojawi się po pierwszej ważnej sesji.',
    drop: (p) => `Największy spadek uwagi wystąpił między ${p.from} a ${p.to}${p.where ? ` (${lower(p.where)})` : ''}.`,
    dropDetail: (p) => `Odsetek patrzących spada z ${p.fromPct}% do ${p.toPct}%, czyli o ${p.deltaPp} pp. Średnio przez cały materiał patrzy ${p.meanPct}% widzów.`,
    stable: (p) => `Uwaga utrzymuje się stabilnie: średnio patrzy ${p.meanPct}% widzów.`,
    stableDetail: 'Krzywa nie ma spadków większych niż 10 pp.',
  },
  findings: {
    drop: {
      title: (p) => `${p.where ? `${p.where}: ` : ''}spadek uwagi o ${p.deltaPp} pp (${p.from}–${p.to})`,
      fact: (p) => `Między ${p.from} a ${p.to} odsetek patrzących spada z ${p.fromPct}% do ${p.toPct}% (−${p.deltaPp} pp, ok. ${p.lost} z ${p.n} ${plural(p.n, 'widza', 'widzów', 'widzów')}).`,
      start: {
        observation: 'Spadek zaczyna się w pierwszych sekundach.',
        hypothesis: 'Pierwszy kadr nie daje powodu, by zostać.',
        recommendation: 'Zacznij od najmocniejszego kadru i obietnicy w pierwszej sekundzie: twarz, akcja albo wynik. Bez intra i logo na start.',
      },
      afterCut: {
        observation: (s) => `Spadek zaczyna się tuż po cięciu do ${seg(s, 'gen')}.`,
        hypothesis: 'Nowe ujęcie nie ma punktu zaczepienia dla wzroku (twarz, ruch, napis).',
        recommendation: (s) => `Otwórz ${s.kind === 'scene' ? `scenę ${s.n}` : `fragment ${s.range}`} mocniej: zbliżenie, ruch albo krótki napis w pierwszej sekundzie ujęcia.`,
      },
      intoScene: {
        observation: (p) => `Spadek zaczyna się po ${p.seconds} s trwania ${seg(p.seg, 'gen')}.`,
        hypothesis: 'Scena jest w tym miejscu za długa lub zbyt statyczna.',
        recommendation: (p) => `Skróć ${p.seg.kind === 'scene' ? `scenę ${p.seg.n}` : `fragment ${p.seg.range}`} o ok. ${p.cut} s albo dodaj zmianę kadru (pattern interrupt) przed ${p.before}.`,
      },
      genericRecommendation: (p) => `Sprawdź, co dzieje się na ekranie między ${p.from} a ${p.to}: zmiana kadru, ruch albo napis mogą zatrzymać wzrok.`,
    },
    weak: {
      title: (p) => (p.low ? `${seg(p.seg, 'nom')} ma ${p.lowest ? 'najniższą' : 'niską'} uwagę` : `${seg(p.seg, 'nom')} traci uwagę`),
      fact: (p) => `${seg(p.seg, 'nom')} (${p.from}–${p.to}) ma średnią uwagę ${p.meanPct}% wobec ${p.filmPct}% w całym materiale.`,
      change: (pp) => ` W jej trakcie uwaga spada o ${pp} pp.`,
      hypothesis: 'Tempo lub treść tego fragmentu angażują słabiej niż reszta materiału.',
      recommendation: (s) => `Skróć albo przyspiesz ${s.kind === 'scene' ? `scenę ${s.n}` : `fragment ${s.range}`} i sprawdź nową wersję w porównaniu A/B.`,
    },
    hook: {
      title: 'Hook nie zatrzymuje wszystkich widzów',
      fact: (p) => `Po 3 sekundach patrzy ${p.pct}% widzów (próg dobrego hooka: ${p.limitPct}%).`,
      hypothesis: 'Pierwsze ujęcie nie przyciąga wzroku albo nie obiecuje niczego konkretnego.',
      recommendationVertical: 'Zacznij od najmocniejszego kadru i obietnicy w pierwszej sekundzie: twarz, akcja albo wynik. Bez intra i logo na start.',
      recommendationHorizontal: 'Skróć wstęp: pokaż temat i prowadzącego w pierwszych sekundach, a planszę tytułową przenieś dalej.',
    },
    ending: {
      title: 'Końcówka traci uwagę',
      fact: (p) => `W ostatnich 3 s patrzy ${p.pct}% widzów (średnio w materiale ${p.filmPct}%).`,
      hypothesis: 'Zakończenie (plansza, napisy końcowe) nie utrzymuje uwagi.',
      recommendation: 'Skróć zakończenie albo przenieś CTA i najważniejszy komunikat przed ostatnie sekundy.',
    },
    aoi: {
      title: (name) => `Mało widzów patrzy na „${name}”`,
      fact: (p) => `${p.pct}% widzów (${p.lookers} z ${p.n}) spojrzało na „${p.name}” między ${p.from} a ${p.to}.`,
      small: ' Strefa jest mniejsza niż dokładność pomiaru, więc wynik jest orientacyjny.',
      hypothesis: 'Element jest za mały, widoczny zbyt krótko albo leży poza miejscem, w które patrzy większość widzów.',
      recommendation: 'Powiększ element, wydłuż jego ekspozycję albo przesuń go bliżej miejsca, w które patrzą widzowie.',
    },
    text: {
      title: (name) => `„${name}”: widzowie mogą nie zdążyć przeczytać`,
      factShort: (p) => `„${p.name}” jest na ekranie ${p.seconds} s, a ${p.words} ${plural(p.words, 'słowo', 'słowa', 'słów')} wymaga ok. ${p.needed} s.`,
      factFew: (p) => `Widzowie, którzy spojrzeli na „${p.name}”, patrzyli średnio ${p.median} s, mniej niż połowa potrzebnych ${p.needed} s.`,
      hypothesis: 'Napis jest za długi na czas ekspozycji albo konkuruje z twarzą i ruchem w kadrze.',
      recommendation: 'Zostaw napis na ekranie co najmniej 2,5 s albo skróć go do 5–6 słów; przenieś go w miejsce, w które patrzą widzowie.',
    },
    unsafe: {
      title: (name) => `„${name}” jest w strefie zasłoniętej`,
      fact: (p) => `Strefa „${p.name}” nachodzi na obszar kadru, który zasłania interfejs platformy (opis i przyciski).`,
      hypothesis: 'Na platformie część napisu, logo albo CTA może być niewidoczna.',
      recommendation: (p) => `Przesuń napis wyżej: dolne ok. ${p.bottomPct}% kadru zasłania opis i przyciski platformy.`,
    },
    brand: {
      title: 'Marka pojawia się w oczach widzów za późno',
      fact: (p) => `${p.median === null ? 'Większość widzów nie spojrzała na logo ani produkt.' : `Mediana pierwszego spojrzenia na logo lub produkt: ${p.median} s.`} Do 3 s markę zobaczyło ${p.by3Pct}% widzów, w całym materiale ${p.reachPct}%.`,
      hypothesis: 'Produkt lub logo pojawia się późno albo w miejscu, na które nikt nie patrzy.',
      recommendation: 'Pokaż produkt lub logo w pierwszych 3 sekundach, najlepiej w ręku albo przy twarzy.',
    },
    cta: {
      title: (name) => `CTA „${name}” jest mało zauważane`,
      fact: (p) => `Na CTA „${p.name}” spojrzało ${p.pct}% widzów (${p.lookers} z ${p.n}), którzy dotrwali do jego pojawienia się.`,
      hypothesis: 'CTA jest za małe, za krótko na ekranie albo konkuruje z innym elementem kadru.',
      recommendation: 'Powiększ CTA, pokaż je dłużej i powiedz je na głos; umieść je tam, gdzie patrzą widzowie w ostatnich sekundach.',
    },
    feedSkip: {
      title: 'W feedzie widzowie przewijają ten klip częściej niż inne',
      fact: (p) => `Na klipie zostało co najmniej ${p.seconds} s ${p.stopPct}% widzów, a na pozostałych klipach feedu średnio ${p.fillerPct}%.`,
      hypothesis: 'Pierwszy kadr w feedzie nie odróżnia się od otoczenia albo nie obiecuje niczego konkretnego.',
      recommendation: 'Wzmocnij pierwszą klatkę: kontrast, twarz w zbliżeniu i krótki napis z obietnicą już od pierwszej sekundy.',
    },
    strong: {
      title: (s) => `${seg(s, 'nom')} trzyma uwagę najlepiej`,
      fact: (p) => `${seg(p.seg, 'nom')} ma średnią uwagę ${p.pct}% (cały materiał: ${p.filmPct}%).`,
      recommendation: 'Zachowaj ten fragment; to dobry wzorzec tempa dla reszty materiału.',
    },
  },
  ab: {
    noData: 'Za mało danych, aby porównać wersje.',
    means: (list) => `Średnia uwaga: ${list}.`,
    unclear: (p) => `Różnica mieści się w granicach niepewności${p.enough ? '' : ' (za mało widzów w jednej z wersji)'}.`,
    winner: (p) => `Wersja ${p.win} utrzymuje uwagę średnio o ${p.pp} pp wyżej (${p.winVal} wobec ${p.loseVal}).`,
    biggest: (p) => `Największa różnica: ${lower(p.label)}, wersja ${p.win} o ${p.pp} pp wyżej.`,
    testLine: (p) => `Test t Welcha na średniej uwadze widzów${p.holm ? ' (korekta Holma)' : ''}: p = ${p.p}. Różnica jest rozstrzygająca przy p < 0,05 i co najmniej ${p.min} widzach w każdej wersji.`,
    hookLine: (p) => `Test dwóch proporcji dla utrzymania hooka @3 s${p.holm ? ' (korekta Holma)' : ''}: p = ${p.p}.`,
    sharedRest: (p) => `Od ${p.from} wersje są identyczne; tam różnica średniej uwagi wynosi ${p.pp} pp.`,
  },
  demo: {
    reelProject: 'Rolka demo: test hooka',
    videoProject: 'Film demo na YouTube',
    feedProject: 'Rolka demo w feedzie',
    creator: 'Studio demo',
    reelA: 'Rolka demo A (15 s, 9:16)',
    reelB: 'Rolka demo B (15 s, 9:16)',
    video: 'Film demo (60 s, 16:9)',
    versionA: 'Wersja A (logo na start)',
    versionB: 'Wersja B (mocny hook)',
    caption: 'Trzy rzeczy, które sprawdzam przed publikacją',
    aoi: { face: 'Twarz', hook: 'Hook', captions: 'Napisy dolne', product: 'Produkt', logo: 'Logo', cta: 'CTA', chart: 'Wykres', title: 'Tytuł' },
  },
};
