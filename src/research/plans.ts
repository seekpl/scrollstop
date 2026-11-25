/**
 * Plany, limity i uprawnienia (§16) — jedno źródło dla serwera (limity sesji, funkcje) i interfejsu
 * (paywall, cennik). Ceny netto, propozycja do walidacji wywiadami i kosztami panelu (§26.4).
 */
import type { Currency } from '../i18n/locales';

export type PlanId = 'free' | 'creator' | 'pro' | 'agency';
export const PLAN_IDS: PlanId[] = ['free', 'creator', 'pro', 'agency'];

export type Feature =
  | 'aggregateHeatmaps'
  | 'findings'
  | 'recommendations'
  | 'feed'
  | 'thumbnail'
  | 'carousel'
  | 'aoi'
  | 'textCheck'
  | 'shareLink'
  | 'shareImageClean'
  | 'rawExport'
  | 'clientLogo'
  | 'clientFolders';

export interface Plan {
  id: PlanId;
  /** Cena miesięczna netto. `agency` — cena „od”. */
  monthly: Record<Currency, number>;
  /** Plan Agency: cena od, wycena indywidualna. */
  fromPrice: boolean;
  limits: {
    /** null = bez limitu. */
    activeProjects: number | null;
    /** Widzowie w jednym projekcie (Free). */
    projectSessions: number | null;
    /** Widzowie miesięcznie. */
    monthSessions: number | null;
    seats: number;
  };
  maxVariants: 1 | 2 | 4;
  /** Znak wodny na PDF i grafice do udostępnienia. */
  watermark: boolean;
  features: Record<Feature, boolean>;
}

const none: Record<Feature, boolean> = {
  aggregateHeatmaps: false,
  findings: false,
  recommendations: false,
  feed: false,
  thumbnail: false,
  carousel: false,
  aoi: false,
  textCheck: false,
  shareLink: false,
  shareImageClean: false,
  rawExport: false,
  clientLogo: false,
  clientFolders: false,
};

const creatorFeatures = { ...none, aggregateHeatmaps: true, findings: true, shareImageClean: true };
const proFeatures = { ...creatorFeatures, recommendations: true, feed: true, thumbnail: true, carousel: true, aoi: true, textCheck: true, shareLink: true };
const agencyFeatures = { ...proFeatures, rawExport: true, clientLogo: true, clientFolders: true };

export const PLANS: Record<PlanId, Plan> = {
  free: { id: 'free', monthly: { PLN: 0, EUR: 0, USD: 0 }, fromPrice: false, limits: { activeProjects: 1, projectSessions: 5, monthSessions: null, seats: 1 }, maxVariants: 1, watermark: true, features: none },
  creator: { id: 'creator', monthly: { PLN: 79, EUR: 19, USD: 19 }, fromPrice: false, limits: { activeProjects: 5, projectSessions: null, monthSessions: 150, seats: 1 }, maxVariants: 2, watermark: false, features: creatorFeatures },
  pro: { id: 'pro', monthly: { PLN: 199, EUR: 49, USD: 49 }, fromPrice: false, limits: { activeProjects: 20, projectSessions: null, monthSessions: 600, seats: 3 }, maxVariants: 4, watermark: false, features: proFeatures },
  agency: { id: 'agency', monthly: { PLN: 790, EUR: 189, USD: 199 }, fromPrice: true, limits: { activeProjects: null, projectSessions: null, monthSessions: 2500, seats: 10 }, maxVariants: 4, watermark: false, features: agencyFeatures },
};

/** Cena roczna = 10 × miesięczna (2 miesiące gratis). */
export const yearlyPrice = (plan: Plan, currency: Currency): number => plan.monthly[currency] * 10;

export const isPlanId = (x: unknown): x is PlanId => typeof x === 'string' && (PLAN_IDS as string[]).includes(x);

export function hasFeature(plan: PlanId, f: Feature): boolean {
  return PLANS[plan].features[f];
}

/** Najtańszy plan z daną funkcją. */
export function planFor(f: Feature | 'variants4' | 'variants2'): PlanId {
  if (f === 'variants2') return PLAN_IDS.find((p) => PLANS[p].maxVariants >= 2) ?? 'creator';
  if (f === 'variants4') return PLAN_IDS.find((p) => PLANS[p].maxVariants >= 4) ?? 'pro';
  return PLAN_IDS.find((p) => PLANS[p].features[f]) ?? 'agency';
}

/** Następny plan (do przycisku „Przejdź na wyższy plan”). */
export function upgradeTarget(plan: PlanId): PlanId {
  return PLAN_IDS[Math.min(PLAN_IDS.length - 1, PLAN_IDS.indexOf(plan) + 1)];
}

export type BlockReason = 'active_projects' | 'project_sessions' | 'month_sessions';

/** Czy można utworzyć kolejny aktywny projekt. */
export function projectBlock(plan: PlanId, activeProjects: number): BlockReason | null {
  const max = PLANS[plan].limits.activeProjects;
  return max !== null && activeProjects >= max ? 'active_projects' : null;
}

/** Czy link przyjmie kolejną sesję (sprawdzane PRZED zgodą widza, §16.3). Sesje symulowane się nie liczą. */
export function sessionBlock(plan: PlanId, usage: { projectSessions: number; monthSessions: number }): BlockReason | null {
  const l = PLANS[plan].limits;
  if (l.projectSessions !== null && usage.projectSessions >= l.projectSessions) return 'project_sessions';
  if (l.monthSessions !== null && usage.monthSessions >= l.monthSessions) return 'month_sessions';
  return null;
}

/** Badanie z panelem (§16.5): propozycja do wyceny u dostawcy panelu. */
export const PANEL = {
  sizes: [30, 50, 100] as const,
  /** Cena od, za 30 widzów przy materiale do 60 s. */
  from: { PLN: 590, EUR: 139 } as const,
  days: '2–5',
};
