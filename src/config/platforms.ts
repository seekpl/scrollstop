/**
 * Platformy publikacji: domyślne proporcje, urządzenie docelowe i strefy zasłaniane przez interfejs
 * platformy (§4.8). Wartości stref są PRZYBLIŻONE i do sprawdzenia z aktualnymi wytycznymi platform.
 */
export type Platform = 'tiktok' | 'reels' | 'shorts' | 'instagram_feed' | 'youtube' | 'linkedin' | 'facebook' | 'other';

export const PLATFORMS: Platform[] = ['tiktok', 'reels', 'shorts', 'instagram_feed', 'youtube', 'linkedin', 'facebook', 'other'];

export type TargetDevice = 'mobile' | 'desktop' | 'any';

/** Obszar zasłonięty: ułamki kadru od krawędzi (0..1). */
export interface UnsafeInsets {
  top: number;
  bottom: number;
  right: number;
  left: number;
}

export interface PlatformSpec {
  /** Domyślne proporcje materiału (szerokość × wysokość, nominalnie). */
  width: number;
  height: number;
  /** Inne dopuszczalne proporcje bez ostrzeżenia w kreatorze. */
  alsoAccepts: Array<[number, number]>;
  device: TargetDevice;
  /** Strefy zasłonięte przez interfejs (null = brak danych / brak nakładki). */
  unsafe: UnsafeInsets | null;
}

export const PLATFORM_SPECS: Record<Platform, PlatformSpec> = {
  tiktok: { width: 1080, height: 1920, alsoAccepts: [], device: 'mobile', unsafe: { top: 0.08, bottom: 0.22, right: 0.14, left: 0 } },
  reels: { width: 1080, height: 1920, alsoAccepts: [], device: 'mobile', unsafe: { top: 0.1, bottom: 0.2, right: 0.12, left: 0 } },
  shorts: { width: 1080, height: 1920, alsoAccepts: [], device: 'mobile', unsafe: { top: 0.1, bottom: 0.2, right: 0.13, left: 0 } },
  instagram_feed: { width: 1080, height: 1350, alsoAccepts: [[1080, 1080]], device: 'mobile', unsafe: null },
  youtube: { width: 1920, height: 1080, alsoAccepts: [], device: 'desktop', unsafe: null },
  linkedin: { width: 1080, height: 1350, alsoAccepts: [[1080, 1080], [1920, 1080]], device: 'any', unsafe: null },
  facebook: { width: 1080, height: 1350, alsoAccepts: [[1080, 1080], [1080, 1920]], device: 'mobile', unsafe: null },
  other: { width: 1080, height: 1920, alsoAccepts: [[1080, 1350], [1080, 1080], [1920, 1080]], device: 'any', unsafe: null },
};

/** Czy proporcje pasują do platformy (tolerancja 3%). */
export function aspectFits(platform: Platform, width: number, height: number): boolean {
  if (!(width > 0 && height > 0)) return true;
  const spec = PLATFORM_SPECS[platform];
  const r = width / height;
  return [[spec.width, spec.height] as [number, number], ...spec.alsoAccepts].some(([w, h]) => Math.abs(r / (w / h) - 1) <= 0.03);
}

/** Domyślne urządzenie dla proporcji: pion i 4:5 → telefon, poziom → komputer (§4.1). */
export function defaultDeviceFor(width: number, height: number): TargetDevice {
  if (!(width > 0 && height > 0)) return 'any';
  return width / height < 1 ? 'mobile' : width / height > 1.2 ? 'desktop' : 'any';
}

/**
 * Czy prostokąt (0..1 na obrazie) nachodzi na strefę zasłoniętą platformy o więcej niż `minShare` swojej powierzchni.
 */
export function overlapsUnsafe(platform: Platform, r: { x: number; y: number; w: number; h: number }, minShare = 0.25): boolean {
  const u = PLATFORM_SPECS[platform].unsafe;
  if (!u || r.w <= 0 || r.h <= 0) return false;
  const area = r.w * r.h;
  const inter = (ax: number, ay: number, aw: number, ah: number) => {
    const w = Math.max(0, Math.min(r.x + r.w, ax + aw) - Math.max(r.x, ax));
    const h = Math.max(0, Math.min(r.y + r.h, ay + ah) - Math.max(r.y, ay));
    return w * h;
  };
  // Pasy: góra, dół, prawa (bez podwójnego liczenia narożników — wystarczy maksimum z sumy przycięte do 1).
  const covered = inter(0, 0, 1, u.top) + inter(0, 1 - u.bottom, 1, u.bottom) + inter(1 - u.right, u.top, u.right, 1 - u.top - u.bottom) + inter(0, u.top, u.left, 1 - u.top - u.bottom);
  return covered / area >= minShare;
}
