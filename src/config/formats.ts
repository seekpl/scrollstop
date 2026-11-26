/**
 * Formaty badań pokazywane na stronie głównej, z własnymi podstronami (`/formats/<id>/`).
 * Jedno źródło dla kafelków, routera, plików HTML dla wyszukiwarek i sitemap.xml.
 */
export const FORMAT_IDS = ['reel', 'video', 'feed', 'thumbnail', 'carousel', 'versions'] as const;
export type FormatId = (typeof FORMAT_IDS)[number];

export const isFormatId = (x: unknown): x is FormatId => typeof x === 'string' && (FORMAT_IDS as readonly string[]).includes(x);

/** Przykładowy raport dla formatu (tam, gdzie istnieje). */
export const FORMAT_SAMPLE: Partial<Record<FormatId, 'reel' | 'video' | 'feed'>> = { reel: 'reel', video: 'video', feed: 'feed' };
