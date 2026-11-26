import { useMemo, useState, type ReactNode } from 'react';
import { navigate, pathOf } from '../../app/router';
import { useResearch } from '../../app/research';
import { defaultDeviceFor, PLATFORM_SPECS, PLATFORMS, type Platform } from '../../config/platforms';
import { errorCode } from '../../core/errors';
import { LOCALE_NAMES, LOCALES, useI18n, type Locale } from '../../i18n';
import { formatPct } from '../../i18n/format';
import type { NewProject } from '../../api/types';
import { GRID_LAYOUTS } from '../../research/grid';
import { AGE_BANDS, VARIANT_IDS, type AgeBand, type AudioMode, type FillerItem, type GridSettings, type MediaSource, type QuestionId, type StudyKind, type TargetDevice, type Variant } from '../../research/model';
import { planFor, type BlockReason } from '../../research/plans';
import { RECOMMENDED_AB_SAMPLE, RELIABLE_SAMPLE } from '../../research/sessions';
import { minimumDetectableDifference, sampleSizeForProportions } from '../../research/statsMath';
import { Badge, Btn, Callout, ChoiceCards, Field, inputClass, Segmented } from '../../ui/kit';
import { FillersPicker, SlidesPicker, ThumbnailPicker, type PickedFiller, type PickedImage } from './FormatPickers';
import { MediaPicker, type PickedMedia } from './MediaPicker';
import { PaywallDialog } from './Paywall';
import { StudioShell } from './Shell';

