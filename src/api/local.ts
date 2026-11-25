import { currentMessages } from '../i18n';
import { newDeletionCode, normalizeCode, randomId, sha256Hex } from '../research/link';
import { CONSENT_VERSION, LIMITS, type Project, type StudyConfig, type Variant, type VariantId, type ViewerSession } from '../research/model';
import { PLANS, projectBlock, sessionBlock, type PlanId } from '../research/plans';
import { sanitizeSession } from '../research/sanitize';
import { assessSession, expiryDate, isExpired, monthKey } from '../research/sessions';
import type { LocalStore } from './localStore';
import { ApiError, type Account, type NewProject, type NewVariant, type ProjectPatch, type ResearchApi, type StudyLookup, type SubmitResult, type Usage } from './types';


interface Kv<T> {
  id: string;
  value: T;
}

/** Błąd z komunikatem w języku interfejsu według kodu (helper `fail`, lekcja §24.3). */
export const fail = (code: string, status: number) => new ApiError((currentMessages().errors as Record<string, string>)[code] ?? code, status, code);

const VARIANT_IDS: VariantId[] = ['A', 'B', 'C', 'D'];

export function variantFrom(v: NewVariant, i: number, label?: string): Variant {
  const id = VARIANT_IDS[i];
  return {
    id,
    label: label ?? v.label ?? `Wersja ${id}`,
    media: v.media,
    ...(v.slides ? { slides: v.slides } : {}),
    mediaName: v.mediaName,
    duration: v.duration ?? 0,
    width: v.width ?? 1080,
    height: v.height ?? 1920,
    scenes: v.scenes ?? [],
    aois: [],
    ...(v.sharedFrom !== undefined ? { sharedFrom: v.sharedFrom } : {}),
    ...(v.title !== undefined ? { title: v.title } : {}),
  };
}

/**
 * Tryb lokalny (§12.2): projekty i sesje w IndexedDB tej przeglądarki, konto „tego urządzenia”,
 * plan z VITE_LOCAL_PLAN. Funkcje wymagające serwera rzucają błąd z kodem `local_mode`.
 */
export class LocalResearchApi implements ResearchApi {
  readonly mode = 'local' as const;

  constructor(
    private readonly store: LocalStore,
    private readonly opts: { plan?: PlanId; now?: () => number } = {},
  ) {}

  private now(): number {
    return this.opts.now?.() ?? Date.now();
  }

  private async kv<T>(key: string, fallback: T): Promise<T> {
    return (await this.store.get<Kv<T>>('kv', key))?.value ?? fallback;
  }

  private async setKv<T>(key: string, value: T): Promise<void> {
    await this.store.put<Kv<T>>('kv', { id: key, value });
  }

  async me(): Promise<Account> {
    const stored = await this.kv<Partial<Account>>('account', {});
    return {
      id: 'local',
      email: '',
      name: stored.name ?? '',
      company: stored.company ?? '',
      plan: this.opts.plan ?? 'free',
      planStatus: 'none',
      planRenewsAt: null,
      isAdmin: false,
      logo: stored.logo ?? null,
      workspaceId: 'local',
      role: 'owner',
    };
  }

  async register(): Promise<Account> {
    throw fail('local_mode', 400);
  }

  async login(): Promise<Account> {
    throw fail('local_mode', 400);
  }

  async logout(): Promise<void> {}

  async updateAccount(patch: Partial<Pick<Account, 'name' | 'company' | 'logo'>>): Promise<Account> {
    const stored = await this.kv<Partial<Account>>('account', {});
    await this.setKv('account', { ...stored, ...patch });
    return this.me();
  }

  async deleteAccount(): Promise<void> {
    for (const c of ['sessions', 'projects', 'orders', 'kv'] as const) for (const item of await this.store.all<{ id: string }>(c)) await this.store.del(c, item.id);
  }

  /** Sesje bez wygasłych — usuwanie automatyczne po okresie przechowywania (§17.3). */
  private async allSessions(): Promise<ViewerSession[]> {
    const all = await this.store.all<ViewerSession>('sessions');
    const now = this.now();
    const live: ViewerSession[] = [];
    for (const s of all) {
      if (isExpired(s, now)) await this.store.del('sessions', s.id);
      else live.push(s);
    }
    return live;
  }

