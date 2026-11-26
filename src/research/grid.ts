/**
 * Test miniatury w siatce (§4.5, §6 pkt 16): czy widz spojrzał na badaną miniaturę, kiedy po raz
 * pierwszy, jaki udział patrzenia dostała, jej miejsce w kolejności pierwszych spojrzeń i wybór
 * (deklaracja). Efekt pozycji korygujemy wypełniaczami na tej samej pozycji.
 */
import { GazeCode, type GridSettings, type ItemLog, type ViewerSession } from './model';
import { reportSessions } from './sessions';

/** Czas pokazania siatki miniatur (s): zakres ustawienia w kreatorze. */
export const GRID_EXPOSURE = { min: 3, max: 10 } as const;
export const DEFAULT_GRID: GridSettings = { layout: 'yt_home', exposureSeconds: 6, askChoice: true };
export const GRID_LAYOUTS: GridSettings['layout'][] = ['yt_home', 'yt_search_mobile', 'profile_grid'];
/** Liczba komórek układu (badana + wypełniacze). */
export const GRID_CELLS: Record<GridSettings['layout'], number> = { yt_home: 6, yt_search_mobile: 4, profile_grid: 9 };

export interface GridCellBox {
  /** Cała komórka (miniatura + tytuł) — automatyczna strefa zainteresowania. */
  rect: { x: number; y: number; w: number; h: number };
  /** Sama miniatura w komórce. */
  thumb: { x: number; y: number; w: number; h: number };
}

const r4 = (v: number) => Math.round(v * 1e4) / 1e4;
const box = (x: number, y: number, w: number, h: number) => ({ x: r4(x), y: r4(y), w: r4(w), h: r4(h) });

/**
 * Geometria układu siatki we współrzędnych ekranu (0..1). Ten sam kod rysuje siatkę u widza
 * i przypisuje spojrzenia w raporcie. `aspect` — szerokość / wysokość ekranu.
 */
export function gridCells(layout: GridSettings['layout'], aspect: number): GridCellBox[] {
  if (layout === 'yt_search_mobile') {
    // Lista: miniatura 16:9 po lewej (42% szerokości), tytuł po prawej.
    const n = GRID_CELLS.yt_search_mobile;
    const top = 0.06;
    const rowH = (1 - top - 0.04) / n;
    const thumbW = 0.42;
    const thumbH = Math.min(rowH * 0.86, ((thumbW * 9) / 16) * aspect);
    return Array.from({ length: n }, (_, i) => {
      const y = top + i * rowH;
      return { rect: box(0.03, y, 0.94, rowH * 0.92), thumb: box(0.03, y + (rowH * 0.92 - thumbH) / 2, thumbW, thumbH) };
    });
  }
  if (layout === 'profile_grid') {
    // Siatka profilu: 3 kolumny, komórki 4:5 bez tytułów.
    const cols = 3;
    const gap = 0.006;
    const w = (1 - gap * (cols + 1)) / cols;
    const h = Math.min(0.3, (w * 5 * aspect) / 4);
    const top = Math.max(0.04, (1 - (3 * h + 2 * gap)) / 2);
    return Array.from({ length: GRID_CELLS.profile_grid }, (_, i) => {
      const c = i % cols;
      const r = Math.floor(i / cols);
      const b = box(gap + c * (w + gap), top + r * (h + gap), w, h);
      return { rect: b, thumb: b };
    });
  }
  // Strona główna (komputer): 3 × 2, miniatura 16:9 + dwa wiersze tytułu.
  const cols = 3;
  const left = 0.05;
  const gapX = 0.025;
  const w = (1 - 2 * left - gapX * (cols - 1)) / cols;
  const thumbH = ((w * 9) / 16) * aspect;
  const cellH = thumbH + 0.09;
  const top = Math.max(0.08, (1 - (2 * cellH + 0.04)) / 2);
  return Array.from({ length: GRID_CELLS.yt_home }, (_, i) => {
    const c = i % cols;
    const r = Math.floor(i / cols);
    const x = left + c * (w + gapX);
    const y = top + r * (cellH + 0.04);
    return { rect: box(x, y, w, cellH), thumb: box(x, y, w, thumbH) };
  });
}
/** Spojrzenie = co najmniej 3 kolejne próbki w komórce (~100 ms przy 30 Hz). */
const RUN = 3;

type Rect = NonNullable<ItemLog['rect']>;
const inside = (x: number, y: number, r: Rect) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;

export interface CellLooks {
  index: number;
  role: ItemLog['role'];
  itemId: string;
  /** Sekundy od pokazania siatki do pierwszego spojrzenia; null — nie spojrzał. */
  firstLook: number | null;
  samples: number;
}

