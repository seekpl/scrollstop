import { DatabaseSync } from 'node:sqlite';
import { gunzipSync, gzipSync } from 'node:zlib';
import type { Role } from '../src/api/types';
import type { Project, ViewerSession } from '../src/research/model';
import type { PlanId } from '../src/research/plans';

/**
 * Magazyn serwera (§14): jeden plik SQLite (`node:sqlite`, bez zależności). Projekty jako dokumenty
 * JSON, próbki sesji skompresowane gzipem. Obraz z kamery nigdy tu nie trafia — serwer przyjmuje
 * tylko format kolumnowy po sanitizacji. Tokeny, kody usunięcia i linki: wyłącznie skróty SHA-256.
 */

export interface AccountRow {
  id: string;
  email: string;
  name: string;
  company: string;
  password_hash: string;
  plan: PlanId;
  plan_status: 'active' | 'past_due' | 'canceled' | 'none';
  plan_renews_at: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  is_admin: number;
  logo: string | null;
  /** Bieżący zespół (przestrzeń robocza) konta. */
  workspace_id: string;
  created_at: string;
}

export interface WorkspaceRow {
  id: string;
  name: string;
  owner_id: string;
  created_at: string;
}

export interface MemberRow {
  account_id: string;
  email: string;
  name: string;
  role: Role;
  created_at: string;
}

const SCHEMA = `
pragma journal_mode = wal;
pragma foreign_keys = on;
create table if not exists accounts (
  id text primary key,
  email text not null unique,
  name text not null default '',
  company text not null default '',
  password_hash text not null,
  plan text not null default 'free',
  plan_status text not null default 'none',
  plan_renews_at text,
  stripe_customer_id text,
  stripe_subscription_id text,
  is_admin integer not null default 0,
  logo text,
  workspace_id text not null,
  created_at text not null
);
create table if not exists auth_tokens (
  token_hash text primary key,
  account_id text not null references accounts(id) on delete cascade,
  created_at text not null,
  expires_at text not null
);
create table if not exists workspaces (
  id text primary key,
  name text not null,
  owner_id text not null references accounts(id) on delete cascade,
  created_at text not null
);
create table if not exists members (
  workspace_id text not null references workspaces(id) on delete cascade,
  account_id text not null references accounts(id) on delete cascade,
  role text not null,
  created_at text not null,
  primary key (workspace_id, account_id)
);
create index if not exists members_account on members(account_id);
create table if not exists invites (
  token_hash text primary key,
  workspace_id text not null references workspaces(id) on delete cascade,
  role text not null,
  created_by text not null,
  expires_at text not null,
  created_at text not null
);
create table if not exists projects (
  id text primary key,
  workspace_id text not null references workspaces(id) on delete cascade,
  account_id text not null,
  link_token text not null unique,
  status text not null,
  doc text not null,
  created_at text not null,
  updated_at text not null
);
create index if not exists projects_workspace on projects(workspace_id);
create table if not exists sessions (
  id text primary key,
  project_id text not null references projects(id) on delete cascade,
  variant_id text not null,
  status text not null,
  meta text not null,
  samples blob not null,
  deletion_hash text not null,
  created_at text not null,
  expires_at text not null
);
create index if not exists sessions_project on sessions(project_id);
create index if not exists sessions_expires on sessions(expires_at);
create table if not exists media (
  id text primary key,
  workspace_id text not null references workspaces(id) on delete cascade,
  project_id text references projects(id) on delete cascade,
  mime text not null,
  size integer not null,
  file text not null,
  created_at text not null
);
create index if not exists media_project on media(project_id);
create table if not exists share_links (
  token_hash text primary key,
  project_id text not null references projects(id) on delete cascade,
  created_by text not null,
  expires_at text not null,
  created_at text not null
);
create index if not exists share_project on share_links(project_id);
create table if not exists orders (
  id text primary key,
  account_id text,
  kind text not null,
  doc text not null,
  status text not null default 'new',
  created_at text not null
);
create table if not exists insights_cache (
  key text primary key,
  doc text not null,
  created_at text not null
);
create table if not exists stripe_events (
  id text primary key,
  received_at text not null
);
`;

type Row = Record<string, unknown>;

export class Db {
  readonly sql: DatabaseSync;

  constructor(file: string) {
    this.sql = new DatabaseSync(file);
    this.sql.exec(SCHEMA);
  }

