import { describe, expect, it } from 'vitest';
import { FILLER_IDS, SLIDE_IDS, THUMB_IDS } from '../src/demo/demoScene';
import { carouselMetrics } from '../src/research/carousel';
import { feedFocus, feedMetrics, testedIndex } from '../src/research/feed';
import { simulateCarouselSessions, simulateFeedSessions, simulateGridSessions } from '../src/research/formatSim';
import { cellLooks, GRID_LAYOUTS, gridCells, gridMetrics } from '../src/research/grid';
import { GazeCode } from '../src/research/model';
import { sanitizeSession } from '../src/research/sanitize';
import { assessSession } from '../src/research/sessions';

const NOW = '2026-11-20T10:00:00.000Z';
const base = { projectId: 'prj_f', variantId: 'A' as const, createdAt: NOW };

describe('feed (§4.4, §6 pkt 7–11)', () => {
  const skipped = simulateFeedSessions({ ...base, tested: 'reel', fillers: FILLER_IDS, valid: 40, seed: 3, skip: 0.6, fillerSkip: 0.15 });
  const strong = simulateFeedSessions({ ...base, tested: 'reel_b', fillers: FILLER_IDS, valid: 40, seed: 4, skip: 0.1, fillerSkip: 0.15 });

  it('badany klip nigdy na pierwszej pozycji; wczesne przewinięcie nie odrzuca sesji', () => {
    for (const s of skipped) {
      const idx = testedIndex(s) as number;
      expect(idx).toBeGreaterThanOrEqual(1);
      expect(idx).toBeLessThanOrEqual(4);
      expect(s.items).toHaveLength(6);
    }
    expect(skipped.every((s) => s.status === 'valid')).toBe(true);
    expect(skipped.every((s) => assessSession(s).status === 'valid')).toBe(true);
  });

  it('zatrzymanie scrolla: słaby klip wyraźnie poniżej wypełniaczy, różnica istotna', () => {
    const m = feedMetrics(skipped, { stopSeconds: 2, duration: 15, bin: 0.5, includeSimulated: true });
    expect(m.viewers).toBe(40);
    expect(m.stop).not.toBeNull();
    expect(m.stop as number).toBeLessThan(m.fillerStop as number);
    expect(m.significant).toBe(true);
    expect(m.stopP as number).toBeLessThan(0.05);
    const good = feedMetrics(strong, { stopSeconds: 2, duration: 15, bin: 0.5, includeSimulated: true });
    expect(good.stop as number).toBeGreaterThan(m.stop as number);
    expect(good.gazeStop as number).toBeGreaterThan(m.gazeStop as number);
    expect(good.dwellMedian as number).toBeGreaterThan(m.dwellMedian as number);
  });

  it('retencja nie rośnie; momenty przewinięcia i pętle zgodne z wizytami', () => {
    const m = feedMetrics(skipped, { stopSeconds: 2, duration: 15, bin: 0.5, includeSimulated: true });
    for (let i = 1; i < m.retention.length; i++) expect(m.retention[i].value as number).toBeLessThanOrEqual(m.retention[i - 1].value as number);
    expect(m.retention[0].value).toBe(1);
    const firstSwipes = skipped.filter((s) => {
      const v = s.items!.find((x) => x.role === 'tested')!;
      return v.exitType === 'swipe_next' && v.loops === 0;
    }).length;
    expect(m.swipes.reduce((a, b) => a + b.n, 0)).toBe(firstSwipes);
    const loops = skipped.reduce((a, s) => a + s.items!.filter((x) => x.role === 'tested').reduce((b, v) => b + v.loops, 0), 0);
    expect(m.meanLoops).toBeCloseTo(loops / 40, 6);
  });

  it('feedFocus zostawia tylko próbki badanego klipu jako pozycję 0', () => {
    const s = skipped[0];
    const idx = testedIndex(s) as number;
    const f = feedFocus(s);
    expect(f.data.tc.length).toBe(s.data.it.filter((x) => x === idx).length);
    expect(new Set(f.data.it)).toEqual(new Set([0]));
  });
});

