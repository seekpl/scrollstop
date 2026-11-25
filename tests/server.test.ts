// @vitest-environment node
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../server/app';
import { Db } from '../server/db';
import { RESEARCH_TEXT } from '../src/i18n/research';
import type { MediaSource, Project, ViewerSession } from '../src/research/model';
import { demoProject } from '../src/research/panelSim';

let dir: string;
let staticDir: string;
let db: Db;
let server: Server;
let base: string;
let purge: () => number;
let clock = Date.parse('2026-11-20T10:00:00Z');
const DAY = 86_400_000;

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'attn-server-'));
  staticDir = join(dir, 'static');
  mkdirSync(join(staticDir, 'assets'), { recursive: true });
  writeFileSync(join(staticDir, 'index.html'), '<!doctype html><title>app</title>');
  writeFileSync(join(staticDir, 'assets', 'app-abc123.js'), 'console.log(1)');
  writeFileSync(join(dir, 'secret.txt'), 'tajne');
  db = new Db(join(dir, 'test.sqlite'));
  const app = createApp(db, {
    dataDir: dir,
    appUrl: 'https://app.example/',
    origins: ['https://app.example'],
    adminEmails: ['admin@example.com'],
    maxVideoMb: 1,
    maxImageMb: 1,
    trustProxy: false,
    staticDir,
    now: () => clock,
  });
  server = createServer((req, res) => void app.handler(req, res));
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  purge = app.purge;
});

afterAll(() => {
  server.close();
  db.close();
  rmSync(dir, { recursive: true, force: true });
});

interface Res<T> {
  status: number;
  headers: Headers;
  data: T;
}

