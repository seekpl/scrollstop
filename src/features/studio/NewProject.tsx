import { useMemo, useState, type ReactNode } from 'react';
import { navigate, pathOf } from '../../app/router';
import { useResearch } from '../../app/research';
import { defaultDeviceFor, PLATFORM_SPECS, PLATFORMS, type Platform } from '../../config/platforms';
import { errorCode } from '../../core/errors';
import { LOCALE_NAMES, LOCALES, useI18n, type Locale } from '../../i18n';
import { formatPct } from '../../i18n/format';
import type { NewProject } from '../../api/types';
import { AGE_BANDS, VARIANT_IDS, type AgeBand, type AudioMode, type QuestionId, type StudyKind, type TargetDevice } from '../../research/model';
import { planFor, type BlockReason } from '../../research/plans';
import { RECOMMENDED_AB_SAMPLE, RELIABLE_SAMPLE } from '../../research/sessions';
import { minimumDetectableDifference, sampleSizeForProportions } from '../../research/statsMath';
import { Badge, Btn, Callout, ChoiceCards, Field, inputClass, PageHeader, Segmented } from '../../ui/kit';
import { MediaPicker, type PickedMedia } from './MediaPicker';
import { PaywallDialog } from './Paywall';
import { StudioShell } from './Shell';

/** Rodzaje badań dostępne w kreatorze. Feed, miniatury i karuzele — M6 (oznaczone „wkrótce”). */
const KINDS: StudyKind[] = ['video', 'hook', 'abn', 'feed', 'thumbnail', 'carousel'];
const READY: StudyKind[] = ['video', 'hook', 'abn'];

function Step({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <section className="min-w-0 space-y-4 rounded-2xl bg-surface p-4 ring-1 ring-line sm:p-6" aria-labelledby={`step-${n}`}>
      <h2 id={`step-${n}`} className="flex items-center gap-3 text-[19px] font-semibold text-ink">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-ink text-[13px] font-bold text-white">{n}</span>
        {title}
      </h2>
      {children}
    </section>
  );
}

/**
 * Kreator nowego projektu (§9.2): co sprawdzić, gdzie opublikujesz, materiał każdej wersji,
 * warunki, widzowie (z kalkulatorem MDE), nazwy i język badania. Wszystko można zmienić później.
 */
