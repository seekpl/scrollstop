import type { ResearchText } from '../research/text';
import { research as en } from './en/research';
import type { Locale } from './locales';
import { research as pl } from './pl/research';

/**
 * Teksty analityczne wszystkich języków w jednym miejscu — dla serwera (link udostępniania,
 * rekomendacje AI) i trybu lokalnego, które budują raport bez Reacta (§18).
 */
export const RESEARCH_TEXT: Record<Locale, ResearchText> = { pl, en };
