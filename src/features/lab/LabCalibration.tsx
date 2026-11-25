import { useEffect, type ReactNode } from 'react';
import { DESKTOP_PLAN, planDurationMs, TEST_THRESHOLDS } from '../../core/calibration/calibration';
import { trackingHub } from '../../core/tracking/trackingHub';
import { useT } from '../../i18n';
import { Btn } from '../../ui/kit';
import { CalibrationTarget } from '../shared/CalibrationTarget';
import { useHubInfo } from '../shared/hooks';
import { useCalibration, type CalibrationOutcome } from '../shared/useCalibration';
import { useLab } from './LabContext';
import { QualityBadge } from './parts';

export function LabCalibration() {
  const lab = useLab();
  const hub = useHubInfo();
  const t = useT();
  const c = t.lab.calib;
  const { phase: runPhase, target, outcome, error, faceVisible, run, cancel } = useCalibration(DESKTOP_PLAN);
  const phase = runPhase === 'idle' ? 'intro' : runPhase;
  const back = lab.media ? 'setup' : 'live';

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        cancel();
        lab.leaveFullscreenView(back);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [lab, cancel, back]);

  const accept = (next: 'watch' | 'live') => {
    if (!outcome) return;
    lab.setCalibration({ model: outcome.model, summary: outcome.summary });
    if (next === 'watch') lab.setView('watch');
    else lab.leaveFullscreenView('live');
  };

  return (
    <div className="fixed inset-0 z-50 cursor-none select-none overflow-hidden bg-[#F7F9FC]">
      {(phase === 'calibrating' || phase === 'testing') && target && (
        <>
          <CalibrationTarget state={target} size={DESKTOP_PLAN.targetSize} />
          <div className="absolute inset-x-0 top-0 h-1 bg-line">
            <div className="h-full bg-cobalt" style={{ width: `${target.progress * 100}%` }} />
          </div>
          <p className="absolute bottom-6 left-1/2 -translate-x-1/2 text-[14px] text-muted">
            {phase === 'testing' ? c.progressTest(DESKTOP_PLAN.test.length) : c.progressCal}
            {!faceVisible && <span className="ml-2 font-semibold text-poor">{c.noFace}</span>}
          </p>
        </>
      )}
      {phase === 'intro' && (
        <Centered>
          <h1 className="max-w-[24ch] text-[34px] font-semibold tracking-[-0.02em]">{c.introTitle}</h1>
          <p className="mt-4 max-w-xl text-[17px] text-muted">{c.introBody(DESKTOP_PLAN.points.length, DESKTOP_PLAN.test.length, Math.round(planDurationMs(DESKTOP_PLAN) / 1000))}</p>
          {hub.status !== 'running' ? (
            <div className="mt-8 space-y-3">
              <p className="font-semibold text-poor">{hub.error ? ((t.errors as Record<string, string>)[hub.error] ?? t.errors.camera_unknown) : c.cameraOff}</p>
              <Btn variant="primary" size="lg" onClick={() => void trackingHub.start(lab.cameraId)}>
                {t.lab.camera.turnOn}
              </Btn>
            </div>
          ) : (
            <div className="mt-8 flex flex-wrap gap-3">
              <Btn variant="primary" size="lg" onClick={() => void run()}>
                {c.start}
              </Btn>
              <Btn size="lg" onClick={() => lab.leaveFullscreenView(back)}>
                {t.common.actions.cancel}
              </Btn>
            </div>
          )}
          <p className="mt-6 text-[14px] text-muted">{c.escHint}</p>
        </Centered>
      )}
      {phase === 'fitting' && (
        <Centered>
          <h1 className="text-[28px] font-semibold">{c.fitting}</h1>
        </Centered>
      )}
      {phase === 'error' && (
        <Centered>
          <h1 className="text-[28px] font-semibold">{c.errorTitle}</h1>
          <p className="mt-3 text-[17px] text-muted">{error ? ((t.errors as Record<string, string>)[error] ?? t.errors.unknown) : ''}</p>
          <p className="mt-1 text-muted">{c.errorHint}</p>
          <div className="mt-8 flex gap-3">
            <Btn variant="primary" size="lg" onClick={() => void run()}>
              {c.retry}
            </Btn>
            <Btn size="lg" onClick={() => lab.leaveFullscreenView('setup')}>
              {t.common.actions.back}
            </Btn>
          </div>
        </Centered>
      )}
      {phase === 'result' && outcome && <Result outcome={outcome} onRetry={() => void run()} onAccept={accept} hasMedia={!!lab.media} />}
    </div>
  );
}

