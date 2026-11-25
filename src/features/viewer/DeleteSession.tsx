import { useState, type FormEvent } from 'react';
import { useResearch } from '../../app/research';
import { useT } from '../../i18n';
import { errorCode } from '../../core/errors';
import { Field, inputClass } from '../../ui/kit';
import { BigButton, Screen, Title } from './parts';

/** Usuwanie danych przez widza kodem (§10.12). */
export function DeleteSessionPage({ id }: { id: string | null }) {
  const t = useT();
  const d = t.viewer.deletion;
  const { api } = useResearch();
  const [sessionId, setSessionId] = useState(id ?? '');
  const [code, setCode] = useState('');
  const [state, setState] = useState<'idle' | 'busy' | 'done'>('idle');
  const [error, setError] = useState<string | null>(null);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setState('busy');
    try {
      await api.deleteSessionByCode(sessionId.trim(), code);
      setState('done');
    } catch (err) {
      setError((t.errors as Record<string, string>)[errorCode(err)] ?? t.errors.bad_code);
      setState('idle');
    }
  };
  return (
    <Screen>
      <div className="space-y-6">
        <Title>{d.title}</Title>
        {state === 'done' ? (
          <p className="text-[16px] leading-relaxed" role="status">
            {d.done}
          </p>
        ) : (
          <form className="space-y-5" onSubmit={(e) => void submit(e)}>
            <p className="text-[15px] leading-relaxed text-muted">{d.lead}</p>
            <Field label={d.sessionLabel}>{(fid, desc) => <input id={fid} aria-describedby={desc} className={`${inputClass} h-12 font-mono`} value={sessionId} onChange={(e) => setSessionId(e.target.value)} autoComplete="off" required />}</Field>
            <Field label={d.codeLabel} hint={d.codeHint} error={error}>
              {(fid, desc) => <input id={fid} aria-describedby={desc} className={`${inputClass} h-12 font-mono uppercase`} value={code} onChange={(e) => setCode(e.target.value)} autoComplete="off" required />}
            </Field>
            <BigButton type="submit" disabled={state === 'busy' || !sessionId.trim() || code.replace(/[^A-Za-z0-9]/g, '').length < 8}>
              {d.submit}
            </BigButton>
            <p className="text-[13.5px] leading-relaxed text-muted">{d.packageNote}</p>
          </form>
        )}
      </div>
    </Screen>
  );
}
