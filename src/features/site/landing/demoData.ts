import { useEffect, useState } from 'react';
import type { SampleId } from '../../../app/router';
import type { Locale } from '../../../i18n/locales';
import { RESEARCH_TEXT } from '../../../i18n/research';
import { demoFeedProject } from '../../../research/formatSim';
import { demoProject } from '../../../research/panelSim';
import { buildVariantReport, headline, type VariantReport } from '../../../research/report';

/** Raport przykładu z symulowanego panelu — te same dane co na stronach przykładowych raportów. */
export interface SampleSummary {
  report: VariantReport;
  lead: string;
  detail: string | null;
}

const cache = new Map<string, SampleSummary>();

export function sampleSummary(id: SampleId, locale: Locale): SampleSummary {
  const key = `${id}:${locale}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const tx = RESEARCH_TEXT[locale];
  const opts = { createdAt: '2026-01-01T00:00:00.000Z' };
  const { project, sessions } = id === 'feed' ? demoFeedProject(tx, opts) : demoProject(id, tx, opts);
  const report = buildVariantReport(project, project.variants[0], sessions, tx, { includeSimulated: true });
  const h = headline(report, tx);
  const out = { report, lead: h.lead, detail: h.detail };
  cache.set(key, out);
  return out;
}

/** Liczy przykład po pierwszym malowaniu (symulacja panelu nie opóźnia wejścia na stronę). */
export function useSampleSummary(id: SampleId, locale: Locale): SampleSummary | null {
  const [data, setData] = useState<SampleSummary | null>(() => cache.get(`${id}:${locale}`) ?? null);
  useEffect(() => {
    const cached = cache.get(`${id}:${locale}`);
    if (cached) {
      setData(cached);
      return;
    }
    setData(null);
    const timer = window.setTimeout(() => setData(sampleSummary(id, locale)), 0);
    return () => window.clearTimeout(timer);
  }, [id, locale]);
  return data;
}

export const prefersReducedMotion = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