  /**
   * Spójna kopia bazy w trakcie działania serwera (`VACUUM INTO`): zwarty plik SQLite gotowy do
   * odtworzenia. Pliki materiałów (`media/`) są niezmienne — kopiuje się je osobno (rsync, tar).
   */
  backupTo(path: string): void {
    this.run('VACUUM INTO ?', path);
  }

  close(): void {
    this.sql.close();
  }

  private get<T>(query: string, ...args: Array<string | number | null | Uint8Array>): T | undefined {
    return this.sql.prepare(query).get(...args) as T | undefined;
  }

  private all<T>(query: string, ...args: Array<string | number | null | Uint8Array>): T[] {
    return this.sql.prepare(query).all(...args) as T[];
  }

  private run(query: string, ...args: Array<string | number | null | Uint8Array>): number {
    return Number(this.sql.prepare(query).run(...args).changes);
  }

  /** Kilka zapisów naraz (np. konto + zespół + członkostwo). */
  transaction<T>(fn: () => T): T {
    this.sql.exec('begin');
    try {
      const out = fn();
      this.sql.exec('commit');
      return out;
    } catch (e) {
      this.sql.exec('rollback');
      throw e;
    }
  }

  // ── Konta ────────────────────────────────────────────────────────────────
  account(id: string): AccountRow | undefined {
    return this.get<AccountRow>('select * from accounts where id = ?', id);
  }

  accountByEmail(email: string): AccountRow | undefined {
    return this.get<AccountRow>('select * from accounts where email = ?', email.toLowerCase());
  }

  accountByCustomer(customer: string): AccountRow | undefined {
    return this.get<AccountRow>('select * from accounts where stripe_customer_id = ?', customer);
  }

  insertAccount(a: AccountRow): void {
    this.run(
      'insert into accounts (id, email, name, company, password_hash, plan, plan_status, plan_renews_at, stripe_customer_id, stripe_subscription_id, is_admin, logo, workspace_id, created_at) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      a.id,
      a.email.toLowerCase(),
      a.name,
      a.company,
      a.password_hash,
      a.plan,
      a.plan_status,
      a.plan_renews_at,
      a.stripe_customer_id,
      a.stripe_subscription_id,
      a.is_admin,
      a.logo,
      a.workspace_id,
      a.created_at,
    );
  }

  /** Zmiana wybranych kolumn (nazwy kolumn tylko z listy — nigdy z danych użytkownika). */
  updateAccount(id: string, patch: Partial<Omit<AccountRow, 'id'>>): void {
    const allowed: Array<keyof Omit<AccountRow, 'id'>> = ['name', 'company', 'plan', 'plan_status', 'plan_renews_at', 'stripe_customer_id', 'stripe_subscription_id', 'is_admin', 'logo', 'workspace_id', 'password_hash'];
    const keys = allowed.filter((k) => k in patch);
    if (!keys.length) return;
    this.run(`update accounts set ${keys.map((k) => `${k} = ?`).join(', ')} where id = ?`, ...keys.map((k) => (patch[k] ?? null) as string | number | null), id);
  }

  /** Usunięcie konta: kaskadowo zespoły właściciela z projektami, sesjami, mediami i linkami. */
  deleteAccount(id: string): void {
    this.run('delete from accounts where id = ?', id);
  }

  // ── Tokeny logowania (w bazie wyłącznie skrót SHA-256) ─────────────────────
  insertToken(hash: string, accountId: string, createdAt: string, expiresAt: string): void {
    this.run('insert into auth_tokens (token_hash, account_id, created_at, expires_at) values (?, ?, ?, ?)', hash, accountId, createdAt, expiresAt);
  }

  tokenAccount(hash: string, now: string): AccountRow | undefined {
    return this.get<AccountRow>('select a.* from auth_tokens t join accounts a on a.id = t.account_id where t.token_hash = ? and t.expires_at > ?', hash, now);
  }

  deleteToken(hash: string): void {
    this.run('delete from auth_tokens where token_hash = ?', hash);
  }

  // ── Zespoły ──────────────────────────────────────────────────────────────
  insertWorkspace(w: WorkspaceRow): void {
    this.run('insert into workspaces (id, name, owner_id, created_at) values (?, ?, ?, ?)', w.id, w.name, w.owner_id, w.created_at);
    this.addMember(w.id, w.owner_id, 'owner', w.created_at);
  }

  workspace(id: string): WorkspaceRow | undefined {
    return this.get<WorkspaceRow>('select * from workspaces where id = ?', id);
  }

  renameWorkspace(id: string, name: string): void {
    this.run('update workspaces set name = ? where id = ?', name, id);
  }

