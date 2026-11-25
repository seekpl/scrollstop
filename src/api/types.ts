/**
 * Jeden interfejs danych dla dwóch trybów (§12.2):
 * - `local` — wszystko w IndexedDB tej przeglądarki (plan z VITE_LOCAL_PLAN, linki samowystarczalne, pliki sesji),
 * - `server` — konta, zespoły, wgrywanie materiałów, linki dla wielu widzów, płatności, AI, linki udostępniania.
 * Błędy: `ApiError(message, status, code)`; interfejs tłumaczy komunikat po kodzie (słownik `errors`).
 */
import type { Locale } from '../i18n/locales';
import type {
  AgeBand,
  Audience,
  AudioMode,
  FeedSettings,
  FillerItem,
  GridSettings,
  MediaSource,
  Platform,
  Project,
  QuestionId,
  Scene,
  SlidesSettings,
  StudyConfig,
  StudyKind,
  TargetDevice,
  Variant,
  VariantId,
  ViewContext,
  ViewerSession,
} from '../research/model';
import type { BlockReason, PlanId } from '../research/plans';

export interface Account {
  id: string;
  email: string;
  name: string;
  company: string;
  plan: PlanId;
  planStatus: 'active' | 'past_due' | 'canceled' | 'none';
  planRenewsAt: string | null;
  isAdmin: boolean;
  /** Logo do raportu (plan z `clientLogo`), data URL ≤ 150 kB. */
  logo: string | null;
  workspaceId: string;
  role: 'owner' | 'editor' | 'viewer';
}

export interface Usage {
  activeProjects: number;
  monthSessions: number;
  /** RRRR-MM. */
  month: string;
}

export interface NewVariant {
  media: MediaSource | null;
  slides?: MediaSource[];
  mediaName: string;
  duration?: number;
  width?: number;
  height?: number;
  scenes?: Scene[];
  sharedFrom?: number;
  title?: string;
  label?: string;
}

export interface NewProject {
  name: string;
  creatorName: string;
  kind: StudyKind;
  platform: Platform;
  audio: AudioMode;
  context: ViewContext;
  platformUi: 'none' | 'generic';
  caption?: string;
  targetDevice: TargetDevice;
  variants: NewVariant[];
  fillers?: FillerItem[];
  feed?: FeedSettings;
  grid?: GridSettings;
  slides?: SlidesSettings;
  questions: QuestionId[];
  audience: Audience;
  targetSessions?: number;
  retentionDays?: number;
  locale: Locale;
}

export type ProjectPatch = Partial<
  Pick<Project, 'name' | 'creatorName' | 'status' | 'targetSessions' | 'retentionDays' | 'locale' | 'audience' | 'questions' | 'audio' | 'platformUi' | 'caption' | 'feed' | 'grid' | 'slides' | 'targetDevice' | 'context' | 'platform'>
> & { variants?: Variant[]; fillers?: FillerItem[] };

export type StudyLookup = { ok: true; config: StudyConfig } | { ok: false; reason: 'not_found' | 'closed' | 'paused' | BlockReason };

export interface SubmitResult {
  sessionId: string;
  /** Kod, którym widz usuwa swoją sesję. Pokazywany raz; przy ponownym wysłaniu pusty. */
  deletionCode: string;
  status: ViewerSession['status'];
}

export interface PanelOrder {
  projectId: string | null;
  viewers: number;
  ageBands: AgeBand[];
  countries: string[];
  platforms: string;
  company: string;
  taxId: string;
  contactEmail: string;
  notes: string;
}

export interface ShareLinkInfo {
  token: string;
  expiresAt: string;
}

export interface AiInsight {
  title: string;
  fact: string;
  observation: string | null;
  hypothesis: string | null;
  recommendation: string;
  t0: number;
  t1: number;
}

export interface AiInsightsResult {
  source: 'ai' | 'rules';
  model: string | null;
  insights: AiInsight[];
  /** Odrzucone propozycje z liczbami spoza danych albo zakazanymi treściami. */
  rejected: number;
}

export type BillingInterval = 'monthly' | 'yearly';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code: string = 'unknown',
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface ResearchApi {
  readonly mode: 'local' | 'server';
  /** Zalogowane konto; w trybie lokalnym — konto tego urządzenia. */
  me(): Promise<Account | null>;
  register(input: { email: string; password: string; name: string; company: string }): Promise<Account>;
  login(email: string, password: string): Promise<Account>;
  logout(): Promise<void>;
  updateAccount(patch: Partial<Pick<Account, 'name' | 'company' | 'logo'>>): Promise<Account>;
  /** Usuwa konto z projektami, sesjami i plikami (tryb lokalny: wszystkie dane tej przeglądarki). */
  deleteAccount(): Promise<void>;
  usage(): Promise<Usage>;

  listProjects(): Promise<Project[]>;
  getProject(id: string): Promise<Project | null>;
  createProject(input: NewProject): Promise<Project>;
  updateProject(id: string, patch: ProjectPatch): Promise<Project>;
  deleteProject(id: string): Promise<void>;

  listSessions(projectId: string): Promise<ViewerSession[]>;
  setSessionStatus(projectId: string, sessionId: string, status: ViewerSession['status']): Promise<void>;
  deleteSession(projectId: string, sessionId: string): Promise<void>;
  /** Pliki sesji od widzów (badanie bez serwera). */
  importSessions(projectId: string, sessions: unknown[]): Promise<{ imported: number; skipped: number }>;
  /** Wgrywa plik materiału na serwer (tylko tryb serwerowy). */
  uploadMedia(projectId: string, variantId: VariantId, file: File, onProgress?: (p: number) => void): Promise<MediaSource>;

  /** Konfiguracja badania dla widza (przydział wersji). */
  study(token: string): Promise<StudyLookup>;
  submitSession(token: string, session: ViewerSession): Promise<SubmitResult>;
  deleteSessionByCode(sessionId: string, code: string): Promise<void>;

  checkout(plan: Exclude<PlanId, 'free' | 'agency'>, interval: BillingInterval): Promise<{ url: string }>;
  billingPortal(): Promise<{ url: string }>;
  requestPanel(order: PanelOrder): Promise<{ id: string }>;
  /** Rekomendacje AI (serwer) albo z reguł. */
  insights(projectId: string, variantId: VariantId, locale: Locale): Promise<AiInsightsResult>;
  createShareLink(projectId: string, days: 7 | 30 | 90): Promise<ShareLinkInfo>;
  revokeShareLink(projectId: string): Promise<void>;
}
