/** Prostokąt znormalizowany względem kontenera (0..1). */
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const FULL_RECT: Rect = { x: 0, y: 0, w: 1, h: 1 };

/** Gdzie w kontenerze leży obraz o proporcjach vw×vh przy `object-fit: contain` (czarne pasy). */
export function containRect(cw: number, ch: number, vw: number, vh: number): Rect {
  if (cw <= 0 || ch <= 0 || vw <= 0 || vh <= 0) return FULL_RECT;
  const s = Math.min(cw / vw, ch / vh);
  const w = (vw * s) / cw;
  const h = (vh * s) / ch;
  return { x: (1 - w) / 2, y: (1 - h) / 2, w, h };
}

/** Wycinek obrazu sw×sh, który wypełnia cel dw×dh bez zniekształceń (`object-fit: cover`). */
export function coverCrop(sw: number, sh: number, dw: number, dh: number): { sx: number; sy: number; sw: number; sh: number } {
  if (sw <= 0 || sh <= 0 || dw <= 0 || dh <= 0) return { sx: 0, sy: 0, sw, sh };
  const s = Math.max(dw / sw, dh / sh);
  const cw = dw / s;
  const ch = dh / s;
  return { sx: (sw - cw) / 2, sy: (sh - ch) / 2, sw: cw, sh: ch };
}

/** Przelicza punkt ekranu na współrzędne obrazu materiału (§5.9). */
export function toVideoCoords(x: number, y: number, r: Rect): { vx: number; vy: number; inside: boolean } {
  const vx = (x - r.x) / r.w;
  const vy = (y - r.y) / r.h;
  return { vx, vy, inside: vx >= 0 && vx <= 1 && vy >= 0 && vy <= 1 };
}
