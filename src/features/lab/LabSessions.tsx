import { useMemo, useState } from 'react';
import { detectFixations } from '../../core/analysis/fixations';
import { computeStats, sessionDuration } from '../../core/analysis/stats';
import { formatTime } from '../../core/math/util';
import { brandSlug } from '../../config/brand';
import { downloadText, sessionToCSV, sessionToJSON } from '../../export/exporters';
import { useI18n } from '../../i18n';
import { Btn, Callout, Dialog, Surface } from '../../ui/kit';
import { useSessions } from './hooks';
import { useLab } from './LabContext';
import { Item, mediaLabel, QualityBadge, SessionBar, Stat } from './parts';

export function LabSessions() {
  const lab = useLab();
  const { t, tag } = useI18n();
  const s = t.lab.sessions;
  const sessions = useSessions();
  const session = lab.activeSession;
  const [confirm, setConfirm] = useState<string | null>(null);
  const stats = useMemo(() => (session ? computeStats(session.samples) : null), [session]);
  const fixations = useMemo(() => (session ? detectFixations(session.samples) : []), [session]);
  const nf = (n: number) => n.toLocaleString(tag);

  const remove = async (id: string) => {
    await lab.store.deleteSession(id);
    setConfirm(null);
    if (lab.activeSessionId === id) lab.openSession(null, 'sessions');
    lab.refreshSessions();
  };

  return (
    <div className="space-y-6">
      <h1 className="text-[28px] font-semibold tracking-[-0.02em] sm:text-[34px]">{s.title}</h1>
      {session && <SessionBar />}
      {session && stats ? (
        <>
          <Surface>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              <Stat label={t.lab.stats.watched} value={formatTime(stats.watchedSeconds, 0)} hint={s.mediaLength(formatTime(sessionDuration(session.samples, session.meta.video.duration), 0))} />
              <Stat label={s.validShare} value={`${Math.round(stats.validRatio * 100)}%`} hint={s.validShareHint} />
              <Stat label={s.validSamples} value={nf(stats.nValid)} hint={s.ofAll(nf(stats.nSamples))} />
              <Stat label={s.meanConfidence} value={`${Math.round(stats.avgConfidence * 100)}%`} hint={s.meanUncertainty((stats.avgUncertainty * 100).toFixed(1))} />
              <Stat label={s.dominant} value={stats.dominantRegion ? t.lab.heatmap.regions[stats.dominantRegion] : '–'} />
              <Stat label={s.streak} value={`${stats.longestStreakSeconds.toFixed(1)} s`} hint={s.fixCount(fixations.length)} />
            </div>
            <div className="mt-6 flex flex-wrap gap-2 border-t border-line pt-5">
              <Btn variant="primary" onClick={() => lab.setView('heatmap')}>
                {t.lab.nav.heatmap}
              </Btn>
              <Btn onClick={() => lab.setView('path')}>{t.lab.nav.path}</Btn>
              <Btn onClick={() => lab.setView('stats')}>{t.lab.nav.stats}</Btn>
              <Btn variant="quiet" onClick={() => downloadText(sessionToJSON(session, fixations), `${brandSlug()}_${session.meta.id}.json`, 'application/json')}>
                {s.exportJson}
              </Btn>
              <Btn variant="quiet" onClick={() => downloadText(sessionToCSV(session), `${brandSlug()}_${session.meta.id}.csv`, 'text/csv')}>
                {s.exportCsv}
              </Btn>
            </div>
          </Surface>
          <div className="grid gap-6 lg:grid-cols-2">
            <Surface>
              <h2 className="mb-3 text-[17px] font-semibold">{s.details}</h2>
              <dl className="grid grid-cols-2 gap-3">
                <Item label={s.media} value={mediaLabel(session.meta.video, t)} />
                <Item label={s.participant} value={session.meta.participant} />
                <Item label={s.source} value={t.lab.setup.sources[session.meta.source]} />
                <Item label={s.mode} value={t.lab.setup.modes[session.meta.mode]} />
                <Item label={s.screen} value={`${session.meta.screen.width}×${session.meta.screen.height}${session.meta.screen.fullscreen ? `, ${s.fullscreen}` : ''}`} />
                <Item label={s.engine} value={session.meta.engine.name} />
              </dl>
            </Surface>
            <Surface>
              <h2 className="mb-3 text-[17px] font-semibold">{s.calibration}</h2>
              {session.meta.calibration ? (
                <div className="space-y-3">
                  <QualityBadge quality={session.meta.calibration.quality} prefix={s.calibration} />
                  <dl className="grid grid-cols-2 gap-3">
                    <Item label={s.testError} value={session.meta.calibration.testError ? s.testErrorValue(session.meta.calibration.testError.xPct.toFixed(1), session.meta.calibration.testError.yPct.toFixed(1)) : '–'} />
                    <Item label={t.lab.calib.model} value={session.meta.calibration.model} />
                  </dl>
                </div>
              ) : (
                <p className="text-[14px] text-muted">{s.noCalibration}</p>
              )}
            </Surface>
          </div>
          {session.meta.mode === 'demo_overlay' && <Callout tone="warn">{s.overlayWarn}</Callout>}
        </>
      ) : (
        <Surface>
          <p className="text-muted">{s.choose}</p>
        </Surface>
      )}
      <Surface>
        <h2 className="mb-3 text-[17px] font-semibold">{s.all}</h2>
        {sessions.length === 0 ? (
          <p className="text-[14px] text-muted">{s.empty}</p>
        ) : (
          <ul className="divide-y divide-line">
            {sessions.map((m) => (
              <li key={m.id} className="flex flex-wrap items-center gap-3 py-3">
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold">{mediaLabel(m.video, t)}</div>
                  <div className="text-[13.5px] text-muted">{s.rowMeta(new Date(m.createdAt).toLocaleString(tag), m.participant, t.lab.setup.sources[m.source], nf(m.sampleCount))}</div>
                </div>
                <Btn size="sm" variant={m.id === lab.activeSessionId ? 'primary' : 'secondary'} onClick={() => lab.openSession(m.id)}>
                  {m.id === lab.activeSessionId ? s.opened : s.open}
                </Btn>
                <Btn size="sm" variant="danger" onClick={() => setConfirm(m.id)}>
                  {t.common.actions.delete}
                </Btn>
              </li>
            ))}
          </ul>
        )}
      </Surface>
      <Dialog open={confirm !== null} onClose={() => setConfirm(null)} title={s.confirmTitle}>
        <p className="text-[14.5px] text-muted">{s.confirmBody}</p>
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <Btn onClick={() => setConfirm(null)}>{t.common.actions.cancel}</Btn>
          <Btn variant="danger" onClick={() => confirm && void remove(confirm)}>
            {s.confirmDelete}
          </Btn>
        </div>
      </Dialog>
    </div>
  );
}
