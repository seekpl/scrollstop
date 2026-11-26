/**
 * Fotografie klipów demo (wygenerowane w Higgsfield, pliki w `src/demo/photos`). Wczytywane leniwie
 * przy pierwszym rysowaniu; dopóki się nie wczytają (oraz w testach bez przeglądarki), scena
 * rysuje się wersją zapasową z kształtów — dzięki temu klipy działają zawsze i są deterministyczne.
 */
const URLS = {
  reelTalk: new URL('./photos/reel-talk.webp', import.meta.url).href,
  reelProduct: new URL('./photos/reel-product.webp', import.meta.url).href,
  reelPoint: new URL('./photos/reel-point.webp', import.meta.url).href,
  videoHost: new URL('./photos/video-host.webp', import.meta.url).href,
  videoBroll: new URL('./photos/video-broll.webp', import.meta.url).href,
  feedFood: new URL('./photos/feed-food.webp', import.meta.url).href,
  feedLake: new URL('./photos/feed-lake.webp', import.meta.url).href,
  feedYoga: new URL('./photos/feed-yoga.webp', import.meta.url).href,
  feedDog: new URL('./photos/feed-dog.webp', import.meta.url).href,
  feedCity: new URL('./photos/feed-city.webp', import.meta.url).href,
  thumbFaceLeft: new URL('./photos/thumb-face-left.webp', import.meta.url).href,
  thumbFaceRight: new URL('./photos/thumb-face-right.webp', import.meta.url).href,
  thumbCity: new URL('./photos/thumb-city.webp', import.meta.url).href,
  thumbSneaker: new URL('./photos/thumb-sneaker.webp', import.meta.url).href,
  thumbMountain: new URL('./photos/thumb-mountain.webp', import.meta.url).href,
  thumbHeadphones: new URL('./photos/thumb-headphones.webp', import.meta.url).href,
} as const;

export type PhotoId = keyof typeof URLS;

const images = new Map<PhotoId, HTMLImageElement>();
const loads = new Map<PhotoId, Promise<void>>();

function start(id: PhotoId): Promise<void> {
  const known = loads.get(id);
  if (known) return known;
  if (typeof Image === 'undefined') return Promise.resolve();
  const img = new Image();
  img.decoding = 'async';
  const p = new Promise<void>((resolve) => {
    img.onload = () => resolve();
    // Błąd wczytania nie blokuje klipu — zostaje wersja zapasowa.
    img.onerror = () => resolve();
  });
  img.src = URLS[id];
  images.set(id, img);
  loads.set(id, p);
  return p;
}

/** Wczytana fotografia albo null (jeszcze się wczytuje, błąd, środowisko bez obrazów). */
export function photo(id: PhotoId): HTMLImageElement | null {
  void start(id);
  const img = images.get(id);
  return img && img.complete && img.naturalWidth > 0 ? img : null;
}

/** Czeka na wczytanie podanych fotografii (najdłużej `timeoutMs`), np. przed klatkami raportu. */
export function preloadPhotos(ids: readonly PhotoId[], timeoutMs = 8000): Promise<void> {
  if (!ids.length) return Promise.resolve();
  return Promise.race([Promise.all(ids.map(start)).then(() => undefined), new Promise<void>((r) => setTimeout(r, timeoutMs))]);
}

/**
 * Rysuje fotografię jak `object-fit: cover` powiększoną `zoom` razy tak, aby punkt obrazu
 * (`fx`, `fy`, ułamki) wypadł w punkcie płótna (`ax`, `ay`); bez pustych pasów przy krawędziach.
 */
export function drawPhoto(ctx: CanvasRenderingContext2D, img: HTMLImageElement, w: number, h: number, opts: { zoom?: number; fx?: number; fy?: number; ax?: number; ay?: number } = {}): void {
  const { zoom = 1, fx = 0.5, fy = 0.5 } = opts;
  const ax = opts.ax ?? fx;
  const ay = opts.ay ?? fy;
  const s = Math.max(w / img.naturalWidth, h / img.naturalHeight) * zoom;
  const dw = img.naturalWidth * s;
  const dh = img.naturalHeight * s;
  const x = Math.min(0, Math.max(w - dw, ax * w - fx * dw));
  const y = Math.min(0, Math.max(h - dh, ay * h - fy * dh));
  ctx.drawImage(img, x, y, dw, dh);
}
