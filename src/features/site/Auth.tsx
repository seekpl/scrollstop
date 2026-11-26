import { useState, type FormEvent, type ReactNode } from 'react';
import { hashQuery, hrefOf, navigate, pathOf } from '../../app/router';
import { useResearch } from '../../app/research';
import { errorCode } from '../../core/errors';
import { useI18n } from '../../i18n';
import { Field, inputClass } from '../../ui/kit';
import { BRAND } from '../../config/brand';
import { PageIntro } from './PageIntro';
import { SiteShell } from './SiteShell';

const EMAIL_RE = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,24}$/;
const MIN_PASSWORD = 10;

/** Dokąd wrócić po zalogowaniu: tylko adresy tej aplikacji (`#/…`), bez przekierowań na zewnątrz. */
export function nextTarget(): string {
  const next = hashQuery().get('next');
  return next && /^#\/[A-Za-z0-9/_\-.?=&]*$/.test(next) ? next : pathOf({ name: 'projects' });
}

function AuthCard({ title, lead, children }: { title: string; lead?: string; children: ReactNode }) {
  return (
    <SiteShell seo={{ title: `${title} — ${BRAND.name}` }}>
      <PageIntro title={title} lead={lead} narrow />
      <section className="l-light">
        <div className="mx-auto max-w-[808px] px-4 py-10 sm:px-6 md:py-14">
          <div className="max-w-[480px] rounded-[14px] border border-[var(--l-line)] bg-[var(--l-light-2)] p-6 sm:p-8 [&_.text-cobalt]:text-[var(--l-accent-deep)] [&_.text-muted]:text-[var(--l-muted)]">{children}</div>
        </div>
      </section>
    </SiteShell>
  );
}

/** Tryb lokalny: konto nie jest potrzebne — studio działa w tej przeglądarce. */
function LocalNotice({ title }: { title: string }) {
  const { t } = useI18n();
  return (
    <AuthCard title={title} lead={t.site.auth.localMode}>
      <a href={hrefOf({ name: 'projects' })} className="l-btn l-btn-primary">
        {t.site.auth.toStudio}
      </a>
    </AuthCard>
  );
}

function useSubmit() {
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
    } catch (e) {
      setError((t.errors as Record<string, string>)[errorCode(e)] ?? t.errors.unknown);
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, setError, run };
}

/** Logowanie (§9.7): ten sam komunikat dla złego e-maila i hasła. */
export function LoginPage() {
  const { t } = useI18n();
  const a = t.site.auth;
  const { api, refreshAccount } = useResearch();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { busy, error, run } = useSubmit();
  if (api.mode === 'local') return <LocalNotice title={a.loginTitle} />;
  const submit = (e: FormEvent) => {
    e.preventDefault();
    void run(async () => {
      await api.login(email.trim(), password);
      await refreshAccount();
      navigate(nextTarget());
    });
  };
  const next = hashQuery().get('next');
  return (
    <AuthCard title={a.loginTitle}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field label={a.email}>{(id) => <input id={id} type="email" autoComplete="email" required className={inputClass} value={email} onChange={(e) => setEmail(e.target.value)} />}</Field>
        <Field label={a.password}>{(id) => <input id={id} type="password" autoComplete="current-password" required className={inputClass} value={password} onChange={(e) => setPassword(e.target.value)} />}</Field>
        {error && (
          <p className="text-[14px] font-semibold text-poor" role="alert">
            {error}
          </p>
        )}
        <button type="submit" className="l-btn l-btn-primary w-full disabled:opacity-60" disabled={busy || !email || !password}>
          {busy ? a.busy : a.login}
        </button>
      </form>
      <p className="mt-6 text-[14px] text-muted">
        {a.noAccount}{' '}
        <a className="font-semibold text-cobalt underline underline-offset-4" href={`${hrefOf({ name: 'register' })}${next ? `?next=${encodeURIComponent(next)}` : ''}`}>
          {a.register}
        </a>
      </p>
    </AuthCard>
  );
}

/** Rejestracja (§9.7): imię i nazwisko, firma lub kanał, e-mail służbowy, hasło od 10 znaków. */
export function RegisterPage() {
  const { t } = useI18n();
  const a = t.site.auth;
  const { api, refreshAccount } = useResearch();
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const { busy, error, run } = useSubmit();
  if (api.mode === 'local') return <LocalNotice title={a.registerTitle} />;
  const emailError = touched.email && !EMAIL_RE.test(email.trim()) ? t.errors.invalid_email : null;
  const passwordError = touched.password && password.length < MIN_PASSWORD ? t.errors.weak_password : null;
  const valid = EMAIL_RE.test(email.trim()) && password.length >= MIN_PASSWORD;
  const submit = (e: FormEvent) => {
    e.preventDefault();
    setTouched({ email: true, password: true });
    if (!valid) return;
    void run(async () => {
      await api.register({ email: email.trim(), password, name: name.trim(), company: company.trim() });
      await refreshAccount();
      navigate(nextTarget());
    });
  };
  const next = hashQuery().get('next');
  return (
    <AuthCard title={a.registerTitle} lead={a.registerLead}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field label={a.name}>{(id) => <input id={id} autoComplete="name" className={inputClass} value={name} maxLength={120} onChange={(e) => setName(e.target.value)} />}</Field>
        <Field label={a.company} hint={a.companyHint}>
          {(id, d) => <input id={id} aria-describedby={d} autoComplete="organization" className={inputClass} value={company} maxLength={120} onChange={(e) => setCompany(e.target.value)} />}
        </Field>
        <Field label={a.workEmail} error={emailError ?? undefined}>
          {(id, d) => <input id={id} aria-describedby={d} type="email" autoComplete="email" className={inputClass} value={email} onChange={(e) => setEmail(e.target.value)} onBlur={() => setTouched((x) => ({ ...x, email: true }))} />}
        </Field>
        <Field label={a.password} hint={a.passwordHint} error={passwordError ?? undefined}>
          {(id, d) => <input id={id} aria-describedby={d} type="password" autoComplete="new-password" className={inputClass} value={password} onChange={(e) => setPassword(e.target.value)} onBlur={() => setTouched((x) => ({ ...x, password: true }))} />}
        </Field>
        {error && (
          <p className="text-[14px] font-semibold text-poor" role="alert">
            {error}
          </p>
        )}
        <button type="submit" className="l-btn l-btn-primary w-full disabled:opacity-60" disabled={busy}>
          {busy ? a.busy : a.createAccount}
        </button>
        <p className="text-[12.5px] leading-relaxed text-muted">
          {a.terms}{' '}
          <a className="font-semibold text-ink underline underline-offset-4" href={hrefOf({ name: 'terms' })} target="_blank" rel="noopener">
            {t.site.nav.terms}
          </a>
          {' · '}
          <a className="font-semibold text-ink underline underline-offset-4" href={hrefOf({ name: 'privacy' })} target="_blank" rel="noopener">
            {t.site.nav.privacy}
          </a>
        </p>
      </form>
      <p className="mt-6 text-[14px] text-muted">
        {a.haveAccount}{' '}
        <a className="font-semibold text-cobalt underline underline-offset-4" href={`${hrefOf({ name: 'login' })}${next ? `?next=${encodeURIComponent(next)}` : ''}`}>
          {a.login}
        </a>
      </p>
    </AuthCard>
  );
}
