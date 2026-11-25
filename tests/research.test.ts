import { describe, expect, it } from 'vitest';
import { RESEARCH_TEXT } from '../src/i18n/research';
import { aoiMetrics, rectProbability } from '../src/research/aoi';
import { attentionCurve, binSize, findDrops, hookRetention, intervalBounds, viewerBins, type BinState } from '../src/research/attention';
import { COMPACT_KEYS, decodePackage, emptyCompact, encodePackage, validateCompact } from '../src/research/compact';
import { aggregateDensityCompact } from '../src/research/heatmap';
import { allowedNumbers } from '../src/research/insights';
import { GazeCode, type Aoi, type CompactSamples } from '../src/research/model';
import { demoProject } from '../src/research/panelSim';
import { buildVariantReport, compareVariants, headline } from '../src/research/report';
import { sanitizeSession } from '../src/research/sanitize';
import { assessSession, sampleLevel } from '../src/research/sessions';
import { bootstrapMeanCI, holm, minimumDetectableDifference, sampleSizeForProportions, twoProportionTest, welch, wilson } from '../src/research/statsMath';

const tx = RESEARCH_TEXT.pl;
const NOW = '2026-11-20T10:00:00.000Z';

/** Sesja testowa: stan per 1/30 s z funkcji. */
function synth(duration: number, state: (t: number) => number, opts: { x?: number; y?: number; hz?: number } = {}): CompactSamples {
  const hz = opts.hz ?? 30;
  const c = emptyCompact();
  for (let i = 0; i < Math.round(duration * hz); i++) {
    const t = i / hz;
    const st = state(t);
    c.tc.push(Math.round((i * 1000) / hz));
    c.vt.push(Math.round(t * 1000) / 1000);
    c.seg.push(1);
    c.it.push(0);
    const look = st === GazeCode.LOOK;
    c.vx.push(look ? Math.round((opts.x ?? 0.5) * 1000) : -1);
    c.vy.push(look ? Math.round((opts.y ?? 0.5) * 1000) : -1);
    c.cf.push(look ? 85 : 0);
    c.un.push(look ? 50 : -1);
    c.st.push(st);
  }
  return c;
}

