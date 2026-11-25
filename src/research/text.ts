import type { SampleLevel } from './sessions';

/**
 * Teksty generowane przez warstwę analityczną (wnioski, etykiety scen, porównanie wersji,
 * zdanie otwierające). Każdy język ma własną implementację (`src/i18n/<język>/research.ts`);
 * liczby wstawiają funkcje, więc odmiana i szyk zdania zależą od języka (§18).
 * Ten sam kod działa w przeglądarce i na serwerze.
 */
export interface SegmentRef {
  kind: 'scene' | 'interval';
  /** Numer sceny (od 1). */
  n: number;
  /** Zakres czasu fragmentu, np. „00:04–00:08”. */
  range: string;
}

/** Forma nazwy segmentu w zdaniu (języki z przypadkami; inne mogą ją pominąć). */
export type SegForm = 'nom' | 'gen' | 'loc';

export interface ResearchText {
  /** Etykieta sceny w tabeli i na wykresie, np. „Scena 3”. */
  scene(n: number): string;
  seg(s: SegmentRef, form: SegForm): string;
  /** Domyślna nazwa wersji (zapisywana w danych, tłumaczona przy wyświetlaniu). */
  version(id: string): string;
  sampleLevel: Record<SampleLevel, string>;
  headline: {
    empty: string;
    drop(p: { from: string; to: string; where: string | null }): string;
    dropDetail(p: { fromPct: number; toPct: number; deltaPp: number; meanPct: number }): string;
    stable(p: { meanPct: number }): string;
    stableDetail: string;
    /** Feed: zatrzymanie scrolla wobec pozostałych klipów. */
    feed(p: { stopPct: number; fillerPct: number | null; significant: boolean }): string;
    feedDetail(p: { dwell: number | null; meanPct: number | null }): string;
    /** Test miniatury: spojrzenia na badaną miniaturę. */
    grid(p: { lookedPct: number; firstLook: number | null }): string;
    gridDetail(p: { chosenPct: number | null; positionIndex: number | null }): string;
    /** Karuzela: ilu dochodzi do końca i gdzie odpada najwięcej. */
    carousel(p: { completedPct: number; slides: number }): string;
    carouselDetail(p: { worst: number | null; lost: number }): string;
  };
  findings: {
    drop: {
      title(p: { where: string | null; deltaPp: number; from: string; to: string }): string;
      fact(p: { from: string; to: string; fromPct: number; toPct: number; deltaPp: number; lost: number; n: number }): string;
      start: { observation: string; hypothesis: string; recommendation: string };
      afterCut: { observation(seg: SegmentRef): string; hypothesis: string; recommendation(seg: SegmentRef): string };
      intoScene: {
        observation(p: { seconds: number; seg: SegmentRef }): string;
        hypothesis: string;
        recommendation(p: { seg: SegmentRef; cut: number; before: string }): string;
      };
      genericRecommendation(p: { from: string; to: string }): string;
    };
    weak: {
      title(p: { seg: SegmentRef; low: boolean; lowest: boolean }): string;
      fact(p: { seg: SegmentRef; from: string; to: string; meanPct: number; filmPct: number }): string;
      change(pp: number): string;
      hypothesis: string;
      recommendation(seg: SegmentRef): string;
    };
    hook: { title: string; fact(p: { pct: number; limitPct: number }): string; hypothesis: string; recommendationVertical: string; recommendationHorizontal: string };
    ending: { title: string; fact(p: { pct: number; filmPct: number }): string; hypothesis: string; recommendation: string };
    aoi: {
      title(name: string): string;
      fact(p: { pct: number; lookers: number; n: number; name: string; from: string; to: string }): string;
      small: string;
      hypothesis: string;
      recommendation: string;
    };
    text: {
      title(name: string): string;
      factShort(p: { name: string; seconds: string; needed: string; words: number }): string;
      factFew(p: { name: string; median: string; needed: string }): string;
      hypothesis: string;
      recommendation: string;
    };
    unsafe: { title(name: string): string; fact(p: { name: string }): string; hypothesis: string; recommendation(p: { bottomPct: number }): string };
    brand: { title: string; fact(p: { median: string | null; by3Pct: number; reachPct: number }): string; hypothesis: string; recommendation: string };
    cta: { title(name: string): string; fact(p: { name: string; pct: number; lookers: number; n: number }): string; hypothesis: string; recommendation: string };
    feedSkip: { title: string; fact(p: { stopPct: number; fillerPct: number; seconds: string }): string; hypothesis: string; recommendation: string };
    strong: { title(seg: SegmentRef): string; fact(p: { seg: SegmentRef; pct: number; filmPct: number }): string; recommendation: string };
  };
  ab: {
    noData: string;
    means(list: string): string;
    unclear(p: { enough: boolean }): string;
    winner(p: { win: string; pp: number; winVal: string; loseVal: string; vs: string }): string;
    biggest(p: { label: string; win: string; pp: number }): string;
    testLine(p: { p: string; min: number; holm: boolean }): string;
    hookLine(p: { p: string; holm: boolean }): string;
    sharedRest(p: { from: string; pp: number }): string;
  };
  /** Nazwy w projektach demonstracyjnych (raporty przykładowe). */
  demo: {
    reelProject: string;
    videoProject: string;
    feedProject: string;
    gridProject: string;
    carouselProject: string;
    thumbTitle: string;
    creator: string;
    reelA: string;
    reelB: string;
    video: string;
    versionA: string;
    versionB: string;
    caption: string;
    aoi: Record<'face' | 'hook' | 'captions' | 'product' | 'logo' | 'cta' | 'chart' | 'title', string>;
  };
}
