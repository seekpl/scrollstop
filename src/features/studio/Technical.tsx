import { navigate, pathOf } from '../../app/router';
import { useResearch } from '../../app/research';
import { brandSlug } from '../../config/brand';
import { SCHEMA_VERSION, type Session } from '../../core/contracts/types';
import { downloadText } from '../../export/exporters';
import { useI18n } from '../../i18n';
import { expandSamples } from '../../research/compact';
import type { ViewerSession } from '../../research/model';
import { planFor } from '../../research/plans';
import { assessSession } from '../../research/sessions';
import { Btn, Callout, Section } from '../../ui/kit';
import { getLabStore, LAB_OPEN_KEY } from '../lab/labStore';
import { projectToCsv, projectToJson } from './exportRaw';
import type { ProjectCtx } from './ProjectPage';

/** Sesja widza → sesja laboratorium (ścieżka wzroku, fiksacje, statystyki). */
function toLabSession(s: ViewerSession, mediaName: string, width: number, height: number): Session {
  const samples = expandSamples(s.data);
  return {
    meta: {
      schemaVersion: SCHEMA_VERSION,
      id: `lab_${s.id}`,
      createdAt: s.createdAt,
      endedAt: s.createdAt,
      mode: 'measurement',
      source: s.source === 'webcam' ? 'webcam' : 'simulated',
      participant: s.participantId,
      video: { kind: 'file', name: mediaName, duration: s.mediaDuration, width, height },
      screen: { width: s.device.screenW, height: s.device.screenH, dpr: s.device.dpr, fullscreen: true },
      engine: { name: 'study', smoothingLevel: 2 },
      sampleCount: samples.length,
      disclaimerShown: true,
    },
    samples,
  };
}

/** Analiza techniczna (§9.5): szczegóły sesji, otwarcie w laboratorium, eksport surowych danych. */
export function Technical({ project, sessions }: ProjectCtx) {
  const { t, locale } = useI18n();
  const x = t.studio.technical;
  const { can } = useResearch();
  const nf = (v: number, d = 1) => new Intl.NumberFormat(locale === 'pl' ? 'pl-PL' : 'en-US', { maximumFractionDigits: d }).format(v);
  const open = async (s: ViewerSession) => {
    const v = project.variants.find((q) => q.id === s.variantId) ?? project.variants[0];
    const lab = toLabSession(s, v.media?.kind === 'demo' ? v.media.demo : v.mediaName, v.width, v.height);
    if (v.media?.kind === 'demo') lab.meta.video = { ...lab.meta.video, kind: 'demo', name: v.media.demo };
    const store = getLabStore();
    await store.saveMeta(lab.meta);
    await store.appendSamples(lab.meta.id, 0, lab.samples);
    try {
      sessionStorage.setItem(LAB_OPEN_KEY, lab.meta.id);
    } catch {
      /* bez sessionStorage laboratorium otworzy listę */
    }
    navigate(pathOf({ name: 'lab' }));
  };
  return (
    <div className="space-y-10">
      <Section title={x.exportTitle}>
        {can.rawExport ? (
          <div className="flex flex-wrap gap-2">
            <Btn onClick={() => downloadText(projectToJson(project, sessions), `${brandSlug()}_${project.id}.json`, 'application/json')}>{x.json}</Btn>
            <Btn onClick={() => downloadText(projectToCsv(project, sessions), `${brandSlug()}_${project.id}.csv`, 'text/csv')}>{x.csv}</Btn>
          </div>
        ) : (
          <Callout tone="locked">{x.exportLocked(t.billing.planNames[planFor('rawExport')])}</Callout>
        )}
      </Section>
      <Section title={x.tableTitle}>
        {sessions.length === 0 ? (
          <p className="text-[14px] text-muted">{t.studio.collect.emptyBody}</p>
        ) : (
          <div className="relative overflow-x-auto rounded-2xl bg-surface ring-1 ring-line">
            <table className="w-full min-w-[860px] text-left text-[13.5px]">
              <caption className="sr-only">{x.tableTitle}</caption>
              <thead className="text-[12.5px] text-muted">
                <tr className="border-b border-line">
                  {[x.cols.participant, x.cols.device, x.cols.screen, x.cols.calError, x.cols.samples, x.cols.reliable, ''].map((h, i) => (
                    <th key={i} className="px-4 py-3 font-semibold">
                      {h || <span className="sr-only">{x.cols.open}</span>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sessions.map((s) => {
                  const a = assessSession(s);
                  return (
                    <tr key={s.id} className="border-b border-line last:border-0">
                      <td className="px-4 py-3 font-mono text-[12.5px]">{s.participantId}</td>
                      <td className="px-4 py-3">
                        {t.common.devices[s.device.type]}, {t.common.orientation[s.device.orientation]}
                      </td>
                      <td className="tabular px-4 py-3">
                        {s.device.screenW}×{s.device.screenH} @{s.device.dpr}x
                      </td>
                      <td className="tabular px-4 py-3">{s.calibration && s.calibration.xPct !== null ? `${nf(s.calibration.xPct)}% / ${nf(s.calibration.yPct ?? 0)}%` : '–'}</td>
                      <td className="tabular px-4 py-3">{s.data.tc.length.toLocaleString(locale === 'pl' ? 'pl-PL' : 'en-US')}</td>
                      <td className="tabular px-4 py-3">{x.reliable(nf(a.playedSeconds * a.determinateShare, 0))}</td>
                      <td className="px-4 py-3 text-right">
                        <Btn size="sm" variant="quiet" onClick={() => void open(s)}>
                          {x.openLab}
                        </Btn>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </div>
  );
}
