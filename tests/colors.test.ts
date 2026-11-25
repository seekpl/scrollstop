import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { blend, contrast, minSeriesDeltaE } from '../src/ui/colors';
import { SERIES, TOKENS } from '../src/ui/tokens';

describe('kolory (§19.1, §19.4)', () => {
  it('tokeny w CSS zgadzają się z tokens.ts', () => {
    const css = readFileSync('src/index.css', 'utf8');
    const kebab = (k: string) => k.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
    for (const [k, v] of Object.entries(TOKENS)) expect(css, k).toContain(`--color-${kebab(k)}: ${v};`);
    for (const [k, v] of Object.entries(SERIES)) expect(css, k).toContain(`--color-series-${k.toLowerCase()}: ${v};`);
  });

  it('tekst i statusy mają kontrast AA', () => {
    expect(contrast(TOKENS.ink, TOKENS.paper)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(TOKENS.muted, TOKENS.paper)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(TOKENS.muted, TOKENS.surface)).toBeGreaterThanOrEqual(4.5);
    expect(contrast('#ffffff', TOKENS.cobalt)).toBeGreaterThanOrEqual(4.5);
    expect(contrast('#ffffff', TOKENS.cobaltDark)).toBeGreaterThanOrEqual(4.5);
    for (const s of [TOKENS.good, TOKENS.fair, TOKENS.poor, TOKENS.cobalt]) {
      expect(contrast(s, TOKENS.surface), s).toBeGreaterThanOrEqual(4.5);
      // Tekst odznaki na tle 10% własnego koloru.
      expect(contrast(blend(s, 1, '#ffffff'), blend(s, 0.1, '#ffffff')), s).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('obramowania pól ≥ 3:1, znacznik nigdy jako tekst', () => {
    expect(contrast(TOKENS.field, TOKENS.surface)).toBeGreaterThanOrEqual(3);
    expect(contrast(TOKENS.marker, TOKENS.surface)).toBeLessThan(3);
  });

  it('kolory wersji: ≥ 3:1 na białym i rozróżnialne przy daltonizmie (ΔE00 ≥ 8)', () => {
    const colors = Object.values(SERIES);
    for (const c of colors) expect(contrast(c, TOKENS.surface), c).toBeGreaterThanOrEqual(3);
    const worst = minSeriesDeltaE(colors);
    expect(worst.value, `${worst.pair.join(' vs ')} (${worst.vision})`).toBeGreaterThanOrEqual(8);
  });
});