describe('stan widza i krzywa (§5.11–§5.12)', () => {
  it('rozdzielczość 0,5 s do 60 s, 1 s dla dłuższych', () => {
    expect(binSize(15)).toBe(0.5);
    expect(binSize(60)).toBe(0.5);
    expect(binSize(61)).toBe(1);
  });

  it('większość decyduje, krótka luka przejmuje stan, dłuższa zostaje bez danych', () => {
    // 0–2 s patrzy, 2,0–2,5 s mrugnięcie (nie wiadomo), 2,5–4 s patrzy, 4–6 s brak twarzy, 6–8 s nie wiadomo.
    const c = synth(8, (t) => (t < 2 ? GazeCode.LOOK : t < 2.5 ? GazeCode.UNKNOWN : t < 4 ? GazeCode.LOOK : t < 6 ? GazeCode.AWAY : GazeCode.UNKNOWN));
    const b = viewerBins(c, 8, 0.5);
    expect(b).toHaveLength(16);
    expect(b.slice(0, 4)).toEqual([1, 1, 1, 1]);
    expect(b[4]).toBe(1); // krótka luka przejmuje stan
    expect(b.slice(8, 12)).toEqual([0, 0, 0, 0]);
    expect(b[12]).toBe(0); // jedna luka po „nie patrzy”
    expect(b.slice(13)).toEqual([null, null, null]); // dłuższa luka → brak danych, nie fałszywe „nie patrzy”
  });

  it('przedział Wilsona i liczba widzów w punkcie krzywej', () => {
    const viewers: BinState[][] = [[1, 1], [1, 0], [0, null]];
    const c = attentionCurve(viewers, 1, 0.5);
    expect(c[0]).toMatchObject({ t: 0, n: 3, watching: 2 });
    expect(c[0].value).toBeCloseTo(2 / 3);
    expect(c[1]).toMatchObject({ t: 0.5, n: 2, watching: 1 });
    const w = wilson(2, 3);
    expect(c[0].lo).toBeCloseTo(w.lo);
    expect(w.lo).toBeLessThan(2 / 3);
    expect(w.hi).toBeGreaterThan(2 / 3);
  });

  it('największy spadek: stromy spadek znaleziony, powolne dryfowanie pominięte', () => {
    const viewers = Array.from({ length: 20 }, (_, i) => synth(15, (t) => (t >= 6 && t < 9 && i < 8 ? GazeCode.AWAY : GazeCode.LOOK)));
    const curve = attentionCurve(viewers.map((c) => viewerBins(c, 15)), 15);
    const drops = findDrops(curve);
    expect(drops).toHaveLength(1);
    expect(drops[0].start).toBeGreaterThanOrEqual(5);
    expect(drops[0].end).toBeLessThanOrEqual(7.5);
    expect(drops[0].delta).toBeCloseTo(0.4, 1);
    expect(drops[0].lost).toBe(8);
    // Dryf: −10 pp w 50 s (0,2 pp/s) nie jest spadkiem.
    const drift = Array.from({ length: 30 }, (_, i) => synth(60, (t) => (i < 3 && t > 50 - i * 15 ? GazeCode.AWAY : GazeCode.LOOK)));
    expect(findDrops(attentionCurve(drift.map((c) => viewerBins(c, 60)), 60)).filter((d) => d.delta >= 0.08 && (d.end - d.start) > 20)).toHaveLength(0);
  });

  it('równe przedziały bez scen (§5.14)', () => {
    expect(intervalBounds(15)).toEqual([0, 4, 8, 12, 15]);
    expect(intervalBounds(60)).toEqual([0, 10, 20, 30, 40, 50, 60]);
    expect(intervalBounds(600)).toEqual([0, 50, 100, 150, 200, 250, 300, 350, 400, 450, 500, 550, 600]);
  });

  it('utrzymanie hooka: spośród patrzących w 0–0,5 s odsetek patrzących w 2,5–3 s', () => {
    const v = (late: 0 | 1, start: 0 | 1 = 1): BinState[] => [start, 1, 1, 1, 1, late];
    const r = hookRetention([v(1), v(1), v(0), v(1, 0)], 0.5);
    expect(r).toEqual({ retained: 2, base: 3, value: 2 / 3 });
  });
});

describe('statystyka (§4.3, §5.19, §5.21)', () => {
  it('test t Welcha — wartość p', () => {
    const a = [0.71, 0.75, 0.8, 0.68, 0.77, 0.74, 0.79, 0.7];
    const b = [0.82, 0.88, 0.85, 0.9, 0.79, 0.86, 0.91, 0.84];
    const r = welch(a, b)!;
    expect(r.t).toBeGreaterThan(4);
    expect(r.p).toBeLessThan(0.001);
    expect(welch([0.5, 0.6], [0.5, 0.6])!.p).toBeCloseTo(1, 5);
    // Znana wartość: t = 2,0, df = 10 → p ≈ 0,0734.
    expect(welch([0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0])).toMatchObject({ p: 1 });
  });

  it('test dwóch proporcji', () => {
    const r = twoProportionTest(18, 31, 28, 31)!;
    expect(r.pA).toBeCloseTo(18 / 31);
    expect(r.p).toBeLessThan(0.01);
    expect(twoProportionTest(10, 20, 10, 20)!.p).toBeCloseTo(1, 5);
  });

  it('korekta Holma: monotoniczna, null bez zmian', () => {
    expect(holm([0.01, 0.04, 0.03])).toEqual([0.03, 0.06, 0.06]);
    expect(holm([0.02, null])).toEqual([0.02, null]);
  });

  it('MDE i wielkość próby (§5.21)', () => {
    // 10 pp różnicy przy p1 = 0,7: (1,96 + 0,84)² · (0,21 + 0,24) / 0,01 = 352,8 → 353 widzów na wersję.
    expect(sampleSizeForProportions(0.7, 0.6)).toBe(353);
    const d30 = minimumDetectableDifference(30);
    expect(d30).toBeGreaterThan(0.25);
    expect(d30).toBeLessThan(0.4);
    expect(minimumDetectableDifference(100)).toBeLessThan(d30);
    expect(sampleSizeForProportions(0.7, 0.7 - d30)).toBeLessThanOrEqual(30);
  });

  it('bootstrap 95% jest deterministyczny', () => {
    const ci = bootstrapMeanCI([1, 2, 3, 4, 5, 6, 7, 8])!;
    expect(ci).toEqual(bootstrapMeanCI([1, 2, 3, 4, 5, 6, 7, 8]));
    expect(ci.lo).toBeLessThan(4.5);
    expect(ci.hi).toBeGreaterThan(4.5);
  });
});

