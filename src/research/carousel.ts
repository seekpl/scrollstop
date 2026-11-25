/**
 * Karuzela i slajdy (§4.6, §6 pkt 17): zasięg slajdu, czas na slajdzie, uwaga na slajdzie i slajd
 * porzucenia. Wizyty slajdów w `items` (indeks = numer slajdu), próbki z `it` = numer slajdu.
 */
import { GazeCode, type ViewerSession } from './model';
import { reportSessions } from './sessions';

export interface CarouselMetrics {
  viewers: number;
  slides: number;
  /** Odsetek widzów, którzy doszli do slajdu k. */
  reach: number[];
  /** Mediana łącznego czasu na slajdzie k (s) wśród tych, którzy do niego doszli. */
  timeMedian: Array<number | null>;
  /** Średni udział patrzenia na slajd (wśród rozstrzygających próbek). */
  attention: Array<number | null>;
  /** Liczba widzów, dla których slajd k był ostatnim obejrzanym (bez ostatniego slajdu). */
  dropOff: number[];
  /** Obejrzeli wszystkie slajdy. */
  completed: number | null;
}

export function carouselMetrics(all: readonly ViewerSession[], opts: { slides: number; includeSimulated?: boolean }): CarouselMetrics {
  const sessions = reportSessions(all, { includeSimulated: opts.includeSimulated }).filter((s) => (s.items ?? []).length > 0);
  const k = Math.max(1, opts.slides);
  const reached = new Array<number>(k).fill(0);
  const times: number[][] = Array.from({ length: k }, () => []);
  const att: number[][] = Array.from({ length: k }, () => []);
  const drop = new Array<number>(k).fill(0);
  let completed = 0;
  for (const s of sessions) {
    const end = s.data.tc.length ? s.data.tc[s.data.tc.length - 1] : 0;
    const visits = s.items ?? [];
    let last = -1;
    const total = new Array<number>(k).fill(0);
    const seen = new Array<boolean>(k).fill(false);
    for (const v of visits) {
      if (v.index < 0 || v.index >= k) continue;
      seen[v.index] = true;
      last = Math.max(last, v.index);
      total[v.index] += Math.max(0, (v.exitMs ?? end) - v.enterMs) / 1000;
    }
    seen.forEach((x, i) => {
      if (!x) return;
      reached[i]++;
      times[i].push(total[i]);
    });
    if (last === k - 1) completed++;
    else if (last >= 0) drop[last]++;
    const look = new Array<number>(k).fill(0);
    const det = new Array<number>(k).fill(0);
    for (let i = 0; i < s.data.tc.length; i++) {
      const it = s.data.it[i];
      if (it < 0 || it >= k) continue;
      const code = s.data.st[i];
      if (code === GazeCode.LOOK || code === GazeCode.LOOK_OFF_MEDIA || code === GazeCode.AWAY) {
        det[it]++;
        if (code === GazeCode.LOOK) look[it]++;
      }
    }
    det.forEach((d, i) => d >= 10 && att[i].push(look[i] / d));
  }
  const n = sessions.length;
  const med = (a: number[]) => {
    if (!a.length) return null;
    const b = [...a].sort((x, y) => x - y);
    return b.length % 2 ? b[b.length >> 1] : (b[b.length / 2 - 1] + b[b.length / 2]) / 2;
  };
  return {
    viewers: n,
    slides: k,
    reach: reached.map((r) => (n ? r / n : 0)),
    timeMedian: times.map(med),
    attention: att.map((a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null)),
    dropOff: drop,
    completed: n ? completed / n : null,
  };
}