  /** Zespoły, do których należy konto, z rolą i planem właściciela. */
  workspacesOf(accountId: string): Array<WorkspaceRow & { role: Role; plan: PlanId; members: number }> {
    return this.all(
      `select w.*, m.role role, o.plan plan, (select count(*) from members x where x.workspace_id = w.id) members
       from members m join workspaces w on w.id = m.workspace_id join accounts o on o.id = w.owner_id
       where m.account_id = ? order by w.created_at`,
      accountId,
    );
  }

  role(workspaceId: string, accountId: string): Role | undefined {
    return this.get<{ role: Role }>('select role from members where workspace_id = ? and account_id = ?', workspaceId, accountId)?.role;
  }

  members(workspaceId: string): MemberRow[] {
    return this.all<MemberRow>('select m.account_id, a.email, a.name, m.role, m.created_at from members m join accounts a on a.id = m.account_id where m.workspace_id = ? order by m.created_at', workspaceId);
  }

  memberCount(workspaceId: string): number {
    return this.get<{ n: number }>('select count(*) n from members where workspace_id = ?', workspaceId)?.n ?? 0;
  }

  addMember(workspaceId: string, accountId: string, role: Role, createdAt: string): void {
    this.run('insert or replace into members (workspace_id, account_id, role, created_at) values (?, ?, ?, ?)', workspaceId, accountId, role, createdAt);
  }

  setRole(workspaceId: string, accountId: string, role: Role): void {
    this.run('update members set role = ? where workspace_id = ? and account_id = ?', role, workspaceId, accountId);
  }

  removeMember(workspaceId: string, accountId: string): void {
    this.run('delete from members where workspace_id = ? and account_id = ?', workspaceId, accountId);
  }

  /** Konta, których bieżącym zespołem był usuwany zespół (wracają do własnego). */
  accountsInWorkspace(workspaceId: string): Array<{ id: string }> {
    return this.all('select id from accounts where workspace_id = ?', workspaceId);
  }

  ownWorkspace(accountId: string): WorkspaceRow | undefined {
    return this.get<WorkspaceRow>('select * from workspaces where owner_id = ? order by created_at limit 1', accountId);
  }

  // ── Zaproszenia ──────────────────────────────────────────────────────────
  insertInvite(hash: string, workspaceId: string, role: Role, createdBy: string, createdAt: string, expiresAt: string): void {
    this.run('insert into invites (token_hash, workspace_id, role, created_by, expires_at, created_at) values (?, ?, ?, ?, ?, ?)', hash, workspaceId, role, createdBy, expiresAt, createdAt);
  }

  invite(hash: string, now: string): { workspace_id: string; role: Role; expires_at: string } | undefined {
    return this.get('select workspace_id, role, expires_at from invites where token_hash = ? and expires_at > ?', hash, now);
  }

  pendingInvites(workspaceId: string, now: string): number {
    return this.get<{ n: number }>('select count(*) n from invites where workspace_id = ? and expires_at > ?', workspaceId, now)?.n ?? 0;
  }

  deleteInvite(hash: string): void {
    this.run('delete from invites where token_hash = ?', hash);
  }

  // ── Projekty ─────────────────────────────────────────────────────────────
  projects(workspaceId: string): Project[] {
    return this.all<{ doc: string }>('select doc from projects where workspace_id = ? order by updated_at desc', workspaceId).map((r) => JSON.parse(r.doc) as Project);
  }

  project(id: string): Project | undefined {
    const r = this.get<{ doc: string }>('select doc from projects where id = ?', id);
    return r ? (JSON.parse(r.doc) as Project) : undefined;
  }

  projectByToken(token: string): Project | undefined {
    const r = this.get<{ doc: string }>('select doc from projects where link_token = ?', token);
    return r ? (JSON.parse(r.doc) as Project) : undefined;
  }

  saveProject(p: Project, accountId: string): void {
    this.run(
      `insert into projects (id, workspace_id, account_id, link_token, status, doc, created_at, updated_at) values (?, ?, ?, ?, ?, ?, ?, ?)
       on conflict(id) do update set status = excluded.status, doc = excluded.doc, updated_at = excluded.updated_at`,
      p.id,
      p.workspaceId,
      accountId,
      p.linkToken,
      p.status,
      JSON.stringify(p),
      p.createdAt,
      p.updatedAt,
    );
  }

  deleteProject(id: string): void {
    this.run('delete from projects where id = ?', id);
  }

  activeProjects(workspaceId: string): number {
    return this.get<{ n: number }>("select count(*) n from projects where workspace_id = ? and status != 'closed'", workspaceId)?.n ?? 0;
  }