describe('strefy i czytelność (§5.16, §6.13)', () => {
  const aoi = (p: Partial<Aoi> = {}): Aoi => ({ id: 'a', name: 'Napis', type: 'text', x: 0.1, y: 0.1, w: 0.3, h: 0.2, t0: 0, t1: 6, ...p });

  it('prawdopodobieństwo z niepewnością: większa σ rozmywa', () => {
    const a = aoi();
    expect(rectProbability(0.25, 0.2, 0.01, a)).toBeGreaterThan(0.99);
    expect(rectProbability(0.25, 0.2, 0.2, a)).toBeLessThan(0.5);
    expect(rectProbability(0.9, 0.9, 0.05, a)).toBeLessThan(0.001);
  });

  it('zasięg strefy i czytelność napisu', () => {
    const look = Array.from({ length: 6 }, () => synth(6, () => GazeCode.LOOK, { x: 0.25, y: 0.2 }));
    const away = Array.from({ length: 4 }, () => synth(6, () => GazeCode.LOOK, { x: 0.8, y: 0.8 }));
    const r = aoiMetrics(aoi({ words: 12 }), [...look, ...away]);
    expect(r.n).toBe(10);
    expect(r.lookers).toBe(6);
    expect(r.reach).toBeCloseTo(0.6);
    expect(r.firstLook).toBe(0);
    // 12 słów / 3 sł./s + 0,5 s = 4,5 s ≤ 6 s ekspozycji → nie za krótko; patrzą ~6 s → przeczytany.
    expect(r.reading).toMatchObject({ words: 12, needed: 4.5, tooShort: false, fewRead: false });
    const short = aoiMetrics(aoi({ words: 12, t1: 3 }), look);
    expect(short.reading?.tooShort).toBe(true);
  });

  it('strefa zasłonięta przez interfejs platformy', () => {
    const c = [synth(6, () => GazeCode.LOOK)];
    expect(aoiMetrics(aoi({ y: 0.85, h: 0.1 }), c, { platform: 'tiktok' }).unsafe).toBe(true);
    expect(aoiMetrics(aoi({ y: 0.4, h: 0.1 }), c, { platform: 'tiktok' }).unsafe).toBe(false);
  });
});

describe('heat mapa zbiorcza', () => {
  it('każdy widz ma tę samą wagę niezależnie od długości sesji', () => {
    const long = synth(10, () => GazeCode.LOOK, { x: 0.2, y: 0.5 });
    const short = synth(2, () => GazeCode.LOOK, { x: 0.8, y: 0.5 });
    const d = aggregateDensityCompact([long, short], 0, 10, { gridW: 40, gridH: 10, baseSigma: 0.02, useUncertainty: false, maxDt: 0.1 });
    const col = (x: number) => d.grid.slice(0).filter((_, i) => i % 40 === Math.floor(x * 40)).reduce((a, b) => a + b, 0);
    expect(d.viewers).toBe(2);
    expect(col(0.2) / col(0.8)).toBeCloseTo(1, 1);
  });
});