export function NewProjectPage() {
  const { t, locale } = useI18n();
  const n = t.studio.newProject;
  const { api, account, can } = useResearch();
  const [kind, setKind] = useState<StudyKind>('video');
  const [platform, setPlatform] = useState<Platform>('tiktok');
  const [variants, setVariants] = useState<Array<PickedMedia | null>>([null]);
  const [audio, setAudio] = useState<AudioMode>('off');
  const [device, setDevice] = useState<TargetDevice | 'auto'>('auto');
  const [source, setSource] = useState<'community' | 'panel'>('community');
  const [ages, setAges] = useState<AgeBand[]>(AGE_BANDS.slice());
  const [screenPlatforms, setScreenPlatforms] = useState(false);
  const [target, setTarget] = useState(RELIABLE_SAMPLE);
  const [questions, setQuestions] = useState<QuestionId[]>(['finish']);
  const [name, setName] = useState('');
  const [creator, setCreator] = useState(account?.company ?? '');
  const [studyLocale, setStudyLocale] = useState<Locale>(locale);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [paywall, setPaywall] = useState<BlockReason | null>(null);

  const multi = kind === 'hook' || kind === 'abn';
  const maxVariants = multi ? Math.min(4, can.maxVariants) : 1;
  const setKindAndVariants = (k: StudyKind) => {
    setKind(k);
    if (k === 'hook' || k === 'abn') {
      setVariants((v) => (v.length < 2 ? [...v, null] : v));
      setTarget(RECOMMENDED_AB_SAMPLE);
    } else {
      setVariants((v) => v.slice(0, 1));
      setTarget(RELIABLE_SAMPLE);
    }
  };
  const choosePlatform = (p: Platform) => {
    setPlatform(p);
    // Reklama w feedzie i rolki: domyślnie bez dźwięku; YouTube: z dźwiękiem (§4.1, §4.7).
    setAudio(p === 'youtube' ? 'on' : 'off');
  };
  const first = variants[0];
  const autoDevice: TargetDevice = first ? defaultDeviceFor(first.width ?? 0, first.height ?? 0) : PLATFORM_SPECS[platform].device;
  const targetDevice: TargetDevice = device === 'auto' ? autoDevice : device;

  const mde = useMemo(() => minimumDetectableDifference(target, 0.7), [target]);
  const n10 = useMemo(() => sampleSizeForProportions(0.7, 0.6), []);
  const missing: string[] = [];
  if (variants.some((v) => !v)) missing.push(n.missing.media);
  if (!creator.trim()) missing.push(n.missing.creator);
  if (!name.trim()) missing.push(n.missing.name);
  if (!ages.length) missing.push(n.missing.ages);

  const create = async () => {
    if (missing.length) return;
    setError(null);
    setBusy(n.creating);
    try {
      const input: NewProject = {
        name: name.trim(),
        creatorName: creator.trim(),
        kind,
        platform,
        audio,
        context: 'fullscreen',
        platformUi: 'none',
        targetDevice,
        variants: (variants as PickedMedia[]).map((v, i) => ({ ...v, label: t.common.version(VARIANT_IDS[i]) })),
        questions,
        audience: { source, ageBands: ages, countries: [], screenPlatforms },
        targetSessions: target,
        locale: studyLocale,
      };
      let project = await api.createProject(input);
      // Tryb serwerowy: wgrywanie plików z paskiem postępu („Wgrywam materiał A: 42%”).
      const files = (variants as PickedMedia[]).map((v) => v.file);
      if (files.some(Boolean)) {
        const next = [...project.variants];
        for (let i = 0; i < files.length; i++) {
          const f = files[i];
          if (!f) continue;
          const media = await api.uploadMedia(project.id, next[i].id, f, (p) => setBusy(n.uploading(next[i].id, formatPct(p, locale))));
          next[i] = { ...next[i], media };
        }
        project = await api.updateProject(project.id, { variants: next });
      }
      navigate(pathOf({ name: 'project', id: project.id, step: 'prepare' }));
    } catch (e) {
      const code = errorCode(e);
      if (code === 'active_projects') setPaywall('active_projects');
      else setError((t.errors as Record<string, string>)[code] ?? t.errors.unknown);
    } finally {
      setBusy(null);
    }
  };

  return (
    <StudioShell crumbs={[{ label: n.crumb }]} title={n.title}>
      <div className="space-y-6">
        <PageHeader title={n.title} lead={n.lead} />
        <Step n={1} title={n.kindTitle}>
          <ChoiceCards<StudyKind>
            label={n.kindTitle}
            value={kind}
            onChange={setKindAndVariants}
            options={KINDS.map((k) => {
              const ready = READY.includes(k);
              const needs = k === 'abn' || k === 'hook' ? (can.maxVariants >= 2 ? null : planFor('variants2')) : null;
              return {
                value: k,
                title: t.common.studyKinds[k],
                body: n.kinds[k as keyof typeof n.kinds],
                disabled: !ready || needs !== null,
                badge: !ready ? <Badge>{t.common.soon}</Badge> : needs ? <Badge tone="info">{t.billing.planNames[needs]}</Badge> : undefined,
              };
            })}
          />
        </Step>
        <Step n={2} title={n.platformTitle}>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={n.platformTitle}>
            {PLATFORMS.map((p) => (
              <button key={p} type="button" role="radio" aria-checked={platform === p} onClick={() => choosePlatform(p)} className={`min-h-10 rounded-[10px] px-3.5 text-[14px] font-semibold ring-inset ${platform === p ? 'bg-cobalt/[0.07] text-ink ring-2 ring-cobalt' : 'bg-surface text-ink ring-1 ring-field/60 hover:ring-ink/40'}`}>
                {t.common.platforms[p]}
              </button>
            ))}
          </div>
          <p className="text-[13px] text-muted">{n.platformHint}</p>
        </Step>
        <Step n={3} title={multi ? n.mediaTitleMulti : n.mediaTitle}>
          <div className="space-y-5">
            {variants.map((v, i) => (
              <div key={i} className="space-y-2">
                {multi && (
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-[15px] font-semibold">{t.common.version(VARIANT_IDS[i])}</h3>
                    {i >= 2 && (
                      <Btn size="sm" variant="quiet" onClick={() => setVariants((x) => x.filter((_, k) => k !== i))}>
                        {t.common.actions.delete}
                      </Btn>
                    )}
                  </div>
                )}
                <MediaPicker label={n.mediaFor(VARIANT_IDS[i])} value={v} platform={platform} onChange={(m) => setVariants((x) => x.map((old, k) => (k === i ? m : old)))} />
              </div>
            ))}
            {multi && variants.length < 4 && (
              <div className="flex flex-wrap items-center gap-3">
                <Btn disabled={variants.length >= maxVariants} onClick={() => setVariants((x) => [...x, null])}>
                  {n.addVariant(VARIANT_IDS[variants.length])}
                </Btn>
                {variants.length >= maxVariants && maxVariants < 4 && <span className="text-[13px] text-muted">{n.moreVariants(t.billing.planNames[planFor('variants4')])}</span>}
              </div>
            )}
            {kind === 'hook' && <Callout>{n.hookNote}</Callout>}
            {platform === 'youtube' && <p className="text-[13px] text-muted">{n.youtubeTip}</p>}
          </div>
        </Step>
        <Step n={4} title={n.conditionsTitle}>
          <div className="space-y-4">
            <div>
              <div className="mb-2 text-[13.5px] font-semibold">{n.audio}</div>
              <Segmented<AudioMode> label={n.audio} value={audio} onChange={setAudio} options={(['on', 'off', 'viewer'] as AudioMode[]).map((a) => ({ value: a, label: t.common.audioModes[a] }))} />
            </div>
            <div>
              <div className="mb-2 text-[13.5px] font-semibold">{n.device}</div>
              <Segmented<TargetDevice | 'auto'>
                label={n.device}
                value={device}
                onChange={setDevice}
                options={[{ value: 'auto', label: n.deviceAuto(t.common.devices[autoDevice]) }, ...(['mobile', 'desktop', 'any'] as TargetDevice[]).map((d) => ({ value: d, label: t.common.devices[d] }))]}
              />
            </div>
            <p className="text-[13px] text-muted">{n.contextNote}</p>
          </div>
        </Step>
        <Step n={5} title={n.viewersTitle}>
          <div className="space-y-5">
            <div>
              <div className="mb-2 text-[13.5px] font-semibold">{n.source}</div>
              <Segmented<'community' | 'panel'> label={n.source} value={source} onChange={setSource} options={(['community', 'panel'] as const).map((x) => ({ value: x, label: n.sources[x] }))} />
              <p className="mt-2 text-[13px] text-muted">{n.sourceHints[source]}</p>
            </div>
            <fieldset>
              <legend className="mb-2 text-[13.5px] font-semibold">{n.ages}</legend>
              <div className="flex flex-wrap gap-2">
                {AGE_BANDS.map((a) => (
                  <label key={a} className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-[10px] bg-surface px-3 text-[14px] ring-1 ring-inset ring-field/60">
                    <input type="checkbox" className="h-4 w-4 accent-cobalt" checked={ages.includes(a)} onChange={(e) => setAges((x) => (e.target.checked ? AGE_BANDS.filter((b) => x.includes(b) || b === a) : x.filter((b) => b !== a)))} />
                    {t.common.ageBands[a]}
                  </label>
                ))}
              </div>
            </fieldset>
            <label className="flex items-start gap-3 text-[14px]">
              <input type="checkbox" className="mt-0.5 h-5 w-5 accent-cobalt" checked={screenPlatforms} onChange={(e) => setScreenPlatforms(e.target.checked)} />
              <span>
                <span className="font-semibold">{n.screener}</span>
                <span className="block text-[13px] text-muted">{n.screenerHint}</span>
              </span>
            </label>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={multi ? n.targetPerVersion : n.target} hint={multi ? n.mdeLine(target, Math.round(mde * 100)) : n.targetHint}>
                {(id, d) => <input id={id} aria-describedby={d} type="number" min={5} max={1000} className={inputClass} value={target} onChange={(e) => setTarget(Math.max(5, Math.min(1000, Number(e.target.value) || 5)))} />}
              </Field>
              {multi && <p className="self-end text-[13px] text-muted sm:pb-7">{n.mdeInverse(n10)}</p>}
            </div>
            <fieldset>
              <legend className="mb-2 text-[13.5px] font-semibold">{n.questions}</legend>
              <div className="space-y-2">
                {(['finish', 'brand_recall'] as QuestionId[]).map((q) => (
                  <label key={q} className="flex items-start gap-3 text-[14px]">
                    <input type="checkbox" className="mt-0.5 h-5 w-5 accent-cobalt" checked={questions.includes(q)} onChange={(e) => setQuestions((x) => (e.target.checked ? [...x, q] : x.filter((y) => y !== q)))} />
                    {(t.viewer.questions.text as Record<string, string>)[q]}
                  </label>
                ))}
              </div>
            </fieldset>
          </div>
        </Step>
        <Step n={6} title={n.namesTitle}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={n.name} hint={n.nameHint}>
              {(id, d) => <input id={id} aria-describedby={d} className={inputClass} value={name} maxLength={120} onChange={(e) => setName(e.target.value)} />}
            </Field>
            <Field label={n.creator} hint={n.creatorHint}>
              {(id, d) => <input id={id} aria-describedby={d} className={inputClass} value={creator} maxLength={120} onChange={(e) => setCreator(e.target.value)} />}
            </Field>
            <Field label={n.language} hint={n.languageHint}>
              {(id, d) => (
                <select id={id} aria-describedby={d} className={inputClass} value={studyLocale} onChange={(e) => setStudyLocale(e.target.value as Locale)}>
                  {LOCALES.map((l) => (
                    <option key={l} value={l}>
                      {LOCALE_NAMES[l]}
                    </option>
                  ))}
                </select>
              )}
            </Field>
          </div>
        </Step>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Btn variant="primary" size="lg" className="sm:max-w-[360px]" disabled={missing.length > 0 || busy !== null} onClick={() => void create()}>
            {busy ?? n.submit}
          </Btn>
          {missing.length > 0 && <p className="text-[13.5px] text-muted">{missing[0]}</p>}
          {error && (
            <p className="text-[13.5px] font-semibold text-poor" role="alert">
              {error}
            </p>
          )}
        </div>
      </div>
      <PaywallDialog reason={paywall} onClose={() => setPaywall(null)} />
    </StudioShell>
  );
}
