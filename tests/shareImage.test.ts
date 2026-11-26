import { describe, expect, it } from 'vitest';
import { availableStats, shareSpecFor } from '../src/features/report/ShareImage';
import { drawShareImage, SHARE_SIZES, wrapText, type Ctx2D } from '../src/features/report/shareImage';
import { pl } from '../src/i18n/pl';
import { RESEARCH_TEXT } from '../src/i18n/research';
import { demoProject } from '../src/research/panelSim';
import { buildVariantReport } from '../src/research/report';

/** Atrapa kontekstu 2D: zapisuje teksty i prostokąty; szerokość tekstu ≈ 0,5 × rozmiar × znaki. */
function recorder() {
  const texts: Array<{ text: string; x: number; y: number; font: string }> = [];
  const rects: Array<{ x: number; y: number; w: number; h: number; fill: unknown }> = [];
  const state = { font: '10px sans', fillStyle: '#000' as unknown };
  const noop = () => undefined;
  const ctx = {
    get font() {
      return state.font;
    },
    set font(v: string) {
      state.font = v;
    },
    get fillStyle() {
      return state.fillStyle;
    },
    set fillStyle(v: unknown) {
      state.fillStyle = v;
    },
    strokeStyle: '#000',
    lineWidth: 1,
    textAlign: 'left',
    textBaseline: 'alphabetic',
    globalAlpha: 1,
    lineJoin: 'miter',
    lineCap: 'butt',
    fillRect: (x: number, y: number, w: number, h: number) => rects.push({ x, y, w, h, fill: state.fillStyle }),
    fillText: (text: string, x: number, y: number) => texts.push({ text, x, y, font: state.font }),
    measureText: (text: string) => ({ width: text.length * 0.5 * Number(/(\d+)px/.exec(state.font)?.[1] ?? 10) }),
    beginPath: noop,
    moveTo: noop,
    lineTo: noop,
    closePath: noop,
    fill: noop,
    stroke: noop,
    save: noop,
    restore: noop,
    translate: noop,
    rotate: noop,
    setLineDash: noop,
    bezierCurveTo: noop,
  } as unknown as Ctx2D;
  return { ctx, texts, rects };
}

const tx = RESEARCH_TEXT.pl;
const demo = demoProject('reel', tx, { valid: 31, createdAt: '2026-11-20T10:00:00.000Z' });
const report = buildVariantReport(demo.project, demo.project.variants[0], demo.sessions, tx, { includeSimulated: true });
const s = pl.report.share;

describe('grafika do udostępnienia (§7.1)', () => {
  it('dwa formaty: 1080×1350 (4:5) i 1080×1920 (9:16), tło na całe płótno', () => {
    expect(SHARE_SIZES).toEqual({ portrait: { w: 1080, h: 1350 }, story: { w: 1080, h: 1920 } });
    for (const format of ['portrait', 'story'] as const) {
      const { ctx, texts, rects } = recorder();
      drawShareImage(ctx, shareSpecFor(report, { format, stat: 'hook', title: 'Rolka o kawie', watermark: false }, s, 'ScrollStop Free'));
      expect(rects[0]).toMatchObject({ x: 0, y: 0, w: SHARE_SIZES[format].w, h: SHARE_SIZES[format].h });
      const all = texts.map((t) => t.text);
      expect(all).toContain('ScrollStop');
      expect(all).toContain('Rolka o kawie');
      expect(all).toContain('Zbadane w ScrollStop · scroll-stop.com');
      expect(all).toContain(s.hookLabel);
      expect(all).toContain(`${Math.round((report.hook.at3 ?? 0) * 100)}%`);
      // Wszystkie teksty mieszczą się na płótnie.
      for (const t of texts) expect(t.y).toBeLessThanOrEqual(SHARE_SIZES[format].h);
      expect(all).not.toContain('ScrollStop Free');
    }
  });

  it('tylko dane zbiorcze: największy spadek z przedziałem, średnia i liczba widzów; Free ze znakiem wodnym', () => {
    const spec = shareSpecFor(report, { format: 'portrait', stat: 'drop', title: null, watermark: true }, s, 'ScrollStop Free');
    const biggest = [...report.drops].sort((a, b) => b.delta - a.delta)[0];
    expect(spec.stat.value).toBe(`−${Math.round(biggest.delta * 100)} pp`);
    expect(spec.highlight).toEqual({ t0: biggest.start, t1: biggest.end });
    expect(spec.facts).toEqual([`Średnio patrzy ${Math.round((report.meanAttention ?? 0) * 100)}%`, '31 widzów']);
    expect(spec.curve).toHaveLength(report.curve.length);
    expect(JSON.stringify(spec)).not.toMatch(/ses_|p_[a-z0-9]{9}/);
    const { ctx, texts } = recorder();
    drawShareImage(ctx, spec);
    expect(texts.map((t) => t.text)).toContain('ScrollStop Free');
    expect(availableStats(report)).toEqual(['hook', 'mean', 'drop']);
  });

  it('zawijanie nazwy: najwyżej 2 wiersze, wielokropek', () => {
    const { ctx } = recorder();
    ctx.font = '700 40px sans';
    const lines = wrapText(ctx, 'Bardzo długa nazwa materiału, która nie zmieści się w jednym ani w dwóch wierszach grafiki do udostępnienia', 400, 2);
    expect(lines).toHaveLength(2);
    expect(lines[1].endsWith('…')).toBe(true);
    expect(wrapText(ctx, 'Krótka', 400, 2)).toEqual(['Krótka']);
  });
});