  // ── Sesje ────────────────────────────────────────────────────────────────
  insertSession(s: ViewerSession, deletionHash: string): void {
    const { data, ...meta } = s;
    this.run(
      'insert into sessions (id, project_id, variant_id, status, meta, samples, deletion_hash, created_at, expires_at) values (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      s.id,
      s.projectId,
      s.variantId,
      s.status,
      JSON.stringify(meta),
      gzipSync(JSON.stringify(data)),
      deletionHash,
      s.createdAt,
      s.expiresAt,
    );
  }

  /** Sesje projektu z próbkami, bez wygasłych (`now` — ISO). */
  sessions(projectId: string, now: string): ViewerSession[] {
    return this.all<{ meta: string; samples: Uint8Array }>('select meta, samples from sessions where project_id = ? and expires_at > ? order by created_at', projectId, now).map(
      (r) => ({ ...(JSON.parse(r.meta) as Omit<ViewerSession, 'data'>), data: JSON.parse(gunzipSync(r.samples).toString('utf8')) }) as ViewerSession,
    );
  }

  /** Sesje z panelu do rozliczenia z dostawcą: same metadane, bez próbek wzroku. */
  panelSessions(projectId: string): Array<{ id: string; status: ViewerSession['status']; rejectCode: ViewerSession['rejectCode']; createdAt: string; refHash: string; provider: string }> {
    return this.all<{ meta: string }>('select meta from sessions where project_id = ? order by created_at', projectId).flatMap((r) => {
      const m = JSON.parse(r.meta) as Omit<ViewerSession, 'data'>;
      return m.panel ? [{ id: m.id, status: m.status, rejectCode: m.rejectCode, createdAt: m.createdAt, refHash: m.panel.refHash, provider: m.panel.provider }] : [];
    });
  }

  session(id: string): ViewerSession | undefined {
    const r = this.get<{ meta: string; samples: Uint8Array }>('select meta, samples from sessions where id = ?', id);
    return r ? ({ ...(JSON.parse(r.meta) as Omit<ViewerSession, 'data'>), data: JSON.parse(gunzipSync(r.samples).toString('utf8')) } as ViewerSession) : undefined;
  }

  sessionRow(id: string): { project_id: string; deletion_hash: string; status: string } | undefined {
    return this.get('select project_id, deletion_hash, status from sessions where id = ?', id);
  }

  /** Status i powód odrzucenia (także w dokumencie metadanych). */
  setSessionStatus(id: string, status: ViewerSession['status'], rejectCode: ViewerSession['rejectCode'], manual: boolean): void {
    const r = this.get<{ meta: string }>('select meta from sessions where id = ?', id);
    if (!r) return;
    const meta = { ...(JSON.parse(r.meta) as Row), status, rejectCode, manual };
    this.run('update sessions set status = ?, meta = ? where id = ?', status, JSON.stringify(meta), id);
  }

  /** Krótszy (albo dłuższy) okres przechowywania obejmuje też sesje już zebrane. */
  updateRetention(projectId: string, days: number): void {
    const rows = this.all<{ id: string; created_at: string; meta: string }>('select id, created_at, meta from sessions where project_id = ?', projectId);
    for (const r of rows) {
      const exp = new Date(Date.parse(r.created_at) + days * 86_400_000).toISOString();
      this.run('update sessions set expires_at = ?, meta = ? where id = ?', exp, JSON.stringify({ ...(JSON.parse(r.meta) as Row), expiresAt: exp }), r.id);
    }
  }

  deleteSession(id: string): void {
    this.run('delete from sessions where id = ?', id);
  }

  /**
   * Liczniki projektu: `counted` — sesje liczone do limitów (bez symulacji), `valid` — ważne
   * prawdziwe sesje (postęp do celu), `byVariant` — wszystkie sesje wersji (przydział A→D).
   */
  sessionCounts(projectId: string, now: string): { total: number; valid: number; counted: number; byVariant: Record<string, number> } {
    const rows = this.all<{ v: string; s: string; sim: number; n: number }>(
      "select variant_id v, status s, json_extract(meta, '$.source') = 'simulated' sim, count(*) n from sessions where project_id = ? and expires_at > ? group by variant_id, status, sim",
      projectId,
      now,
    );
    const out = { total: 0, valid: 0, counted: 0, byVariant: {} as Record<string, number> };
    for (const r of rows) {
      out.total += r.n;
      if (!r.sim) out.counted += r.n;
      if (r.s === 'valid' && !r.sim) out.valid += r.n;
      out.byVariant[r.v] = (out.byVariant[r.v] ?? 0) + r.n;
    }
    return out;
  }

