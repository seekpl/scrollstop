/**
 * Klipy demo rysowane proceduralnie na canvasie (§23) — bez licencji, deterministyczne (ta sama
 * klatka dla tego samego czasu). Napisy to „pseudotekst” (paski słów), więc klipy działają
 * w każdym języku interfejsu. Każdy klip ma strefy zainteresowania (do raportów przykładowych)
 * i funkcję celu wzroku (do symulacji widzów).
 */
import type { AoiType } from '../research/model';

export type DemoId =
  | 'reel'
  | 'reel_b'
  | 'video'
  | 'filler_1'
  | 'filler_2'
  | 'filler_3'
  | 'filler_4'
  | 'filler_5'
  | 'thumb_1'
  | 'thumb_2'
  | 'thumb_3'
  | 'thumb_4'
  | 'thumb_5'
  | 'thumb_6'
  | 'slide_1'
  | 'slide_2'
  | 'slide_3'
  | 'slide_4'
  | 'slide_5';

export const DEMO_IDS: DemoId[] = ['reel', 'reel_b', 'video', 'filler_1', 'filler_2', 'filler_3', 'filler_4', 'filler_5', 'thumb_1', 'thumb_2', 'thumb_3', 'thumb_4', 'thumb_5', 'thumb_6', 'slide_1', 'slide_2', 'slide_3', 'slide_4', 'slide_5'];
export const FILLER_IDS: DemoId[] = ['filler_1', 'filler_2', 'filler_3', 'filler_4', 'filler_5'];
export const THUMB_IDS: DemoId[] = ['thumb_1', 'thumb_2', 'thumb_3', 'thumb_4', 'thumb_5', 'thumb_6'];
/** Karuzela demo 4:5: okładka, trzy plansze z tekstem i wykresem, plansza z CTA. */
export const SLIDE_IDS: DemoId[] = ['slide_1', 'slide_2', 'slide_3', 'slide_4', 'slide_5'];

/** Strefa demo: `key` tłumaczony przy budowie projektu demo (słownik `research.demo.aoi`). */
export interface DemoAoi {
  key: 'face' | 'hook' | 'captions' | 'product' | 'logo' | 'cta' | 'chart' | 'title';
  type: AoiType;
  x: number;
  y: number;
  w: number;
  h: number;
  t0: number;
  t1: number;
  words?: number;
}

export interface GazeTarget {
  x: number;
  y: number;
  /** Strefa, na którą patrzy uważny widz (do symulacji). */
  key: DemoAoi['key'] | 'background';
}

export interface DemoSpec {
  id: DemoId;
  kind: 'video' | 'image';
  duration: number;
  w: number;
  h: number;
  /** Początki scen (z 0). */
  cuts: number[];
  aois: DemoAoi[];
  /** Hook: od tej sekundy wersje są identyczne (§4.2). */
  sharedFrom?: number;
  draw(ctx: CanvasRenderingContext2D, t: number, w: number, h: number): void;
  target(t: number): GazeTarget;
}

// ——— pomocnicze ———

const TAU = Math.PI * 2;

function rr(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const k = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + k, y);
  ctx.arcTo(x + w, y, x + w, y + h, k);
  ctx.arcTo(x + w, y + h, x, y + h, k);
  ctx.arcTo(x, y + h, x, y, k);
  ctx.arcTo(x, y, x + w, y, k);
  ctx.closePath();
}

function gradient(ctx: CanvasRenderingContext2D, w: number, h: number, top: string, bottom: string): void {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, top);
  g.addColorStop(1, bottom);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

/** Pseudotekst: wiersze „słów” jako zaokrąglone paski (bez konkretnego języka). */
function pseudoText(ctx: CanvasRenderingContext2D, x: number, y: number, maxW: number, lineH: number, words: number[], color: string, seed = 1): void {
  ctx.fillStyle = color;
  let cx = x;
  let cy = y;
  const gap = lineH * 0.35;
  for (let i = 0; i < words.length; i++) {
    const ww = words[i] * lineH * 0.55 * (0.85 + 0.3 * (((seed * 9301 + i * 49297) % 233280) / 233280));
    if (cx + ww > x + maxW && cx > x) {
      cx = x;
      cy += lineH * 1.25;
    }
    rr(ctx, cx, cy, ww, lineH * 0.72, lineH * 0.2);
    ctx.fill();
    cx += ww + gap;
  }
}

