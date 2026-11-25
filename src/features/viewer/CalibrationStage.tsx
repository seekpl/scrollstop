import { useState } from 'react';
import { DESKTOP_PLAN, MOBILE_PLAN, planDurationMs } from '../../core/calibration/calibration';
import { MEASUREMENT } from '../../core/config';
import { useT } from '../../i18n';
import { enterFullscreen } from '../shared/browser';
import { CalibrationTarget } from '../shared/CalibrationTarget';
import { useCalibration, type CalibrationOutcome } from '../shared/useCalibration';
import { BigButton, Screen, Title } from './parts';

/**
 * Kalibracja widza (§10.7): ekran wstępny, punkt na pełnym ekranie (komputer: ukryty kursor),
 * wynik. Przy POOR: „Spróbuj jeszcze raz”, po 2 próbach także „Kontynuuj mimo to” (sesja zostanie
 * odrzucona automatycznie, widz nie jest karany).
 */
export function CalibrationStage({ mobile, onDone }: { mobile: boolean; onDone(o: CalibrationOutcome): void }) {
  const t = useT();
  const c = t.viewer.calibration;
  const plan = mobile ? MOBILE_PLAN : DESKTOP_PLAN;
  const cal = useCalibration(plan);
  const [attempts, setAttempts] = useState(0);
  const start = () => {
    if (!mobile) enterFullscreen();
    setAttempts((a) => a + 1);
    void cal.run();
  };
  const running = cal.phase === 'calibrating' || cal.phase === 'testing';
  if (running && cal.target) {
    return (
      <div className={`fixed inset-0 z-[90] select-none overflow-hidden bg-[#F7F9FC] ${mobile ? '' : 'cursor-none'}`}>
        <CalibrationTarget state={cal.target} size={plan.targetSize} />
        <div className="absolute inset-x-0 top-0 h-1 bg-line" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(cal.target.progress * 100)}>
          <div className="h-full bg-cobalt" style={{ width: `${cal.target.progress * 100}%` }} />
        </div>
        {!cal.faceVisible && <p className="absolute bottom-8 left-1/2 -translate-x-1/2 rounded-full bg-surface px-4 py-2 text-[14px] font-semibold text-poor shadow">{c.faceMissing}</p>}
      </div>
    );
  }
  const poor = cal.outcome?.summary.quality === 'POOR';
  return (
    <Screen>
      <div className="space-y-6">
        {cal.phase === 'idle' && (
          <>
            <Title>{c.title}</Title>
            <p className="text-[16px] leading-relaxed text-muted">{c.intro(mobile, Math.round(planDurationMs(plan) / 1000 / 5) * 5)}</p>
            <BigButton onClick={start}>{c.start}</BigButton>
          </>
        )}
        {cal.phase === 'fitting' && <Title>{c.fitting}</Title>}
        {cal.phase === 'error' && (
          <>
            <Title>{c.poorTitle}</Title>
            <p className="text-[16px] text-muted">{c.poorBody}</p>
            <BigButton onClick={start}>{c.again}</BigButton>
          </>
        )}
        {cal.phase === 'result' && cal.outcome && (
          <>
            <Title>{poor ? c.poorTitle : c.goodTitle}</Title>
            <p className="text-[16px] leading-relaxed text-muted">{poor ? c.poorBody : c.goodBody}</p>
            {poor ? (
              <div className="space-y-3">
                <BigButton onClick={start}>{c.again}</BigButton>
                {attempts >= MEASUREMENT.calibration.attemptsBeforeContinue && (
                  <>
                    <BigButton variant="secondary" onClick={() => onDone(cal.outcome as CalibrationOutcome)}>
                      {c.continueAnyway}
                    </BigButton>
                    <p className="text-[13.5px] text-muted">{c.poorNote}</p>
                  </>
                )}
              </div>
            ) : (
              <BigButton
                onClick={() => {
                  if (!mobile) enterFullscreen();
                  onDone(cal.outcome as CalibrationOutcome);
                }}
              >
                {c.play}
              </BigButton>
            )}
          </>
        )}
      </div>
    </Screen>
  );
}
