import { describe, expect, it } from 'vitest';
import { detectFixations } from '../src/core/analysis/fixations';
import { pathWindow } from '../src/core/analysis/gazePath';
import { detectCuts, histDistance, rgbHistogram } from '../src/core/analysis/scenes';
import { attentionTimeline, computeStats } from '../src/core/analysis/stats';
import { generateDemoSession } from '../src/demo/simulator';
import { DEMO_SPECS, demoTargetAt } from '../src/demo/demoScene';
import { cluster, makeSample } from './helpers';

describe('fixacje', () => {
  it('wykrywa skupienia wzroku z poprawnym czasem i miejscem', () => {
    const s = [...cluster(3.2, 4.8, 0.42, 0.31, 0.006), ...cluster(4.9, 6.0, 0.8, 0.7, 0.006, 9)];
    const f = detectFixations(s);
    expect(f.length).toBe(2);
    expect(f[0].x).toBeCloseTo(0.42, 1);
    expect(f[0].y).toBeCloseTo(0.31, 1);
    expect(f[0].start).toBeCloseTo(3.2, 1);
    expect(f[0].duration).toBeGreaterThan(1.4);
    expect(f[1].x).toBeCloseTo(0.8, 1);
  });

  it('nie znajduje fixacji w losowym błądzeniu wzroku', () => {
    let seed = 5;
    const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const s = Array.from({ length: 150 }, (_, i) => {
      const x = r();
      const y = r();
      return makeSample({ t: i / 30, x, y, vx: x, vy: y });
    });
    expect(detectFixations(s).length).toBe(0);
  });

  it('krótkie mrugnięcie nie przerywa fixacji, długa przerwa tak', () => {
    const a = cluster(0, 1, 0.5, 0.5);
    const b = cluster(1.08, 2, 0.5, 0.5, 0.005, 6);
    expect(detectFixations([...a, ...b]).length).toBe(1);
    const c = cluster(1.5, 2.5, 0.5, 0.5, 0.005, 6);
    expect(detectFixations([...a, ...c]).length).toBe(2);
  });
});

describe('statystyki i oś uwagi', () => {
  it('liczy czas, udział ważnych próbek i dominujący obszar', () => {
    const s = [...cluster(0, 6, 0.8, 0.5), ...cluster(6, 8, 0.2, 0.5, 0.005, 2)];
    s.push(makeSample({ t: 8.1, x: null, y: null, flags: ['no_face'], faceDetected: false }));
    const st = computeStats(s);
    expect(st.dominantRegion).toBe('right');
    expect(st.regionShares.right).toBeGreaterThan(0.7);
    expect(st.watchedSeconds).toBeGreaterThan(7.5);
    expect(st.longestStreakSeconds).toBeGreaterThan(7.5);
    expect(st.nValid).toBe(s.length - 1);
  });

  it('oś czasu: puste przedziały mają wartość null zamiast fałszywej „uwagi”', () => {
    const s = [...cluster(0, 3, 0.5, 0.5), ...cluster(5, 6, 0.5, 0.5)];
    const bins = attentionTimeline(s, 6, 1);
    expect(bins).toHaveLength(6);
    expect(bins[0].estimated).toBeGreaterThan(0.8);
    expect(bins[3].estimated).toBeNull();
  });

  it('ścieżka wzroku zawiera tylko punkty z wybranego okna', () => {
    const s = cluster(0, 30, 0.5, 0.5);
    const p = pathWindow(s, 20, 5);
    expect(p.every((q) => q.t > 15 && q.t <= 20)).toBe(true);
    expect(p.length).toBeGreaterThan(140);
  });
});

describe('wykrywanie scen', () => {
  it('znajduje cięcia przy dużej zmianie histogramu', () => {
    const solid = (r: number, g: number, b: number) => {
      const d = new Uint8ClampedArray(64 * 4);
      for (let i = 0; i < d.length; i += 4) d.set([r, g, b, 255], i);
      return rgbHistogram(d);
    };
    const A = solid(120, 200, 240);
    const B = solid(240, 160, 110);
    expect(histDistance(A, A)).toBe(0);
    expect(histDistance(A, B)).toBeCloseTo(1, 5);
    const hists = Array.from({ length: 40 }, (_, i) => ({ t: i * 0.5, h: i < 24 ? A : B }));
    const scenes = detectCuts(hists, 20);
    expect(scenes).toHaveLength(2);
    expect(scenes[1].start).toBe(12);
    expect(scenes[1].end).toBe(20);
  });
});

describe('demo mode', () => {
  it('symulowany wzrok podąża za scenariuszem rolki (hook u góry, twarz, produkt, CTA)', () => {
    const reel = DEMO_SPECS.reel_b;
    expect(demoTargetAt(1, reel).key).toBe('hook');
    expect(demoTargetAt(4, reel).key).toBe('face');
    expect(demoTargetAt(7, reel)).toMatchObject({ key: 'product', x: 0.7, y: 0.6 });
    expect(demoTargetAt(13, reel).key).toBe('cta');
    // Słaby hook (wersja A): plansza z logo przez pierwsze 1,5 s.
    expect(demoTargetAt(0.5, DEMO_SPECS.reel).key).toBe('background');
    const s = generateDemoSession(DEMO_SPECS.video);
    expect(s.samples.length).toBe(1800);
    expect(s.meta.scenes).toHaveLength(5);
    const st = computeStats(s.samples);
    expect(st.validRatio).toBeGreaterThan(0.85);
    expect(st.validRatio).toBeLessThan(1);
    expect(detectFixations(s.samples).length).toBeGreaterThan(5);
  });
});
