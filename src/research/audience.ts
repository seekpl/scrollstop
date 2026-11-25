/**
 * Segmenty widzów w raporcie (§4.9): mieszane źródła (panel i społeczność, każde ≥ 10 sesji)
 * i korzystanie z platformy publikacji według pytań przesiewowych (§10.3).
 */
import type { Platform } from '../config/platforms';
import type { ViewerSession } from './model';
import { reportSessions } from './sessions';

/** Platformy w pytaniach przesiewowych; klucz odpowiedzi to `platform_<id>`. */
export const SCREENER_PLATFORMS = ['tiktok', 'reels', 'shorts', 'youtube'] as const;
export type ScreenerPlatform = (typeof SCREENER_PLATFORMS)[number];
export const SCREENER_FREQUENCIES = ['daily', 'weekly', 'rarely', 'never'] as const;

/** Platforma publikacji → pytanie przesiewowe o nią (post na Instagramie liczymy z Reels). */
export const SCREENER_FOR: Partial<Record<Platform, ScreenerPlatform>> = { tiktok: 'tiktok', reels: 'reels', instagram_feed: 'reels', shorts: 'shorts', youtube: 'youtube' };

/** Minimalna liczba sesji w każdym segmencie źródła, żeby pokazać je osobno (§4.9). */
export const MIN_SEGMENT_SESSIONS = 10;

export type AudienceSegment = 'all' | 'platform' | 'other' | 'panel' | 'community';

/** Regularny użytkownik platformy: ogląda ją codziennie albo co tydzień. */
export function usesPlatform(s: Pick<ViewerSession, 'screener'>, p: ScreenerPlatform): boolean | null {
  const a = s.screener[`platform_${p}`];
  if (!a) return null;
  return a === 'daily' || a === 'weekly';
}

export function inSegment(s: ViewerSession, segment: AudienceSegment, platform: Platform): boolean {
  const sp = SCREENER_FOR[platform];
  switch (segment) {
    case 'all':
      return true;
    case 'platform':
      return sp ? usesPlatform(s, sp) === true : false;
    case 'other':
      return sp ? usesPlatform(s, sp) === false : false;
    case 'panel':
      return !!s.panel;
    case 'community':
      return !s.panel;
  }
}

/** Sesje segmentu (wszystkie statusy — kontrolę jakości robi raport). */
export function filterAudience(sessions: readonly ViewerSession[], segment: AudienceSegment, platform: Platform): ViewerSession[] {
  return segment === 'all' ? sessions.slice() : sessions.filter((s) => inSegment(s, segment, platform));
}

/**
 * Segmenty dostępne w raporcie. Źródła tylko, gdy oba mają ≥ 10 ważnych sesji; platforma, gdy
 * ktokolwiek odpowiedział na pytanie o platformę publikacji.
 */
export function audienceSegments(sessions: readonly ViewerSession[], platform: Platform, opts: { includeSimulated?: boolean } = {}): AudienceSegment[] {
  const valid = reportSessions(sessions, opts);
  const out: AudienceSegment[] = ['all'];
  const sp = SCREENER_FOR[platform];
  if (sp && valid.some((s) => usesPlatform(s, sp) !== null)) out.push('platform', 'other');
  const panel = valid.filter((s) => s.panel).length;
  if (panel >= MIN_SEGMENT_SESSIONS && valid.length - panel >= MIN_SEGMENT_SESSIONS) out.push('panel', 'community');
  return out;
}
