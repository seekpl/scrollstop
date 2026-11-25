import { STORAGE } from '../config/brand';
import { currentMessages } from '../i18n';
import type { Locale } from '../i18n/locales';
import type { MediaSource, Project, VariantId, ViewerSession } from '../research/model';
import type { PlanId } from '../research/plans';
import type { SharedReport } from '../research/share';
import {
  ApiError,
  type Account,
  type AiInsightsResult,
  type BillingInterval,
  type InviteInfo,
  type InvitePreview,
  type MemberInfo,
  type NewProject,
  type PanelOrder,
  type ProjectPatch,
  type ResearchApi,
  type Role,
  type ShareLinkInfo,
  type ShareLinkStatus,
  type StudyLookup,
  type SubmitResult,
  type Usage,
  type WorkspaceInfo,
} from './types';

/** Komunikat w języku interfejsu według kodu błędu; nieznany kod — opis z serwera. */
const message = (code: string, fallback: string): string => (currentMessages().errors as Record<string, string>)[code] ?? fallback;

/** Token logowania w localStorage (§17.7: jedyny zapis poza językiem); wylogowanie go usuwa. */
const tokenStore = {
  get(): string | null {
    try {
      return localStorage.getItem(STORAGE.token);
    } catch {
      return null;
    }
  },
  set(v: string | null): void {
    try {
      if (v) localStorage.setItem(STORAGE.token, v);
      else localStorage.removeItem(STORAGE.token);
    } catch {
      /* tryb prywatny: token tylko w pamięci */
    }
  },
};

/** Kompresja dużych sesji przed wysłaniem (telefon na słabym internecie). */
async function gzipBody(text: string): Promise<{ body: BodyInit; encoding: string | null }> {
  if (text.length < 32 * 1024 || typeof CompressionStream === 'undefined') return { body: text, encoding: null };
  const stream = new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'));
  return { body: await new Response(stream).blob(), encoding: 'gzip' };
}

const enc = encodeURIComponent;

/**
 * Tryb serwerowy (§12.2): konta, zespoły, wgrywanie materiałów, link dla wielu widzów, linki do
 * raportu. Serwer to `server/` w tym repozytorium; adres podaje `VITE_API_URL` (`/` = ten sam serwer).
 */
export class HttpResearchApi implements ResearchApi {
  readonly mode = 'server' as const;
  private token: string | null = tokenStore.get();

  constructor(private readonly base: string) {
    this.base = base.replace(/\/$/, '');
  }

