/**
 * IFrame API nie podaje rozdzielczości filmu, a odtwarzacz YouTube wpasowuje obraz
 * w ramkę jak `object-fit: contain`. Do przeliczania wzroku na współrzędne bajki
 * wystarczą proporcje — wykrywane z oEmbed albo wybierane ręcznie.
 */
export const ASPECT_OPTIONS = [
  { label: '16:9', w: 16, h: 9 },
  { label: '4:3', w: 4, h: 3 },
  { label: '9:16', w: 9, h: 16 },
] as const;

export type AspectLabel = (typeof ASPECT_OPTIONS)[number]['label'];

const NOMINAL_H = 720;

/** Nominalny rozmiar obrazu (wysokość 720) dla proporcji w:h. */
export function nominalSize(w: number, h: number): { width: number; height: number } {
  return { width: Math.round((NOMINAL_H * w) / h), height: NOMINAL_H };
}

/** Najbliższa standardowa proporcja, jeśli różnica jest mniejsza niż 4% (oEmbed zaokrągla wymiary). */
export function snapAspect(w: number, h: number): { width: number; height: number } {
  const r = w / h;
  const best = ASPECT_OPTIONS.reduce((a, b) => (Math.abs(b.w / b.h - r) < Math.abs(a.w / a.h - r) ? b : a));
  return Math.abs(best.w / best.h - r) / r < 0.04 ? nominalSize(best.w, best.h) : nominalSize(w, h);
}

/** Etykieta proporcji dla rozmiaru albo `null`, gdy to proporcja niestandardowa. */
export function aspectLabel(width: number, height: number): AspectLabel | null {
  const r = width / height;
  return ASPECT_OPTIONS.find((a) => Math.abs(a.w / a.h - r) / r < 0.01)?.label ?? null;
}
