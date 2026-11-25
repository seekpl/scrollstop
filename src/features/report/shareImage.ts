import { TOKENS } from '../../ui/tokens';

/**
 * Grafika do udostępnienia (§7.1): wykres uwagi i jedna liczba z raportu w formacie posta (4:5)
 * albo relacji (9:16). Wyłącznie dane zbiorcze — krzywa, średnie i największy spadek; nigdy dane
 * pojedynczych widzów. Free: znak wodny. Wszystkie teksty przychodzą ze słownika (`spec`).
 */
export type ShareFormat = 'portrait' | 'story';

export const SHARE_SIZES: Record<ShareFormat, { w: number; h: number }> = {
  portrait: { w: 1080, h: 1350 },
  story: { w: 1080, h: 1920 },
};

export interface ShareImageSpec {
  format: ShareFormat;
  /** Krzywa uwagi (0–1) w przedziałach czasu materiału. */
  curve: ReadonlyArray<{ t: number; value: number | null }>;
  duration: number;
  /** Główna liczba: etykieta, wartość i opcjonalny dopisek (np. przedział czasu). */
  stat: { label: string; value: string; detail: string | null };
  /** Krótkie fakty pod wykresem (np. „Średnio patrzy 78%”, „31 widzów”). */
  facts: string[];
  /** Nazwa materiału (opcjonalnie). */
  title: string | null;
  /** Podświetlony fragment wykresu (np. największy spadek). */
  highlight: { t0: number; t1: number } | null;
  axis: { start: string; end: string };
  brandName: string;
  /** „Zbadane w …” i domena. */
  footer: string;
  watermark: string | null;
  fontFamily: string;
}

/** Podzbiór kontekstu 2D, którego używamy (canvas w przeglądarce, atrapa w testach). */
export type Ctx2D = Pick<
  CanvasRenderingContext2D,
  | 'fillStyle'
  | 'strokeStyle'
  | 'lineWidth'
  | 'font'
  | 'textAlign'
  | 'textBaseline'
  | 'globalAlpha'
  | 'lineJoin'
  | 'lineCap'
  | 'fillRect'
  | 'fillText'
  | 'beginPath'
  | 'moveTo'
  | 'lineTo'
  | 'closePath'
  | 'fill'
  | 'stroke'
  | 'save'
  | 'restore'
  | 'translate'
  | 'rotate'
  | 'measureText'
  | 'setLineDash'
  | 'bezierCurveTo'
>;

const BG = TOKENS.ink;
const FG = '#ffffff';
const MARK = TOKENS.marker;
const DROP = '#eb6834';
const M = 80;

/** Zawija tekst do szerokości (najwyżej `lines` wierszy; ostatni skrócony wielokropkiem). */
export function wrapText(ctx: Pick<Ctx2D, 'measureText'>, text: string, width: number, lines: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const out: string[] = [];
  let line = '';
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (ctx.measureText(next).width <= width || !line) line = next;
    else {
      out.push(line);
      line = w;
    }
  }
  if (line) out.push(line);
  if (out.length <= lines) return out;
  const kept = out.slice(0, lines);
  let last = kept[lines - 1];
  while (last.length > 1 && ctx.measureText(`${last}…`).width > width) last = last.slice(0, -1);
  kept[lines - 1] = `${last.trimEnd()}…`;
  return kept;
}