  private async request<T>(method: string, path: string, body?: unknown, opts: { gzip?: boolean } = {}): Promise<T> {
    const headers: Record<string, string> = {};
    if (this.token) headers.Authorization = `Bearer ${this.token}`;
    let payload: BodyInit | undefined;
    if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
      const text = JSON.stringify(body);
      if (opts.gzip) {
        const z = await gzipBody(text);
        payload = z.body;
        if (z.encoding) headers['Content-Encoding'] = z.encoding;
      } else payload = text;
    }
    let res: Response;
    try {
      res = await fetch(`${this.base}${path}`, { method, headers, body: payload });
    } catch {
      throw new ApiError(message('network', 'Network error'), 0, 'network');
    }
    const data = (await res.json().catch(() => null)) as (T & { error?: { message: string; code: string } }) | null;
    if (!res.ok) {
      if (res.status === 401) this.setToken(null);
      const code = data?.error?.code ?? 'unknown';
      throw new ApiError(message(code, data?.error?.message ?? `HTTP ${res.status}`), res.status, code);
    }
    return data as T;
  }

  private setToken(t: string | null): void {
    this.token = t;
    tokenStore.set(t);
  }

  async me(): Promise<Account | null> {
    if (!this.token) return null;
    try {
      return await this.request<Account>('GET', '/api/me');
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) return null;
      throw e;
    }
  }

  async register(input: { email: string; password: string; name: string; company: string }): Promise<Account> {
    const r = await this.request<{ account: Account; token: string }>('POST', '/api/auth/register', input);
    this.setToken(r.token);
    return r.account;
  }

  async login(email: string, password: string): Promise<Account> {
    const r = await this.request<{ account: Account; token: string }>('POST', '/api/auth/login', { email, password });
    this.setToken(r.token);
    return r.account;
  }

  async logout(): Promise<void> {
    try {
      await this.request('POST', '/api/auth/logout');
    } finally {
      this.setToken(null);
    }
  }

  updateAccount(patch: Partial<Pick<Account, 'name' | 'company' | 'logo'>>): Promise<Account> {
    return this.request('PATCH', '/api/me', patch);
  }

  async deleteAccount(): Promise<void> {
    await this.request('DELETE', '/api/me');
    this.setToken(null);
  }

  usage(): Promise<Usage> {
    return this.request('GET', '/api/usage');
  }

  listProjects(): Promise<Project[]> {
    return this.request('GET', '/api/projects');
  }

  async getProject(id: string): Promise<Project | null> {
    try {
      return await this.request<Project>('GET', `/api/projects/${enc(id)}`);
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) return null;
      throw e;
    }
  }

  createProject(input: NewProject): Promise<Project> {
    return this.request('POST', '/api/projects', input);
  }

  updateProject(id: string, patch: ProjectPatch): Promise<Project> {
    return this.request('PATCH', `/api/projects/${enc(id)}`, patch);
  }

  async deleteProject(id: string): Promise<void> {
    await this.request('DELETE', `/api/projects/${enc(id)}`);
  }

  listSessions(projectId: string): Promise<ViewerSession[]> {
    return this.request('GET', `/api/projects/${enc(projectId)}/sessions`);
  }

  async setSessionStatus(projectId: string, sessionId: string, status: ViewerSession['status']): Promise<void> {
    await this.request('PATCH', `/api/projects/${enc(projectId)}/sessions/${enc(sessionId)}`, { status });
  }

  async deleteSession(projectId: string, sessionId: string): Promise<void> {
    await this.request('DELETE', `/api/projects/${enc(projectId)}/sessions/${enc(sessionId)}`);
  }

  importSessions(projectId: string, sessions: unknown[]): Promise<{ imported: number; skipped: number }> {
    return this.request('POST', `/api/projects/${enc(projectId)}/import`, { sessions }, { gzip: true });
  }

  /** Wysyłanie pliku z postępem (XHR, bo fetch nie raportuje postępu wysyłania). */
  uploadMedia(projectId: string, _variantId: VariantId, file: File, onProgress?: (p: number) => void): Promise<MediaSource> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${this.base}/api/projects/${enc(projectId)}/media`);
      if (this.token) xhr.setRequestHeader('Authorization', `Bearer ${this.token}`);
      xhr.setRequestHeader('Content-Type', file.type || 'video/mp4');
      xhr.upload.onprogress = (e) => e.lengthComputable && onProgress?.(e.loaded / e.total);
      xhr.onerror = () => reject(new ApiError(message('network', 'Network error'), 0, 'network'));
      xhr.onload = () => {
        let data: unknown = null;
        try {
          data = JSON.parse(xhr.responseText);
        } catch {
          /* pusta odpowiedź */
        }
        if (xhr.status >= 200 && xhr.status < 300) resolve(data as MediaSource);
        else {
          const err = (data as { error?: { message: string; code: string } } | null)?.error;
          const code = err?.code ?? 'unknown';
          reject(new ApiError(message(code, err?.message ?? `HTTP ${xhr.status}`), xhr.status, code));
        }
      };
      xhr.send(file);
    });
  }

  study(token: string): Promise<StudyLookup> {
    return this.request('GET', `/api/study/${enc(token)}`);
  }

  submitSession(token: string, session: ViewerSession): Promise<SubmitResult> {
    return this.request('POST', `/api/study/${enc(token)}/sessions`, session, { gzip: true });
  }

  async deleteSessionByCode(sessionId: string, code: string): Promise<void> {
    await this.request('POST', `/api/sessions/${enc(sessionId)}/delete`, { code });
  }

  checkout(plan: Exclude<PlanId, 'free' | 'agency'>, interval: BillingInterval): Promise<{ url: string }> {
    return this.request('POST', '/api/billing/checkout', { plan, interval });
  }

  billingPortal(): Promise<{ url: string }> {
    return this.request('POST', '/api/billing/portal');
  }

  requestPanel(order: PanelOrder): Promise<{ id: string }> {
    return this.request('POST', '/api/orders/panel', order);
  }

  insights(projectId: string, variantId: VariantId, locale: Locale): Promise<AiInsightsResult> {
    return this.request('POST', `/api/projects/${enc(projectId)}/variants/${variantId}/insights`, { locale });
  }

  createShareLink(projectId: string, days: 7 | 30 | 90): Promise<ShareLinkInfo> {
    return this.request('POST', `/api/projects/${enc(projectId)}/share`, { days });
  }

  shareLinkStatus(projectId: string): Promise<ShareLinkStatus> {
    return this.request('GET', `/api/projects/${enc(projectId)}/share`);
  }

  async revokeShareLink(projectId: string): Promise<void> {
    await this.request('DELETE', `/api/projects/${enc(projectId)}/share`);
  }

  sharedReport(token: string, locale: Locale): Promise<SharedReport> {
    return this.request('GET', `/api/share/${enc(token)}?lang=${locale}`);
  }

  workspaces(): Promise<WorkspaceInfo[]> {
    return this.request('GET', '/api/workspaces');
  }

  switchWorkspace(workspaceId: string): Promise<Account> {
    return this.request('PATCH', '/api/me', { workspaceId });
  }

  async renameWorkspace(workspaceId: string, name: string): Promise<void> {
    await this.request('PATCH', `/api/workspaces/${enc(workspaceId)}`, { name });
  }

  members(workspaceId: string): Promise<MemberInfo[]> {
    return this.request('GET', `/api/workspaces/${enc(workspaceId)}/members`);
  }

  createInvite(workspaceId: string, role: Exclude<Role, 'owner'>): Promise<InviteInfo> {
    return this.request('POST', `/api/workspaces/${enc(workspaceId)}/invites`, { role });
  }

  inviteInfo(token: string): Promise<InvitePreview> {
    return this.request('GET', `/api/invites/${enc(token)}`);
  }

  acceptInvite(token: string): Promise<Account> {
    return this.request('POST', `/api/invites/${enc(token)}/accept`);
  }

  async setMemberRole(workspaceId: string, accountId: string, role: Exclude<Role, 'owner'>): Promise<void> {
    await this.request('PATCH', `/api/workspaces/${enc(workspaceId)}/members/${enc(accountId)}`, { role });
  }

  async removeMember(workspaceId: string, accountId: string): Promise<void> {
    await this.request('DELETE', `/api/workspaces/${enc(workspaceId)}/members/${enc(accountId)}`);
  }
}