describe('miniatura w siatce (§4.5, §6 pkt 16)', () => {
  it('geometria układów: komórki w ekranie, bez nakładania', () => {
    for (const layout of GRID_LAYOUTS) {
      for (const aspect of [390 / 844, 1440 / 900]) {
        const cells = gridCells(layout, aspect);
        for (const c of cells) {
          expect(c.rect.x).toBeGreaterThanOrEqual(0);
          expect(c.rect.y).toBeGreaterThanOrEqual(0);
          expect(c.rect.x + c.rect.w).toBeLessThanOrEqual(1.0001);
          expect(c.rect.y + c.rect.h).toBeLessThanOrEqual(1.0001);
        }
        for (let i = 0; i < cells.length; i++)
          for (let j = i + 1; j < cells.length; j++) {
            const a = cells[i].rect;
            const b = cells[j].rect;
            const overlap = a.x < b.x + b.w - 1e-6 && b.x < a.x + a.w - 1e-6 && a.y < b.y + b.h - 1e-6 && b.y < a.y + a.h - 1e-6;
            expect(overlap).toBe(false);
          }
      }
    }
  });

  it('atrakcyjna miniatura: częściej i szybciej oglądana, indeks pozycji > 1, wybory sumują się', () => {
    const strong = simulateGridSessions({ ...base, tested: 'thumb_1', fillers: THUMB_IDS.slice(1), layout: 'yt_home', valid: 50, seed: 5, appeal: 3 });
    const weak = simulateGridSessions({ ...base, tested: 'thumb_2', fillers: THUMB_IDS.filter((x) => x !== 'thumb_2'), layout: 'yt_home', valid: 50, seed: 6, appeal: 0.4 });
    const s = gridMetrics(strong, { includeSimulated: true });
    const w = gridMetrics(weak, { includeSimulated: true });
    expect(s.viewers).toBe(50);
    expect(s.looked as number).toBeGreaterThan(w.looked as number);
    expect(s.dwellShare as number).toBeGreaterThan(w.dwellShare as number);
    expect(s.positionIndex as number).toBeGreaterThan(1);
    expect(w.positionIndex as number).toBeLessThan(1);
    expect(s.choice.tested + s.choice.other + s.choice.none).toBe(s.choice.asked);
    expect(s.choice.tested).toBeGreaterThan(w.choice.tested);
    expect(s.rank.reduce((a, b) => a + b, 0)).toBe(s.lookedCount);
  });

  it('pierwsze spojrzenie: co najmniej 3 kolejne próbki w komórce', () => {
    const [s] = simulateGridSessions({ ...base, tested: 'thumb_1', fillers: THUMB_IDS.slice(1), layout: 'profile_grid', valid: 1, seed: 9, appeal: 1 });
    const one = { ...s, data: { ...s.data, st: s.data.st.map(() => GazeCode.AWAY) } };
    expect(cellLooks(one).every((c) => c.firstLook === null)).toBe(true);
    expect(cellLooks(s).some((c) => c.firstLook !== null)).toBe(true);
  });
});

describe('karuzela (§4.6, §6 pkt 17)', () => {
  it('zasięg malejący, porzucenia i ukończenia sumują się do liczby widzów', () => {
    const ss = simulateCarouselSessions({ ...base, slides: SLIDE_IDS, valid: 60, seed: 8, continueProb: [0.9, 0.7, 0.8, 0.85] });
    const m = carouselMetrics(ss, { slides: 5, includeSimulated: true });
    expect(m.reach[0]).toBe(1);
    for (let i = 1; i < 5; i++) expect(m.reach[i]).toBeLessThanOrEqual(m.reach[i - 1]);
    expect(m.dropOff.reduce((a, b) => a + b, 0) + Math.round((m.completed as number) * m.viewers)).toBe(m.viewers);
    expect(m.timeMedian.every((t) => t === null || t > 1)).toBe(true);
    expect(m.attention[0] as number).toBeGreaterThan(0.5);
  });
});

describe('sanitizacja pozycji', () => {
  it('prostokąt komórki zostaje tylko z poprawnymi wartościami 0..1', () => {
    const [s] = simulateGridSessions({ ...base, tested: 'thumb_1', fillers: THUMB_IDS.slice(1), layout: 'yt_home', valid: 1, seed: 2, appeal: 1 });
    const items = s.items!.map((it, i) => (i === 0 ? { ...it, rect: { x: 2, y: 0, w: 0.1, h: 0.1 } } : it));
    const clean = sanitizeSession({ ...s, items }, { trustCreatedAt: true, now: Date.parse(NOW) + 1000 });
    expect(clean.items![0].rect).toBeUndefined();
    expect(clean.items![1].rect).toEqual(s.items![1].rect);
    expect(clean.choice).toEqual(s.choice);
  });
});