  /** Prawdziwe sesje zespołu w miesiącu (prefiks `RRRR-MM`). */
  monthSessions(workspaceId: string, monthPrefix: string): number {
    return (
      this.get<{ n: number }>(
        "select count(*) n from sessions s join projects p on p.id = s.project_id where p.workspace_id = ? and s.created_at like ? and json_extract(s.meta, '$.source') != 'simulated'",
        workspaceId,
        `${monthPrefix}%`,
      )?.n ?? 0
    );
  }

  /** Usuwanie po okresie przechowywania (§17.3) i sprzątanie wygasłych tokenów, zaproszeń i linków. */
  purgeExpired(now: string): number {
    const n = this.run('delete from sessions where expires_at <= ?', now);
    this.run('delete from auth_tokens where expires_at <= ?', now);
    this.run('delete from invites where expires_at <= ?', now);
    this.run('delete from share_links where expires_at <= ?', now);
    return n;
  }

  // ── Media ────────────────────────────────────────────────────────────────
  insertMedia(m: { id: string; workspaceId: string; projectId: string; mime: string; size: number; file: string; createdAt: string }): void {
    this.run('insert into media (id, workspace_id, project_id, mime, size, file, created_at) values (?, ?, ?, ?, ?, ?, ?)', m.id, m.workspaceId, m.projectId, m.mime, m.size, m.file, m.createdAt);
  }

  media(id: string): { workspace_id: string; project_id: string | null; mime: string; size: number; file: string } | undefined {
    return this.get('select workspace_id, project_id, mime, size, file from media where id = ?', id);
  }

  projectMedia(projectId: string): Array<{ id: string; file: string }> {
    return this.all('select id, file from media where project_id = ?', projectId);
  }

  /** Pliki zespołów, których właścicielem jest konto (do usunięcia z dysku razem z kontem). */
  ownedMedia(accountId: string): Array<{ id: string; file: string }> {
    return this.all('select m.id, m.file from media m join workspaces w on w.id = m.workspace_id where w.owner_id = ?', accountId);
  }

  // ── Linki do raportu ─────────────────────────────────────────────────────
  insertShareLink(hash: string, projectId: string, createdBy: string, createdAt: string, expiresAt: string): void {
    this.run('insert into share_links (token_hash, project_id, created_by, expires_at, created_at) values (?, ?, ?, ?, ?)', hash, projectId, createdBy, expiresAt, createdAt);
  }

  shareLink(hash: string, now: string): { project_id: string; expires_at: string } | undefined {
    return this.get('select project_id, expires_at from share_links where token_hash = ? and expires_at > ?', hash, now);
  }

  activeShareLink(projectId: string, now: string): { expires_at: string; created_at: string } | undefined {
    return this.get('select expires_at, created_at from share_links where project_id = ? and expires_at > ? order by created_at desc limit 1', projectId, now);
  }

  deleteShareLinks(projectId: string): void {
    this.run('delete from share_links where project_id = ?', projectId);
  }

  // ── Zamówienia (badanie z panelem) ───────────────────────────────────────
  insertOrder(id: string, accountId: string | null, kind: string, doc: unknown, createdAt: string): void {
    this.run('insert into orders (id, account_id, kind, doc, created_at) values (?, ?, ?, ?, ?)', id, accountId, kind, JSON.stringify(doc), createdAt);
  }

  orders(): Array<{ id: string; account_id: string | null; kind: string; doc: string; status: string; created_at: string }> {
    return this.all('select * from orders order by created_at desc');
  }

  // ── Pamięć podręczna rekomendacji AI (po kluczu z danych wejściowych) ────
  cachedInsights(key: string): string | undefined {
    return this.get<{ doc: string }>('select doc from insights_cache where key = ?', key)?.doc;
  }

  cacheInsights(key: string, doc: string, createdAt: string): void {
    this.run('insert or replace into insights_cache (key, doc, created_at) values (?, ?, ?)', key, doc, createdAt);
  }

  // ── Idempotencja webhooków Stripe ────────────────────────────────────────
  stripeEventSeen(id: string): boolean {
    return !!this.get('select 1 from stripe_events where id = ?', id);
  }

  claimStripeEvent(id: string, receivedAt: string): boolean {
    try {
      this.run('insert into stripe_events (id, received_at) values (?, ?)', id, receivedAt);
      return true;
    } catch {
      return false;
    }
  }
}