  async usage(): Promise<Usage> {
    const projects = await this.store.all<Project>('projects');
    const month = monthKey(new Date(this.now()).toISOString());
    const sessions = await this.allSessions();
    return {
      activeProjects: projects.filter((p) => p.status !== 'closed').length,
      // Sesje symulowane nie liczą się do limitów (§5.17).
      monthSessions: sessions.filter((s) => s.source !== 'simulated' && monthKey(s.createdAt) === month).length,
      month,
    };
  }

  async listProjects(): Promise<Project[]> {
    const sessions = await this.allSessions();
    return (await this.store.all<Project>('projects'))
      .map((p) => {
        const own = sessions.filter((s) => s.projectId === p.id);
        return { ...p, counts: { total: own.length, valid: own.filter((s) => s.status === 'valid' && s.source !== 'simulated').length } };
      })
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async getProject(id: string): Promise<Project | null> {
    return (await this.store.get<Project>('projects', id)) ?? null;
  }

  async createProject(input: NewProject): Promise<Project> {
    const me = await this.me();
    const block = projectBlock(me.plan, (await this.usage()).activeProjects);
    if (block) throw fail(block, 402);
    if (!input.variants.length) throw fail('bad_request', 400);
    const now = new Date(this.now()).toISOString();
    const max = PLANS[me.plan].maxVariants;
    const project: Project = {
      id: `prj_${randomId(9)}`,
      workspaceId: 'local',
      name: input.name.trim().slice(0, 120),
      creatorName: input.creatorName.trim().slice(0, 120),
      kind: input.kind,
      platform: input.platform,
      audio: input.audio,
      context: input.context,
      platformUi: input.platformUi,
      ...(input.caption ? { caption: input.caption.slice(0, 300) } : {}),
      targetDevice: input.targetDevice,
      variants: input.variants.slice(0, Math.min(max, LIMITS.maxVariants)).map((v, i) => variantFrom(v, i)),
      fillers: input.fillers ?? [],
      ...(input.feed ? { feed: input.feed } : {}),
      ...(input.grid ? { grid: input.grid } : {}),
      ...(input.slides ? { slides: input.slides } : {}),
      questions: input.questions.slice(0, 3),
      audience: input.audience,
      targetSessions: input.targetSessions ?? 30,
      status: 'collecting',
      linkToken: randomId(16),
      retentionDays: input.retentionDays ?? 90,
      locale: input.locale,
      createdAt: now,
      updatedAt: now,
    };
    await this.store.put('projects', project);
    return project;
  }

  async updateProject(id: string, patch: ProjectPatch): Promise<Project> {
    const p = await this.getProject(id);
    if (!p) throw fail('not_found', 404);
    const next: Project = { ...p, ...patch, updatedAt: new Date(this.now()).toISOString() };
    // Zmiana okresu przechowywania dotyczy też zapisanych sesji.
    if (patch.retentionDays && patch.retentionDays !== p.retentionDays) {
      for (const s of await this.listSessions(id)) await this.store.put('sessions', { ...s, expiresAt: expiryDate(s.createdAt, patch.retentionDays) });
    }
    await this.store.put('projects', next);
    return next;
  }

  async deleteProject(id: string): Promise<void> {
    for (const s of await this.listSessions(id)) await this.store.del('sessions', s.id);
    await this.store.del('projects', id);
  }

  async listSessions(projectId: string): Promise<ViewerSession[]> {
    return (await this.allSessions()).filter((s) => s.projectId === projectId).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }

  async setSessionStatus(projectId: string, sessionId: string, status: ViewerSession['status']): Promise<void> {
    const s = await this.store.get<ViewerSession>('sessions', sessionId);
    if (!s || s.projectId !== projectId) throw fail('not_found', 404);
    if (status === 'rejected') await this.store.put('sessions', { ...s, status, rejectCode: 'manual', manual: true });
    else {
      // Przywrócenie: kontrola jakości jeszcze raz (sesja słabej jakości zostaje z kodem automatycznym).
      const verdict = assessSession(s);
      await this.store.put('sessions', { ...s, status: verdict.status, rejectCode: verdict.rejectCode, manual: true });
    }
  }

  async deleteSession(projectId: string, sessionId: string): Promise<void> {
    const s = await this.store.get<ViewerSession>('sessions', sessionId);
    if (s && s.projectId === projectId) await this.store.del('sessions', sessionId);
  }

  private async blockFor(project: Project) {
    const me = await this.me();
    const own = (await this.listSessions(project.id)).filter((s) => s.source !== 'simulated');
    return sessionBlock(me.plan, { projectSessions: own.length, monthSessions: (await this.usage()).monthSessions });
  }

  /** Sesja w bazie: status z kontroli jakości, wersja z projektu, data wygaśnięcia z ustawień. */
  private normalize(project: Project, s: ViewerSession, overLimit: boolean): ViewerSession {
    const verdict = assessSession(s);
    const variantId = project.variants.some((v) => v.id === s.variantId) ? s.variantId : 'A';
    return {
      ...s,
      projectId: project.id,
      variantId,
      status: overLimit ? 'rejected' : verdict.status,
      rejectCode: overLimit ? 'over_limit' : verdict.rejectCode,
      manual: false,
      expiresAt: expiryDate(s.createdAt, project.retentionDays),
    };
  }

  async importSessions(projectId: string, sessions: unknown[]) {
    const project = await this.getProject(projectId);
    if (!project) throw fail('not_found', 404);
    let imported = 0;
    let skipped = 0;
    for (const raw of sessions) {
      let s: ViewerSession;
      try {
        // Tylko dozwolone pola: plik od widza nie wniesie do bazy niczego ponad kierunek wzroku.
        s = sanitizeSession(raw, { now: this.now(), trustCreatedAt: true });
      } catch {
        skipped++;
        continue;
      }
      if ((await this.store.get('sessions', s.id)) || (s.source !== 'simulated' && (await this.blockFor(project)))) {
        skipped++;
        continue;
      }
      await this.store.put('sessions', this.normalize(project, s, false));
      imported++;
    }
    return { imported, skipped };
  }

  async uploadMedia(): Promise<never> {
    throw fail('local_mode', 400);
  }

  /** Badanie na urządzeniu twórcy (link z tokenem projektu). */
  async study(token: string): Promise<StudyLookup> {
    const project = (await this.store.all<Project>('projects')).find((p) => p.linkToken === token);
    if (!project) return { ok: false, reason: 'not_found' };
    if (project.status === 'closed') return { ok: false, reason: 'closed' };
    if (project.status === 'paused') return { ok: false, reason: 'paused' };
    const block = await this.blockFor(project);
    if (block) return { ok: false, reason: block };
    return { ok: true, config: studyConfigFor(project, await this.pickVariant(project), 'local') };
  }

  /** Wersja z najmniejszą liczbą sesji, przy remisie A→D (§13.3). */
  private async pickVariant(project: Project): Promise<Variant> {
    const own = await this.listSessions(project.id);
    const counts = project.variants.map((v) => own.filter((s) => s.variantId === v.id).length);
    return project.variants[counts.indexOf(Math.min(...counts))];
  }

  async submitSession(token: string, session: ViewerSession): Promise<SubmitResult> {
    const project = (await this.store.all<Project>('projects')).find((p) => p.linkToken === token);
    if (!project) throw fail('not_found', 404);
    let clean: ViewerSession;
    try {
      clean = sanitizeSession(session, { now: this.now() });
    } catch (e) {
      throw fail((e as { code?: string }).code ?? 'bad_request', 400);
    }
    const existing = await this.store.get<ViewerSession>('sessions', clean.id);
    if (existing) return { sessionId: existing.id, deletionCode: '', status: existing.status };
    const over = clean.source !== 'simulated' && !!(await this.blockFor(project));
    const stored = this.normalize(project, clean, over);
    await this.store.put('sessions', stored);
    const code = newDeletionCode();
    await this.setKv(`del:${stored.id}`, await sha256Hex(normalizeCode(code)));
    return { sessionId: stored.id, deletionCode: code, status: stored.status };
  }

  async deleteSessionByCode(sessionId: string, code: string): Promise<void> {
    const hash = await this.kv<string | null>(`del:${sessionId}`, null);
    if (!hash || hash !== (await sha256Hex(normalizeCode(code)))) throw fail('bad_code', 404);
    await this.store.del('sessions', sessionId);
    await this.store.del('kv', `del:${sessionId}`);
  }

  async checkout(): Promise<never> {
    throw fail('local_mode', 400);
  }

  async billingPortal(): Promise<never> {
    throw fail('local_mode', 400);
  }

  async requestPanel(order: Parameters<ResearchApi['requestPanel']>[0]) {
    const id = `ord_${randomId(8)}`;
    await this.store.put('orders', { id, ...order, createdAt: new Date(this.now()).toISOString() });
    return { id };
  }

  async insights(): Promise<never> {
    throw fail('local_mode', 400);
  }

  async createShareLink(): Promise<never> {
    throw fail('local_mode', 400);
  }

  async revokeShareLink(): Promise<never> {
    throw fail('local_mode', 400);
  }
}

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
