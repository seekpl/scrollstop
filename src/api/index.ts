import { isPlanId } from '../research/plans';
import { apiBase } from './base';
import { HttpResearchApi } from './http';
import { LocalResearchApi } from './local';
import { IndexedDbLocalStore } from './localStore';
import type { ResearchApi } from './types';

export * from './types';

/**
 * Tryb danych (§12.2): z `VITE_API_URL` — serwerowy (`/` = API na tym samym serwerze co aplikacja),
 * bez niej — lokalny (IndexedDB tej przeglądarki, plan z `VITE_LOCAL_PLAN`).
 */
export function createApi(): ResearchApi {
  const base = apiBase();
  if (base) return new HttpResearchApi(base === '/' ? '' : base);
  const plan = import.meta.env.VITE_LOCAL_PLAN;
  return new LocalResearchApi(new IndexedDbLocalStore(), { plan: isPlanId(plan) ? plan : 'free' });
}
