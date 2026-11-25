import { createHmac, timingSafeEqual } from 'node:crypto';
import { createReadStream, createWriteStream, existsSync, mkdirSync, statSync, unlinkSync } from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { extname, join, resolve, sep } from 'node:path';
import { INVITE_DAYS, SHARE_DAYS, type Account, type AiInsightsResult, type InviteInfo, type InvitePreview, type MemberInfo, type PanelOrder, type Role, type ShareLinkStatus, type StudyLookup, type SubmitResult, type Usage, type WorkspaceInfo } from '../src/api/types';
import { BRAND } from '../src/config/brand';
import { isLocale } from '../src/i18n/locales';
import { RESEARCH_TEXT } from '../src/i18n/research';
import { newDeletionCode, normalizeCode, randomId } from '../src/research/link';
import { cleanPanelConfig, cleanPid } from '../src/research/panel';
import { AGE_BANDS, type AgeBand, type MediaSource, type Project, type ViewerSession } from '../src/research/model';
import { entitlements, isPlanId, PLANS, projectBlock, sessionBlock, type BlockReason, type PlanId } from '../src/research/plans';
import { newProjectFrom, patchProject, pickVariant, PlanLimit, studyConfigFor } from '../src/research/project';
import { cleanText, InvalidInput, sanitizeSession } from '../src/research/sanitize';
import { assessSession, expiryDate, monthKey } from '../src/research/sessions';
import { buildSharedReport, type SharedReport } from '../src/research/share';
import { burnPasswordCheck, EMAIL_RE, hashPassword, MAX_PASSWORD, MIN_PASSWORD, newToken, sha256, TOKEN_TTL_DAYS, verifyPassword } from './auth';
import { PAID_PLANS, SignatureError, type Stripe, type StripeEvent, type StripeSubscription, type SubscriptionState } from './billing';
import type { AccountRow, Db } from './db';
import { applyCors, bearer, clientIp, fail, KB, MB, RateLimiter, readBody, readJson, SECURITY_HEADERS, sendError, sendJson } from './http';

export interface ServerConfig {
  dataDir: string;
  /** Adres aplikacji (frontend), np. https://example.com/ — linki w e-mailach i powroty z płatności. */
  appUrl: string;
  /** Originy, które mogą wołać API z przeglądarki (§15). */
  origins: string[];
  adminEmails: string[];
  maxVideoMb: number;
  maxImageMb: number;
  trustProxy: boolean;
  /** Katalog zbudowanego frontendu (jeden kontener: aplikacja + API). */
  staticDir: string | null;
  /** Stripe (§16.4); brak — płatności online wyłączone: 503 `billing_unavailable` i ścieżka e-mail. */
  stripe?: Stripe | null;
  /** Sól skrótu identyfikatora uczestnika panelu (`PANEL_SALT`); bez niej skrótu nie zapisujemy. */
  panelSalt?: string | null;
  now?: () => number;
  /** Linia logu na żądanie API (`METODA wzorzec status ms`). */
  log?: boolean;
}

/** Skrót identyfikatora uczestnika panelu: HMAC-SHA256 z solą serwera (§15). Twórca go nie widzi. */
export const panelRefHash = (salt: string, provider: string, pid: string): string => createHmac('sha256', salt).update(`${provider}:${pid}`).digest('hex');

/** Sesja dla twórcy: bez skrótu identyfikatora z panelu (służy tylko rozliczeniom operatora). */
const forCreator = ({ panel: _panel, ...s }: ViewerSession): ViewerSession => s;

interface Ctx {
  req: IncomingMessage;
  res: ServerResponse;
  params: Record<string, string>;
  url: URL;
  ip: string;
}

const HANDLED = Symbol('handled');

interface Route {
  method: string;
  pattern: string;
  re: RegExp;
  keys: string[];
  /** Zasób publiczny (CORS `*`): pliki mediów dla widzów. */
  open: boolean;
  handler(c: Ctx): Promise<unknown>;
}

class Created {
  constructor(readonly body: unknown) {}
}

const VIDEO_TYPES: Record<string, string> = { 'video/mp4': '.mp4', 'video/webm': '.webm', 'video/quicktime': '.mov' };
const IMAGE_TYPES: Record<string, string> = { 'image/png': '.png', 'image/jpeg': '.jpg', 'image/webp': '.webp' };
const LOGO_RE = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/;
const RANK: Record<Role, number> = { viewer: 0, editor: 1, owner: 2 };
const DAY = 86_400_000;

/** Kontekst zespołu: konto, bieżący zespół, rola i plan właściciela (limity zespołu). */
interface Scope {
  account: AccountRow;
  workspaceId: string;
  role: Role;
  plan: PlanId;
}