function Centered({ children }: { children: ReactNode }) {
  return <div className="absolute inset-0 flex cursor-auto flex-col items-start justify-center px-[10vw]">{children}</div>;
}

function Result({ outcome, onRetry, onAccept, hasMedia }: { outcome: CalibrationOutcome; onRetry(): void; onAccept(next: 'watch' | 'live'): void; hasMedia: boolean }) {
  const t = useT();
  const c = t.lab.calib;
  const { summary, test } = outcome;
  const W = window.innerWidth;
  const H = window.innerHeight;
  return (
    <div className="absolute inset-0 cursor-auto">
      {test?.perPoint.map((p) => (
        <svg key={p.pointId} className="pointer-events-none absolute inset-0" width={W} height={H} aria-hidden>
          <line x1={p.target.x * W} y1={p.target.y * H} x2={p.pred.x * W} y2={p.pred.y * H} stroke="#C03636" strokeWidth="2" strokeDasharray="6 5" />
          <circle cx={p.target.x * W} cy={p.target.y * H} r="12" fill="none" stroke="#1F2A44" strokeWidth="3" />
          <circle cx={p.pred.x * W} cy={p.pred.y * H} r="7" fill="#C03636" />
        </svg>
      ))}
      <div className="absolute left-1/2 top-1/2 w-[min(560px,92vw)] -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-surface p-6 shadow-xl ring-1 ring-line sm:p-8">
        <QualityBadge quality={summary.quality} prefix={c.qualityPrefix} />
        <h1 className="mt-4 text-[24px] font-semibold tracking-[-0.01em]">{c.result[summary.quality]}</h1>
        <dl className="tabular mt-6 grid grid-cols-2 gap-4 text-[14px]">
          <div>
            <dt className="text-muted">{c.errX}</dt>
            <dd className="text-[19px] font-semibold">{test ? c.pctW(test.xPct.toFixed(1)) : c.noData}</dd>
          </div>
          <div>
            <dt className="text-muted">{c.errY}</dt>
            <dd className="text-[19px] font-semibold">{test ? c.pctH(test.yPct.toFixed(1)) : c.noData}</dd>
          </div>
          <div>
            <dt className="text-muted">{c.model}</dt>
            <dd className="font-semibold">{summary.model}</dd>
          </div>
          <div>
            <dt className="text-muted">{c.samples}</dt>
            <dd className="font-semibold">{summary.samples}</dd>
          </div>
        </dl>
        <p className="mt-4 text-[12.5px] text-muted">{c.thresholds(TEST_THRESHOLDS.good.x, TEST_THRESHOLDS.good.y, TEST_THRESHOLDS.fair.x, TEST_THRESHOLDS.fair.y)}</p>
        <div className="mt-6 flex flex-wrap gap-3">
          {hasMedia ? (
            <Btn variant={summary.quality === 'POOR' ? 'secondary' : 'primary'} size="lg" onClick={() => onAccept('watch')}>
              {summary.quality === 'POOR' ? c.continueAnyway : c.toMedia}
            </Btn>
          ) : (
            <Btn variant="primary" size="lg" onClick={() => onAccept('live')}>
              {c.toLive}
            </Btn>
          )}
          <Btn variant={summary.quality === 'POOR' ? 'primary' : 'secondary'} size="lg" onClick={onRetry}>
            {c.retry}
          </Btn>
        </div>
      </div>
    </div>
  );
}