/** Stylizowany prowadzący: głowa (środek cx, cy, promień r), włosy, oczy, usta „mówiące”, tułów. */
function presenter(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, t: number, opts: { skin?: string; hair?: string; shirt?: string; talking?: boolean } = {}): void {
  const skin = opts.skin ?? '#E8B796';
  const hair = opts.hair ?? '#3B2A20';
  const shirt = opts.shirt ?? '#24324F';
  // tułów
  ctx.fillStyle = shirt;
  ctx.beginPath();
  ctx.ellipse(cx, cy + r * 2.55, r * 1.75, r * 1.45, 0, Math.PI, 0);
  ctx.lineTo(cx + r * 1.75, cy + r * 4);
  ctx.lineTo(cx - r * 1.75, cy + r * 4);
  ctx.fill();
  // szyja
  ctx.fillStyle = skin;
  ctx.fillRect(cx - r * 0.33, cy + r * 0.7, r * 0.66, r * 0.8);
  // głowa
  ctx.beginPath();
  ctx.ellipse(cx, cy, r * 0.86, r, 0, 0, TAU);
  ctx.fill();
  // włosy
  ctx.fillStyle = hair;
  ctx.beginPath();
  ctx.ellipse(cx, cy - r * 0.45, r * 0.92, r * 0.62, 0, Math.PI, 0);
  ctx.fill();
  // oczy (mrugają co ~3,7 s)
  const blink = t % 3.7 < 0.12;
  ctx.fillStyle = '#1F2A44';
  for (const dx of [-0.32, 0.32]) {
    ctx.beginPath();
    ctx.ellipse(cx + dx * r, cy - r * 0.05, r * 0.1, blink ? r * 0.02 : r * 0.12, 0, 0, TAU);
    ctx.fill();
  }
  // usta
  const open = opts.talking === false ? 0.04 : 0.05 + 0.13 * Math.abs(Math.sin(t * 9.1) * Math.sin(t * 3.7));
  ctx.fillStyle = '#8C3B3B';
  ctx.beginPath();
  ctx.ellipse(cx, cy + r * 0.45, r * 0.26, r * open, 0, 0, TAU);
  ctx.fill();
}