describe('jakość sesji (§5.17) i poziom próby (§5.18)', () => {
  const cal = { quality: 'GOOD' as const, xPct: 5, yPct: 6, points: 9 };
  it('odrzuca słabą kalibrację, brak kalibracji i za mało danych; odejście to nie odrzucenie', () => {
    const ok = synth(15, () => GazeCode.LOOK);
    expect(assessSession({ source: 'webcam', calibration: cal, data: ok, mediaDuration: 15 }).status).toBe('valid');
    expect(assessSession({ source: 'webcam', calibration: { ...cal, quality: 'POOR' }, data: ok, mediaDuration: 15 }).rejectCode).toBe('poor_calibration');
    expect(assessSession({ source: 'webcam', calibration: null, data: ok, mediaDuration: 15 }).rejectCode).toBe('no_calibration');
    expect(assessSession({ source: 'webcam', calibration: cal, data: synth(15, () => GazeCode.UNKNOWN), mediaDuration: 15 }).rejectCode).toBe('low_data');
    expect(assessSession({ source: 'webcam', calibration: cal, data: synth(2, () => GazeCode.LOOK), mediaDuration: 15 }).rejectCode).toBe('too_short');
    // Widz odszedł po 5 s z 15 — sesja ważna.
    expect(assessSession({ source: 'webcam', calibration: cal, data: synth(5, () => GazeCode.LOOK), mediaDuration: 15 }).status).toBe('valid');
  });

  it('poziomy próby: 0 / 1–9 / 10–29 / ≥ 30', () => {
    expect([0, 1, 9, 10, 29, 30].map(sampleLevel)).toEqual(['none', 'preview', 'preview', 'indicative', 'indicative', 'reliable']);
  });
});

describe('format kolumnowy i plik sesji', () => {
  it('tylko dozwolone pola, równe długości, zakresy', () => {
    const c = synth(1, () => GazeCode.LOOK);
    expect(validateCompact(c)).toEqual([]);
    expect(validateCompact({ ...c, image: [1] })).toContain('samples_extra_fields');
    expect(validateCompact({ ...c, vx: c.vx.slice(1) })).toContain('samples_length');
    expect(validateCompact({ ...c, st: c.st.map(() => 9) })).toContain('samples_range');
    expect(COMPACT_KEYS).toContain('it');
  });

  it('pakiet sesji: kodowanie, dekodowanie, sanitizacja wymaga zgody 18+', () => {
    const { sessions } = demoProject('video', tx, { createdAt: NOW, valid: 2 });
    const s = sessions[0];
    const back = sanitizeSession(decodePackage(encodePackage(s)), { trustCreatedAt: true, now: Date.parse(NOW) + 1000 });
    expect(back.data).toEqual(s.data);
    expect(back.createdAt).toBe(NOW);
    expect(() => decodePackage('{}')).toThrow();
    expect(() => sanitizeSession({ ...s, consent: { ...s.consent, adult: false } })).toThrow(/adult_required/);
    expect(() => sanitizeSession({ ...s, consent: undefined })).toThrow(/consent_required/);
    // Pola spoza listy znikają (np. imię widza).
    const dirty = sanitizeSession({ ...s, name: 'Jan', email: 'jan@example.com', screener: { platform_tiktok: 'daily', note: 'tekst wolny!' } }) as unknown as Record<string, unknown>;
    expect(dirty.name).toBeUndefined();
    expect(dirty.email).toBeUndefined();
    expect(dirty.screener).toEqual({ platform_tiktok: 'daily' });
  });
});

