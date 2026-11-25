import { describe, expect, it } from 'vitest';
import { LocalResearchApi } from '../src/api/local';
import { MemoryLocalStore } from '../src/api/localStore';
import type { NewProject } from '../src/api/types';
import { RESEARCH_TEXT } from '../src/i18n/research';
import { decodeStudyConfig, encodeStudyConfig, newDeletionCode, normalizeCode } from '../src/research/link';
import { demoProject } from '../src/research/panelSim';

const tx = RESEARCH_TEXT.pl;
const input = (patch: Partial<NewProject> = {}): NewProject => ({
  name: 'Rolka',
  creatorName: 'Studio',
  kind: 'abn',
  platform: 'tiktok',
  audio: 'off',
  context: 'fullscreen',
  platformUi: 'none',
  targetDevice: 'mobile',
  variants: [
    { media: { kind: 'demo', demo: 'reel' }, mediaName: 'A', duration: 15, width: 1080, height: 1920 },
    { media: { kind: 'demo', demo: 'reel_b' }, mediaName: 'B', duration: 15, width: 1080, height: 1920 },
  ],
  questions: ['finish'],
  audience: { source: 'community', ageBands: ['18-24', '25-34'], countries: [], screenPlatforms: false },
  locale: 'pl',
  ...patch,
});

/** Sesja z kamerą (dobra kalibracja) z symulacji — jak od prawdziwego widza. */
function webcamSessions(n: number, projectId = 'x') {
  return demoProject('reel', tx, { valid: n }).sessions.slice(0, n).map((s) => ({ ...s, projectId, source: 'webcam' as const, calibration: { quality: 'GOOD' as const, xPct: 5, yPct: 6, points: 9 } }));
}

describe('link samowystarczalny i kod usunięcia (§12.4–§12.5)', () => {
  it('kodowanie i dekodowanie konfiguracji; materiał lokalny i uszkodzony link jako kody', async () => {
    const api = new LocalResearchApi(new MemoryLocalStore(), { plan: 'pro' });
    const p = await api.createProject(input());
    const r = await api.study(p.linkToken);
    if (!r.ok) throw new Error('study');
    const back = decodeStudyConfig(encodeStudyConfig(r.config));
    expect(back).toMatchObject({ projectId: p.id, transport: 'package', creatorName: 'Studio', locale: 'pl', variant: { id: 'A', media: { kind: 'demo', demo: 'reel' } } });
    expect(() => decodeStudyConfig('%%%')).toThrow(/link_broken/);
    expect(() => decodeStudyConfig(encodeStudyConfig({ ...r.config, variant: { ...r.config.variant, media: { kind: 'local', fileName: 'a.mp4', fileSize: 1 } } }))).toThrow(/local_media/);
    expect(() => decodeStudyConfig(btoa(JSON.stringify({ projectId: 'p' })))).toThrow(/link_incomplete/);
  });

  it('kod usunięcia: 8 znaków bez mylących, format XXXX-XXXX', () => {
    for (let i = 0; i < 50; i++) {
      const c = newDeletionCode();
      expect(c).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{4}-[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{4}$/);
    }
    expect(normalizeCode(' k7qm-4xpa ')).toBe('K7QM4XPA');
  });
});