async function call<T = Record<string, unknown>>(method: string, path: string, body?: unknown, token?: string, headers: Record<string, string> = {}): Promise<Res<T>> {
  const res = await fetch(base + path, {
    method,
    headers: { ...(body !== undefined && !(body instanceof Uint8Array) ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers },
    body: body === undefined ? undefined : body instanceof Uint8Array ? (body as BodyInit) : JSON.stringify(body),
  });
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  return { status: res.status, headers: res.headers, data: data as T };
}

const errCode = (r: Res<unknown>) => (r.data as { error?: { code: string } }).error?.code;

let n = 0;
async function account(plan: 'free' | 'creator' | 'pro' | 'agency' = 'free', email = `user${++n}@example.com`) {
  const r = await call<{ token: string; account: { id: string; workspaceId: string } }>('POST', '/api/auth/register', { email, password: 'dlugie-haslo-123', name: `Osoba ${n}`, company: `Studio ${n}` });
  expect(r.status).toBe(201);
  if (plan !== 'free') db.updateAccount(r.data.account.id, { plan, plan_status: 'active' });
  return { token: r.data.token, id: r.data.account.id, workspaceId: r.data.account.workspaceId, email };
}

const projectInput = (patch: Record<string, unknown> = {}) => ({
  name: 'Rolka testowa',
  creatorName: 'Studio testowe',
  kind: 'video',
  platform: 'tiktok',
  audio: 'off',
  targetDevice: 'mobile',
  variants: [{ media: { kind: 'demo', demo: 'reel_b' }, mediaName: 'Rolka demo B', duration: 15, width: 1080, height: 1920 }],
  questions: ['finish'],
  audience: { source: 'community', ageBands: ['18-24', '25-34'] },
  locale: 'pl',
  ...patch,
});

async function project(token: string, patch: Record<string, unknown> = {}) {
  const r = await call<Project>('POST', '/api/projects', projectInput(patch), token);
  expect(r.status).toBe(201);
  return r.data;
}

/** Sesje „z kamery” (dobra kalibracja) z symulacji — jak od prawdziwego widza, z unikalnym id. */
function webcam(count: number, extra: Partial<ViewerSession> = {}): ViewerSession[] {
  return demoProject('reel', RESEARCH_TEXT.pl, { valid: count, createdAt: new Date(clock).toISOString() })
    .sessions.slice(0, count)
    .map((s, i) => ({ ...s, id: `ses_t${++n}x${i}`, variantId: 'A', source: 'webcam' as const, calibration: { quality: 'GOOD' as const, xPct: 5, yPct: 6, points: 9 }, ...extra }));
}

describe('serwer: konto (§9.7, §15)', () => {
  it('rejestracja i logowanie; komunikaty nie zdradzają, czy e-mail istnieje', async () => {
    const a = await account('free', 'ala@example.com');
    expect((await call('GET', '/api/me', undefined, a.token)).data).toMatchObject({ email: 'ala@example.com', plan: 'free', role: 'owner', workspaceId: a.workspaceId });
    const dup = await call('POST', '/api/auth/register', { email: 'ALA@example.com', password: 'dlugie-haslo-123' });
    expect([dup.status, errCode(dup)]).toEqual([409, 'exists']);
    const wrongPass = await call('POST', '/api/auth/login', { email: 'ala@example.com', password: 'zle-haslo-123' });
    const noUser = await call('POST', '/api/auth/login', { email: 'nikt@example.com', password: 'zle-haslo-123' });
    expect([wrongPass.status, errCode(wrongPass)]).toEqual([401, 'bad_credentials']);
    expect(noUser.data).toEqual(wrongPass.data);
    expect(errCode(await call('POST', '/api/auth/register', { email: 'zly-adres', password: 'dlugie-haslo-123' }))).toBe('invalid_email');
    expect(errCode(await call('POST', '/api/auth/register', { email: 'b@example.com', password: 'krotkie' }))).toBe('weak_password');
    // Dwa równoczesne żądania z tym samym adresem: jedno konto, drugie 409 (nie błąd serwera).
    const race = await Promise.all([1, 2].map(() => call('POST', '/api/auth/register', { email: 'wyscig@example.com', password: 'dlugie-haslo-123' })));
    expect(race.map((r) => r.status).sort()).toEqual([201, 409]);
    const login = await call<{ token: string }>('POST', '/api/auth/login', { email: 'ala@example.com', password: 'dlugie-haslo-123' });
    expect(login.status).toBe(200);
    await call('POST', '/api/auth/logout', undefined, login.data.token);
    expect((await call('GET', '/api/me', undefined, login.data.token)).status).toBe(401);
  });
});

describe('serwer: projekty, plany i izolacja', () => {
  it('Free: jeden aktywny projekt, potem 402; płatne funkcje jako 402 feature_*', async () => {
    const a = await account();
    expect(errCode(await call('POST', '/api/projects', projectInput({ kind: 'abn', variants: [projectInput().variants[0], projectInput().variants[0]] }), a.token))).toBe('feature_variants');
    expect(errCode(await call('POST', '/api/projects', projectInput({ kind: 'feed' }), a.token))).toBe('kind_unavailable');
    expect(errCode(await call('POST', '/api/projects', projectInput({ variants: [{ media: { kind: 'local', fileName: 'a.mp4', fileSize: 10 } }] }), a.token))).toBe('local_media');
    const p = await project(a.token);
    expect(p).toMatchObject({ workspaceId: a.workspaceId, status: 'collecting', retentionDays: 90 });
    const second = await call('POST', '/api/projects', projectInput(), a.token);
    expect([second.status, errCode(second)]).toEqual([402, 'active_projects']);
    // Strefy zainteresowania wymagają planu z `aoi`.
    const aoi = { id: 'aoi_1', name: 'Logo', type: 'logo', x: 0.1, y: 0.1, w: 0.2, h: 0.1, t0: 0, t1: 3 };
    const patch = await call('PATCH', `/api/projects/${p.id}`, { variants: [{ ...p.variants[0], aois: [aoi] }] }, a.token);
    expect([patch.status, errCode(patch)]).toEqual([402, 'feature_aoi']);
    db.updateAccount(a.id, { plan: 'pro' });
    const ok = await call<Project>('PATCH', `/api/projects/${p.id}`, { variants: [{ ...p.variants[0], aois: [aoi] }], name: '  Nowa nazwa  ', status: 'paused', extra: 'x' }, a.token);
    expect(ok.data.variants[0].aois).toHaveLength(1);
    expect(ok.data).toMatchObject({ name: 'Nowa nazwa', status: 'paused' });
    expect(ok.data).not.toHaveProperty('extra');
  });

  it('cudzy projekt jest niewidoczny (404), bez tokenu 401', async () => {
    const a = await account('pro');
    const b = await account('pro');
    const p = await project(a.token);
    expect((await call('GET', `/api/projects/${p.id}`, undefined, b.token)).status).toBe(404);
    expect((await call('GET', `/api/projects/${p.id}/sessions`, undefined, b.token)).status).toBe(404);
    expect((await call('DELETE', `/api/projects/${p.id}`, undefined, b.token)).status).toBe(404);
    expect((await call('GET', `/api/projects/${p.id}`)).status).toBe(401);
    expect(((await call<Project[]>('GET', '/api/projects', undefined, b.token)).data).map((x) => x.id)).not.toContain(p.id);
  });
});

describe('serwer: badanie widza, limity i RODO', () => {
  it('link: konfiguracja serwerowa, przydział wersji A→B, limit Free przed zgodą; symulacja się nie liczy', async () => {
    const pro = await account('pro');
    const ab = await project(pro.token, { kind: 'abn', variants: [projectInput().variants[0], { ...projectInput().variants[0], mediaName: 'B' }] });
    const first = await call<{ ok: true; config: { transport: string; variant: { id: string } } }>('GET', `/api/study/${ab.linkToken}`);
    expect(first.data.config).toMatchObject({ transport: 'server', variant: { id: 'A' } });
    expect(first.data.config).not.toHaveProperty('variant.aois');
    await call('POST', `/api/study/${ab.linkToken}/sessions`, webcam(1)[0]);
    expect((await call<{ config: { variant: { id: string } } }>('GET', `/api/study/${ab.linkToken}`)).data.config.variant.id).toBe('B');

    const a = await account();
    const p = await project(a.token);
    for (const s of webcam(5)) expect((await call('POST', `/api/study/${p.linkToken}/sessions`, s)).status).toBe(201);
    expect((await call('GET', `/api/study/${p.linkToken}`)).data).toEqual({ ok: false, reason: 'project_sessions' });
    // Sesja wysłana mimo limitu jest zapisana jako odrzucona (over_limit); symulacja przechodzi bez limitu.
    const late = await call<{ status: string }>('POST', `/api/study/${p.linkToken}/sessions`, webcam(1)[0]);
    expect(late.data.status).toBe('rejected');
    const sim = await call<{ status: string }>('POST', `/api/study/${p.linkToken}/sessions`, { ...webcam(1)[0], source: 'simulated' });
    expect(sim.status).toBe(201);
    const sessions = (await call<ViewerSession[]>('GET', `/api/projects/${p.id}/sessions`, undefined, a.token)).data;
    expect(sessions.filter((s) => s.rejectCode === 'over_limit')).toHaveLength(1);
    expect((await call<{ monthSessions: number }>('GET', '/api/usage', undefined, a.token)).data.monthSessions).toBe(6);
    expect((await call<Project[]>('GET', '/api/projects', undefined, a.token)).data[0].counts).toEqual({ total: 7, valid: 5 });
  });

  it('zapisuje tylko dozwolone pola, wymaga zgody 18+; status i powrót do kontroli jakości', async () => {
    const a = await account('pro');
    const p = await project(a.token);
    const [s] = webcam(1);
    const dirty = { ...s, name: 'Jan', email: 'jan@example.com', image: 'data:image/png;base64,AAAA', screener: { platform_tiktok: 'daily', note: 'wolny tekst' } };
    expect((await call('POST', `/api/study/${p.linkToken}/sessions`, dirty)).status).toBe(201);
    const stored = (await call<ViewerSession[]>('GET', `/api/projects/${p.id}/sessions`, undefined, a.token)).data[0] as unknown as Record<string, unknown>;
    expect(stored.name).toBeUndefined();
    expect(stored.email).toBeUndefined();
    expect(stored.image).toBeUndefined();
    expect(stored.screener).toEqual({ platform_tiktok: 'daily' });
    expect(errCode(await call('POST', `/api/study/${p.linkToken}/sessions`, { ...webcam(1)[0], consent: undefined }))).toBe('consent_required');
    expect(errCode(await call('POST', `/api/study/${p.linkToken}/sessions`, { ...webcam(1)[0], consent: { ...s.consent, adult: false } }))).toBe('adult_required');
    await call('PATCH', `/api/projects/${p.id}/sessions/${s.id}`, { status: 'rejected' }, a.token);
    expect((await call<ViewerSession[]>('GET', `/api/projects/${p.id}/sessions`, undefined, a.token)).data[0]).toMatchObject({ status: 'rejected', rejectCode: 'manual', manual: true });
    await call('PATCH', `/api/projects/${p.id}/sessions/${s.id}`, { status: 'valid' }, a.token);
    expect((await call<ViewerSession[]>('GET', `/api/projects/${p.id}/sessions`, undefined, a.token)).data[0]).toMatchObject({ status: 'valid', rejectCode: null });
  });

  it('kod usunięcia: zły kod 404, dobry usuwa, ponowne wysłanie nie zwraca kodu', async () => {
    const a = await account('pro');
    const p = await project(a.token);
    const [s] = webcam(1);
    const r = await call<{ sessionId: string; deletionCode: string }>('POST', `/api/study/${p.linkToken}/sessions`, s);
    expect(r.data.deletionCode).toMatch(/^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/);
    expect((await call<{ deletionCode: string }>('POST', `/api/study/${p.linkToken}/sessions`, s)).data.deletionCode).toBe('');
    const bad = await call('POST', `/api/sessions/${s.id}/delete`, { code: 'AAAA-BBBB' });
    expect([bad.status, errCode(bad)]).toEqual([404, 'bad_code']);
    expect((await call('POST', `/api/sessions/${s.id}/delete`, { code: r.data.deletionCode.toLowerCase() })).status).toBe(200);
    expect((await call<ViewerSession[]>('GET', `/api/projects/${p.id}/sessions`, undefined, a.token)).data).toHaveLength(0);
    expect((await call('POST', `/api/sessions/${s.id}/delete`, { code: r.data.deletionCode })).status).toBe(404);
  });

  it('import plików: sanitizacja, duplikaty i uszkodzone pominięte', async () => {
    const a = await account('pro');
    const p = await project(a.token);
    const ss = webcam(2);
    const r = await call('POST', `/api/projects/${p.id}/import`, { sessions: [...ss, ss[0], { kind: 'zły' }] }, a.token);
    expect(r.data).toEqual({ imported: 2, skipped: 2 });
  });

  it('retencja: sesje znikają po okresie przechowywania; krótszy okres obejmuje zebrane', async () => {
    const a = await account('pro');
    const p = await project(a.token);
    await call('POST', `/api/study/${p.linkToken}/sessions`, webcam(1)[0]);
    await call('PATCH', `/api/projects/${p.id}`, { retentionDays: 30 }, a.token);
    clock += 31 * DAY;
    // Token logowania też wygasł (30 dni) — logujemy się ponownie.
    expect((await call('GET', '/api/me', undefined, a.token)).status).toBe(401);
    const again = await call<{ token: string }>('POST', '/api/auth/login', { email: a.email, password: 'dlugie-haslo-123' });
    expect((await call<ViewerSession[]>('GET', `/api/projects/${p.id}/sessions`, undefined, again.data.token)).data).toHaveLength(0);
    expect(purge()).toBeGreaterThanOrEqual(1);
  });
});

describe('serwer: media z Range, link do raportu, zespoły', () => {
  it('wgranie i odtwarzanie z Range; zły typ 415, za duży 413; cudze media odrzucone', async () => {
    const a = await account('pro');
    const p = await project(a.token);
    const bytes = new Uint8Array(1000).map((_, i) => i % 256);
    const up = await call<MediaSource & { mediaId: string; url: string }>('POST', `/api/projects/${p.id}/media`, bytes, a.token, { 'Content-Type': 'video/mp4' });
    expect(up.status).toBe(201);
    expect(up.data).toMatchObject({ kind: 'hosted', mime: 'video/mp4', url: `/api/media/${up.data.mediaId}` });
    const part = await fetch(`${base}${up.data.url}`, { headers: { Range: 'bytes=10-19' } });
    expect(part.status).toBe(206);
    expect(part.headers.get('content-range')).toBe('bytes 10-19/1000');
    expect(part.headers.get('accept-ranges')).toBe('bytes');
    expect(part.headers.get('cross-origin-resource-policy')).toBe('cross-origin');
    expect(Array.from(new Uint8Array(await part.arrayBuffer()))).toEqual([10, 11, 12, 13, 14, 15, 16, 17, 18, 19]);
    expect((await fetch(`${base}${up.data.url}`, { headers: { Range: 'bytes=5000-' } })).status).toBe(416);
    expect((await call('POST', `/api/projects/${p.id}/media`, bytes, a.token, { 'Content-Type': 'application/x-msdownload' })).status).toBe(415);
    expect((await call('POST', `/api/projects/${p.id}/media`, new Uint8Array(1.5 * 1024 * 1024), a.token, { 'Content-Type': 'video/mp4' })).status).toBe(413);
    const patched = await call<Project>('PATCH', `/api/projects/${p.id}`, { variants: [{ ...p.variants[0], media: up.data }] }, a.token);
    expect(patched.data.variants[0].media).toEqual(up.data);
    const b = await account('pro');
    const pb = await project(b.token);
    const stolen = await call('PATCH', `/api/projects/${pb.id}`, { variants: [{ ...pb.variants[0], media: up.data }] }, b.token);
    expect([stolen.status, errCode(stolen)]).toEqual([400, 'bad_media']);
  });

  it('link do raportu: plan z shareLink, raport zbiorczy bez danych widzów, unieważnienie', async () => {
    const free = await account();
    const fp = await project(free.token);
    expect(errCode(await call('POST', `/api/projects/${fp.id}/share`, { days: 7 }, free.token))).toBe('feature_share');
    const a = await account('pro');
    const p = await project(a.token);
    for (const s of webcam(4)) await call('POST', `/api/study/${p.linkToken}/sessions`, s);
    const link = await call<{ token: string; expiresAt: string }>('POST', `/api/projects/${p.id}/share`, { days: 7 }, a.token);
    expect(link.status).toBe(201);
    expect((await call('GET', `/api/projects/${p.id}/share`, undefined, a.token)).data).toEqual({ active: true, expiresAt: link.data.expiresAt });
    const shared = await call<{ reports: Array<Record<string, unknown>>; project: Record<string, unknown> }>('GET', `/api/share/${link.data.token}?lang=en`);
    expect(shared.status).toBe(200);
    expect(shared.data.reports[0]).toMatchObject({ variantId: 'A', viewers: 4 });
    expect(shared.data.reports[0]).not.toHaveProperty('perViewer');
    expect(shared.data.reports[0]).not.toHaveProperty('states');
    const text = JSON.stringify(shared.data);
    expect(text).not.toMatch(/"ses_|"participantId"|"vx"|"tc"|linkToken/);
    await call('DELETE', `/api/projects/${p.id}/share`, undefined, a.token);
    const gone = await call('GET', `/api/share/${link.data.token}`);
    expect([gone.status, errCode(gone)]).toEqual([404, 'share_expired']);
    const again = await call<{ token: string }>('POST', `/api/projects/${p.id}/share`, { days: 7 }, a.token);
    clock += 8 * DAY;
    expect((await call('GET', `/api/share/${again.data.token}`)).status).toBe(404);
  });

  it('zespół: zaproszenie, rola edytora i widza, limit miejsc, usunięcie członka', async () => {
    const free = await account();
    expect(errCode(await call('POST', `/api/workspaces/${free.workspaceId}/invites`, { role: 'editor' }, free.token))).toBe('seats');
    const owner = await account('pro');
    const editor = await account();
    const viewer = await account();
    const inv = await call<{ token: string }>('POST', `/api/workspaces/${owner.workspaceId}/invites`, { role: 'editor' }, owner.token);
    expect(inv.status).toBe(201);
    expect((await call('GET', `/api/invites/${inv.data.token}`)).data).toMatchObject({ role: 'editor' });
    const joined = await call<{ workspaceId: string; role: string }>('POST', `/api/invites/${inv.data.token}/accept`, undefined, editor.token);
    expect(joined.data).toMatchObject({ workspaceId: owner.workspaceId, role: 'editor' });
    expect((await call('POST', `/api/invites/${inv.data.token}/accept`, undefined, viewer.token)).status).toBe(404);
    // Edytor tworzy projekt w zespole (limity planu właściciela), właściciel go widzi.
    const shared = await project(editor.token);
    expect(shared.workspaceId).toBe(owner.workspaceId);
    expect((await call<Project[]>('GET', '/api/projects', undefined, owner.token)).data.map((x) => x.id)).toContain(shared.id);
    const vinv = await call<{ token: string }>('POST', `/api/workspaces/${owner.workspaceId}/invites`, { role: 'viewer' }, owner.token);
    await call('POST', `/api/invites/${vinv.data.token}/accept`, undefined, viewer.token);
    expect((await call('POST', '/api/projects', projectInput(), viewer.token)).status).toBe(403);
    expect((await call('GET', `/api/projects/${shared.id}`, undefined, viewer.token)).status).toBe(200);
    expect((await call('POST', `/api/workspaces/${owner.workspaceId}/invites`, { role: 'editor' }, editor.token)).status).toBe(403);
    // Pro: 3 miejsca — czwarte zaproszenie odrzucone.
    expect(errCode(await call('POST', `/api/workspaces/${owner.workspaceId}/invites`, { role: 'editor' }, owner.token))).toBe('seats');
    const members = await call<Array<{ accountId: string; role: string }>>('GET', `/api/workspaces/${owner.workspaceId}/members`, undefined, editor.token);
    expect(members.data.map((m) => m.role).sort()).toEqual(['editor', 'owner', 'viewer']);
    expect(errCode(await call('DELETE', `/api/workspaces/${owner.workspaceId}/members/${owner.id}`, undefined, owner.token))).toBe('owner_fixed');
    await call('DELETE', `/api/workspaces/${owner.workspaceId}/members/${editor.id}`, undefined, owner.token);
    expect((await call<{ workspaceId: string }>('GET', '/api/me', undefined, editor.token)).data.workspaceId).toBe(editor.workspaceId);
    expect((await call('GET', `/api/projects/${shared.id}`, undefined, editor.token)).status).toBe(404);
  });

  it('usunięcie konta: projekty, sesje, linki i pliki znikają; członkowie wracają do swoich zespołów', async () => {
    const owner = await account('pro');
    const member = await account();
    const inv = await call<{ token: string }>('POST', `/api/workspaces/${owner.workspaceId}/invites`, { role: 'editor' }, owner.token);
    await call('POST', `/api/invites/${inv.data.token}/accept`, undefined, member.token);
    const p = await project(owner.token);
    await call('POST', `/api/study/${p.linkToken}/sessions`, webcam(1)[0]);
    const up = await call<{ mediaId: string }>('POST', `/api/projects/${p.id}/media`, new Uint8Array(100), owner.token, { 'Content-Type': 'video/webm' });
    const files = () => readdirSync(join(dir, 'media')).filter((f) => f.startsWith(up.data.mediaId));
    expect(files()).toHaveLength(1);
    expect((await call('DELETE', '/api/me', undefined, owner.token)).status).toBe(200);
    expect(files()).toHaveLength(0);
    expect(db.project(p.id)).toBeUndefined();
    expect((await call('GET', `/api/study/${p.linkToken}`)).data).toEqual({ ok: false, reason: 'not_found' });
    expect((await call<{ workspaceId: string; role: string }>('GET', '/api/me', undefined, member.token)).data).toMatchObject({ workspaceId: member.workspaceId, role: 'owner' });
  });
});

describe('serwer: nagłówki, CORS, statyka, usługi M7–M8', () => {
  it('CORS tylko dla adresu aplikacji, media publiczne; nagłówki bezpieczeństwa', async () => {
    const ok = await call('GET', '/api/health', undefined, undefined, { Origin: 'https://app.example' });
    expect(ok.headers.get('access-control-allow-origin')).toBe('https://app.example');
    expect(ok.headers.get('x-content-type-options')).toBe('nosniff');
    expect(ok.headers.get('permissions-policy')).toBe('camera=(self), microphone=()');
    const evil = await call('GET', '/api/health', undefined, undefined, { Origin: 'https://evil.example' });
    expect(evil.headers.get('access-control-allow-origin')).toBeNull();
    const pre = await fetch(`${base}/api/media/med_x`, { method: 'OPTIONS', headers: { Origin: 'https://other.example' } });
    expect(pre.headers.get('access-control-allow-origin')).toBe('*');
    expect(ok.data).toMatchObject({ ok: true, billing: false, ai: false });
  });

  it('statyka: pliki z hashem na rok, index bez cache, ścieżka poza katalog → index.html', async () => {
    const asset = await fetch(`${base}/assets/app-abc123.js`);
    expect(asset.headers.get('cache-control')).toBe('public, max-age=31536000, immutable');
    expect(asset.headers.get('content-type')).toContain('text/javascript');
    const index = await fetch(`${base}/`);
    expect(index.headers.get('cache-control')).toBe('no-cache');
    const escape = await fetch(`${base}/%2e%2e/secret.txt`);
    expect(await escape.text()).toContain('<title>app</title>');
    expect(existsSync(join(dir, 'secret.txt'))).toBe(true);
  });

  it('rekomendacje: Free 402, Pro — reguły bez klucza AI; płatności bez Stripe — 503', async () => {
    const free = await account();
    const fp = await project(free.token);
    expect(errCode(await call('POST', `/api/projects/${fp.id}/variants/A/insights`, { locale: 'pl' }, free.token))).toBe('feature_recommendations');
    const pro = await account('pro');
    const pp = await project(pro.token);
    expect((await call('POST', `/api/projects/${pp.id}/variants/A/insights`, { locale: 'pl' }, pro.token)).data).toMatchObject({ source: 'rules', model: null });
    const pay = await call('POST', '/api/billing/checkout', { plan: 'creator' }, pro.token);
    expect([pay.status, errCode(pay)]).toEqual([503, 'billing_unavailable']);
  });

  it('zamówienie panelu i administracja planów', async () => {
    const order = await call<{ id: string }>('POST', '/api/orders/panel', { company: 'Marka', contactEmail: 'kontakt@marka.pl', viewers: 50, ageBands: ['25-34', 'x'], notes: 'termin' });
    expect(order.status).toBe(201);
    const user = await account();
    expect((await call('GET', '/api/admin/orders', undefined, user.token)).status).toBe(403);
    const admin = await account('free', 'admin@example.com');
    const list = await call<Array<{ id: string; doc: { ageBands: string[] } }>>('GET', '/api/admin/orders', undefined, admin.token);
    expect(list.data.find((o) => o.id === order.data.id)?.doc.ageBands).toEqual(['25-34']);
    const set = await call<{ plan: string }>('POST', '/api/admin/plan', { email: user.email, plan: 'agency' }, admin.token);
    expect(set.data.plan).toBe('agency');
  });
});