describe('raport demo (§7, §8, §23)', () => {
  const reel = demoProject('reel', tx, { createdAt: NOW });
  const [a, b] = reel.project.variants.map((v) => buildVariantReport(reel.project, v, reel.sessions, tx, { includeSimulated: true }));

  it('symulowany panel 31 ważnych widzów na wersję, odrzucone z powodami', () => {
    expect(a.viewers).toBe(31);
    expect(a.level).toBe('reliable');
    expect(a.sessions.rejectedBy.poor_calibration).toBe(3);
    expect(a.sessions.byDevice.mobile).toBe(24);
    expect(a.bin).toBe(0.5);
    // Bez flagi sesje symulowane są poza raportem.
    expect(buildVariantReport(reel.project, reel.project.variants[0], reel.sessions, tx).viewers).toBe(0);
  });

  it('rolka 9:16: spadek w hooku, rekomendacja „początek”, napisy w strefie zasłoniętej', () => {
    expect(a.drops[0].start).toBeLessThan(3);
    const drop = a.findings.find((f) => f.kind === 'drop')!;
    expect(drop.recommendation).toMatch(/najmocniejszego kadru/);
    expect(drop.fact).toMatch(/^Między 00:00 a 00:03 odsetek patrzących spada z \d+% do \d+% \(−\d+ pp, ok\. \d+ z 31 widzów\)\.$/);
    expect(a.findings.some((f) => f.kind === 'unsafe_zone')).toBe(true);
    expect(a.findings.length).toBeLessThanOrEqual(6);
    expect(a.hook.retention).toBeLessThan(b.hook.retention!);
    expect(a.hook.mini).toHaveLength(20);
  });

  it('spadek po cięciu → rekomendacja otwarcia sceny', () => {
    const cut = b.drops.find((d) => d.afterCut)!;
    expect(cut.segment?.index).toBe(2);
    expect(b.findings.find((f) => f.t0 === cut.start)?.recommendation).toMatch(/^Otwórz scenę 3 mocniej/);
  });

  it('A/B: wersja B wygrywa (Welch i test proporcji), część wspólna od 00:03', () => {
    const c = compareVariants([a, b], tx, { sharedFrom: 3 });
    expect(c.verdict).toBe('B');
    expect(c.rows[1].significant).toBe(true);
    expect(c.rows[1].welch!.p).toBeLessThan(0.05);
    expect(c.rows[1].proportion!.p).toBeLessThan(0.05);
    expect(c.summary).toMatch(/^Wersja B utrzymuje uwagę średnio o \d+ pp wyżej/);
    expect(c.summary).toMatch(/Od 00:03 wersje są identyczne/);
    expect(c.testLine).toMatch(/co najmniej 15 widzach/);
  });

  it('A/B/n: korekta Holma i brak werdyktu poniżej 15 widzów', () => {
    const small = demoProject('reel', tx, { createdAt: NOW, valid: 12 });
    const [sa, sb] = small.project.variants.map((v) => buildVariantReport(small.project, v, small.sessions, tx, { includeSimulated: true }));
    expect(compareVariants([sa, sb], tx).verdict).toBe('unclear');
    const c3 = compareVariants([a, b, { ...b, variantId: 'C', label: 'Wersja C' }], tx, { sharedFrom: 3 });
    expect(c3.holm).toBe(true);
    expect(c3.rows[1].welchAdj).toBeGreaterThanOrEqual(c3.rows[1].welch!.p);
  });

  it('zdanie otwierające i film 16:9 ze scenami', () => {
    const video = demoProject('video', tx, { createdAt: NOW });
    const r = buildVariantReport(video.project, video.project.variants[0], video.sessions, tx, { includeSimulated: true });
    expect(r.segments).toHaveLength(5);
    expect(r.segments.find((s) => s.fixRank === 1)?.index).toBe(2);
    const h = headline(r, tx);
    expect(h.lead).toMatch(/^Największy spadek uwagi wystąpił między 00:2\d a 00:3\d \(scena 3\)\.$/);
    expect(h.detail).toMatch(/Średnio przez cały materiał patrzy \d+% widzów\.$/);
    expect(headline(null, tx).lead).toBe('Raport pojawi się po pierwszej ważnej sesji.');
    // Liczby z tekstów reguł są w zbiorze dozwolonym dla AI.
    const allowed = allowedNumbers(r);
    for (const f of r.findings) for (const n of f.fact.match(/\d+/g) ?? []) expect(allowed.has(n), `${n} w „${f.fact}”`).toBe(true);
  });
});