function roundRect(ctx: Ctx2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.bezierCurveTo(x + w, y, x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.bezierCurveTo(x + w, y + h, x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.bezierCurveTo(x, y + h, x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.bezierCurveTo(x, y, x, y, x + r, y);
  ctx.closePath();
}

/** Znak marki (kadr z krzywą, jak favicon) w kwadracie `s` px. */
function brandMark(ctx: Ctx2D, x: number, y: number, s: number) {
  const k = s / 64;
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = FG;
  ctx.lineWidth = 3.5 * k;
  roundRect(ctx, 20 * k, 9 * k, 24 * k, 46 * k, 5 * k);
  ctx.stroke();
  ctx.strokeStyle = MARK;
  ctx.lineWidth = 4 * k;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(14 * k, 26 * k);
  ctx.bezierCurveTo(20 * k, 26 * k, 22 * k, 28 * k, 26 * k, 28 * k);
  ctx.bezierCurveTo(30 * k, 28 * k, 31 * k, 38 * k, 35 * k, 38 * k);
  ctx.bezierCurveTo(39 * k, 38 * k, 41 * k, 34 * k, 50 * k, 34 * k);
  ctx.stroke();
  ctx.restore();
}

/** Rysuje całą grafikę; płótno musi mieć rozmiar `SHARE_SIZES[spec.format]`. */
export function drawShareImage(ctx: Ctx2D, spec: ShareImageSpec): void {
  const { w, h } = SHARE_SIZES[spec.format];
  const story = spec.format === 'story';
  const font = (weight: number, px: number) => `${weight} ${px}px ${spec.fontFamily}`;
  const inner = w - 2 * M;
  ctx.save();
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, w, h);
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';

  // Nagłówek: znak i nazwa marki. Relacja: treść poza górnym i dolnym pasem, który zasłania aplikacja.
  let y = story ? 230 : M;
  brandMark(ctx, M, y, 72);
  ctx.fillStyle = FG;
  ctx.font = font(650, 44);
  ctx.fillText(spec.brandName, M + 92, y + 50);
  y += 72 + (story ? 90 : 56);

  // Nazwa materiału (opcjonalnie).
  if (spec.title) {
    ctx.font = font(560, 44);
    ctx.globalAlpha = 0.82;
    for (const line of wrapText(ctx, spec.title, inner, 2)) {
      y += 50;
      ctx.fillText(line, M, y);
    }
    ctx.globalAlpha = 1;
    y += story ? 70 : 44;
  }

  // Główna liczba.
  ctx.font = font(560, 40);
  ctx.globalAlpha = 0.75;
  y += 40;
  ctx.fillText(spec.stat.label, M, y);
  ctx.globalAlpha = 1;
  ctx.font = font(700, story ? 210 : 176);
  y += story ? 200 : 170;
  ctx.fillText(spec.stat.value, M - 6, y);
  if (spec.stat.detail) {
    ctx.font = font(560, 40);
    ctx.globalAlpha = 0.75;
    // Odstęp na wydłużenia liter dużej liczby (np. „pp”).
    y += story ? 100 : 86;
    ctx.fillText(spec.stat.detail, M, y);
    ctx.globalAlpha = 1;
  }

  // Wykres uwagi 0–100% z podświetlonym fragmentem.
  const footerY = h - (story ? 340 : M);
  const factsH = spec.facts.length ? 90 : 0;
  const chartTop = y + (story ? 110 : 70);
  const chartBottom = footerY - 70 - factsH - 56;
  const chartH = Math.max(160, chartBottom - chartTop);
  const labelW = 110;
  const cx0 = M + labelW;
  const cw = inner - labelW;
  const dur = Math.max(spec.duration, 1e-6);
  const px = (t: number) => cx0 + (Math.min(Math.max(t, 0), dur) / dur) * cw;
  const py = (v: number) => chartTop + (1 - v) * chartH;
  if (spec.highlight) {
    ctx.fillStyle = DROP;
    ctx.globalAlpha = 0.4;
    ctx.fillRect(px(spec.highlight.t0), chartTop, Math.max(6, px(spec.highlight.t1) - px(spec.highlight.t0)), chartH);
    ctx.globalAlpha = 1;
  }
  ctx.strokeStyle = FG;
  ctx.lineWidth = 2;
  ctx.font = font(560, 30);
  ctx.textAlign = 'right';
  for (const v of [0, 0.5, 1]) {
    ctx.globalAlpha = 0.22;
    ctx.beginPath();
    ctx.moveTo(cx0, py(v));
    ctx.lineTo(cx0 + cw, py(v));
    ctx.stroke();
    ctx.globalAlpha = 0.7;
    ctx.fillStyle = FG;
    ctx.fillText(`${Math.round(v * 100)}%`, cx0 - 18, py(v) + 10);
  }
  ctx.globalAlpha = 1;
  ctx.textAlign = 'left';
  ctx.fillStyle = FG;
  ctx.globalAlpha = 0.7;
  ctx.fillText(spec.axis.start, cx0, chartTop + chartH + 46);
  ctx.textAlign = 'right';
  ctx.fillText(spec.axis.end, cx0 + cw, chartTop + chartH + 46);
  ctx.globalAlpha = 1;
  ctx.textAlign = 'left';

  // Krzywa: ciągłe odcinki (przerwa tam, gdzie brak danych), wypełnienie pod spodem.
  const runs: Array<Array<{ x: number; y: number }>> = [];
  let run: Array<{ x: number; y: number }> = [];
  for (const p of spec.curve) {
    if (p.value === null) {
      if (run.length) runs.push(run);
      run = [];
      continue;
    }
    run.push({ x: px(p.t), y: py(Math.min(1, Math.max(0, p.value))) });
  }
  if (run.length) runs.push(run);
  for (const r of runs) {
    ctx.fillStyle = FG;
    ctx.globalAlpha = 0.08;
    ctx.beginPath();
    ctx.moveTo(r[0].x, py(0));
    r.forEach((p) => ctx.lineTo(p.x, p.y));
    ctx.lineTo(r[r.length - 1].x, py(0));
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = MARK;
    ctx.lineWidth = 9;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.beginPath();
    r.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.stroke();
  }

  // Fakty pod wykresem.
  if (spec.facts.length) {
    ctx.font = font(600, 40);
    ctx.fillStyle = FG;
    ctx.fillText(spec.facts.join('   ·   '), M, chartTop + chartH + 46 + factsH);
  }

  // Stopka.
  ctx.globalAlpha = 0.25;
  ctx.fillRect(M, footerY - 58, inner, 2);
  ctx.globalAlpha = 0.85;
  ctx.font = font(560, 34);
  ctx.fillText(spec.footer, M, footerY);
  ctx.globalAlpha = 1;

  // Znak wodny (Free).
  if (spec.watermark) {
    ctx.save();
    ctx.translate(w / 2, h / 2);
    ctx.rotate((-28 * Math.PI) / 180);
    ctx.globalAlpha = 0.1;
    ctx.fillStyle = FG;
    ctx.textAlign = 'center';
    ctx.font = font(800, 150);
    ctx.fillText(spec.watermark, 0, 50);
    ctx.restore();
  }
  ctx.restore();
}