export function createApp(db: Db, cfg: ServerConfig) {
  const now = cfg.now ?? Date.now;
  const iso = () => new Date(now()).toISOString();
  const limiter = new RateLimiter(now);
  const mediaDir = join(cfg.dataDir, 'media');
  mkdirSync(mediaDir, { recursive: true });
  const routes: Route[] = [];

  const add = (method: string, pattern: string, handler: Route['handler'], open = false) => {
    const keys: string[] = [];
    const re = new RegExp(`^${pattern.replace(/:(\w+)/g, (_, k: string) => (keys.push(k), '([A-Za-z0-9_-]+)'))}$`);
    routes.push({ method, pattern, re, keys, handler, open });
  };

  // ── Pomocnicze ─────────────────────────────────────────────────────────────
  const isAdmin = (a: AccountRow) => !!a.is_admin || cfg.adminEmails.includes(a.email);

  const toAccount = (a: AccountRow): Account => ({
    id: a.id,
    email: a.email,
    name: a.name,
    company: a.company,
    plan: a.plan,
    planStatus: a.plan_status,
    planRenewsAt: a.plan_renews_at,
    isAdmin: isAdmin(a),
    logo: a.logo,
    workspaceId: a.workspace_id,
    role: db.role(a.workspace_id, a.id) ?? 'owner',
    workspacePlan: ownerPlan(a.workspace_id),
    billing: a.stripe_customer_id ? 'stripe' : a.plan !== 'free' ? 'manual' : null,
  });

  const auth = (c: Ctx): AccountRow => {
    const token = bearer(c.req);
    const row = token ? db.tokenAccount(sha256(token), iso()) : undefined;
    if (!row) throw fail(401, 'unauthorized');
    return row;
  };

  const optionalAuth = (c: Ctx): AccountRow | null => {
    const token = bearer(c.req);
    return (token && db.tokenAccount(sha256(token), iso())) || null;
  };

  const ownerPlan = (workspaceId: string): PlanId => {
    const w = db.workspace(workspaceId);
    return (w && db.account(w.owner_id)?.plan) || 'free';
  };

  /**
   * Bieżący zespół konta z kontrolą roli. Gdy konto usunięto z zespołu, wraca do własnego.
   */
  const scope = (c: Ctx, min: Role = 'viewer'): Scope => {
    let account = auth(c);
    let role = db.role(account.workspace_id, account.id);
    if (!role) {
      const own = db.ownWorkspace(account.id);
      if (!own) throw fail(403, 'forbidden');
      db.updateAccount(account.id, { workspace_id: own.id });
      account = { ...account, workspace_id: own.id };
      role = 'owner';
    }
    if (RANK[role] < RANK[min]) throw fail(403, 'forbidden');
    return { account, workspaceId: account.workspace_id, role, plan: ownerPlan(account.workspace_id) };
  };

  const projectIn = (c: Ctx, s: Scope): Project => {
    const p = db.project(c.params.id);
    if (!p || p.workspaceId !== s.workspaceId) throw fail(404, 'not_found');
    return p;
  };

  const usageOf = (workspaceId: string): Usage => {
    const month = monthKey(iso());
    return { activeProjects: db.activeProjects(workspaceId), monthSessions: db.monthSessions(workspaceId, month), month };
  };

  /** Limit sesji (Free: w projekcie; płatne: miesięcznie w zespole). Symulacje się nie liczą. */
  const blockFor = (project: Project): BlockReason | null => {
    const counts = db.sessionCounts(project.id, iso());
    return sessionBlock(ownerPlan(project.workspaceId), { projectSessions: counts.counted, monthSessions: db.monthSessions(project.workspaceId, monthKey(iso())) });
  };

  /** Błędy warstwy badań jako HTTP: walidacja 400, plan 402. */
  const guard = <T>(fn: () => T): T => {
    try {
      return fn();
    } catch (e) {
      if (e instanceof PlanLimit) throw fail(402, e.code);
      if (e instanceof InvalidInput) throw fail(400, e.code);
      throw e;
    }
  };

  /** Materiały z serwera muszą należeć do tego samego zespołu (izolacja projektów). */
  const checkMedia = (p: Project) => {
    const sources: MediaSource[] = p.variants.flatMap((v) => [...(v.media ? [v.media] : []), ...(v.slides ?? [])]);
    for (const m of sources) {
      if (m.kind !== 'hosted') continue;
      const row = db.media(m.mediaId);
      if (!row || row.workspace_id !== p.workspaceId) throw fail(400, 'bad_media');
    }
  };

  /** Sesja w bazie: status z kontroli jakości, wersja z projektu, data wygaśnięcia z ustawień. */
  const normalize = (project: Project, s: ViewerSession, overLimit: boolean): ViewerSession => {
    const verdict = assessSession(s);
    return {
      ...s,
      projectId: project.id,
      variantId: project.variants.some((v) => v.id === s.variantId) ? s.variantId : project.variants[0].id,
      status: overLimit ? 'rejected' : verdict.status,
      rejectCode: overLimit ? 'over_limit' : verdict.rejectCode,
      manual: false,
      expiresAt: expiryDate(s.createdAt, project.retentionDays),
    };
  };

  const removeMediaFiles = (list: Array<{ file: string }>) => {
    for (const m of list) {
      try {
        unlinkSync(join(mediaDir, m.file));
      } catch {
        /* plik już usunięty */
      }
    }
  };

  const issueToken = (accountId: string) => {
    const t = newToken();
    db.insertToken(t.hash, accountId, iso(), new Date(now() + TOKEN_TTL_DAYS * DAY).toISOString());
    return t.token;
  };

  const workspaceName = (name: string, company: string, email: string) => (company || name || email.split('@')[0]).slice(0, 120);

  // ── Stan ──────────────────────────────────────────────────────────────────
  add('GET', '/api/health', async () => ({ ok: true, time: iso(), billing: !!cfg.stripe, ai: false }));

  // ── Konto (§9.7, §15) ─────────────────────────────────────────────────────
  add('POST', '/api/auth/register', async (c) => {
    limiter.check(`auth:${c.ip}`, 20, 15 * 60_000);
    const b = await readJson<Record<string, unknown>>(c.req, 16 * KB);
    const email = cleanText(b.email, 254).toLowerCase();
    const password = typeof b.password === 'string' ? b.password : '';
    if (!EMAIL_RE.test(email)) throw fail(400, 'invalid_email');
    if (password.length < MIN_PASSWORD || password.length > MAX_PASSWORD) throw fail(400, 'weak_password');
    // Komunikat nie zdradza wprost, że konto istnieje (§9.7: „Nie udało się utworzyć konta…”).
    if (db.accountByEmail(email)) throw fail(409, 'exists');
    const name = cleanText(b.name, 120);
    const company = cleanText(b.company, 120);
    const t = iso();
    const id = `acc_${randomId(9)}`;
    const wsId = `wsp_${randomId(9)}`;
    const row: AccountRow = {
      id,
      email,
      name,
      company,
      password_hash: await hashPassword(password),
      plan: 'free',
      plan_status: 'none',
      plan_renews_at: null,
      stripe_customer_id: null,
      stripe_subscription_id: null,
      is_admin: cfg.adminEmails.includes(email) ? 1 : 0,
      logo: null,
      workspace_id: wsId,
      created_at: t,
    };
    try {
      db.transaction(() => {
        db.insertAccount(row);
        db.insertWorkspace({ id: wsId, name: workspaceName(name, company, email), owner_id: id, created_at: t });
      });
    } catch (e) {
      // Dwa równoległe żądania z tym samym adresem: drugie trafia na unikalny indeks.
      if (db.accountByEmail(email)) throw fail(409, 'exists');
      throw e;
    }
    return new Created({ account: toAccount(row), token: issueToken(id) });
  });

  add('POST', '/api/auth/login', async (c) => {
    limiter.check(`auth:${c.ip}`, 20, 15 * 60_000);
    const b = await readJson<Record<string, unknown>>(c.req, 16 * KB);
    const email = cleanText(b.email, 254).toLowerCase();
    const password = typeof b.password === 'string' ? b.password.slice(0, MAX_PASSWORD) : '';
    limiter.check(`login:${email}`, 10, 15 * 60_000);
    const row = db.accountByEmail(email);
    if (!row) {
      await burnPasswordCheck(password);
      throw fail(401, 'bad_credentials');
    }
    if (!(await verifyPassword(password, row.password_hash))) throw fail(401, 'bad_credentials');
    return { account: toAccount(row), token: issueToken(row.id) };
  });

  add('POST', '/api/auth/logout', async (c) => {
    const token = bearer(c.req);
    if (token) db.deleteToken(sha256(token));
    return { ok: true };
  });

  add('GET', '/api/me', async (c) => toAccount(scope(c).account));

  add('PATCH', '/api/me', async (c) => {
    const a = auth(c);
    const b = await readJson<Record<string, unknown>>(c.req, 300 * KB);
    const patch: Partial<AccountRow> = {};
    if ('name' in b) patch.name = cleanText(b.name, 120);
    if ('company' in b) patch.company = cleanText(b.company, 120);
    if ('logo' in b) {
      if (b.logo === null) patch.logo = null;
      else if (typeof b.logo === 'string' && LOGO_RE.test(b.logo) && b.logo.length <= 210 * KB) {
        if (!PLANS[a.plan].features.clientLogo) throw fail(402, 'feature_logo');
        patch.logo = b.logo;
      } else throw fail(400, 'invalid_logo');
    }
    if ('workspaceId' in b) {
      if (typeof b.workspaceId !== 'string' || !db.role(b.workspaceId, a.id)) throw fail(403, 'forbidden');
      patch.workspace_id = b.workspaceId;
    }
    db.updateAccount(a.id, patch);
    return toAccount(db.account(a.id)!);
  });

  /** Usunięcie konta ze wszystkimi danymi (RODO, art. 17); najpierw anulowanie subskrypcji. */
  add('DELETE', '/api/me', async (c) => {
    const a = auth(c);
    if (a.stripe_subscription_id && a.plan_status !== 'canceled' && a.plan !== 'free') throw fail(409, 'active_subscription');
    removeMediaFiles(db.ownedMedia(a.id));
    db.transaction(() => {
      // Członkowie zespołów usuwanego konta wracają do własnych zespołów.
      for (const w of db.workspacesOf(a.id).filter((w) => w.owner_id === a.id)) {
        for (const other of db.accountsInWorkspace(w.id)) {
          if (other.id === a.id) continue;
          const own = db.ownWorkspace(other.id);
          if (own) db.updateAccount(other.id, { workspace_id: own.id });
        }
      }
      db.deleteAccount(a.id);
    });
    return { ok: true };
  });

  add('GET', '/api/usage', async (c) => usageOf(scope(c).workspaceId));

  // ── Projekty ──────────────────────────────────────────────────────────────
  add('GET', '/api/projects', async (c) => {
    const s = scope(c);
    return db.projects(s.workspaceId).map((p) => {
      const n = db.sessionCounts(p.id, iso());
      return { ...p, counts: { total: n.total, valid: n.valid } };
    });
  });

  add('POST', '/api/projects', async (c) => {
    const s = scope(c, 'editor');
    const block = projectBlock(s.plan, db.activeProjects(s.workspaceId));
    if (block) throw fail(402, block);
    const b = await readJson<unknown>(c.req, MB);
    const project = guard(() => newProjectFrom(b, { id: `prj_${randomId(9)}`, workspaceId: s.workspaceId, linkToken: randomId(16) }, { now: iso(), entitlements: entitlements(s.plan), allowLocal: false }));
    checkMedia(project);
    db.saveProject(project, s.account.id);
    return new Created(project);
  });

  add('GET', '/api/projects/:id', async (c) => projectIn(c, scope(c)));

  add('PATCH', '/api/projects/:id', async (c) => {
    const s = scope(c, 'editor');
    const p = projectIn(c, s);
    const b = await readJson<unknown>(c.req, 2 * MB);
    const next = guard(() => patchProject(p, b, { now: iso(), entitlements: entitlements(s.plan), allowLocal: false }));
    if (p.status === 'closed' && next.status !== 'closed') {
      const block = projectBlock(s.plan, db.activeProjects(s.workspaceId));
      if (block) throw fail(402, block);
    }
    checkMedia(next);
    db.saveProject(next, s.account.id);
    if (next.retentionDays !== p.retentionDays) db.updateRetention(p.id, next.retentionDays);
    return next;
  });

  add('DELETE', '/api/projects/:id', async (c) => {
    const p = projectIn(c, scope(c, 'editor'));
    removeMediaFiles(db.projectMedia(p.id));
    db.deleteProject(p.id);
    return { ok: true };
  });

  // ── Sesje (twórca) ────────────────────────────────────────────────────────
  add('GET', '/api/projects/:id/sessions', async (c) => db.sessions(projectIn(c, scope(c)).id, iso()).map(forCreator));

  add('PATCH', '/api/projects/:id/sessions/:sid', async (c) => {
    const p = projectIn(c, scope(c, 'editor'));
    const session = db.session(c.params.sid);
    if (!session || session.projectId !== p.id) throw fail(404, 'not_found');
    const b = await readJson<Record<string, unknown>>(c.req, 8 * KB);
    if (b.status === 'valid') {
      // Przywrócenie: kontrola jakości jeszcze raz (słaba sesja zostaje z kodem automatycznym).
      const verdict = assessSession(session);
      db.setSessionStatus(session.id, verdict.status, verdict.rejectCode, true);
    } else db.setSessionStatus(session.id, 'rejected', 'manual', true);
    return { ok: true };
  });

  add('DELETE', '/api/projects/:id/sessions/:sid', async (c) => {
    const p = projectIn(c, scope(c, 'editor'));
    const row = db.sessionRow(c.params.sid);
    if (row && row.project_id === p.id) db.deleteSession(c.params.sid);
    return { ok: true };
  });

  /** Pliki sesji od widzów (link samowystarczalny): do 500 na raz, duplikaty i limit → pominięte. */
  add('POST', '/api/projects/:id/import', async (c) => {
    const p = projectIn(c, scope(c, 'editor'));
    const b = await readJson<{ sessions?: unknown }>(c.req, 128 * MB);
    let imported = 0;
    let skipped = 0;
    for (const raw of (Array.isArray(b.sessions) ? b.sessions : []).slice(0, 500)) {
      let s: ViewerSession;
      try {
        s = sanitizeSession(raw, { now: now(), trustCreatedAt: true });
      } catch (e) {
        if (!(e instanceof InvalidInput)) throw e;
        skipped++;
        continue;
      }
      if (db.sessionRow(s.id) || (s.source !== 'simulated' && blockFor(p))) {
        skipped++;
        continue;
      }
      db.insertSession(normalize(p, s, false), '-');
      imported++;
    }
    return { imported, skipped };
  });

  // ── Media ─────────────────────────────────────────────────────────────────
  /** Wgranie materiału: surowe body z `Content-Type`, strumień na dysk z limitem (§13.2). */
  add('POST', '/api/projects/:id/media', async (c) => {
    const s = scope(c, 'editor');
    const p = projectIn(c, s);
    const mime = String(c.req.headers['content-type'] ?? '').split(';')[0].trim().toLowerCase();
    const ext = VIDEO_TYPES[mime] ?? IMAGE_TYPES[mime];
    if (!ext) throw fail(415, 'unsupported_type');
    const limit = (VIDEO_TYPES[mime] ? cfg.maxVideoMb : cfg.maxImageMb) * MB;
    if (Number(c.req.headers['content-length'] ?? 0) > limit) throw fail(413, 'too_large');
    const id = `med_${randomId(15)}`;
    const file = id + ext;
    const path = join(mediaDir, file);
    const size = await new Promise<number>((resolveSize, reject) => {
      let n = 0;
      let failed = false;
      const out = createWriteStream(path, { flags: 'wx' });
      const abort = (err: Error) => {
        if (failed) return;
        failed = true;
        c.req.unpipe(out);
        c.req.resume();
        out.destroy();
        try {
          unlinkSync(path);
        } catch {
          /* brak pliku */
        }
        reject(err);
      };
      c.req.on('data', (chunk: Buffer) => {
        n += chunk.length;
        if (n > limit) abort(fail(413, 'too_large'));
      });
      c.req.on('aborted', () => abort(fail(400, 'bad_request')));
      out.on('error', abort);
      out.on('finish', () => {
        if (!failed) resolveSize(n);
      });
      c.req.pipe(out);
    });
    if (!size) {
      removeMediaFiles([{ file }]);
      throw fail(400, 'bad_request');
    }
    db.insertMedia({ id, workspaceId: s.workspaceId, projectId: p.id, mime, size, file, createdAt: iso() });
    const media: MediaSource = { kind: 'hosted', mediaId: id, url: `/api/media/${id}`, mime };
    return new Created(media);
  });

  /** Odtwarzanie z `Range` — publiczne pod nieodgadywalnym identyfikatorem (widz ogląda bez konta). */
  add(
    'GET',
    '/api/media/:id',
    async (c) => {
      const m = db.media(c.params.id);
      const path = m ? join(mediaDir, m.file) : null;
      if (!m || !path || !existsSync(path)) throw fail(404, 'not_found');
      const size = statSync(path).size;
      const headers: Record<string, string> = {
        ...SECURITY_HEADERS,
        'Content-Type': m.mime,
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'private, max-age=3600',
        'Cross-Origin-Resource-Policy': 'cross-origin',
      };
      const r = /^bytes=(\d*)-(\d*)$/.exec(String(c.req.headers.range ?? ''));
      if (r && (r[1] || r[2])) {
        let start = r[1] ? Number(r[1]) : Math.max(0, size - Number(r[2]));
        let end = r[1] && r[2] ? Math.min(Number(r[2]), size - 1) : size - 1;
        if (start >= size || start > end) {
          c.res.writeHead(416, { ...headers, 'Content-Range': `bytes */${size}` });
          c.res.end();
          return HANDLED;
        }
        start = Math.max(0, start);
        end = Math.max(start, end);
        c.res.writeHead(206, { ...headers, 'Content-Range': `bytes ${start}-${end}/${size}`, 'Content-Length': String(end - start + 1) });
        if (c.req.method === 'HEAD') c.res.end();
        else createReadStream(path, { start, end }).pipe(c.res);
        return HANDLED;
      }
      c.res.writeHead(200, { ...headers, 'Content-Length': String(size) });
      if (c.req.method === 'HEAD') c.res.end();
      else createReadStream(path).pipe(c.res);
      return HANDLED;
    },
    true,
  );

  // ── Rekomendacje (§8.4): bez klucza AI — wnioski z reguł, które raport już pokazuje ──
  add('POST', '/api/projects/:id/variants/:v/insights', async (c) => {
    const s = scope(c, 'editor');
    const p = projectIn(c, s);
    if (!PLANS[s.plan].features.recommendations) throw fail(402, 'feature_recommendations');
    if (!p.variants.some((v) => v.id === c.params.v)) throw fail(404, 'not_found');
    limiter.check(`ai:${s.account.id}`, 30, 60 * 60_000);
    await readJson(c.req, 4 * KB);
    const result: AiInsightsResult = { source: 'rules', model: null, insights: [], rejected: 0 };
    return result;
  });

  // ── Link do raportu tylko do odczytu (§13.2) ──────────────────────────────
  add('POST', '/api/projects/:id/share', async (c) => {
    const s = scope(c, 'editor');
    const p = projectIn(c, s);
    if (!PLANS[s.plan].features.shareLink) throw fail(402, 'feature_share');
    const b = await readJson<Record<string, unknown>>(c.req, 4 * KB);
    const days = (SHARE_DAYS as readonly number[]).includes(b.days as number) ? (b.days as number) : 30;
    const t = newToken();
    const expiresAt = new Date(now() + days * DAY).toISOString();
    db.transaction(() => {
      // Jeden aktywny link na projekt: nowy unieważnia poprzedni.
      db.deleteShareLinks(p.id);
      db.insertShareLink(t.hash, p.id, s.account.id, iso(), expiresAt);
    });
    return new Created({ token: t.token, expiresAt });
  });

  add('GET', '/api/projects/:id/share', async (c): Promise<ShareLinkStatus> => {
    const p = projectIn(c, scope(c));
    const link = db.activeShareLink(p.id, iso());
    return { active: !!link, expiresAt: link?.expires_at ?? null };
  });

  add('DELETE', '/api/projects/:id/share', async (c) => {
    const p = projectIn(c, scope(c, 'editor'));
    db.deleteShareLinks(p.id);
    return { ok: true };
  });

  /** Raport zbiorczy liczony na serwerze — bez surowych sesji i bez wartości pojedynczych widzów. */
  add('GET', '/api/share/:token', async (c): Promise<SharedReport> => {
    limiter.check(`share:${c.ip}`, 120, 10 * 60_000);
    const link = db.shareLink(sha256(c.params.token), iso());
    const project = link ? db.project(link.project_id) : undefined;
    if (!link || !project) throw fail(404, 'share_expired');
    const lang = c.url.searchParams.get('lang');
    const locale = isLocale(lang) ? lang : project.locale;
    const owner = db.workspace(project.workspaceId);
    const ownerRow = owner ? db.account(owner.owner_id) : undefined;
    const logo = ownerRow && PLANS[ownerRow.plan].features.clientLogo ? ownerRow.logo : null;
    return buildSharedReport(project, db.sessions(project.id, iso()), RESEARCH_TEXT[locale], { locale, logo, generatedAt: iso(), expiresAt: link.expires_at });
  });

  // ── Badanie (widz, bez konta) ─────────────────────────────────────────────
  add('GET', '/api/study/:token', async (c): Promise<StudyLookup> => {
    limiter.check(`study:${c.ip}`, 240, 10 * 60_000);
    const project = db.projectByToken(c.params.token);
    if (!project) return { ok: false, reason: 'not_found' };
    if (project.status === 'closed') return { ok: false, reason: 'closed' };
    if (project.status === 'paused') return { ok: false, reason: 'paused' };
    // Limit planu sprawdzamy przed zgodą widza (§16.3).
    const block = blockFor(project);
    if (block) return { ok: false, reason: block };
    const variant = pickVariant(project, db.sessionCounts(project.id, iso()).byVariant, { allowLocal: false });
    if (!variant) return { ok: false, reason: 'closed' };
    return { ok: true, config: studyConfigFor(project, variant, 'server') };
  });

  add('POST', '/api/study/:token/sessions', async (c): Promise<Created> => {
    limiter.check(`submit:${c.ip}`, 60, 60 * 60_000);
    const project = db.projectByToken(c.params.token);
    if (!project) throw fail(404, 'not_found');
    if (project.status === 'closed') throw fail(409, 'closed');
    const raw = await readJson(c.req, 40 * MB);
    const s = guard(() => sanitizeSession(raw, { now: now() }));
    const existing = db.sessionRow(s.id);
    // Ponowne wysłanie tej samej sesji (np. po zerwanym połączeniu): kod usunięcia był już pokazany.
    if (existing) return new Created({ sessionId: s.id, deletionCode: '', status: existing.status as ViewerSession['status'] } satisfies SubmitResult);
    const normalized = normalize(project, s, s.source !== 'simulated' && !!blockFor(project));
    // Widz z panelu: identyfikator uczestnika tylko jako skrót z solą (nagłówek, nie treść sesji).
    const pid = project.panel && cfg.panelSalt ? cleanPid(c.req.headers['x-panel-ref']) : null;
    const stored: ViewerSession = pid && project.panel && cfg.panelSalt ? { ...normalized, panel: { provider: project.panel.provider, refHash: panelRefHash(cfg.panelSalt, project.panel.provider, pid) } } : normalized;
    const code = newDeletionCode();
    db.insertSession(stored, sha256(normalizeCode(code)));
    return new Created({ sessionId: stored.id, deletionCode: code, status: stored.status } satisfies SubmitResult);
  });

  /** Widz usuwa swoją sesję kodem z ekranu końcowego (§12.5). */
  add('POST', '/api/sessions/:id/delete', async (c) => {
    limiter.check(`delete:${c.ip}`, 10, 15 * 60_000);
    const b = await readJson<Record<string, unknown>>(c.req, 4 * KB);
    const row = db.sessionRow(c.params.id);
    const given = Buffer.from(sha256(normalizeCode(String(b.code ?? ''))));
    const ok = !!row && row.deletion_hash.length === given.length && timingSafeEqual(Buffer.from(row.deletion_hash), given);
    if (!ok) throw fail(404, 'bad_code');
    db.deleteSession(c.params.id);
    return { ok: true };
  });

  // ── Płatności (§16.4): Stripe Checkout, portal klienta, webhook z podpisem ─
  const billing = (): Stripe => {
    if (!cfg.stripe) throw fail(503, 'billing_unavailable');
    return cfg.stripe;
  };
  /** Adres w aplikacji (routing po `#`), np. powrót z płatności. */
  const appLink = (hashPath: string) => `${cfg.appUrl.replace(/\/+$/, '')}/${hashPath}`;
  /** Błąd po stronie Stripe (sieć, klucz, cena): 502, szczegóły tylko w logu serwera. */
  const providerError = (e: unknown): never => {
    console.error(`[${BRAND.code}] Stripe: ${e instanceof Error ? e.message : String(e)}`);
    throw fail(502, 'billing_failed');
  };

  add('POST', '/api/billing/checkout', async (c) => {
    const stripe = billing();
    const a = auth(c);
    limiter.check(`checkout:${a.id}`, 20, 60 * 60_000);
    const b = await readJson<Record<string, unknown>>(c.req, 4 * KB);
    const plan = PAID_PLANS.find((p) => p === b.plan);
    const interval = b.interval === 'monthly' || b.interval === 'yearly' ? b.interval : null;
    if (!plan || !interval) throw fail(400, 'bad_request');
    if (!stripe.hasPrice(plan, interval)) throw fail(503, 'billing_unavailable');
    // Zmiana planu przy aktywnej subskrypcji: w portalu klienta, nie drugą subskrypcją.
    if (a.stripe_subscription_id && (a.plan_status === 'active' || a.plan_status === 'past_due')) throw fail(409, 'already_subscribed');
    const url = await stripe
      .checkout({
        accountId: a.id,
        email: a.email,
        customerId: a.stripe_customer_id,
        plan,
        interval,
        locale: isLocale(b.locale) ? b.locale : 'pl',
        successUrl: appLink('#/app/account?payment=ok'),
        cancelUrl: appLink('#/app/account?payment=cancelled'),
      })
      .catch(providerError);
    return { url };
  });

  add('POST', '/api/billing/portal', async (c) => {
    const stripe = billing();
    const a = auth(c);
    limiter.check(`portal:${a.id}`, 30, 60 * 60_000);
    if (!a.stripe_customer_id) throw fail(409, 'no_subscription');
    const b = await readJson<Record<string, unknown>>(c.req, 4 * KB);
    const url = await stripe.portal(a.stripe_customer_id, appLink('#/app/account'), isLocale(b.locale) ? b.locale : 'pl').catch(providerError);
    return { url };
  });

  /**
   * Stan subskrypcji → plan konta. Konto z metadanych (ustawionych przy Checkout) albo po kliencie.
   * Anulowanie starszej subskrypcji nie zdejmuje planu z nowszej.
   */
  const applySubscription = (st: SubscriptionState) => {
    const a = (st.accountId ? db.account(st.accountId) : undefined) ?? db.accountByCustomer(st.customerId);
    if (!a) return;
    if (a.stripe_subscription_id && a.stripe_subscription_id !== st.subscriptionId && st.status !== 'active') return;
    db.updateAccount(a.id, {
      plan: st.plan,
      plan_status: st.status,
      plan_renews_at: st.status === 'canceled' ? null : st.renewsAt,
      stripe_customer_id: st.customerId,
      stripe_subscription_id: st.subscriptionId,
    });
  };

  const handleStripeEvent = async (stripe: Stripe, event: StripeEvent) => {
    const obj = event.data.object;
    switch (event.type) {
      case 'checkout.session.completed': {
        if (obj.mode !== 'subscription' || typeof obj.subscription !== 'string') return;
        const st = stripe.stateOf(await stripe.subscription(obj.subscription));
        applySubscription({ ...st, accountId: st.accountId ?? (typeof obj.client_reference_id === 'string' ? obj.client_reference_id : null) });
        return;
      }
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        // Bieżący stan z API, nie z treści zdarzenia: zdarzenia mogą przyjść w innej kolejności.
        const id = typeof obj.id === 'string' ? obj.id : null;
        if (!id) return;
        const fresh: StripeSubscription = await stripe.subscription(id);
        applySubscription(stripe.stateOf(fresh));
        return;
      }
      case 'invoice.payment_failed': {
        const customer = typeof obj.customer === 'string' ? obj.customer : null;
        const a = customer ? db.accountByCustomer(customer) : undefined;
        if (a && a.plan !== 'free') db.updateAccount(a.id, { plan_status: 'past_due' });
        return;
      }
      default:
        return;
    }
  };

  /** Webhook: podpis HMAC (5 min), idempotencja po `event.id`; błąd przetwarzania → Stripe ponowi. */
  add('POST', '/api/billing/webhook', async (c) => {
    const stripe = billing();
    const raw = await readBody(c.req, MB);
    let event: StripeEvent;
    try {
      event = stripe.verify(raw, typeof c.req.headers['stripe-signature'] === 'string' ? c.req.headers['stripe-signature'] : undefined, now());
    } catch (e) {
      if (e instanceof SignatureError || e instanceof SyntaxError) throw fail(400, 'bad_signature');
      throw e;
    }
    if (typeof event.id !== 'string' || !event.data?.object) throw fail(400, 'bad_request');
    if (db.stripeEventSeen(event.id)) return { received: true, duplicate: true };
    await handleStripeEvent(stripe, event);
    db.claimStripeEvent(event.id, iso());
    return { received: true };
  });

  // ── Badanie z panelem (zamówienie na fakturę, §16.5) ──────────────────────
  add('POST', '/api/orders/panel', async (c) => {
    limiter.check(`order:${c.ip}`, 10, 60 * 60_000);
    const a = optionalAuth(c);
    const b = await readJson<Partial<Record<keyof PanelOrder, unknown>>>(c.req, 16 * KB);
    const contactEmail = cleanText(b.contactEmail, 254).toLowerCase();
    const company = cleanText(b.company, 160);
    if (!EMAIL_RE.test(contactEmail)) throw fail(400, 'invalid_email');
    if (company.length < 2) throw fail(400, 'bad_request');
    const own = typeof b.projectId === 'string' && a ? db.project(b.projectId) : undefined;
    const order: PanelOrder = {
      projectId: own && db.role(own.workspaceId, a!.id) ? own.id : null,
      viewers: Math.min(1000, Math.max(30, Math.round(Number(b.viewers) || 30))),
      ageBands: Array.isArray(b.ageBands) ? (b.ageBands.filter((x) => AGE_BANDS.includes(x as AgeBand)) as AgeBand[]) : [],
      countries: Array.isArray(b.countries) ? b.countries.filter((x): x is string => typeof x === 'string' && /^[A-Z]{2}$/.test(x)).slice(0, 30) : [],
      platforms: cleanText(b.platforms, 200),
      company,
      taxId: cleanText(b.taxId, 32),
      contactEmail,
      notes: cleanText(b.notes, 2000),
    };
    const id = `ord_${randomId(8)}`;
    db.insertOrder(id, a?.id ?? null, 'panel', order, iso());
    console.info(`[${BRAND.code}] nowe zamówienie badania z panelem ${id} (${order.viewers} widzów)`);
    return new Created({ id });
  });

  // ── Administracja (e-maile z ADMIN_EMAILS) ────────────────────────────────
  const admin = (c: Ctx) => {
    const a = auth(c);
    if (!isAdmin(a)) throw fail(403, 'forbidden');
    return a;
  };

  add('GET', '/api/admin/orders', async (c) => {
    admin(c);
    return db.orders().map((o) => ({ ...o, doc: JSON.parse(o.doc) as unknown }));
  });

  /** Plan ustawiany ręcznie (faktura, Agency). */
  add('POST', '/api/admin/plan', async (c) => {
    admin(c);
    const b = await readJson<Record<string, unknown>>(c.req, 4 * KB);
    const row = db.accountByEmail(cleanText(b.email, 254));
    if (!row) throw fail(404, 'not_found');
    if (!isPlanId(b.plan)) throw fail(400, 'bad_request');
    db.updateAccount(row.id, { plan: b.plan, plan_status: b.plan === 'free' ? 'none' : 'active', plan_renews_at: typeof b.renewsAt === 'string' ? cleanText(b.renewsAt, 40) : null });
    return toAccount(db.account(row.id)!);
  });

  /** Integracja projektu z dostawcą panelu (§16.5): adresy powrotu ustawia operator; `panel: null` wyłącza. */
  add('PUT', '/api/admin/projects/:id/panel', async (c) => {
    const a = admin(c);
    const p = db.project(c.params.id);
    if (!p) throw fail(404, 'not_found');
    const b = await readJson<Record<string, unknown>>(c.req, 8 * KB);
    const panel = b.panel === null ? null : cleanPanelConfig(b.panel);
    if (b.panel !== null && !panel) throw fail(400, 'bad_panel');
    const { panel: _old, ...rest } = p;
    const next: Project = panel ? { ...rest, panel, updatedAt: iso() } : { ...rest, updatedAt: iso() };
    db.saveProject(next, a.id);
    return { panel: next.panel ?? null };
  });

  /** Rozliczenie z dostawcą: sesje z panelu (skrót identyfikatora i status), bez danych wzroku. */
  add('GET', '/api/admin/projects/:id/panel', async (c) => {
    admin(c);
    const p = db.project(c.params.id);
    if (!p) throw fail(404, 'not_found');
    return { panel: p.panel ?? null, sessions: db.panelSessions(p.id) };
  });

  // ── Zespoły (§9.6): właściciel / edytor / widz raportu, zaproszenia tokenem ──
  const memberOf = (c: Ctx, min: Role = 'viewer') => {
    const a = auth(c);
    const role = db.role(c.params.id, a.id);
    if (!role) throw fail(404, 'not_found');
    if (RANK[role] < RANK[min]) throw fail(403, 'forbidden');
    return { account: a, role };
  };

  add('GET', '/api/workspaces', async (c): Promise<WorkspaceInfo[]> => {
    const a = auth(c);
    return db.workspacesOf(a.id).map((w) => ({ id: w.id, name: w.name, role: w.role, plan: w.plan, members: w.members }));
  });

  add('PATCH', '/api/workspaces/:id', async (c) => {
    memberOf(c, 'owner');
    const b = await readJson<Record<string, unknown>>(c.req, 4 * KB);
    const name = cleanText(b.name, 120);
    if (!name) throw fail(400, 'bad_request');
    db.renameWorkspace(c.params.id, name);
    return { ok: true };
  });

  add('GET', '/api/workspaces/:id/members', async (c): Promise<MemberInfo[]> => {
    memberOf(c);
    return db.members(c.params.id).map((m) => ({ accountId: m.account_id, email: m.email, name: m.name, role: m.role, joinedAt: m.created_at }));
  });

  add('POST', '/api/workspaces/:id/invites', async (c) => {
    const { account } = memberOf(c, 'owner');
    const b = await readJson<Record<string, unknown>>(c.req, 4 * KB);
    const role: InviteInfo['role'] = b.role === 'viewer' ? 'viewer' : 'editor';
    const seats = PLANS[ownerPlan(c.params.id)].limits.seats;
    if (db.memberCount(c.params.id) + db.pendingInvites(c.params.id, iso()) >= seats) throw fail(402, 'seats');
    const t = newToken();
    const expiresAt = new Date(now() + INVITE_DAYS * DAY).toISOString();
    db.insertInvite(t.hash, c.params.id, role, account.id, iso(), expiresAt);
    return new Created({ token: t.token, role, expiresAt } satisfies InviteInfo);
  });

  add('PATCH', '/api/workspaces/:id/members/:aid', async (c) => {
    memberOf(c, 'owner');
    const b = await readJson<Record<string, unknown>>(c.req, 4 * KB);
    const current = db.role(c.params.id, c.params.aid);
    if (!current) throw fail(404, 'not_found');
    if (current === 'owner') throw fail(400, 'owner_fixed');
    db.setRole(c.params.id, c.params.aid, b.role === 'viewer' ? 'viewer' : 'editor');
    return { ok: true };
  });

  /** Właściciel usuwa członka; członek może sam opuścić zespół. Właściciela usunąć nie można. */
  add('DELETE', '/api/workspaces/:id/members/:aid', async (c) => {
    const { account, role } = memberOf(c);
    if (c.params.aid !== account.id && role !== 'owner') throw fail(403, 'forbidden');
    const target = db.role(c.params.id, c.params.aid);
    if (!target) return { ok: true };
    if (target === 'owner') throw fail(400, 'owner_fixed');
    db.removeMember(c.params.id, c.params.aid);
    const removed = db.account(c.params.aid);
    if (removed?.workspace_id === c.params.id) {
      const own = db.ownWorkspace(removed.id);
      if (own) db.updateAccount(removed.id, { workspace_id: own.id });
    }
    return { ok: true };
  });

  add('GET', '/api/invites/:token', async (c): Promise<InvitePreview> => {
    limiter.check(`invite:${c.ip}`, 60, 15 * 60_000);
    const inv = db.invite(sha256(c.params.token), iso());
    const w = inv ? db.workspace(inv.workspace_id) : undefined;
    if (!inv || !w) throw fail(404, 'invite_invalid');
    return { workspaceName: w.name, role: inv.role === 'viewer' ? 'viewer' : 'editor', expiresAt: inv.expires_at };
  });

  add('POST', '/api/invites/:token/accept', async (c) => {
    const a = auth(c);
    const hash = sha256(c.params.token);
    const inv = db.invite(hash, iso());
    if (!inv || !db.workspace(inv.workspace_id)) throw fail(404, 'invite_invalid');
    if (!db.role(inv.workspace_id, a.id)) {
      if (db.memberCount(inv.workspace_id) >= PLANS[ownerPlan(inv.workspace_id)].limits.seats) throw fail(402, 'seats');
      db.addMember(inv.workspace_id, a.id, inv.role === 'viewer' ? 'viewer' : 'editor', iso());
    }
    db.deleteInvite(hash);
    db.updateAccount(a.id, { workspace_id: inv.workspace_id });
    return toAccount(db.account(a.id)!);
  });

  // ── Obsługa żądań ─────────────────────────────────────────────────────────
  const handler = async (req: IncomingMessage, res: ServerResponse) => {
    const started = Date.now();
    let url: URL;
    try {
      url = new URL(req.url ?? '/', 'http://localhost');
    } catch {
      res.writeHead(400).end();
      return;
    }
    const path = url.pathname;
    const method = req.method === 'HEAD' ? 'GET' : (req.method ?? 'GET');
    let pattern = 'static';
    if (cfg.log) {
      // Bez IP, tokenów i treści (§13.1).
      res.on('finish', () => {
        if (path.startsWith('/api/')) console.info(`${req.method} ${pattern} ${res.statusCode} ${Date.now() - started}ms`);
      });
    }
    try {
      if (path.startsWith('/api/')) {
        const candidates = routes.filter((r) => r.re.test(path));
        if (applyCors(req, res, cfg.origins, candidates.some((r) => r.open))) return;
        const route = candidates.find((r) => r.method === method);
        if (!route) throw fail(candidates.length ? 405 : 404, 'not_found');
        pattern = route.pattern;
        const m = route.re.exec(path)!;
        const params = Object.fromEntries(route.keys.map((k, i) => [k, m[i + 1]]));
        const out = await route.handler({ req, res, params, url, ip: clientIp(req, cfg.trustProxy) });
        if (out === HANDLED) return;
        if (out instanceof Created) sendJson(req, res, 201, out.body);
        else sendJson(req, res, 200, out);
        return;
      }
      if (cfg.staticDir && method === 'GET') {
        serveStatic(cfg.staticDir, path, req, res);
        return;
      }
      throw fail(404, 'not_found');
    } catch (e) {
      if (!res.headersSent) sendError(req, res, e);
      else res.destroy();
    }
  };

  /** Automatyczne usuwanie sesji po okresie przechowywania (co godzinę i przy starcie). */
  const purge = () => db.purgeExpired(iso());

  return { handler, purge };
}

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.wasm': 'application/wasm',
  '.task': 'application/octet-stream',
  '.txt': 'text/plain; charset=utf-8',
};

