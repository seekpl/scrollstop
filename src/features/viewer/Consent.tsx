import { useState } from 'react';
import { pathOf } from '../../app/router';
import { useI18n } from '../../i18n';
import { AGE_BANDS, type AgeBand, type ConsentRecord, type StudyConfig } from '../../research/model';
import { BigButton, Screen, Steps } from './parts';

export type AgeChoice = AgeBand | 'under18';

/**
 * Zgoda dorosłego widza (§10.2): kto prowadzi badanie, co się dzieje z danymi, przedział wieku
 * (poniżej 18 kończy badanie), dwa potwierdzenia. Zapis zgody z wersją i językiem.
 */
export function ConsentScreen({ config, simulated, onAccept, onUnderage, onScreenout }: { config: StudyConfig; simulated: boolean; onAccept(c: ConsentRecord, age: AgeBand): void; onUnderage(): void; onScreenout(): void }) {
  const { t, locale } = useI18n();
  const c = t.viewer.consent;
  const [age, setAge] = useState<AgeChoice | ''>('');
  const [adult, setAdult] = useState(false);
  const [processing, setProcessing] = useState(false);
  const length = config.variant.duration;
  const watchBody = !length ? c.steps.watchNoLength : length >= 90 ? c.steps.watchMinutes(Math.round(length / 60)) : c.steps.watchSeconds(Math.round(length));
  const steps: Array<[string, string]> = [
    [c.steps.prepare, c.steps.prepareBody],
    ...(simulated ? [] : [[c.steps.calibration, c.steps.calibrationBody] as [string, string]]),
    [c.steps.watch, watchBody],
    ...(config.questions.length ? [[c.steps.questions, c.steps.questionsBody] as [string, string]] : []),
  ];
  const accept = () => {
    if (!age) return;
    if (age === 'under18') return onUnderage();
    if (!config.ageBands.includes(age)) return onScreenout();
    onAccept({ version: config.consentVersion, acceptedAt: new Date().toISOString(), adult: true, processing: true, localOnly: true, lang: locale }, age);
  };
  return (
    <Screen wide>
      <div className="space-y-7">
        {simulated && <span className="inline-block rounded-lg bg-surface px-2.5 py-1 text-[13px] font-semibold text-muted ring-1 ring-line">{c.testMode}</span>}
        <div>
          <p className="text-[15px] font-semibold text-cobalt">{config.creatorName}</p>
          <h1 className="mt-1 text-[30px] font-semibold leading-tight tracking-[-0.02em]">{c.title}</h1>
        </div>
        <Steps items={steps} />
        <section className="space-y-3 rounded-2xl bg-surface p-5 ring-1 ring-line">
          <h2 className="text-[18px] font-semibold">{c.dataTitle}</h2>
          <p className="text-[15px] leading-relaxed">
            {c.cameraBefore}
            <strong>{c.cameraStrong}</strong>
            {c.cameraAfter}
          </p>
          <p className="text-[15px] leading-relaxed text-muted">{c.stored(config.creatorName, config.retentionDays)}</p>
          <a href={pathOf({ name: 'privacy' })} target="_blank" rel="noreferrer" className="inline-flex min-h-9 items-center text-[15px] font-semibold text-cobalt underline underline-offset-4">
            {c.privacyLink}
          </a>
        </section>
        <div className="space-y-2">
          <label htmlFor="age" className="text-[15px] font-semibold">
            {c.ageLabel}
          </label>
          <select id="age" value={age} onChange={(e) => setAge(e.target.value as AgeChoice)} className="h-12 w-full rounded-2xl bg-surface px-4 text-[16px] ring-1 ring-inset ring-field">
            <option value="" disabled>
              {c.agePlaceholder}
            </option>
            <option value="under18">{c.under18}</option>
            {AGE_BANDS.map((a) => (
              <option key={a} value={a}>
                {t.common.ageBands[a]}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-3">
          <label className="flex gap-3 text-[15px] leading-snug">
            <input type="checkbox" checked={adult} onChange={(e) => setAdult(e.target.checked)} className="mt-0.5 h-6 w-6 shrink-0 accent-cobalt" />
            {c.adult}
          </label>
          <label className="flex gap-3 text-[15px] leading-snug">
            <input type="checkbox" checked={processing} onChange={(e) => setProcessing(e.target.checked)} className="mt-0.5 h-6 w-6 shrink-0 accent-cobalt" />
            {c.processing}
          </label>
        </div>
        <BigButton disabled={!adult || !processing || !age} onClick={accept}>
          {c.accept}
        </BigButton>
        <p className="text-[13.5px] text-muted">{c.withdraw}</p>
      </div>
    </Screen>
  );
}