describe('tryb lokalny: badanie i sesje widzów', () => {
  it('przydział wersji: najmniej sesji, przy remisie A→D', async () => {
    const api = new LocalResearchApi(new MemoryLocalStore(), { plan: 'pro' });
    const p = await api.createProject(input());
    const ids: string[] = [];
    for (const s of webcamSessions(4, p.id)) {
      const r = await api.study(p.linkToken);
      if (!r.ok) throw new Error('study');
      ids.push(r.config.variant.id);
      await api.submitSession(p.linkToken, { ...s, variantId: r.config.variant.id });
    }
    expect(ids).toEqual(['A', 'B', 'A', 'B']);
  });

  it('wysłanie sesji daje kod usunięcia; zły kod → bad_code; ponowne wysłanie bez kodu', async () => {
    const api = new LocalResearchApi(new MemoryLocalStore(), { plan: 'pro' });
    const p = await api.createProject(input());
    const [s] = webcamSessions(1, p.id);
    const r = await api.submitSession(p.linkToken, s);
    expect(r.deletionCode).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
    expect(r.status).toBe('valid');
    expect((await api.submitSession(p.linkToken, s)).deletionCode).toBe('');
    await expect(api.deleteSessionByCode(r.sessionId, 'AAAA-AAAA')).rejects.toMatchObject({ code: 'bad_code', status: 404 });
    await api.deleteSessionByCode(r.sessionId, r.deletionCode.toLowerCase());
    expect(await api.listSessions(p.id)).toHaveLength(0);
  });

  it('wymagana zgoda 18+ i tylko dozwolone pola', async () => {
    const api = new LocalResearchApi(new MemoryLocalStore(), { plan: 'pro' });
    const p = await api.createProject(input());
    const [s] = webcamSessions(1, p.id);
    await expect(api.submitSession(p.linkToken, { ...s, consent: { ...s.consent, adult: false as unknown as true } })).rejects.toMatchObject({ code: 'adult_required' });
    const r = await api.submitSession(p.linkToken, { ...s, ...({ email: 'x@y.pl' } as object) });
    const [stored] = await api.listSessions(p.id);
    expect(r.status).toBe('valid');
    expect((stored as unknown as Record<string, unknown>).email).toBeUndefined();
  });

  it('plan Free: 1 aktywny projekt i 5 widzów w projekcie; link wstrzymany przed zgodą; symulacja się nie liczy', async () => {
    const api = new LocalResearchApi(new MemoryLocalStore());
    const p = await api.createProject(input());
    // Free ma jedną wersję.
    expect(p.variants).toHaveLength(1);
    await expect(api.createProject(input())).rejects.toMatchObject({ code: 'active_projects', status: 402 });
    for (const s of webcamSessions(5, p.id)) await api.submitSession(p.linkToken, s);
    expect(await api.study(p.linkToken)).toEqual({ ok: false, reason: 'project_sessions' });
    const sim = demoProject('reel', tx, { valid: 1 }).sessions[0];
    expect((await api.importSessions(p.id, [{ ...sim, id: 'ses_simulated_x' }])).imported).toBe(1);
    expect((await api.usage()).monthSessions).toBe(5);
  });

  it('import plików: duplikaty i uszkodzone pliki pominięte, kontrola jakości', async () => {
    const api = new LocalResearchApi(new MemoryLocalStore(), { plan: 'pro' });
    const p = await api.createProject(input());
    const ss = webcamSessions(3, p.id);
    const r = await api.importSessions(p.id, [...ss, ss[0], { kind: 'zły' }, { ...ss[1], id: 'ses_poor', calibration: { quality: 'POOR', xPct: 20, yPct: 22, points: 9 } }]);
    expect(r).toEqual({ imported: 4, skipped: 2 });
    const poor = (await api.listSessions(p.id)).find((s) => s.id === 'ses_poor');
    expect(poor).toMatchObject({ status: 'rejected', rejectCode: 'poor_calibration' });
    await api.setSessionStatus(p.id, ss[0].id, 'rejected');
    expect((await api.listSessions(p.id)).find((s) => s.id === ss[0].id)).toMatchObject({ status: 'rejected', rejectCode: 'manual', manual: true });
    await api.setSessionStatus(p.id, ss[0].id, 'valid');
    expect((await api.listSessions(p.id)).find((s) => s.id === ss[0].id)).toMatchObject({ status: 'valid', rejectCode: null });
  });

  it('retencja: sesje po terminie znikają automatycznie; zamknięte badanie nie przyjmuje widzów', async () => {
    let now = Date.parse('2026-11-20T10:00:00Z');
    const api = new LocalResearchApi(new MemoryLocalStore(), { plan: 'pro', now: () => now });
    const p = await api.createProject(input({ retentionDays: 30 }));
    for (const s of webcamSessions(2, p.id)) await api.submitSession(p.linkToken, s);
    expect(await api.listSessions(p.id)).toHaveLength(2);
    now += 31 * 86_400_000;
    expect(await api.listSessions(p.id)).toHaveLength(0);
    await api.updateProject(p.id, { status: 'closed' });
    expect(await api.study(p.linkToken)).toEqual({ ok: false, reason: 'closed' });
    expect(await api.study('nie-ma')).toEqual({ ok: false, reason: 'not_found' });
  });
});
