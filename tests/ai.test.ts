// @vitest-environment node
import { mkdtempSync, rmSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createClaudeGenerator, type InsightsGenerator, type MessagesClient } from '../server/ai';
import { createApp } from '../server/app';
import { Db } from '../server/db';
import { RESEARCH_TEXT } from '../src/i18n/research';
import { AI_OUTPUT_SCHEMA, AI_SYSTEM_PROMPT, buildAiInput, forbiddenIn, validateAiInsights, type AiInput, type AiInsight } from '../src/research/aiContract';
import type { Project, ViewerSession } from '../src/research/model';
import { demoProject } from '../src/research/panelSim';
import { buildVariantReport, type VariantReport } from '../src/research/report';

const tx = RESEARCH_TEXT.pl;
const demo = demoProject('reel', tx, { valid: 31, createdAt: '2026-11-20T10:00:00.000Z' });
const variant = demo.project.variants[0];
const report: VariantReport = buildVariantReport(demo.project, variant, demo.sessions, tx, { includeSimulated: true });
const input: AiInput = buildAiInput(report, { projectName: 'Rolka', kind: 'video', platform: 'tiktok', vertical: true });
const drop = input.drops[0];

/** Wniosek zbudowany wyłącznie z liczb wejścia (jak powinien odpowiadać model). */
const good = (patch: Partial<AiInsight> = {}): AiInsight => ({
  title: `Spadek o ${drop.deltaPp} pp (${drop.from}–${drop.to})`,
  fact: `Między ${drop.from} a ${drop.to} odsetek patrzących spada z ${drop.fromPct}% do ${drop.toPct}%.`,
  observation: 'Spadek zaczyna się zaraz po cięciu.',
  hypothesis: 'Możliwe, że nowe ujęcie nie ma punktu zaczepienia dla wzroku.',
  recommendation: 'Otwórz scenę mocniej: zbliżenie albo krótki napis w pierwszej sekundzie ujęcia.',
  t0: 1,
  t1: 3,
  ...patch,
});

describe('kontrakt AI: wejście (§8.4)', () => {
  it('tylko metryki zbiorcze: bez identyfikatorów sesji, widzów i surowych próbek', () => {
    const json = JSON.stringify(input);
    expect(report.viewers).toBe(31);
    expect(input.material).toMatchObject({ viewers: 31, sampleLevel: report.level, durationSeconds: Math.round(report.duration) });
    expect(input.drops.length).toBeGreaterThan(0);
    for (const s of demo.sessions) {
      expect(json).not.toContain(s.id);
      expect(json).not.toContain(s.participantId);
    }
    expect(json).not.toMatch(/perViewer|states|"tc"|"vx"|consent|ageBand|screener/);
    expect(input.curve.attentionPct.every((v) => v === null || (Number.isInteger(v) && v >= 0 && v <= 100))).toBe(true);
  });

  it('schemat odpowiedzi: wszystkie pola wymagane, bez dodatkowych', () => {
    const item = AI_OUTPUT_SCHEMA.properties.insights.items;
    expect(item.additionalProperties).toBe(false);
    expect([...item.required].sort()).toEqual(Object.keys(item.properties).sort());
    expect(AI_SYSTEM_PROMPT).toMatch(/wyłącznie liczb z danych/);
  });
});

describe('kontrakt AI: walidacja odpowiedzi (§8.4)', () => {
  it('przyjmuje wniosek z liczbami z danych (także z przecinkiem i z czasów)', () => {
    const r = validateAiInsights({ insights: [good()] }, report, input);
    expect(r).toEqual({ insights: [good()], rejected: 0 });
  });

  it('odrzuca liczby spoza danych i liczy odrzucone', () => {
    const r = validateAiInsights({ insights: [good(), good({ fact: 'Uwaga spada o 73,4 pp, 977 widzów odpada.' })] }, report, input);
    expect(r.insights).toHaveLength(1);
    expect(r.rejected).toBe(1);
  });

  it('odrzuca diagnozy, emocje widzów, obietnice zasięgu i stereotypy (pl i en)', () => {
    const bad = [
      'Widzowie są znudzeni tą sceną.',
      'Viewers get bored here.',
      'Ta zmiana gwarantuje więcej wyświetleń.',
      'This will go viral.',
      'Kobiety wolą krótsze ujęcia.',
      'Young people never watch intros.',
      'Wygląda na objawy ADHD u widzów.',
    ];
    for (const text of bad) expect(forbiddenIn(text), text).not.toBeNull();
    expect(forbiddenIn('Skróć scenę i dodaj zbliżenie na produkt.')).toBeNull();
    const r = validateAiInsights({ insights: bad.map((recommendation) => good({ recommendation })) }, report, input);
    expect(r).toEqual({ insights: [], rejected: bad.length });
  });

  it('limity: najwyżej 6 wniosków, długość tytułu i tekstu, czasy w zakresie materiału, kształt', () => {
    const many = validateAiInsights({ insights: Array.from({ length: 8 }, () => good()) }, report, input);
    expect(many.insights).toHaveLength(6);
    expect(many.rejected).toBe(2);
    const r = validateAiInsights(
      { insights: [good({ title: 'x'.repeat(161) }), good({ recommendation: 'y'.repeat(601) }), good({ t0: 5, t1: 2 }), good({ t1: report.duration + 30 }), { title: 'brak pól' }, null] },
      report,
      input,
    );
    expect(r).toEqual({ insights: [], rejected: 6 });
    expect(validateAiInsights({ nothing: true }, report, input)).toEqual({ insights: [], rejected: 0 });
  });
});