/** Produkt w dłoni: butelka z etykietą (strefa logo). */
function product(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, accent: string): void {
  ctx.fillStyle = '#E8B796';
  ctx.beginPath();
  ctx.ellipse(x, y + s * 1.05, s * 0.55, s * 0.32, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = '#F4F6F9';
  rr(ctx, x - s * 0.42, y - s * 0.9, s * 0.84, s * 1.9, s * 0.18);
  ctx.fill();
  ctx.fillStyle = '#1F2A44';
  rr(ctx, x - s * 0.18, y - s * 1.2, s * 0.36, s * 0.36, s * 0.06);
  ctx.fill();
  ctx.fillStyle = accent;
  rr(ctx, x - s * 0.42, y - s * 0.3, s * 0.84, s * 0.62, s * 0.06);
  ctx.fill();
  // „logo” na etykiecie
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(x, y, s * 0.17, 0, TAU);
  ctx.fill();
}

function logoMark(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, accent: string): void {
  ctx.fillStyle = accent;
  rr(ctx, x - s, y - s, s * 2, s * 2, s * 0.45);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(x, y, s * 0.42, 0, TAU);
  ctx.fill();
}

function ctaButton(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, t: number): void {
  const pulse = 1 + 0.04 * Math.sin(t * 5);
  ctx.save();
  ctx.translate(x + w / 2, y + h / 2);
  ctx.scale(pulse, pulse);
  ctx.fillStyle = '#F2B705';
  rr(ctx, -w / 2, -h / 2, w, h, h / 2);
  ctx.fill();
  ctx.strokeStyle = '#1F2A44';
  ctx.lineWidth = h * 0.09;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(w * 0.18, -h * 0.2);
  ctx.lineTo(w * 0.28, 0);
  ctx.lineTo(w * 0.18, h * 0.2);
  ctx.stroke();
  ctx.restore();
  pseudoText(ctx, x + w * 0.14, y + h * 0.33, w * 0.5, h * 0.42, [3, 4], '#1F2A44', 3);
}

// ——— rolka 9:16 (15 s) ———

const REEL_SCENES: Array<[string, string]> = [
  ['#F46A4E', '#FFC9A8'],
  ['#2F5FD0', '#A8C5FF'],
  ['#1E8A62', '#B4EBCF'],
  ['#6C3FB8', '#D9C6FF'],
  ['#1F2A44', '#3E5582'],
];

function drawReel(ctx: CanvasRenderingContext2D, t: number, w: number, h: number, strongHook: boolean): void {
  const scene = Math.min(4, Math.floor(t / 3));
  const [top, bottom] = REEL_SCENES[scene];
  gradient(ctx, w, h, top, bottom);
  const u = w / 100;
  if (scene === 0 && !strongHook && t < 1.5) {
    // Słaby hook (wersja A): plansza z logo na start.
    gradient(ctx, w, h, '#ECEFF4', '#D7DEE8');
    logoMark(ctx, w / 2, h * 0.46, u * 14 * (0.9 + 0.1 * Math.min(1, t / 0.6)), '#2747D6');
    pseudoText(ctx, w * 0.3, h * 0.58, w * 0.4, u * 4, [4, 5], 'rgba(31,42,68,0.55)', 2);
    return;
  }
  const close = scene === 3 || (scene === 0 && strongHook);
  const r = u * (close ? 23 : 17);
  const cy = h * (close ? 0.47 : 0.43);
  presenter(ctx, w / 2, cy, r, t, { shirt: scene === 4 ? '#F2B705' : '#24324F' });
  if (scene === 0) {
    // Napis hooka u góry (w B od pierwszej klatki, w A po planszy).
    ctx.fillStyle = 'rgba(31,42,68,0.86)';
    rr(ctx, w * 0.08, h * 0.1, w * 0.84, h * 0.12, u * 3);
    ctx.fill();
    pseudoText(ctx, w * 0.13, h * 0.125, w * 0.74, u * 6.5, strongHook ? [3, 5, 2, 4] : [5, 6, 4], '#ffffff', strongHook ? 5 : 4);
  }
  if (scene === 1) {
    // Napisy w dolnej strefie zasłanianej przez interfejs platformy (do ostrzeżenia w raporcie).
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    rr(ctx, w * 0.1, h * 0.83, w * 0.8, h * 0.075, u * 2);
    ctx.fill();
    pseudoText(ctx, w * 0.14, h * 0.848, w * 0.72, u * 4, [4, 3, 5, 4, 3, 6, 4], '#ffffff', 7);
  }
  if (scene === 2) product(ctx, w * 0.7, h * 0.6, u * 11, '#E63946');
  if (scene === 4) {
    ctaButton(ctx, w * 0.2, h * 0.7, w * 0.6, h * 0.075, t);
    logoMark(ctx, w * 0.86, h * 0.08, u * 5, '#E63946');
  }
}

const REEL_AOIS: DemoAoi[] = [
  { key: 'face', type: 'face', x: 0.3, y: 0.3, w: 0.4, h: 0.26, t0: 0, t1: 15 },
  { key: 'hook', type: 'text', x: 0.08, y: 0.1, w: 0.84, h: 0.12, t0: 0, t1: 3, words: 6 },
  { key: 'captions', type: 'subtitle', x: 0.1, y: 0.83, w: 0.8, h: 0.075, t0: 3, t1: 6, words: 9 },
  { key: 'product', type: 'product', x: 0.56, y: 0.47, w: 0.28, h: 0.3, t0: 6, t1: 9 },
  { key: 'cta', type: 'cta', x: 0.2, y: 0.7, w: 0.6, h: 0.075, t0: 12, t1: 15, words: 2 },
  { key: 'logo', type: 'logo', x: 0.81, y: 0.05, w: 0.1, h: 0.06, t0: 12, t1: 15 },
];

function reelTarget(t: number, strongHook: boolean): GazeTarget {
  const scene = Math.min(4, Math.floor(t / 3));
  const face = (dy = 0): GazeTarget => ({ x: 0.5 + 0.02 * Math.sin(t * 1.3), y: (scene === 3 ? 0.45 : 0.41) + dy, key: 'face' });
  if (scene === 0) {
    if (!strongHook && t < 1.5) return { x: 0.5, y: 0.46, key: 'background' };
    if (t < (strongHook ? 1.6 : 2.4)) return { x: 0.45 + 0.1 * ((t * 1.7) % 1), y: 0.16, key: 'hook' };
    return face();
  }
  if (scene === 1) return t > 4.3 && t < 5.3 ? { x: 0.35 + 0.3 * ((t - 4.3) / 1), y: 0.865, key: 'captions' } : face();
  if (scene === 2) return t > 6.3 && t < 8.4 ? { x: 0.7, y: 0.6, key: 'product' } : face();
  if (scene === 4) return t > 12.4 && t < 14.2 ? { x: 0.5, y: 0.737, key: 'cta' } : face();
  return face();
}

// ——— film 16:9 (60 s, 5 scen po 12 s) ———

function drawVideo(ctx: CanvasRenderingContext2D, t: number, w: number, h: number): void {
  const scene = Math.min(4, Math.floor(t / 12));
  const local = t - scene * 12;
  const u = h / 100;
  if (scene === 0) {
    gradient(ctx, w, h, '#EEF2F7', '#D2DCEA');
    presenter(ctx, w * 0.3, h * 0.42, u * 15, t);
    ctx.fillStyle = '#1F2A44';
    pseudoText(ctx, w * 0.52, h * 0.3, w * 0.4, u * 7, [4, 6, 3, 5], '#1F2A44', 11);
    pseudoText(ctx, w * 0.52, h * 0.55, w * 0.38, u * 3.6, [5, 4, 6, 3, 5, 4, 5], 'rgba(31,42,68,0.5)', 12);
  } else if (scene === 1) {
    gradient(ctx, w, h, '#FFD166', '#FFE8A3');
    pseudoText(ctx, w * 0.08, h * 0.1, w * 0.6, u * 6, [5, 4, 6], '#1F2A44', 21);
    const bars = [0.35, 0.5, 0.42, 0.68, 0.84];
    const grow = Math.min(1, local / 4);
    bars.forEach((b, i) => {
      const bh = h * 0.55 * b * grow;
      ctx.fillStyle = i === 4 ? '#EB6834' : '#2747D6';
      rr(ctx, w * (0.16 + i * 0.14), h * 0.85 - bh, w * 0.09, bh, u);
      ctx.fill();
    });
  } else if (scene === 2) {
    gradient(ctx, w, h, '#86C5F0', '#E2F3FF');
    ctx.fillStyle = '#FFC300';
    ctx.beginPath();
    ctx.arc(w * (0.2 + 0.01 * local), h * 0.25, u * 9, 0, TAU);
    ctx.fill();
    for (const [x, c, s] of [
      [0.15, '#5E9E5A', 0.55],
      [0.55, '#4C8A49', 0.62],
      [0.9, '#6BAF66', 0.5],
    ] as Array<[number, string, number]>) {
      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.ellipse(w * (x - 0.004 * local), h, w * 0.4, h * s, 0, Math.PI, 0);
      ctx.fill();
    }
  } else if (scene === 3) {
    gradient(ctx, w, h, '#2D3E66', '#4F6699');
    presenter(ctx, w * 0.5, h * 0.4, u * 22, t, { shirt: '#1F2A44' });
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    rr(ctx, w * 0.25, h * 0.86, w * 0.5, h * 0.08, u * 1.5);
    ctx.fill();
    pseudoText(ctx, w * 0.27, h * 0.88, w * 0.46, u * 3.4, [4, 5, 3, 6, 4, 5], '#ffffff', 31);
  } else {
    gradient(ctx, w, h, '#0F3D3A', '#1B5E57');
    logoMark(ctx, w * 0.5, h * 0.32, u * 9, '#2747D6');
    ctaButton(ctx, w * 0.36, h * 0.56, w * 0.28, h * 0.12, t);
  }
}

const VIDEO_AOIS: DemoAoi[] = [
  { key: 'face', type: 'face', x: 0.2, y: 0.2, w: 0.2, h: 0.36, t0: 0, t1: 12 },
  { key: 'title', type: 'text', x: 0.5, y: 0.27, w: 0.44, h: 0.4, t0: 0, t1: 12, words: 18 },
  { key: 'chart', type: 'center', x: 0.14, y: 0.3, w: 0.74, h: 0.56, t0: 12, t1: 24 },
  { key: 'face', type: 'face', x: 0.37, y: 0.12, w: 0.26, h: 0.56, t0: 36, t1: 48 },
  { key: 'captions', type: 'subtitle', x: 0.25, y: 0.86, w: 0.5, h: 0.08, t0: 36, t1: 48, words: 6 },
  { key: 'cta', type: 'cta', x: 0.36, y: 0.56, w: 0.28, h: 0.12, t0: 48, t1: 60, words: 2 },
];

function videoTarget(t: number): GazeTarget {
  const scene = Math.min(4, Math.floor(t / 12));
  const local = t - scene * 12;
  if (scene === 0) return local % 4 < 2.6 ? { x: 0.3, y: 0.38, key: 'face' } : { x: 0.7, y: 0.42, key: 'title' };
  if (scene === 1) return { x: 0.3 + 0.12 * Math.min(4, Math.floor(local / 2)), y: 0.62, key: 'chart' };
  if (scene === 2) return { x: 0.2 + 0.4 * Math.sin(local * 0.3) ** 2, y: 0.35, key: 'background' };
  if (scene === 3) return local % 5 < 3.8 ? { x: 0.5, y: 0.37, key: 'face' } : { x: 0.5, y: 0.9, key: 'captions' };
  return local < 4 ? { x: 0.5, y: 0.32, key: 'logo' } : { x: 0.5, y: 0.62, key: 'cta' };
}

// ——— wypełniacze feedu (9:16, 6–10 s) ———

const FILLERS: Array<{ id: DemoId; duration: number; colors: [string, string, string]; motif: 'bubbles' | 'stripes' | 'orbit' | 'wave' | 'blocks' }> = [
  { id: 'filler_1', duration: 8, colors: ['#FF9F1C', '#FFE8C2', '#E4572E'], motif: 'bubbles' },
  { id: 'filler_2', duration: 10, colors: ['#118AB2', '#C9F1FF', '#073B4C'], motif: 'stripes' },
  { id: 'filler_3', duration: 7, colors: ['#8338EC', '#EBDDFF', '#3A0CA3'], motif: 'orbit' },
  { id: 'filler_4', duration: 9, colors: ['#06A77D', '#D1F7EA', '#005F44'], motif: 'wave' },
  { id: 'filler_5', duration: 6, colors: ['#EF476F', '#FFE0E8', '#9E1F43'], motif: 'blocks' },
];

function drawFiller(ctx: CanvasRenderingContext2D, t: number, w: number, h: number, f: (typeof FILLERS)[number]): void {
  const [a, b, c] = f.colors;
  gradient(ctx, w, h, a, b);
  const u = w / 100;
  ctx.fillStyle = c;
  if (f.motif === 'bubbles') {
    for (let i = 0; i < 9; i++) {
      const y = ((i * 0.13 + t * 0.12) % 1.2) - 0.1;
      ctx.beginPath();
      ctx.arc(w * ((i * 0.37) % 1), h * (1 - y), u * (4 + (i % 4) * 3), 0, TAU);
      ctx.fill();
    }
  } else if (f.motif === 'stripes') {
    for (let i = -2; i < 12; i++) {
      ctx.save();
      ctx.translate(((i * 0.12 + t * 0.05) % 1.4) * w, 0);
      ctx.rotate(0.3);
      ctx.fillRect(0, -h * 0.2, u * 4, h * 1.5);
      ctx.restore();
    }
  } else if (f.motif === 'orbit') {
    for (let i = 0; i < 5; i++) {
      const ang = t * (0.8 + i * 0.2) + i;
      ctx.beginPath();
      ctx.arc(w / 2 + Math.cos(ang) * u * (12 + i * 7), h * 0.45 + Math.sin(ang) * u * (12 + i * 7), u * (3 + i), 0, TAU);
      ctx.fill();
    }
  } else if (f.motif === 'wave') {
    ctx.beginPath();
    ctx.moveTo(0, h);
    for (let x = 0; x <= 40; x++) ctx.lineTo((x / 40) * w, h * (0.55 + 0.06 * Math.sin(x * 0.5 + t * 2)));
    ctx.lineTo(w, h);
    ctx.fill();
  } else {
    for (let i = 0; i < 6; i++) {
      const s = u * (14 + 3 * Math.sin(t * 2 + i));
      rr(ctx, w * (0.12 + (i % 2) * 0.44), h * (0.18 + Math.floor(i / 2) * 0.22), s * 2, s * 1.4, u * 2);
      ctx.fill();
    }
  }
  pseudoText(ctx, w * 0.08, h * 0.86, w * 0.7, u * 3.6, [5, 3, 6, 4], 'rgba(255,255,255,0.92)', f.id.length);
}

// ——— miniatury (16:9, obraz) ———

const THUMBS: Array<{ id: DemoId; bg: [string, string]; layout: 'face-left' | 'face-right' | 'big-text' | 'object' }> = [
  { id: 'thumb_1', bg: ['#E63946', '#FF8FA3'], layout: 'face-left' },
  { id: 'thumb_2', bg: ['#1D3557', '#457B9D'], layout: 'big-text' },
  { id: 'thumb_3', bg: ['#2A9D8F', '#A8E6CF'], layout: 'object' },
  { id: 'thumb_4', bg: ['#F4A261', '#FFE5B4'], layout: 'face-right' },
  { id: 'thumb_5', bg: ['#6A4C93', '#C3A6FF'], layout: 'big-text' },
  { id: 'thumb_6', bg: ['#264653', '#6B9080'], layout: 'object' },
];

function drawThumb(ctx: CanvasRenderingContext2D, w: number, h: number, th: (typeof THUMBS)[number]): void {
  gradient(ctx, w, h, th.bg[0], th.bg[1]);
  const u = h / 100;
  const seed = Number(th.id.slice(-1));
  if (th.layout === 'face-left' || th.layout === 'face-right') {
    const left = th.layout === 'face-left';
    presenter(ctx, w * (left ? 0.26 : 0.74), h * 0.42, u * 20, 0.5, { talking: false });
    ctx.fillStyle = 'rgba(31,42,68,0.85)';
    rr(ctx, w * (left ? 0.5 : 0.06), h * 0.22, w * 0.44, h * 0.42, u * 3);
    ctx.fill();
    pseudoText(ctx, w * (left ? 0.53 : 0.09), h * 0.27, w * 0.38, u * 10, [3, 4, 2], '#FFFFFF', seed);
  } else if (th.layout === 'big-text') {
    pseudoText(ctx, w * 0.07, h * 0.18, w * 0.86, u * 16, [4, 3, 5, 2], '#FFFFFF', seed);
  } else {
    product(ctx, w * 0.32, h * 0.5, u * 22, '#F2B705');
    pseudoText(ctx, w * 0.55, h * 0.3, w * 0.38, u * 10, [3, 2, 4], '#FFFFFF', seed);
  }
}

// ——— karuzela demo ———

const SLIDES: Array<{ id: DemoId; bg: [string, string]; layout: 'cover' | 'text' | 'chart' | 'cta' }> = [
  { id: 'slide_1', bg: ['#1F2A44', '#3B4C77'], layout: 'cover' },
  { id: 'slide_2', bg: ['#F4F6F9', '#E3E8F0'], layout: 'text' },
  { id: 'slide_3', bg: ['#F4F6F9', '#E3E8F0'], layout: 'chart' },
  { id: 'slide_4', bg: ['#F4F6F9', '#E3E8F0'], layout: 'text' },
  { id: 'slide_5', bg: ['#2747D6', '#5B78F0'], layout: 'cta' },
];

function drawSlide(ctx: CanvasRenderingContext2D, w: number, h: number, sl: (typeof SLIDES)[number]): void {
  gradient(ctx, w, h, sl.bg[0], sl.bg[1]);
  const u = w / 100;
  const seed = Number(sl.id.slice(-1));
  const dark = sl.layout === 'cover' || sl.layout === 'cta';
  const ink = dark ? '#FFFFFF' : '#1F2A44';
  if (sl.layout === 'cover') {
    pseudoText(ctx, w * 0.08, h * 0.3, w * 0.84, u * 12, [3, 4, 2], ink, seed);
    ctx.fillStyle = '#F2B705';
    rr(ctx, w * 0.08, h * 0.62, w * 0.3, u * 2.4, u);
    ctx.fill();
  } else if (sl.layout === 'text') {
    pseudoText(ctx, w * 0.08, h * 0.1, w * 0.84, u * 8, [3, 3], ink, seed);
    pseudoText(ctx, w * 0.08, h * 0.32, w * 0.84, u * 5, [6, 5, 6, 4, 5, 3], '#5B6478', seed + 3);
  } else if (sl.layout === 'chart') {
    pseudoText(ctx, w * 0.08, h * 0.1, w * 0.84, u * 8, [4, 2], ink, seed);
    const bars = [0.35, 0.55, 0.42, 0.8, 0.62];
    bars.forEach((b, i) => {
      ctx.fillStyle = i === 3 ? '#2747D6' : '#9AA8C7';
      rr(ctx, w * (0.12 + i * 0.16), h * (0.85 - b * 0.5), w * 0.1, h * b * 0.5, u);
      ctx.fill();
    });
  } else {
    pseudoText(ctx, w * 0.08, h * 0.22, w * 0.84, u * 10, [3, 3], ink, seed);
    ctx.fillStyle = '#FFFFFF';
    rr(ctx, w * 0.2, h * 0.62, w * 0.6, h * 0.1, h * 0.05);
    ctx.fill();
    pseudoText(ctx, w * 0.3, h * 0.645, w * 0.4, u * 5, [2], '#2747D6', seed);
  }
  // Kropki postępu karuzeli.
  SLIDES.forEach((x, i) => {
    ctx.fillStyle = x.id === sl.id ? (dark ? '#FFFFFF' : '#1F2A44') : dark ? 'rgba(255,255,255,0.35)' : 'rgba(31,42,68,0.25)';
    ctx.beginPath();
    ctx.arc(w * 0.5 + (i - 2) * u * 3.2, h * 0.95, u * 0.9, 0, TAU);
    ctx.fill();
  });
}

const slideTarget = (layout: (typeof SLIDES)[number]['layout']) => (t: number): GazeTarget => {
  if (layout === 'chart') return t < 1.2 ? { x: 0.45, y: 0.14, key: 'title' } : { x: 0.6 + 0.05 * Math.sin(t * 2), y: 0.62, key: 'chart' };
  if (layout === 'cta') return t < 1 ? { x: 0.5, y: 0.26, key: 'title' } : { x: 0.5, y: 0.67, key: 'cta' };
  return t < 1.5 ? { x: 0.45, y: layout === 'cover' ? 0.36 : 0.14, key: 'title' } : { x: 0.45 + 0.08 * Math.sin(t * 1.7), y: 0.42 + ((t * 0.08) % 0.35), key: 'title' };
};

// ——— rejestr ———

const reelSpec = (id: 'reel' | 'reel_b'): DemoSpec => ({
  id,
  kind: 'video',
  duration: 15,
  w: 1080,
  h: 1920,
  cuts: [0, 3, 6, 9, 12],
  aois: id === 'reel' ? REEL_AOIS.map((a) => (a.key === 'hook' ? { ...a, t0: 1.5 } : a)) : REEL_AOIS,
  sharedFrom: 3,
  draw: (ctx, t, w, h) => drawReel(ctx, t, w, h, id === 'reel_b'),
  target: (t) => reelTarget(t, id === 'reel_b'),
});

export const DEMO_SPECS = {
  reel: reelSpec('reel'),
  reel_b: reelSpec('reel_b'),
  video: { id: 'video', kind: 'video', duration: 60, w: 1920, h: 1080, cuts: [0, 12, 24, 36, 48], aois: VIDEO_AOIS, draw: drawVideo, target: videoTarget },
  ...(Object.fromEntries(
    FILLERS.map((f) => [
      f.id,
      {
        id: f.id,
        kind: 'video',
        duration: f.duration,
        w: 1080,
        h: 1920,
        cuts: [0],
        aois: [],
        draw: (ctx: CanvasRenderingContext2D, t: number, w: number, h: number) => drawFiller(ctx, t, w, h, f),
        target: (t: number): GazeTarget => ({ x: 0.5 + 0.15 * Math.sin(t), y: 0.45, key: 'background' }),
      } satisfies DemoSpec,
    ]),
  ) as Record<string, DemoSpec>),
  ...(Object.fromEntries(
    SLIDES.map((sl) => [
      sl.id,
      {
        id: sl.id,
        kind: 'image',
        duration: 0,
        w: 1080,
        h: 1350,
        cuts: [0],
        aois: sl.layout === 'cta' ? [{ key: 'cta', type: 'cta', x: 0.2, y: 0.62, w: 0.6, h: 0.1, t0: 0, t1: 3600 }] : [{ key: 'title', type: 'text', x: 0.08, y: sl.layout === 'cover' ? 0.28 : 0.08, w: 0.84, h: 0.2, t0: 0, t1: 3600, words: 6 }],
        draw: (ctx: CanvasRenderingContext2D, _t: number, w: number, h: number) => drawSlide(ctx, w, h, sl),
        target: slideTarget(sl.layout),
      } satisfies DemoSpec,
    ]),
  ) as Record<string, DemoSpec>),
  ...(Object.fromEntries(
    THUMBS.map((th) => [
      th.id,
      {
        id: th.id,
        kind: 'image',
        duration: 0,
        w: 1280,
        h: 720,
        cuts: [0],
        aois: [],
        draw: (ctx: CanvasRenderingContext2D, _t: number, w: number, h: number) => drawThumb(ctx, w, h, th),
        target: (): GazeTarget => ({ x: 0.5, y: 0.45, key: 'background' }),
      } satisfies DemoSpec,
    ]),
  ) as Record<string, DemoSpec>),
} as Record<DemoId, DemoSpec>;

export const isDemoId = (x: unknown): x is DemoId => typeof x === 'string' && (DEMO_IDS as string[]).includes(x);

export function drawDemoScene(ctx: CanvasRenderingContext2D, t: number, w: number, h: number, spec: DemoSpec): void {
  ctx.save();
  spec.draw(ctx, Math.max(0, Math.min(t, spec.duration || 0)), w, h);
  ctx.restore();
}

/** Na co patrzy uważny widz w chwili t (symulacja). */
export const demoTargetAt = (t: number, spec: DemoSpec): GazeTarget => spec.target(t);