/** Spojrzenia widza na komórki siatki (współrzędne wzroku względem całego ekranu siatki). */
export function cellLooks(s: Pick<ViewerSession, 'items' | 'data'>): CellLooks[] {
  const cells = (s.items ?? []).filter((c): c is ItemLog & { rect: Rect } => !!c.rect);
  const start = Math.min(...cells.map((c) => c.enterMs), Number.POSITIVE_INFINITY);
  return cells.map((c) => {
    let run = 0;
    let firstLook: number | null = null;
    let samples = 0;
    for (let i = 0; i < s.data.tc.length; i++) {
      const ok = s.data.st[i] === GazeCode.LOOK && s.data.vx[i] >= 0 && inside(s.data.vx[i] / 1000, s.data.vy[i] / 1000, c.rect);
      if (ok) {
        samples++;
        run++;
        if (run === RUN && firstLook === null) firstLook = Math.max(0, (s.data.tc[i - RUN + 1] - (Number.isFinite(start) ? start : 0)) / 1000);
      } else run = 0;
    }
    return { index: c.index, role: c.role, itemId: c.itemId, firstLook, samples };
  });
}

export interface GridMetrics {
  viewers: number;
  /** Odsetek widzów, którzy spojrzeli na badaną miniaturę. */
  looked: number | null;
  lookedCount: number;
  /** Mediana czasu do pierwszego spojrzenia (s) wśród patrzących. */
  firstLookMedian: number | null;
  /** Udział badanej miniatury w czasie patrzenia na siatkę. */
  dwellShare: number | null;
  /** Rozkład miejsca w kolejności pierwszych spojrzeń (1 = pierwsza). */
  rank: number[];
  rankMedian: number | null;
  /** Wybór (deklaracja): badana / inna / żadna. */
  choice: { tested: number; other: number; none: number; asked: number };
  /** Spojrzenia na badaną wobec wypełniaczy na tej samej pozycji (1 = tak jak przeciętna miniatura). */
  positionIndex: number | null;
  cells: number;
}

export function gridMetrics(all: readonly ViewerSession[], opts: { includeSimulated?: boolean } = {}): GridMetrics {
  const sessions = reportSessions(all, opts).filter((s) => (s.items ?? []).some((c) => c.role === 'tested' && c.rect));
  const firstLooks: number[] = [];
  const shares: number[] = [];
  const ranks: number[] = [];
  let looked = 0;
  const choice = { tested: 0, other: 0, none: 0, asked: 0 };
  // Bazowe spojrzenia wypełniaczy według pozycji (efekt pozycji).
  const base = new Map<number, { looked: number; n: number }>();
  const testedAt: number[] = [];
  let cellsMax = 0;
  for (const s of sessions) {
    const looks = cellLooks(s);
    cellsMax = Math.max(cellsMax, looks.length);
    const tested = looks.find((c) => c.role === 'tested');
    if (!tested) continue;
    testedAt.push(tested.index);
    if (tested.firstLook !== null) {
      looked++;
      firstLooks.push(tested.firstLook);
      const order = looks.filter((c) => c.firstLook !== null).sort((a, b) => (a.firstLook as number) - (b.firstLook as number));
      ranks.push(order.findIndex((c) => c.index === tested.index) + 1);
    }
    const total = looks.reduce((a, c) => a + c.samples, 0);
    if (total > 0) shares.push(tested.samples / total);
    for (const c of looks) {
      if (c.role !== 'filler') continue;
      const b = base.get(c.index) ?? { looked: 0, n: 0 };
      b.n++;
      if (c.firstLook !== null) b.looked++;
      base.set(c.index, b);
    }
    if (s.choice) {
      choice.asked++;
      if (s.choice.itemId === null) choice.none++;
      else if (s.choice.itemId === tested.itemId) choice.tested++;
      else choice.other++;
    }
  }
  const n = sessions.length;
  const expected = testedAt.map((p) => {
    const b = base.get(p);
    return b && b.n ? b.looked / b.n : null;
  });
  const known = expected.filter((e): e is number => e !== null);
  const expectedMean = known.length ? known.reduce((a, b) => a + b, 0) / known.length : null;
  const sorted = [...firstLooks].sort((a, b) => a - b);
  const sortedRanks = [...ranks].sort((a, b) => a - b);
  const mid = (a: number[]) => (a.length ? (a.length % 2 ? a[a.length >> 1] : (a[a.length / 2 - 1] + a[a.length / 2]) / 2) : null);
  return {
    viewers: n,
    looked: n ? looked / n : null,
    lookedCount: looked,
    firstLookMedian: mid(sorted),
    dwellShare: shares.length ? shares.reduce((a, b) => a + b, 0) / shares.length : null,
    rank: Array.from({ length: cellsMax }, (_, k) => ranks.filter((r) => r === k + 1).length),
    rankMedian: mid(sortedRanks),
    choice,
    positionIndex: n && expectedMean ? looked / n / expectedMean : null,
    cells: cellsMax,
  };
}
