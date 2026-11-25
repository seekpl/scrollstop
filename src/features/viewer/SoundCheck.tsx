import { useState } from 'react';
import { useT } from '../../i18n';
import { playTestTone } from '../shared/browser';
import { BigButton, Screen, Title } from './parts';

/**
 * Sprawdzenie dźwięku (§10.6): przy warunku `on` krótki dźwięk testowy i „Słyszę” / „Nie słyszę”;
 * po 2 próbach „Kontynuuj bez dźwięku” (audio.confirmed = false). Przy `viewer` widz najpierw wybiera.
 */
export function SoundCheck({ mode, onDone }: { mode: 'on' | 'viewer'; onDone(audio: { mode: 'on' | 'off'; confirmed: boolean }): void }) {
  const t = useT();
  const s = t.viewer.sound;
  const [step, setStep] = useState<'choose' | 'test'>(mode === 'viewer' ? 'choose' : 'test');
  const [played, setPlayed] = useState(false);
  const [fails, setFails] = useState(0);
  const play = async () => {
    setPlayed(true);
    await playTestTone();
  };
  if (step === 'choose') {
    return (
      <Screen>
        <div className="space-y-6">
          <Title>{s.chooseTitle}</Title>
          <p className="text-[15px] text-muted">{s.chooseBody}</p>
          <BigButton onClick={() => setStep('test')}>{s.withSound}</BigButton>
          <BigButton variant="secondary" onClick={() => onDone({ mode: 'off', confirmed: false })}>
            {s.withoutSound}
          </BigButton>
        </div>
      </Screen>
    );
  }
  return (
    <Screen>
      <div className="space-y-6">
        <Title>{s.title}</Title>
        <p className="text-[15px] text-muted">{s.body}</p>
        <BigButton variant={played ? 'secondary' : 'primary'} onClick={() => void play()}>
          {played ? s.playAgain : s.play}
        </BigButton>
        {played && (
          <div className="space-y-3">
            <BigButton onClick={() => onDone({ mode: 'on', confirmed: true })}>{s.hear}</BigButton>
            <BigButton variant="secondary" onClick={() => setFails((f) => f + 1)}>
              {s.dontHear}
            </BigButton>
          </div>
        )}
        {fails > 0 && (
          <div className="space-y-3 rounded-2xl bg-surface p-4 ring-1 ring-line">
            <p className="text-[15px] font-semibold">{s.helpTitle}</p>
            <ul className="list-disc space-y-1 pl-5 text-[14.5px] text-muted">
              {s.help.map((h) => (
                <li key={h}>{h}</li>
              ))}
            </ul>
            {fails >= 2 && (
              <BigButton variant="secondary" onClick={() => onDone({ mode: 'on', confirmed: false })}>
                {s.continueMuted}
              </BigButton>
            )}
          </div>
        )}
      </div>
    </Screen>
  );
}
