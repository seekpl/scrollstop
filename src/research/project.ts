/**
 * Projekt z danych z zewnątrz (§13.2, §15): obiekt budowany od zera z dozwolonych pól, z limitami
 * planu. Ten sam kod działa w trybie lokalnym (IndexedDB) i na serwerze, więc oba tryby przyjmują
 * dokładnie te same projekty. Błędy jako kody: `InvalidInput` (400) i `PlanLimit` (402).
 */
import { CodedError } from '../core/errors';
import { isLocale } from '../i18n/locales';
import {
  AGE_BANDS,
  CONSENT_VERSION,
  LIMITS,
  RETENTION_OPTIONS,
  VARIANT_IDS,
  type Audience,
  type Project,
  type StudyConfig,
  type StudyKind,
  type TargetDevice,
  type Variant,
} from './model';
import type { Entitlements } from './plans';
import { cleanText, InvalidInput, isNum, isObj, pickAgeBands, pickAudio, pickEnum, pickKind, pickPlatform, pickQuestions, sanitizeVariant } from './sanitize';
import { RELIABLE_SAMPLE } from './sessions';

/** Funkcja albo limit spoza planu (HTTP 402, kod `feature_*` lub powód limitu). */
export class PlanLimit extends CodedError {
  constructor(code: string) {
    super(code);
    this.name = 'PlanLimit';
  }
}

/** Rodzaje badań, które widz może dziś przejść. Feed, miniatura i karuzela dochodzą w M6. */
export const READY_KINDS: readonly StudyKind[] = ['video', 'hook', 'abn'];
export const TARGET_DEVICES: readonly TargetDevice[] = ['mobile', 'desktop', 'any'];
export const DEFAULT_RETENTION_DAYS = 90;
export const MIN_TARGET = 5;
export const MAX_TARGET = 1000;

export interface ProjectRules {
  /** ISO — znacznik czasu zapisu. */
  now: string;
  entitlements: Entitlements;
  /** Materiał `local` (plik w przeglądarce twórcy) tylko w trybie lokalnym. */
  allowLocal: boolean;
}

const invalid = (code = 'bad_request'): never => {
  throw new InvalidInput(code);
};

const target = (x: unknown, fallback: number) => (isNum(x, MIN_TARGET, MAX_TARGET) ? Math.round(x) : fallback);
const retention = (x: unknown, fallback: number) => ((RETENTION_OPTIONS as readonly number[]).includes(x as number) ? (x as number) : fallback);
const requiredText = (x: unknown, max: number) => cleanText(x, max) || invalid();

function audience(x: unknown): Audience {
  const o = isObj(x) ? x : {};
  const ages = pickAgeBands(o.ageBands);
  return {
    source: o.source === 'panel' || o.source === 'mixed' ? o.source : 'community',
    ageBands: ages.length ? ages : AGE_BANDS.slice(),
    countries: Array.isArray(o.countries) ? [...new Set(o.countries.filter((c): c is string => typeof c === 'string' && /^[A-Z]{2}$/.test(c)))].slice(0, 30) : [],
    screenPlatforms: o.screenPlatforms === true,
  };
}

/** Wersje z zapisu twórcy: identyfikatory A–D po kolei, limit planu, sanitizacja każdej wersji. */
function variants(raw: unknown, rules: ProjectRules, keepAois: boolean): Variant[] {
  const list = Array.isArray(raw) ? raw : [];
  if (!list.length || list.length > LIMITS.maxVariants) invalid('bad_variant');
  if (list.length > rules.entitlements.maxVariants) throw new PlanLimit('feature_variants');
  return list.map((v, i) => {
    const o = isObj(v) ? v : {};
    return sanitizeVariant({ ...o, id: VARIANT_IDS[i], aois: keepAois ? o.aois : [] }, rules.allowLocal, i);
  });
}

/** Nowy projekt (kreator, §9.2). Identyfikatory nadaje wywołujący (serwer albo IndexedDB). */
export function newProjectFrom(raw: unknown, ids: { id: string; workspaceId: string; linkToken: string }, rules: ProjectRules): Project {
  if (!isObj(raw)) return invalid();
  const kind = pickKind(raw.kind);
  if (!READY_KINDS.includes(kind)) invalid('kind_unavailable');
  const vs = variants(raw.variants, rules, false);
  if ((kind === 'hook' || kind === 'abn') && vs.length < 2) invalid('bad_variant');
  const caption = cleanText(raw.caption, 300);
  return {
    id: ids.id,
    workspaceId: ids.workspaceId,
    name: requiredText(raw.name, 120),
    creatorName: requiredText(raw.creatorName, 120),
    kind,
    platform: pickPlatform(raw.platform),
    audio: pickAudio(raw.audio),
    context: 'fullscreen',
    platformUi: raw.platformUi === 'generic' ? 'generic' : 'none',
    ...(caption ? { caption } : {}),
    targetDevice: pickEnum(raw.targetDevice, TARGET_DEVICES, 'any'),
    variants: vs,
    fillers: [],
    questions: pickQuestions(raw.questions),
    audience: audience(raw.audience),
    targetSessions: target(raw.targetSessions, RELIABLE_SAMPLE),
    status: 'collecting',
    linkToken: ids.linkToken,
    retentionDays: retention(raw.retentionDays, DEFAULT_RETENTION_DAYS),
    locale: isLocale(raw.locale) ? raw.locale : 'pl',
    createdAt: rules.now,
    updatedAt: rules.now,
  };
}

