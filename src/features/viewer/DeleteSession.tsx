import { useState, type FormEvent } from 'react';
import { useResearch } from '../../app/research';
import { useT } from '../../i18n';
import { errorCode } from '../../core/errors';
import { BRAND } from '../../config/brand';
import { Field, inputClass } from '../../ui/kit';
import { PageIntro } from '../site/PageIntro';
import { SiteShell } from '../site/SiteShell';

/** Usuwanie danych przez widza kodem (§10.12) — w układzie serwisu (strona publiczna). */
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
    <SiteShell seo={{ title: `${d.title} — ${BRAND.name}` }}>
      <PageIntro narrow title={d.title} lead={state === 'done' ? undefined : d.lead} />
      <section className="l-light">
        <div className="mx-auto max-w-[808px] px-4 py-10 sm:px-6 md:py-14">
          <div className="max-w-[520px] rounded-[14px] border border-[var(--l-line)] bg-[var(--l-light-2)] p-6 sm:p-8">
            {state === 'done' ? (
              <p className="text-[16px] leading-relaxed" role="status">
                {d.done}
              </p>
            ) : (
              <form className="space-y-5" onSubmit={(e) => void submit(e)}>
                <Field label={d.sessionLabel}>{(fid, desc) => <input id={fid} aria-describedby={desc} className={`${inputClass} h-12 font-mono`} value={sessionId} onChange={(e) => setSessionId(e.target.value)} autoComplete="off" required />}</Field>
                <Field label={d.codeLabel} hint={d.codeHint} error={error}>
                  {(fid, desc) => <input id={fid} aria-describedby={desc} className={`${inputClass} h-12 font-mono uppercase`} value={code} onChange={(e) => setCode(e.target.value)} autoComplete="off" required />}
                </Field>
                <button type="submit" className="l-btn l-btn-primary w-full disabled:opacity-50" disabled={state === 'busy' || !sessionId.trim() || code.replace(/[^A-Za-z0-9]/g, '').length < 8}>
                  {d.submit}
                </button>
                <p className="text-[13.5px] leading-relaxed text-muted">{d.packageNote}</p>
              </form>
            )}
          </div>
        </div>
      </section>
    </SiteShell>
  );
}
