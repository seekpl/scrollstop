import { isPlanId } from '../research/plans';
import { LocalResearchApi } from './local';
import { IndexedDbLocalStore } from './localStore';
import type { ResearchApi } from './types';

export * from './types';

/**
 * Tryb lokalny (bez VITE_API_URL) albo serwerowy (§12.2). Klient HTTP dochodzi w M5.
 */
export function createApi(): ResearchApi {
  const plan = import.meta.env.VITE_LOCAL_PLAN;
  return new LocalResearchApi(new IndexedDbLocalStore(), { plan: isPlanId(plan) ? plan : 'free' });
}