/**
 * Zmiana projektu (PATCH): tylko znane pola. Wersje muszą zachować identyfikatory (nie dodajemy ani
 * nie usuwamy wersji po utworzeniu). Strefy wymagają planu z `aoi`.
 */
export function patchProject(current: Project, raw: unknown, rules: ProjectRules): Project {
  if (!isObj(raw)) return invalid();
  const next: Project = { ...current, updatedAt: rules.now };
  if ('name' in raw) next.name = requiredText(raw.name, 120);
  if ('creatorName' in raw) next.creatorName = requiredText(raw.creatorName, 120);
  if ('status' in raw) next.status = pickEnum(raw.status, ['collecting', 'paused', 'closed'] as const, current.status);
  if ('targetSessions' in raw) next.targetSessions = target(raw.targetSessions, current.targetSessions);
  if ('retentionDays' in raw) next.retentionDays = retention(raw.retentionDays, current.retentionDays);
  if ('locale' in raw && isLocale(raw.locale)) next.locale = raw.locale;
  if ('audience' in raw) next.audience = audience(raw.audience);
  if ('questions' in raw) next.questions = pickQuestions(raw.questions);
  if ('audio' in raw) next.audio = pickAudio(raw.audio);
  if ('platform' in raw) next.platform = pickPlatform(raw.platform);
  if ('platformUi' in raw) next.platformUi = raw.platformUi === 'generic' ? 'generic' : 'none';
  if ('targetDevice' in raw) next.targetDevice = pickEnum(raw.targetDevice, TARGET_DEVICES, current.targetDevice);
  if ('caption' in raw) {
    const caption = cleanText(raw.caption, 300);
    if (caption) next.caption = caption;
    else delete next.caption;
  }
  if ('variants' in raw) {
    const list = variants(raw.variants, rules, true);
    const sameIds = list.length === current.variants.length && list.every((v, i) => v.id === current.variants[i].id);
    if (!sameIds) invalid('bad_variant');
    const aoisChanged = list.some((v, i) => JSON.stringify(v.aois) !== JSON.stringify(current.variants[i].aois));
    if (aoisChanged && list.some((v) => v.aois.length) && !rules.entitlements.aoi) throw new PlanLimit('feature_aoi');
    next.variants = list;
  }
  return next;
}

/** Konfiguracja badania dla widza: tylko to, czego potrzebuje przebieg (bez stref, scen i sesji). */
export function studyConfigFor(project: Project, variant: Variant, transport: StudyConfig['transport']): StudyConfig {
  return {
    projectId: project.id,
    projectName: project.name,
    creatorName: project.creatorName,
    kind: project.kind,
    platform: project.platform,
    audio: project.audio,
    context: project.context,
    platformUi: project.platformUi,
    ...(project.caption ? { caption: project.caption } : {}),
    targetDevice: project.targetDevice,
    variant: { id: variant.id, media: variant.media, ...(variant.slides ? { slides: variant.slides } : {}), mediaName: variant.mediaName, duration: variant.duration, width: variant.width, height: variant.height, ...(variant.title ? { title: variant.title } : {}) },
    fillers: project.fillers,
    ...(project.feed ? { feed: project.feed } : {}),
    ...(project.grid ? { grid: project.grid } : {}),
    ...(project.slides ? { slides: project.slides } : {}),
    questions: project.questions,
    ageBands: project.audience.ageBands,
    screenPlatforms: project.audience.screenPlatforms,
    consentVersion: CONSENT_VERSION,
    transport,
    linkToken: project.linkToken,
    retentionDays: project.retentionDays,
    locale: project.locale,
  };
}

/**
 * Wersja dla kolejnego widza: najmniej sesji, przy remisie A→D (§13.3). Wersje z materiałem
 * dostępnym tylko na komputerze twórcy (albo jeszcze bez materiału) pomijamy, gdy widz jest gdzie indziej.
 */
export function pickVariant(project: Project, counts: Partial<Record<string, number>>, opts: { allowLocal: boolean }): Variant | null {
  const usable = project.variants.filter((v) => v.media !== null && (opts.allowLocal || v.media.kind !== 'local'));
  if (!usable.length) return null;
  return usable.reduce((best, v) => ((counts[v.id] ?? 0) < (counts[best.id] ?? 0) ? v : best), usable[0]);
}
