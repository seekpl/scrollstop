import { useEffect, useRef, useState } from 'react';
import { pathOf } from '../../app/router';
import { useResearch } from '../../app/research';
import { brandSlug } from '../../config/brand';
import { COMPANY, salesEmail } from '../../config/company';
import { downloadText } from '../../export/exporters';
import { useT } from '../../i18n';
import { encodePackage } from '../../research/compact';
import type { StudyConfig, ViewerSession } from '../../research/model';
import { BigButton, Screen, Title } from './parts';
import { clearPending, queueSession } from './outbox';

type FinishState = 'ask' | 'sending' | 'sent' | 'failed' | 'package' | 'declined' | 'reported' | 'redirect';

/**
 * Zakończenie (§10.11): przerwane → pytanie o wysłanie; ukończone → wysyłka automatyczna i kod
 * usunięcia (serwer), kolejka przy błędzie sieci, plik do odesłania (link samowystarczalny),
 * przekierowanie panelu.
 */
export function FinishScreen({ config, session, completed, reported, simulated }: { config: StudyConfig; session: ViewerSession; completed: boolean; reported: boolean; simulated: boolean }) {
  const t = useT();
  const f = t.viewer.finish;
  const { api } = useResearch();
  const initial: FinishState = reported ? 'reported' : !completed ? 'ask' : config.transport === 'package' ? 'package' : 'sending';
  const [state, setState] = useState<FinishState>(initial);
  const [code, setCode] = useState<{ id: string; code: string } | null>(null);
  const sent = useRef(false);

  const redirectPanel = (kind: 'complete' | 'quality_fail') => {
    const p = config.panel;
    if (!p) return false;
    const target = kind === 'complete' ? p.completeUrl : p.qualityFailUrl;
    if (!/^https:\/\//.test(target)) return false;
    setState('redirect');
    window.location.assign(target);
    return true;
  };

  const send = async () => {
    if (config.transport === 'package') return setState('package');
    setState('sending');
    try {
      const r = await api.submitSession(config.linkToken, session);
      await clearPending(session.id);
      if (redirectPanel(r.status === 'valid' ? 'complete' : 'quality_fail')) return;
      setCode(r.deletionCode && config.transport === 'server' ? { id: r.sessionId, code: r.deletionCode } : null);
      setState('sent');
    } catch {
      await queueSession(config.linkToken, session);
      setState('failed');
    }
  };

  useEffect(() => {
    if (state === 'sending' && !sent.current) {
      sent.current = true;
      void send();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fileName = `${brandSlug()}-${f.fileStem}-${session.id}.json`;
  const share = async () => {
    const text = encodePackage(session);
    const file = new File([text], fileName, { type: 'application/json' });
    const nav = navigator as Navigator & { canShare?(d: { files: File[] }): boolean };
    if (nav.canShare?.({ files: [file] }) && navigator.share) {
      try {
        await navigator.share({ files: [file], title: f.shareTitle, text: f.shareText(config.creatorName) });
        return;
      } catch {
        /* anulowano udostępnianie — zostaje pobranie pliku */
      }
    }
    downloadText(text, fileName, 'application/json');
  };

  return (
    <Screen>
      <div className="mt-6 space-y-6">
        {state === 'ask' && (
          <>
            <Title>{f.stoppedTitle}</Title>
            <p className="text-[16px] leading-relaxed text-muted">{f.stoppedBody}</p>
            <BigButton onClick={() => void send()}>{f.sendCollected}</BigButton>
            <BigButton variant="secondary" onClick={() => setState('declined')}>
              {f.dontSend}
            </BigButton>
          </>
        )}
        {state === 'declined' && (
          <>
            <Title>{f.declinedTitle}</Title>
            <p className="text-[16px] text-muted">{f.declined}</p>
          </>
        )}
        {state === 'reported' && (
          <>
            <Title>{f.reportedTitle}</Title>
            <p className="text-[16px] leading-relaxed text-muted">{f.reportedBody}</p>
            <a className="inline-flex min-h-10 items-center text-[15px] font-semibold text-cobalt underline underline-offset-4" href={`mailto:${salesEmail()}?subject=${encodeURIComponent(f.reportSubject(config.projectId))}`}>
              {f.reportContact(COMPANY.email)}
            </a>
          </>
        )}
        {state === 'sending' && <Title>{f.sending}</Title>}
        {state === 'redirect' && <Title>{f.redirecting}</Title>}
        {(state === 'sent' || state === 'package' || state === 'failed') && <h1 className="text-[30px] font-semibold leading-tight">{f.thanks}</h1>}
        {state === 'sent' && config.transport === 'local' && (
          <a href={pathOf({ name: 'project', id: config.projectId, step: 'collect' })} className="inline-flex min-h-10 items-center text-[15px] font-semibold text-cobalt underline underline-offset-4">
            {f.backToProject}
          </a>
        )}
        {state === 'sent' && simulated && <p className="text-[14px] text-muted">{f.simulatedNote}</p>}
        {state === 'sent' && code && (
          <div className="space-y-3 rounded-2xl bg-surface p-5 ring-1 ring-line">
            <p className="text-[15px] leading-relaxed">{f.codeNote}</p>
            <p className="font-mono text-[26px] font-bold tracking-widest" data-testid="deletion-code">
              {code.code}
            </p>
            <p className="text-[13.5px] text-muted">
              {f.sessionNumber} <span className="font-mono">{code.id}</span>
            </p>
            <a href={pathOf({ name: 'delete-session', id: code.id })} className="inline-flex min-h-10 items-center text-[15px] font-semibold text-cobalt underline underline-offset-4">
              {f.deleteData}
            </a>
          </div>
        )}
        {state === 'failed' && (
          <div className="space-y-3">
            <p className="text-[15px] leading-relaxed text-muted">{f.failedBody}</p>
            <BigButton onClick={() => void send()}>{f.sendNow}</BigButton>
          </div>
        )}
        {state === 'package' && (
          <div className="space-y-4">
            <p className="text-[16px] leading-relaxed text-muted">{f.packageBody(config.creatorName)}</p>
            <BigButton onClick={() => void share()}>{f.sendResults(config.creatorName)}</BigButton>
            <p className="text-[13.5px] text-muted">{f.packageNote}</p>
          </div>
        )}
      </div>
    </Screen>
  );
}