/** Atrapa klienta Messages API: zapisuje parametry i zwraca przygotowaną odpowiedź. */
function fakeClient(reply: (params: Record<string, unknown>) => unknown) {
  const calls: Array<Record<string, unknown>> = [];
  const client = {
    beta: {
      messages: {
        create: async (params: Record<string, unknown>) => {
          calls.push(params);
          const out = reply(params);
          if (out instanceof Error) throw out;
          return out;
        },
      },
    },
  } as unknown as MessagesClient;
  return { client, calls };
}

const message = (body: unknown, stop_reason = 'end_turn', model = 'claude-opus-5-5') => ({
  model,
  stop_reason,
  content: [
    { type: 'thinking', thinking: '', signature: 'sig' },
    { type: 'text', text: typeof body === 'string' ? body : JSON.stringify(body) },
  ],
});

describe('generator rekomendacji (Claude, §8.4)', () => {
  it('zapytanie: model z konfiguracji, ustrukturyzowany JSON, średni wysiłek, model zapasowy przy odmowie', async () => {
    const { client, calls } = fakeClient(() => message({ insights: [good()] }));
    const gen = createClaudeGenerator({ apiKey: 'test', client, log: () => undefined });
    const r = await gen.generate(report, input, 'en');
    expect(r).toEqual({ source: 'ai', model: 'claude-opus-5-5', insights: [good()], rejected: 0 });
    const p = calls[0];
    expect(p).toMatchObject({ model: 'claude-opus-5-5', max_tokens: 16000, betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default', output_config: { effort: 'medium', format: { type: 'json_schema' } }, system: AI_SYSTEM_PROMPT });
    expect(p).not.toHaveProperty('thinking');
    const user = (p.messages as Array<{ content: string }>)[0].content;
    expect(user).toMatch(/^Język odpowiedzi: English \(en\)\.\nMetryki badania \(JSON\):\n\{/);
    // Model bez automatycznego zapasu (np. ustawiony w AI_MODEL) — bez tych pól.
    const other = fakeClient(() => message({ insights: [good()] }, 'end_turn', 'claude-haiku-5-5'));
    await createClaudeGenerator({ apiKey: 'test', model: 'claude-haiku-5-5', client: other.client, log: () => undefined }).generate(report, input, 'pl');
    expect(other.calls[0]).not.toHaveProperty('fallbacks');
    expect(other.calls[0].model).toBe('claude-haiku-5-5');
  });

  it('odmowa, max_tokens, zły JSON, błąd połączenia, same odrzucone propozycje → wnioski z reguł', async () => {
    const rulesCount = report.findings.filter((f) => f.recommendation).length;
    const cases: Array<[unknown, number]> = [
      [message({ insights: [] }, 'refusal'), 0],
      [message('{"insights": [', 'max_tokens'), 0],
      [message('to nie JSON'), 0],
      [new Error('ECONNRESET'), 0],
      [message({ insights: [good({ fact: 'Spadek o 987 pp.' })] }), 1],
    ];
    for (const [reply, rejected] of cases) {
      const { client } = fakeClient(() => reply);
      const r = await createClaudeGenerator({ apiKey: 'test', client, log: () => undefined }).generate(report, input, 'pl');
      expect(r.source).toBe('rules');
      expect(r.model).toBeNull();
      expect(r.insights).toHaveLength(rulesCount);
      expect(r.rejected).toBe(rejected);
    }
  });
});

describe('serwer: rekomendacje (plan, pamięć podręczna, limit, reguły bez AI)', () => {
  let dir: string;
  let db: Db;
  const servers: Server[] = [];
  let calls = 0;
  const generator: InsightsGenerator = {
    model: 'claude-opus-5-5',
    async generate(r) {
      calls++;
      return { source: 'ai', model: 'claude-opus-5-5', insights: [{ title: 'AI', fact: `Patrzy ${Math.round((r.meanAttention ?? 0) * 100)}%`, observation: null, hypothesis: null, recommendation: 'Skróć intro.', t0: 0, t1: 1 }], rejected: 0 };
    },
  };

  async function start(ai: InsightsGenerator | null) {
    const app = createApp(db, { dataDir: dir, appUrl: 'https://app.example/', origins: [], adminEmails: [], maxVideoMb: 1, maxImageMb: 1, trustProxy: false, staticDir: null, ai });
    const s = createServer((req, res) => void app.handler(req, res));
    await new Promise<void>((r) => s.listen(0, '127.0.0.1', r));
    servers.push(s);
    return `http://127.0.0.1:${(s.address() as AddressInfo).port}`;
  }
  const call = async <T>(b: string, method: string, path: string, body?: unknown, token?: string) => {
    const res = await fetch(b + path, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) });
    return { status: res.status, data: (await res.json()) as T };
  };
  let n = 0;
  async function account(b: string, plan: 'free' | 'pro') {
    const r = await call<{ token: string; account: { id: string } }>(b, 'POST', '/api/auth/register', { email: `ai${++n}@example.com`, password: 'dlugie-haslo-123', name: 'X', company: '' });
    if (plan !== 'free') db.updateAccount(r.data.account.id, { plan, plan_status: 'active' });
    return r.data.token;
  }
  async function projectWithSessions(b: string, token: string) {
    const p = (await call<Project>(b, 'POST', '/api/projects', { name: 'Rolka', creatorName: 'Studio', kind: 'video', platform: 'tiktok', audio: 'off', targetDevice: 'mobile', variants: [{ media: { kind: 'demo', demo: 'reel_b' }, mediaName: 'Rolka', duration: 15, width: 1080, height: 1920 }], questions: [], audience: { source: 'community', ageBands: ['18-24'] }, locale: 'pl' }, token)).data;
    const sessions: ViewerSession[] = demoProject('reel', tx, { valid: 12, createdAt: new Date().toISOString() }).sessions.slice(0, 12).map((s, i) => ({ ...s, id: `ses_ai${n}x${i}`, variantId: 'A', source: 'webcam', calibration: { quality: 'GOOD', xPct: 5, yPct: 6, points: 9 } }));
    for (const s of sessions) await call(b, 'POST', `/api/study/${p.linkToken}/sessions`, s);
    return p;
  }

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'attn-ai-'));
    db = new Db(join(dir, 'test.sqlite'));
  });
  afterAll(() => {
    servers.forEach((s) => s.close());
    db.close();
    rmSync(dir, { recursive: true, force: true });
  });

  it('Free 402; Pro z AI — wynik z modelu raz, potem z pamięci; bez AI — reguły', async () => {
    const withAi = await start(generator);
    expect((await call<{ ai: boolean }>(withAi, 'GET', '/api/health')).data.ai).toBe(true);
    const free = await account(withAi, 'free');
    const fp = await projectWithSessions(withAi, free);
    expect((await call<{ error: { code: string } }>(withAi, 'POST', `/api/projects/${fp.id}/variants/A/insights`, { locale: 'pl' }, free)).data.error.code).toBe('feature_recommendations');

    const pro = await account(withAi, 'pro');
    const p = await projectWithSessions(withAi, pro);
    const first = await call<{ source: string; insights: AiInsight[] }>(withAi, 'POST', `/api/projects/${p.id}/variants/A/insights`, { locale: 'pl' }, pro);
    expect(first.data.source).toBe('ai');
    const again = await call<{ source: string }>(withAi, 'POST', `/api/projects/${p.id}/variants/A/insights`, { locale: 'pl' }, pro);
    expect(again.data).toEqual(first.data);
    expect(calls).toBe(1);
    // Inny język to inne wejście dla modelu — nowe zapytanie.
    await call(withAi, 'POST', `/api/projects/${p.id}/variants/A/insights`, { locale: 'en' }, pro);
    expect(calls).toBe(2);
    expect((await call(withAi, 'POST', `/api/projects/${p.id}/variants/Z/insights`, {}, pro)).status).toBe(404);

    const noAi = await start(null);
    expect((await call<{ ai: boolean }>(noAi, 'GET', '/api/health')).data.ai).toBe(false);
    const rules = await call<{ source: string; model: null; insights: AiInsight[] }>(noAi, 'POST', `/api/projects/${p.id}/variants/A/insights`, { locale: 'pl' }, pro);
    expect(rules.data).toMatchObject({ source: 'rules', model: null });
  });

  it('limit 30 zapytań do modelu na godzinę na konto (odpowiedzi z pamięci się nie liczą)', async () => {
    const always: InsightsGenerator = { model: 'm', generate: async (r) => ({ source: 'rules', model: null, insights: [], rejected: r.viewers }) };
    const b = await start(always);
    const pro = await account(b, 'pro');
    const p = await projectWithSessions(b, pro);
    const statuses: number[] = [];
    for (let i = 0; i < 31; i++) statuses.push((await call(b, 'POST', `/api/projects/${p.id}/variants/A/insights`, { locale: 'pl' }, pro)).status);
    expect(statuses.slice(0, 30).every((s) => s === 200)).toBe(true);
    expect(statuses[30]).toBe(429);
  });
});
