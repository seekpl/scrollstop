import { useRef, useState } from 'react';
import { useResearch } from '../../app/research';
import { salesEmail } from '../../config/company';
import { errorCode } from '../../core/errors';
import { useI18n } from '../../i18n';
import { formatMoney } from '../../i18n/format';
import { LOCALE_NAMES } from '../../i18n/locales';
import { AGE_BANDS, type AgeBand, type Project } from '../../research/model';
import { PANEL } from '../../research/plans';
import { Btn, Callout, Dialog, Field, inputClass, Segmented } from '../../ui/kit';
import { leaveTo } from './browser';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Kody krajów z pola tekstowego („pl, DE” → PL, DE), bez powtórzeń, najwyżej 30. */
export function parseCountries(text: string): string[] {
  return [...new Set((text.toUpperCase().match(/\b[A-Z]{2}\b/g) ?? []).slice(0, 30))];
}

type Sizes = `${(typeof PANEL.sizes)[number]}`;

/** Wielkość próby dla projektu: najmniejszy pakiet, który pokrywa cel (widzowie × wersje), najwyżej 100. */
function sizeFor(project?: Project): Sizes {
  const need = project ? project.targetSessions * Math.max(1, project.variants.length) : 0;
  return `${PANEL.sizes.find((s) => s >= need) ?? PANEL.sizes[PANEL.sizes.length - 1]}` as Sizes;
}

/**
 * Zamówienie badania z panelem (§16.5): firma, NIP, e-mail, liczba widzów, kryteria, uwagi, suma.
 * Serwer: zamówienie w bazie i potwierdzenie. Bez serwera: e-mail z podsumowaniem. Cena tylko
 * „od” dla 30 widzów — większe próby wyceniamy indywidualnie (bez wymyślonych stawek).
 */