/** Rodzaje badań w kreatorze (§4). Slajdy to karuzela z automatyczną zmianą (ustawienie w kroku 4). */
const KINDS: StudyKind[] = ['video', 'hook', 'abn', 'feed', 'thumbnail', 'carousel'];
const FEATURE: Partial<Record<StudyKind, 'feed' | 'thumbnail' | 'carousel'>> = { feed: 'feed', thumbnail: 'thumbnail', carousel: 'carousel' };
const STOP_OPTIONS = [1, 1.5, 2, 2.5, 3];

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
  // Miniatury (A–D), slajdy karuzeli, wypełniacze feedu i ustawienia formatów.
  const [thumbs, setThumbs] = useState<Array<PickedImage | null>>([null]);
  const [titles, setTitles] = useState<string[]>(['']);
  const [slides, setSlides] = useState<PickedImage[]>([]);
  const [fillers, setFillers] = useState<PickedFiller[] | null>(null);
  const [stopSeconds, setStopSeconds] = useState(2);
  const [overlay, setOverlay] = useState(true);
  const [caption, setCaption] = useState('');
  const [layout, setLayout] = useState<GridSettings['layout']>('yt_home');
  const [exposure, setExposure] = useState(6);
  const [askChoice, setAskChoice] = useState(true);
  const [slideMode, setSlideMode] = useState<'self' | 'auto'>('self');
  const [perSlide, setPerSlide] = useState(5);

  const isThumb = kind === 'thumbnail';
  const isCarousel = kind === 'carousel';
  const multi = kind === 'hook' || kind === 'abn';
  const maxVariants = multi || isThumb ? Math.min(4, can.maxVariants) : 1;
  const setKindAndVariants = (k: StudyKind) => {
    setKind(k);
    if (k === 'hook' || k === 'abn') {
      setVariants((v) => (v.length < 2 ? [...v, null] : v));
      setTarget(RECOMMENDED_AB_SAMPLE);
    } else {
      setVariants((v) => v.slice(0, 1));
      setTarget(RELIABLE_SAMPLE);
    }
    // Miniatura: strona główna YouTube na komputerze; karuzela: telefon (§4.5–4.6).
    if (k === 'thumbnail') setLayout(platform === 'youtube' ? 'yt_home' : 'profile_grid');
  };
  const choosePlatform = (p: Platform) => {
    setPlatform(p);
    // Reklama w feedzie i rolki: domyślnie bez dźwięku; YouTube: z dźwiękiem (§4.1, §4.7).
    setAudio(p === 'youtube' ? 'on' : 'off');
  };
  const first = isThumb ? thumbs[0] : isCarousel ? slides[0] : variants[0];
  const autoDevice: TargetDevice = isThumb ? (layout === 'yt_home' ? 'desktop' : 'mobile') : first ? defaultDeviceFor(first.width ?? 0, first.height ?? 0) : PLATFORM_SPECS[platform].device;
  const targetDevice: TargetDevice = device === 'auto' ? autoDevice : device;

  const mde = useMemo(() => minimumDetectableDifference(target, 0.7), [target]);
  const n10 = useMemo(() => sampleSizeForProportions(0.7, 0.6), []);
  const missing: string[] = [];
  if (isThumb ? thumbs.some((x) => !x) : isCarousel ? slides.length < 2 : variants.some((v) => !v)) missing.push(isCarousel ? n.missing.slides : n.missing.media);
  if (!creator.trim()) missing.push(n.missing.creator);
  if (!name.trim()) missing.push(n.missing.name);
  if (!ages.length) missing.push(n.missing.ages);

  const create = async () => {
    if (missing.length) return;
    setError(null);
    setBusy(n.creating);
    try {
      // Tryb serwerowy: pliki wgrywamy po utworzeniu projektu, więc materiały z plików startują puste.
      const label = (i: number) => t.common.version(VARIANT_IDS[i]);
      const studyKind: StudyKind = isCarousel && slideMode === 'auto' ? 'slides' : kind;
      const picked = isThumb
        ? (thumbs as PickedImage[]).map((x, i) => ({ media: x.file ? null : x.media, mediaName: x.name, duration: 0, width: x.width, height: x.height, title: titles[i]?.trim() ?? '', label: label(i) }))
        : isCarousel
          ? [{ media: slides.some((x) => x.file) ? null : slides[0].media, slides: slides.some((x) => x.file) ? [] : slides.map((x) => x.media), mediaName: n.slidesName(slides.length), duration: 0, width: slides[0].width, height: slides[0].height, label: label(0) }]
          : (variants as PickedMedia[]).map(({ file, ...v }, i) => ({ ...v, media: file ? null : v.media, label: label(i) }));
      const ownFillers: FillerItem[] | undefined = kind === 'feed' && fillers?.length ? fillers.filter((f) => !f.file).map(({ name: _n, file: _f, ...f }) => f) : undefined;
      const input: NewProject = {
        name: name.trim(),
        creatorName: creator.trim(),
        kind: studyKind,
        platform,
        audio: isThumb || isCarousel ? 'off' : audio,
        context: 'fullscreen',
        platformUi: kind === 'feed' && overlay ? 'generic' : 'none',
        ...(kind === 'feed' && caption.trim() ? { caption: caption.trim() } : {}),
        targetDevice,
        variants: picked,
        ...(ownFillers?.length ? { fillers: ownFillers } : {}),
        ...(kind === 'feed' ? { feed: { items: Math.min(6, (fillers?.length ?? 5) + 1), stopSeconds, capSeconds: 180 } } : {}),
        ...(isThumb ? { grid: { layout, exposureSeconds: exposure, askChoice } } : {}),
        ...(isCarousel ? { slides: { mode: slideMode, secondsPerSlide: perSlide } } : {}),
        questions: kind === 'feed' || isThumb ? [] : questions,
        audience: { source, ageBands: ages, countries: [], screenPlatforms },
        targetSessions: target,
        locale: studyLocale,
      };
      let project = await api.createProject(input);
      // Tryb serwerowy: wgrywanie plików z paskiem postępu („Wgrywam materiał A: 42%”).
      const upload = (variantId: Variant['id'], f: File) => api.uploadMedia(project.id, variantId, f, (p) => setBusy(n.uploading(variantId, formatPct(p, locale))));
      const files: Array<File | undefined> = isThumb ? (thumbs as PickedImage[]).map((x) => x.file) : isCarousel ? [] : (variants as PickedMedia[]).map((v) => v.file);
      const slideFiles = isCarousel && slides.some((x) => x.file);
      if (files.some(Boolean) || slideFiles) {
        const next = [...project.variants];
        for (let i = 0; i < files.length; i++) {
          const f = files[i];
          if (f) next[i] = { ...next[i], media: await upload(next[i].id, f) };
        }
        if (slideFiles) {
          const all: MediaSource[] = [];
          for (const x of slides) all.push(x.file ? await upload('A', x.file) : x.media);
          next[0] = { ...next[0], media: all[0], slides: all };
        }
        project = await api.updateProject(project.id, { variants: next });
      }
      if (kind === 'feed' && fillers?.some((f) => f.file)) {
        const list: FillerItem[] = [];
        for (const { name: _n, file, ...f } of fillers) list.push(file ? { ...f, media: await upload('A', file) } : f);
        project = await api.updateProject(project.id, { fillers: list });
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
    <StudioShell crumbs={[{ label: n.crumb }]} title={n.title} lead={n.lead}>
      <div className="space-y-6">
        <Step n={1} title={n.kindTitle}>
          <ChoiceCards<StudyKind>
            label={n.kindTitle}
            value={kind}
            onChange={setKindAndVariants}
            options={KINDS.map((k) => {
              const feature = FEATURE[k];
              const needs = k === 'abn' || k === 'hook' ? (can.maxVariants >= 2 ? null : planFor('variants2')) : feature && !can[feature] ? planFor(feature) : null;
              return {
                value: k,
                title: t.common.studyKinds[k],
                body: n.kinds[k as keyof typeof n.kinds],
                disabled: needs !== null,
                badge: needs ? <Badge tone="info">{t.billing.planNames[needs]}</Badge> : undefined,
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
        <Step n={3} title={isCarousel ? n.slidesTitle : multi || (isThumb && thumbs.length > 1) ? n.mediaTitleMulti : n.mediaTitle}>
          <div className="space-y-5">
            {isThumb &&
              thumbs.map((x, i) => (
                <div key={i} className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-[15px] font-semibold">{t.common.version(VARIANT_IDS[i])}</h3>
                    {i >= 1 && (
                      <Btn size="sm" variant="quiet" onClick={() => (setThumbs((a) => a.filter((_, k) => k !== i)), setTitles((a) => a.filter((_, k) => k !== i)))}>
                        {t.common.actions.delete}
                      </Btn>
                    )}
                  </div>
                  <ThumbnailPicker label={n.mediaFor(VARIANT_IDS[i])} value={x} title={titles[i] ?? ''} onChange={(m) => setThumbs((a) => a.map((old, k) => (k === i ? m : old)))} onTitle={(v) => setTitles((a) => a.map((old, k) => (k === i ? v : old)))} />
                </div>
              ))}
            {isThumb && thumbs.length < 4 && (
              <div className="flex flex-wrap items-center gap-3">
                <Btn disabled={thumbs.length >= maxVariants} onClick={() => (setThumbs((a) => [...a, null]), setTitles((a) => [...a, a[0] ?? '']))}>
                  {n.addVariant(VARIANT_IDS[thumbs.length])}
                </Btn>
                {thumbs.length >= maxVariants && <span className="text-[13px] text-muted">{n.moreVariants(t.billing.planNames[planFor('variants2')])}</span>}
              </div>
            )}
            {isThumb && <p className="text-[13px] text-muted">{n.thumbFillers}</p>}
            {isCarousel && <SlidesPicker label={n.slidesTitle} value={slides} onChange={setSlides} />}
            {!isThumb &&
              !isCarousel &&
              variants.map((v, i) => (
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
                  <MediaPicker label={n.mediaFor(VARIANT_IDS[i])} value={v} platform={platform} noYoutube={kind === 'feed'} onChange={(m) => setVariants((x) => x.map((old, k) => (k === i ? m : old)))} />
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
            {kind === 'feed' && (
              <div className="space-y-2 border-t border-line pt-4">
                <h3 className="text-[15px] font-semibold">{n.fillersTitle}</h3>
                <FillersPicker value={fillers} onChange={setFillers} />
              </div>
            )}
            {kind === 'hook' && <Callout>{n.hookNote}</Callout>}
            {platform === 'youtube' && kind !== 'feed' && !isThumb && !isCarousel && <p className="text-[13px] text-muted">{n.youtubeTip}</p>}
          </div>
        </Step>
        <Step n={4} title={n.conditionsTitle}>
          <div className="space-y-4">
            {!isThumb && !isCarousel && (
              <div>
                <div className="mb-2 text-[13.5px] font-semibold">{n.audio}</div>
                <Segmented<AudioMode> label={n.audio} value={audio} onChange={setAudio} options={(['on', 'off', 'viewer'] as AudioMode[]).map((a) => ({ value: a, label: t.common.audioModes[a] }))} />
              </div>
            )}
            <div>
              <div className="mb-2 text-[13.5px] font-semibold">{n.device}</div>
              <Segmented<TargetDevice | 'auto'>
                label={n.device}
                value={device}
                onChange={setDevice}
                options={[{ value: 'auto', label: n.deviceAuto(t.common.devices[autoDevice]) }, ...(['mobile', 'desktop', 'any'] as TargetDevice[]).map((d) => ({ value: d, label: t.common.devices[d] }))]}
              />
            </div>
            {kind === 'feed' && (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={n.stopSeconds} hint={n.stopSecondsHint}>
                  {(id, d) => (
                    <select id={id} aria-describedby={d} className={inputClass} value={stopSeconds} onChange={(e) => setStopSeconds(Number(e.target.value))}>
                      {STOP_OPTIONS.map((x) => (
                        <option key={x} value={x}>
                          {n.seconds(x)}
                        </option>
                      ))}
                    </select>
                  )}
                </Field>
                <Field label={n.caption} hint={n.captionHint}>
                  {(id, d) => <input id={id} aria-describedby={d} className={inputClass} value={caption} maxLength={300} onChange={(e) => setCaption(e.target.value)} />}
                </Field>
                <label className="flex items-start gap-3 text-[14px] sm:col-span-2">
                  <input type="checkbox" className="mt-0.5 h-5 w-5 accent-cobalt" checked={overlay} onChange={(e) => setOverlay(e.target.checked)} />
                  <span>
                    <span className="font-semibold">{n.overlay}</span>
                    <span className="block text-[13px] text-muted">{n.overlayHint}</span>
                  </span>
                </label>
              </div>
            )}
            {isThumb && (
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={n.layout}>
                  {(id) => (
                    <select id={id} className={inputClass} value={layout} onChange={(e) => setLayout(e.target.value as GridSettings['layout'])}>
                      {GRID_LAYOUTS.map((l) => (
                        <option key={l} value={l}>
                          {n.layouts[l]}
                        </option>
                      ))}
                    </select>
                  )}
                </Field>
                <Field label={n.exposure} hint={n.exposureHint}>
                  {(id, d) => <input id={id} aria-describedby={d} type="number" min={3} max={10} className={inputClass} value={exposure} onChange={(e) => setExposure(Math.max(3, Math.min(10, Number(e.target.value) || 6)))} />}
                </Field>
                <label className="flex items-start gap-3 text-[14px] sm:col-span-2">
                  <input type="checkbox" className="mt-0.5 h-5 w-5 accent-cobalt" checked={askChoice} onChange={(e) => setAskChoice(e.target.checked)} />
                  <span>
                    <span className="font-semibold">{n.askChoice}</span>
                    <span className="block text-[13px] text-muted">{n.askChoiceHint}</span>
                  </span>
                </label>
              </div>
            )}
            {isCarousel && (
              <div className="space-y-4">
                <div>
                  <div className="mb-2 text-[13.5px] font-semibold">{n.slideMode}</div>
                  <Segmented<'self' | 'auto'> label={n.slideMode} value={slideMode} onChange={setSlideMode} options={(['self', 'auto'] as const).map((x) => ({ value: x, label: n.slideModes[x] }))} />
                </div>
                {slideMode === 'auto' && (
                  <Field label={n.perSlide}>{(id) => <input id={id} type="number" min={2} max={60} className={`${inputClass} max-w-[160px]`} value={perSlide} onChange={(e) => setPerSlide(Math.max(2, Math.min(60, Number(e.target.value) || 5)))} />}</Field>
                )}
              </div>
            )}
            <p className="text-[13px] text-muted">{kind === 'feed' ? n.feedNote : isThumb ? n.gridNote : isCarousel ? n.carouselNote : n.contextNote}</p>
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
            {kind !== 'feed' && !isThumb && (
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
            )}
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
