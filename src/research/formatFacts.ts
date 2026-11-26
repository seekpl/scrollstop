/**
 * Liczby i plany używane w treściach podstron formatów — prosto z kodu badań, nigdy wpisane
 * w tekst na sztywno. Zmiana progu w `sessions.ts`, `feed.ts`, `grid.ts` albo w planach od razu
 * zmienia treść strony i plików dla wyszukiwarek.
 */
import { DEFAULT_FEED } from './feed';
import { DEFAULT_GRID, GRID_EXPOSURE } from './grid';
import { MAX_VARIANTS, planFor, type PlanId } from './plans';
import { RECOMMENDED_AB_SAMPLE, RELIABLE_SAMPLE, MIN_VERDICT_SAMPLE } from './sessions';

export interface FormatFacts {
  /** Widzowie do wiarygodnej krzywej. */
  reliable: number;
  /** Widzowie w każdej wersji do werdyktu porównania. */
  verdict: number;
  /** Zalecana liczba widzów w każdej wersji przy teście A/B. */
  recommendedAb: number;
  /** Pozycje w teście feedu i próg zatrzymania (s). */
  feedItems: number;
  feedStop: number;
  /** Czas pokazania siatki miniatur (s): domyślny, najkrótszy, najdłuższy. */
  gridExposure: number;
  gridMin: number;
  gridMax: number;
  /** Najwięcej wersji w jednym badaniu. */
  maxVariants: number;
  /** Nazwy najtańszych planów z daną funkcją. */
  plan: { free: string; heatmaps: string; aoi: string; text: string; feed: string; thumbnail: string; carousel: string; variants2: string; variants4: string };
}

export function formatFacts(planName: (id: PlanId) => string): FormatFacts {
  return {
    reliable: RELIABLE_SAMPLE,
    verdict: MIN_VERDICT_SAMPLE,
    recommendedAb: RECOMMENDED_AB_SAMPLE,
    feedItems: DEFAULT_FEED.items,
    feedStop: DEFAULT_FEED.stopSeconds,
    gridExposure: DEFAULT_GRID.exposureSeconds,
    gridMin: GRID_EXPOSURE.min,
    gridMax: GRID_EXPOSURE.max,
    maxVariants: MAX_VARIANTS,
    plan: {
      free: planName('free'),
      heatmaps: planName(planFor('aggregateHeatmaps')),
      aoi: planName(planFor('aoi')),
      text: planName(planFor('textCheck')),
      feed: planName(planFor('feed')),
      thumbnail: planName(planFor('thumbnail')),
      carousel: planName(planFor('carousel')),
      variants2: planName(planFor('variants2')),
      variants4: planName(planFor('variants4')),
    },
  };
}