/** Zbudowany frontend z tego samego serwera. Ochrona przed wyjściem poza katalog; nieznana ścieżka → index.html. */
function serveStatic(root: string, path: string, req: IncomingMessage, res: ServerResponse): void {
  const base = resolve(root);
  let decoded: string;
  try {
    decoded = decodeURIComponent(path);
  } catch {
    throw fail(400, 'bad_request');
  }
  let file = resolve(base, `.${decoded}`);
  if (!file.startsWith(base + sep) && file !== base) file = join(base, 'index.html');
  if (!existsSync(file) || statSync(file).isDirectory()) file = join(base, 'index.html');
  if (!existsSync(file)) throw fail(404, 'not_found');
  const name = file.slice(base.length);
  const immutable = name.startsWith(`${sep}assets${sep}`);
  const noCache = /(index\.html|sw\.js|manifest\.webmanifest)$/.test(name);
  res.writeHead(200, {
    ...SECURITY_HEADERS,
    'Content-Type': MIME[extname(file)] ?? 'application/octet-stream',
    'Content-Length': String(statSync(file).size),
    'Cache-Control': immutable ? 'public, max-age=31536000, immutable' : noCache ? 'no-cache' : 'public, max-age=3600',
  });
  if (req.method === 'HEAD') res.end();
  else createReadStream(file).pipe(res);
}
