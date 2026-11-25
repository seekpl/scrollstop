import type { Fixation } from '../contracts/types';
import type { PathPoint } from '../analysis/gazePath';
import { paletteColor, type PaletteName } from '../analysis/heatmap';

/** Nakłada warstwę heat mapy (siatka RGBA) na klatkę z wygładzaniem przy skalowaniu. */
export function drawHeatmapLayer(
  ctx: CanvasRenderingContext2D,
  rgba: Uint8ClampedArray,
  gw: number,
  gh: number,
  destW: number,
  destH: number,
  opacity: number,
): void {
  const off = document.createElement('canvas');
  off.width = gw;
  off.height = gh;
  const octx = off.getContext('2d');
  if (!octx) return;
  const img = octx.createImageData(gw, gh);
  img.data.set(rgba);
  octx.putImageData(img, 0, 0);
  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(off, 0, 0, destW, destH);
  ctx.restore();
}

/** Trajektoria: starsze punkty bledsze, nowsze wyraźniejsze. */
export function drawGazePath(
  ctx: CanvasRenderingContext2D,
  pts: PathPoint[],
  tEnd: number,
  window: number,
  w: number,
  h: number,
  color = '#2747D6',
): void {
  if (pts.length < 2) return;
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1];
    const b = pts[i];
    if (b.t - a.t > 0.3) continue;
    const age = 1 - (tEnd - b.t) / window;
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.15 + 0.75 * Math.max(0, age);
    ctx.lineWidth = Math.max(2, w / 400);
    ctx.beginPath();
    ctx.moveTo(a.x * w, a.y * h);
    ctx.lineTo(b.x * w, b.y * h);
    ctx.stroke();
  }
  const last = pts[pts.length - 1];
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#F2B705';
  ctx.strokeStyle = '#1F2A44';
  ctx.lineWidth = Math.max(2, w / 500);
  ctx.beginPath();
  ctx.arc(last.x * w, last.y * h, Math.max(7, w / 110), 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

/** Fixacje: koła o polu proporcjonalnym do czasu trwania, numerowane chronologicznie. */
export function drawFixations(ctx: CanvasRenderingContext2D, fixations: Fixation[], w: number, h: number): void {
  ctx.save();
  const unit = w / 1280;
  fixations.forEach((f, i) => {
    const r = Math.max(8, Math.sqrt(f.duration) * 22) * unit;
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.strokeStyle = '#2747D6';
    ctx.lineWidth = 2.5 * unit;
    ctx.beginPath();
    ctx.arc(f.x * w, f.y * h, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#1F2A44';
    ctx.font = `600 ${Math.round(13 * unit)}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(i + 1), f.x * w, f.y * h);
  });
  ctx.restore();
}

export function drawPoints(ctx: CanvasRenderingContext2D, pts: PathPoint[], w: number, h: number): void {
  ctx.save();
  ctx.fillStyle = 'rgba(39,71,214,0.6)';
  for (const p of pts) {
    ctx.beginPath();
    ctx.arc(p.x * w, p.y * h, Math.max(3, w / 320), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** Legenda i opis do eksportu PNG. */
export function drawExportFooter(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  lines: string[],
  palette: PaletteName,
  legend: { low: string; high: string },
): void {
  const pad = Math.round(w / 64);
  const lineH = Math.round(w / 64);
  const boxH = pad * 2 + lineH * (lines.length + 1);
  ctx.save();
  ctx.fillStyle = 'rgba(255,255,255,0.88)';
  ctx.fillRect(0, h - boxH, w, boxH);
  ctx.fillStyle = '#1F2A44';
  ctx.font = `${Math.round(lineH * 0.8)}px system-ui, sans-serif`;
  ctx.textBaseline = 'top';
  lines.forEach((l, i) => ctx.fillText(l, pad, h - boxH + pad + i * lineH));
  const barW = Math.round(w / 5);
  const barX = w - pad - barW;
  const barY = h - boxH + pad;
  for (let i = 0; i < barW; i++) {
    const [r, g, b] = paletteColor(palette, i / barW);
    ctx.fillStyle = `rgb(${r},${g},${b})`;
    ctx.fillRect(barX + i, barY, 1, lineH * 0.6);
  }
  ctx.fillStyle = '#1F2A44';
  ctx.fillText(legend.low, barX, barY + lineH * 0.8);
  ctx.textAlign = 'right';
  ctx.fillText(legend.high, barX + barW, barY + lineH * 0.8);
  ctx.restore();
}
