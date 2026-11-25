import type { QuestionId } from './model';

/**
 * Pytania po obejrzeniu (§10.10): tylko odpowiedzi do wyboru, zapisywane jako identyfikatory opcji.
 * Teksty pytań i opcji są w słowniku `viewer.questions`.
 */
export const QUESTION_OPTIONS: Record<Exclude<QuestionId, 'thumb_choice'>, string[]> = {
  finish: ['yes', 'no', 'unsure'],
  brand_recall: ['brand', 'd1', 'd2', 'd3', 'none'],
};

/** Dystraktory w pytaniu o markę — fikcyjne nazwy (nazwy własne, bez tłumaczenia). */
export const BRAND_DISTRACTORS = ['Nordia', 'Lumaro', 'Vexel'];
