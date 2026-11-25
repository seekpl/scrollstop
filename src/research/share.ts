/**
 * Raport udostępniany linkiem (§13.2 `GET /api/share/:token`): liczony na serwerze, wyłącznie
 * zbiorczy. Bez surowych sesji i bez wartości pojedynczych widzów (`perViewer`, `states`).
 */
import { formatNumber } from '../i18n/format';
import type { Locale } from '../i18n/locales';
import type { AudioMode, Platform, Project, StudyKind, VariantId, ViewContext, ViewerSession } from './model';
import { buildVariantReport, compareVariants, type VariantReport, type VariantsComparison } from './report';
import { reportSessions } from './sessions';
import type { ResearchText } from './text';

export type SharedVariantReport = Omit<VariantReport, 'perViewer' | 'states'>;
export type SharedComparison = Omit<VariantsComparison, 'reports'> & { reports: SharedVariantReport[] };

export interface SharedReport {
  project: {
    name: string;
    creatorName: string;
    kind: StudyKind;
    platform: Platform;
    context: ViewContext;
    audio: AudioMode;
    targetSessions: number;
    variants: Array<{ id: VariantId; label: string; width: number; height: number; duration: number }>;
  };
  locale: Locale;
  reports: SharedVariantReport[];
  comparison: SharedComparison | null;
  /** Odpowiedzi na pytania po obejrzeniu: wersja → pytanie → odpowiedź → liczba. */
  answers: Partial<Record<VariantId, Record<string, Record<string, number>>>>;
  /** Logo z konta (plan z `clientLogo`). */
  logo: string | null;
  generatedAt: string;
  expiresAt: string;
}

const strip = ({ perViewer: _p, states: _s, ...rest }: VariantReport): SharedVariantReport => rest;

export function buildSharedReport(project: Project, sessions: readonly ViewerSession[], tx: ResearchText, opts: { locale: Locale; logo: string | null; generatedAt: string; expiresAt: string }): SharedReport {
  const reports = project.variants.map((v) => buildVariantReport(project, v, sessions, tx));
  const withData = reports.filter((r) => r.viewers > 0);
  const cmp =
    withData.length >= 2 && withData.length === reports.length
      ? compareVariants(reports, tx, { sharedFrom: project.kind === 'hook' ? project.variants[0].sharedFrom : undefined, formatP: (p) => (p < 0.001 ? `< ${formatNumber(0.001, opts.locale, 3)}` : formatNumber(p, opts.locale, 3)) })
      : null;
  const answers: SharedReport['answers'] = {};
  for (const s of reportSessions(sessions)) {
    for (const [q, a] of Object.entries(s.answers)) {
      const byQ = (answers[s.variantId] ??= {});
      const byA = (byQ[q] ??= {});
      byA[a] = (byA[a] ?? 0) + 1;
    }
  }
  return {
    project: {
      name: project.name,
      creatorName: project.creatorName,
      kind: project.kind,
      platform: project.platform,
      context: project.context,
      audio: project.audio,
      targetSessions: project.targetSessions,
      variants: project.variants.map((v) => ({ id: v.id, label: v.label, width: v.width, height: v.height, duration: v.duration })),
    },
    locale: opts.locale,
    reports: reports.map(strip),
    comparison: cmp ? { ...cmp, reports: cmp.reports.map(strip) } : null,
    answers,
    logo: opts.logo,
    generatedAt: opts.generatedAt,
    expiresAt: opts.expiresAt,
  };
}