export function PanelOrderDialog({ open, onClose, project }: { open: boolean; onClose(): void; project?: Project }) {
  const { t, locale } = useI18n();
  const o = t.billing.panelOrder;
  const { api, account } = useResearch();
  const [company, setCompany] = useState(account?.company ?? '');
  const [taxId, setTaxId] = useState('');
  const [email, setEmail] = useState(account?.email ?? '');
  const [viewers, setViewers] = useState<Sizes>(() => sizeFor(project));
  const [ages, setAges] = useState<AgeBand[]>(project?.audience.ageBands.length && project.audience.ageBands.length < AGE_BANDS.length ? project.audience.ageBands : []);
  const [countries, setCountries] = useState((project?.audience.countries ?? []).join(', '));
  const [platforms, setPlatforms] = useState('');
  const [notes, setNotes] = useState('');
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [state, setState] = useState<'form' | 'sending' | 'sent' | 'mail'>('form');
  const [error, setError] = useState<string | null>(null);
  const companyRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);

  const cur = locale === 'pl' ? 'PLN' : 'EUR';
  const price = formatMoney(PANEL.from[cur], locale, cur);
  const n = Number(viewers);
  const errors = {
    company: company.trim().length < 2 ? o.required : null,
    email: !email.trim() ? o.required : !EMAIL_RE.test(email.trim()) ? o.invalidEmail : null,
  };
  const show = (k: keyof typeof errors) => (touched[k] ? errors[k] : null);
  const agesText = ages.length ? ages.map((a) => t.common.ageBands[a]).join(', ') : o.anyAge;
  const projectLine = project
    ? [
        o.project(project.name),
        o.projectDetails({ kind: t.common.studyKinds[project.kind], platform: t.common.platforms[project.platform], versions: project.variants.length, seconds: Math.round(project.variants[0]?.duration ?? 0), language: LOCALE_NAMES[project.locale] }),
      ].join('\n')
    : '';

  const close = () => {
    setState('form');
    setError(null);
    onClose();
  };

  const submit = async () => {
    setTouched({ company: true, email: true });
    // Pierwsze błędne pole dostaje fokus (komunikat jest przy nim, okno mogło być przewinięte).
    if (errors.company) return companyRef.current?.focus();
    if (errors.email) return emailRef.current?.focus();
    setError(null);
    if (api.mode === 'local') {
      const body = o.mailBody({ company: company.trim(), taxId: taxId.trim(), email: email.trim(), viewers: n, ages: agesText, countries: parseCountries(countries).join(', '), platforms: platforms.trim(), notes: notes.trim(), project: projectLine });
      leaveTo(`mailto:${salesEmail()}?subject=${encodeURIComponent(t.billing.panel.mailSubject)}&body=${encodeURIComponent(body)}`);
      setState('mail');
      return;
    }
    setState('sending');
    try {
      await api.requestPanel({
        projectId: project?.id ?? null,
        viewers: n,
        ageBands: ages,
        countries: parseCountries(countries),
        platforms: platforms.trim(),
        company: company.trim(),
        taxId: taxId.trim(),
        contactEmail: email.trim(),
        notes: [projectLine, notes.trim()].filter(Boolean).join('\n'),
      });
      setState('sent');
    } catch (e) {
      setError((t.errors as Record<string, string>)[errorCode(e)] ?? t.errors.unknown);
      setState('form');
    }
  };

  return (
    <Dialog open={open} onClose={close} title={o.title} wide>
      {state === 'sent' || state === 'mail' ? (
        <div className="space-y-5">
          <Callout title={state === 'sent' ? o.sentTitle : undefined}>{state === 'sent' ? o.sent : o.mailOpened(salesEmail())}</Callout>
          <div className="flex justify-end">
            <Btn variant="primary" onClick={close}>
              {o.close}
            </Btn>
          </div>
        </div>
      ) : (
        <form
          className="space-y-5"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <p className="text-[14.5px] leading-relaxed text-muted">{o.lead}</p>
          {project && <p className="text-[14px] font-semibold text-ink">{o.project(project.name)}</p>}
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={o.company} error={show('company')}>
              {(id, d) => <input ref={companyRef} id={id} aria-describedby={d} aria-invalid={!!show('company')} className={inputClass} value={company} maxLength={160} autoComplete="organization" onChange={(e) => setCompany(e.target.value)} onBlur={() => setTouched((x) => ({ ...x, company: true }))} />}
            </Field>
            <Field label={o.taxId} hint={o.taxIdHint}>
              {(id, d) => <input id={id} aria-describedby={d} className={inputClass} value={taxId} maxLength={32} onChange={(e) => setTaxId(e.target.value)} />}
            </Field>
            <Field label={o.email} error={show('email')}>
              {(id, d) => <input ref={emailRef} id={id} type="email" aria-describedby={d} aria-invalid={!!show('email')} className={inputClass} value={email} maxLength={254} autoComplete="email" onChange={(e) => setEmail(e.target.value)} onBlur={() => setTouched((x) => ({ ...x, email: true }))} />}
            </Field>
            <div className="flex min-w-0 flex-col gap-1.5">
              <span className="text-[13.5px] font-semibold text-ink">{o.viewers}</span>
              <Segmented<Sizes> label={o.viewers} value={viewers} onChange={setViewers} options={PANEL.sizes.map((s) => ({ value: `${s}` as Sizes, label: String(s) }))} />
            </div>
          </div>
          <fieldset>
            <legend className="mb-2 text-[13.5px] font-semibold text-ink">{o.ages}</legend>
            <div className="flex flex-wrap gap-2">
              {AGE_BANDS.map((a) => (
                <label key={a} className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-[10px] bg-surface px-3 text-[14px] ring-1 ring-inset ring-field/60">
                  <input type="checkbox" className="h-4 w-4 accent-cobalt" checked={ages.includes(a)} onChange={(e) => setAges((x) => (e.target.checked ? AGE_BANDS.filter((b) => x.includes(b) || b === a) : x.filter((b) => b !== a)))} />
                  {t.common.ageBands[a]}
                </label>
              ))}
            </div>
            {!ages.length && <p className="mt-1.5 text-[12.5px] text-muted">{o.anyAge}</p>}
          </fieldset>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={o.countries} hint={o.countriesHint}>
              {(id, d) => <input id={id} aria-describedby={d} className={inputClass} value={countries} maxLength={120} onChange={(e) => setCountries(e.target.value)} />}
            </Field>
            <Field label={o.platforms} hint={o.platformsHint}>
              {(id, d) => <input id={id} aria-describedby={d} className={inputClass} value={platforms} maxLength={200} onChange={(e) => setPlatforms(e.target.value)} />}
            </Field>
          </div>
          <Field label={o.notes} hint={o.notesHint}>
            {(id, d) => <textarea id={id} aria-describedby={d} className={`${inputClass} h-24 py-2`} value={notes} maxLength={1500} onChange={(e) => setNotes(e.target.value)} />}
          </Field>
          <section className="rounded-xl bg-ink/[0.04] p-4" aria-label={o.summary}>
            <h3 className="text-[14px] font-semibold text-ink">{o.summary}</h3>
            <p className="mt-1 text-[14px] text-ink">
              {o.summaryViewers(n)} · {agesText}
              {parseCountries(countries).length > 0 && ` · ${parseCountries(countries).join(', ')}`}
            </p>
            <p className="mt-1 text-[14px] font-semibold text-ink">{n === PANEL.sizes[0] ? o.price30(price) : o.priceQuote(price)}</p>
            <p className="mt-1 text-[13px] text-muted">{t.billing.panel.quoteNote}</p>
          </section>
          {error && (
            <p role="alert" className="text-[14px] font-semibold text-poor">
              {error}
            </p>
          )}
          <div className="flex flex-wrap justify-end gap-2">
            <Btn type="button" onClick={close}>
              {t.common.actions.cancel}
            </Btn>
            <Btn type="submit" variant="primary" disabled={state === 'sending'}>
              {state === 'sending' ? o.sending : api.mode === 'local' ? o.submitMail : o.submit}
            </Btn>
          </div>
        </form>
      )}
    </Dialog>
  );
}
