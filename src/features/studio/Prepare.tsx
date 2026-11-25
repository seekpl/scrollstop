import qrcode from 'qrcode-generator';
import { useMemo, useState } from 'react';
import { studyConfigFor } from '../../research/project';
import { absoluteUrl, navigate, pathOf } from '../../app/router';
import { useResearch } from '../../app/research';
import { salesEmail } from '../../config/company';
import { detectScenes, fixedScenes, segmentLength } from '../../core/analysis/scenes';
import { errorCode } from '../../core/errors';
import { formatTime } from '../../core/math/util';
import { I18nProvider, LOCALE_NAMES, LOCALES, useI18n, useT, type Locale } from '../../i18n';
import { encodeStudyConfig } from '../../research/link';
import { AGE_BANDS, RETENTION_OPTIONS, type Aoi, type Project, type Scene, type Variant } from '../../research/model';
import { planFor } from '../../research/plans';
import { Badge, btnClass, Btn, Callout, CopyField, Dialog, Field, Icon, inputClass, Section, Segmented, Surface } from '../../ui/kit';
import { registerLocalFile } from '../shared/mediaLibrary';
import { AoiEditor } from '../report/AoiPanel';
import { useLibraryVersion, useVariantFrames } from '../report/frames';
import { variantLabel } from '../report/ReportView';
import type { ProjectCtx } from './ProjectPage';

/** Kod QR jako SVG (do relacji). */
export function QrCode({ text, label, size = 168 }: { text: string; label: string; size?: number }) {
  const svg = useMemo(() => {
    try {
      const qr = qrcode(0, 'M');
      qr.addData(text);
      qr.make();
      const n = qr.getModuleCount();
      let d = '';
      for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (qr.isDark(r, c)) d += `M${c + 4},${r + 4}h1v1h-1z`;
      return { n: n + 8, d };
    } catch {
      return null;
    }
  }, [text]);
  if (!svg) return null;
  // Długi link (konfiguracja w adresie) daje gęsty kod: co najmniej 3 px na moduł, najwyżej 280 px.
  const px = Math.min(280, Math.max(size, svg.n * 3));
  return (
    <svg viewBox={`0 0 ${svg.n} ${svg.n}`} width={px} height={px} role="img" aria-label={label} className="h-auto max-w-full rounded-lg bg-white ring-1 ring-line" shapeRendering="crispEdges">
      <path d={svg.d} fill="#1f2a44" />
    </svg>
  );
}

/** Gotowe wiadomości w języku badania (§9.3), każda z kopiowaniem. Renderowane w zagnieżdżonym providerze języka. */
function Messages({ project, link }: { project: Project; link: string }) {
  const t = useT();
  const msg = t.studio.prepare.messages;
  const length = project.variants[0].duration;
  const minutes = Math.max(1, Math.round((length + 90) / 60));
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {(['story', 'post', 'dm', 'discord', 'newsletter'] as const).map((k) => (
        <CopyField key={k} label={msg.labels[k]} value={msg.text[k](project.creatorName, minutes, link)} multiline />
      ))}
    </div>
  );
}

export function Prepare({ project, sessions, update }: ProjectCtx) {
  const { t } = useI18n();
  const p = t.studio.prepare;
  const { api } = useResearch();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const studyUrl = absoluteUrl({ name: 'study', token: project.linkToken });
  const simUrl = `${pathOf({ name: 'study', token: project.linkToken })}?sim=1`;
  const local = api.mode === 'local';
  const hasLocalMedia = project.variants.some((v) => v.media?.kind === 'local');
  const vertical = project.variants[0].height > project.variants[0].width;
  const packageLinks = local && !hasLocalMedia ? project.variants.map((v) => ({ id: v.id, url: absoluteUrl(`#/p/${encodeStudyConfig(studyConfigFor(project, v, 'package'))}`) })) : [];
  const shareUrl = local ? (packageLinks[0]?.url ?? studyUrl) : studyUrl;

  return (
    <div className="space-y-12">
      <Section title={p.linkTitle} aside={project.variants.length > 1 && !local ? p.oneLink(project.variants.map((v) => v.id).join('–')) : undefined}>
        <div className="space-y-5">
          {!local && (
            <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-start">
              <div className="min-w-0 space-y-2">
                <CopyField label={p.studyLink} value={studyUrl} />
                <p className="text-[13.5px] text-muted">{vertical ? p.deviceHintPhone : p.deviceHintAny}</p>
              </div>
              <QrCode text={studyUrl} label={p.qr} />
            </div>
          )}
          {local && (
            <>
              <Surface>
                <h3 className="text-[16px] font-semibold">{p.hereTitle}</h3>
                <p className="mt-1 text-[14px] text-muted">{p.hereBody}</p>
                <a href={pathOf({ name: 'study', token: project.linkToken })} className="mt-3 inline-flex min-h-10 items-center rounded-[10px] bg-cobalt px-4 text-[14px] font-semibold text-white hover:bg-cobalt-dark">
                  {p.hereStart}
                </a>
              </Surface>
              <Surface>
                <h3 className="text-[16px] font-semibold">{p.packageTitle}</h3>
                <p className="mt-1 text-[14px] text-muted">{p.packageBody}</p>
                {hasLocalMedia ? (
                  <div className="mt-3">
                    <Callout tone="warn">{p.packageLocalMedia}</Callout>
                  </div>
                ) : (
                  <div className="mt-4 space-y-4">
                    {packageLinks.length > 1 && <p className="text-[13.5px] text-ink">{p.packagePerVersion}</p>}
                    {packageLinks.map((l) => (
                      <div key={l.id} className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-start">
                        <CopyField label={packageLinks.length > 1 ? p.packageLinkFor(l.id) : p.packageLink} value={l.url} />
                        {packageLinks.length === 1 && <QrCode text={l.url} label={p.qr} />}
                      </div>
                    ))}
                  </div>
                )}
              </Surface>
            </>
          )}
          <p className="flex flex-wrap items-center gap-2 text-[14px]">
            <Icon name="eye" size={17} />
            {p.previewLead}
            <a href={simUrl} className="font-semibold text-cobalt underline underline-offset-4">
              {p.preview}
            </a>
          </p>
        </div>
      </Section>

      {project.audience.source === 'panel' && <PanelOrder project={project} />}

      <Section title={p.messagesTitle} aside={p.messagesAside(LOCALE_NAMES[project.locale])}>
        <I18nProvider locale={project.locale}>
          <Messages project={project} link={shareUrl} />
        </I18nProvider>
      </Section>

      <Section title={p.statusTitle}>
        <Segmented<Project['status']> label={p.statusTitle} value={project.status} onChange={(s) => void update({ status: s })} options={(['collecting', 'paused', 'closed'] as const).map((s) => ({ value: s, label: t.studio.projects.status[s] }))} />
      </Section>

      <Section title={p.mediaTitle}>
        <div className="space-y-6">
          {project.variants.map((v) => (
            <VariantCard key={v.id} project={project} variant={v} sessionsCount={sessions.filter((s) => s.variantId === v.id).length} onChange={(nv) => update({ variants: project.variants.map((x) => (x.id === v.id ? nv : x)) })} />
          ))}
        </div>
      </Section>

      <Section title={p.settingsTitle}>
        <Settings project={project} update={update} />
      </Section>

      <Section title={p.deleteTitle}>
        <Btn variant="danger" onClick={() => setConfirmDelete(true)}>
          <Icon name="trash" size={16} />
          {p.delete}
        </Btn>
        <p className="mt-2 text-[13px] text-muted">{p.deleteHint}</p>
      </Section>
      <Dialog open={confirmDelete} onClose={() => setConfirmDelete(false)} title={p.deleteConfirmTitle}>
        <p className="text-[15px] text-ink">{p.deleteConfirm}</p>
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <Btn onClick={() => setConfirmDelete(false)}>{t.common.actions.cancel}</Btn>
          <Btn
            variant="danger"
            onClick={async () => {
              await api.deleteProject(project.id);
              navigate(pathOf({ name: 'projects' }));
            }}
          >
            {p.delete}
          </Btn>
        </div>
      </Dialog>
    </div>
  );
}

/** Zamówienie badania z panelem (§16.5): bez serwera e-mail z podsumowaniem projektu. */
function PanelOrder({ project }: { project: Project }) {
  const { t } = useI18n();
  const p = t.studio.prepare;
  const v0 = project.variants[0];
  const body = p.panelMail({
    name: project.name,
    kind: t.common.studyKinds[project.kind],
    platform: t.common.platforms[project.platform],
    seconds: Math.round(v0.duration),
    versions: project.variants.length,
    target: project.targetSessions,
    ages: project.audience.ageBands.map((a) => t.common.ageBands[a]).join(', '),
    language: LOCALE_NAMES[project.locale],
  });
  const href = `mailto:${salesEmail()}?subject=${encodeURIComponent(t.billing.panel.mailSubject)}&body=${encodeURIComponent(body)}`;
  return (
    <Section title={p.panelTitle}>
      <Surface>
        <p className="max-w-[70ch] text-[14.5px] leading-relaxed text-ink">{p.panelBody}</p>
        <p className="mt-2 text-[13.5px] text-muted">{t.billing.panel.quoteNote}</p>
        <a href={href} className={btnClass('primary', 'md', 'mt-4')}>
          {t.billing.panel.order}
        </a>
      </Surface>
    </Section>
  );
}

function VariantCard({ project, variant, sessionsCount, onChange }: { project: Project; variant: Variant; sessionsCount: number; onChange(v: Variant): Promise<void> }) {
  const t = useT();
  const { can } = useResearch();
  const p = t.studio.prepare;
  const lib = useLibraryVersion();
  const src = useVariantFrames(variant);
  const [progress, setProgress] = useState<number | null>(null);
  const [cut, setCut] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const duration = variant.duration;
  const m = variant.media;
  const framesOk = src?.kind === 'video' || src?.kind === 'demo';
  const setScenes = (scenes: Scene[]) => onChange({ ...variant, scenes });
  const detect = async () => {
    if (!src || !framesOk) return setError(m?.kind === 'youtube' ? p.youtubeFrames : p.corsFrames);
    setError(null);
    setProgress(0);
    try {
      await setScenes(await detectScenes(src, { onProgress: setProgress }));
    } catch (e) {
      setError((t.errors as Record<string, string>)[errorCode(e)] ?? p.corsFrames);
    } finally {
      setProgress(null);
    }
  };
  const addCut = async () => {
    const c = Number(cut.replace(',', '.'));
    if (!(c > 0) || (duration > 0 && c >= duration)) return setError(p.badCut);
    const bounds = [...new Set([0, ...variant.scenes.map((s) => s.start), c])].sort((a, b) => a - b);
    const end = duration || Math.max(c + 1, ...variant.scenes.map((s) => s.end));
    await setScenes(bounds.map((start, i) => ({ id: `scene_${i + 1}`, start, end: bounds[i + 1] ?? end, source: 'manual' as const })));
    setCut('');
    setError(null);
  };
  // `lib` zmienia się po wczytaniu pliku — klatki stają się dostępne.
  const localMissing = lib >= 0 && m?.kind === 'local' && src?.kind === 'placeholder';
  return (
    <div className="space-y-4 rounded-2xl bg-surface p-4 ring-1 ring-line sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-[16px] font-semibold text-ink">{variantLabel(variant, t)}</h3>
          <p className="text-[13.5px] text-muted">{p.mediaMeta(variant.mediaName, t.studio.media.kinds[m?.kind ?? 'demo'], duration > 0 ? formatTime(duration, 0) : p.durationUnknown)}</p>
        </div>
        <Badge>{t.studio.collect.sessionsCount(sessionsCount)}</Badge>
      </div>
      {localMissing && (
        <label className="flex cursor-pointer flex-wrap items-center gap-2 rounded-xl bg-fair/10 px-3 py-2.5 text-[14px]">
          <Icon name="upload" size={17} />
          <span>{p.repick(m.fileName)}</span>
          <input
            type="file"
            accept="video/*"
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              if (f.name !== m.fileName || f.size !== m.fileSize) setError(p.otherFile);
              registerLocalFile(f);
            }}
          />
          <span className="font-semibold text-cobalt underline">{p.pick}</span>
        </label>
      )}
      <div className="flex flex-wrap gap-1.5">
        {variant.scenes.length ? variant.scenes.map((s, i) => <Badge key={s.id}>{p.sceneBadge(i + 1, formatTime(s.start, 0), formatTime(s.end, 0))}</Badge>) : <span className="text-[13.5px] text-muted">{p.noScenes}</span>}
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <Btn size="sm" onClick={() => void detect()} disabled={progress !== null}>
          {progress !== null ? p.detecting(Math.round(progress * 100)) : p.detect}
        </Btn>
        {duration > 0 && (
          <Btn size="sm" onClick={() => void setScenes(fixedScenes(duration, segmentLength(duration)))}>
            {p.split(segmentLength(duration))}
          </Btn>
        )}
        <div className="flex items-end gap-2">
          <Field label={p.cutLabel}>{(id) => <input id={id} inputMode="decimal" className={`${inputClass} h-8 w-24`} value={cut} onChange={(e) => setCut(e.target.value)} />}</Field>
          <Btn size="sm" onClick={() => void addCut()} disabled={!cut}>
            {p.addCut}
          </Btn>
        </div>
        {variant.scenes.length > 0 && (
          <Btn size="sm" variant="quiet" onClick={() => void setScenes([])}>
            {p.clearScenes}
          </Btn>
        )}
      </div>
      {error && (
        <p className="text-[13.5px] font-semibold text-poor" role="alert">
          {error}
        </p>
      )}
      <div className="space-y-3 border-t border-line pt-4">
        <h4 className="text-[14.5px] font-semibold">{p.aoisTitle}</h4>
        {variant.aois.length ? (
          <ul className="flex flex-wrap gap-2">
            {variant.aois.map((a: Aoi) => (
              <li key={a.id} className="inline-flex items-center gap-1.5 rounded-lg bg-ink/[0.05] py-1 pl-2.5 pr-1 text-[13px]">
                <span className="font-semibold">{a.name}</span>
                <span className="text-muted">
                  {t.common.aoiTypes[a.type]}, {formatTime(a.t0, 0)}–{formatTime(a.t1, 0)}
                </span>
                <button type="button" aria-label={t.report.aoi.removeAria(a.name)} className="grid h-7 w-7 place-items-center rounded-md text-muted hover:bg-poor/10 hover:text-poor" onClick={() => void onChange({ ...variant, aois: variant.aois.filter((x) => x.id !== a.id) })}>
                  <Icon name="close" size={14} />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[13.5px] text-muted">{t.report.aoi.empty}</p>
        )}
        {!can.aoi ? (
          <p className="flex flex-wrap items-center gap-2 text-[13.5px] text-muted">
            <Icon name="lock" size={15} />
            {t.errors.feature_aoi}
            <a href={`${pathOf({ name: 'pricing' })}?plan=${planFor('aoi')}`} className="font-semibold text-cobalt underline underline-offset-4">
              {t.billing.locked.unlock(t.billing.planNames[planFor('aoi')])}
            </a>
          </p>
        ) : editing ? (
          <AoiEditor
            src={src}
            duration={duration || 15}
            width={variant.width}
            height={variant.height}
            platform={project.platform}
            existing={variant.aois}
            onCancel={() => setEditing(false)}
            onAdd={async (a) => {
              await onChange({ ...variant, aois: [...variant.aois, a] });
              setEditing(false);
            }}
          />
        ) : (
          <Btn size="sm" onClick={() => setEditing(true)}>
            {t.report.aoi.add}
          </Btn>
        )}
      </div>
    </div>
  );
}

function Settings({ project, update }: { project: Project; update: ProjectCtx['update'] }) {
  const { t } = useI18n();
  const s = t.studio.prepare.settings;
  const [creator, setCreator] = useState(project.creatorName);
  const [target, setTarget] = useState(String(project.targetSessions));
  return (
    <div className="grid gap-5 md:grid-cols-2">
      <Field label={s.creator} hint={s.creatorHint}>
        {(id, d) => <input id={id} aria-describedby={d} className={inputClass} value={creator} maxLength={120} onChange={(e) => setCreator(e.target.value)} onBlur={() => creator.trim() && creator !== project.creatorName && void update({ creatorName: creator.trim() })} />}
      </Field>
      <Field label={s.language} hint={s.languageHint}>
        {(id, d) => (
          <select id={id} aria-describedby={d} className={inputClass} value={project.locale} onChange={(e) => void update({ locale: e.target.value as Locale })}>
            {LOCALES.map((l) => (
              <option key={l} value={l}>
                {LOCALE_NAMES[l]}
              </option>
            ))}
          </select>
        )}
      </Field>
      <Field label={s.target} hint={s.targetHint}>
        {(id, d) => <input id={id} aria-describedby={d} type="number" min={5} max={1000} className={inputClass} value={target} onChange={(e) => setTarget(e.target.value)} onBlur={() => Number(target) >= 5 && void update({ targetSessions: Math.min(1000, Math.round(Number(target))) })} />}
      </Field>
      <Field label={s.retention} hint={s.retentionHint}>
        {(id, d) => (
          <select id={id} aria-describedby={d} className={inputClass} value={project.retentionDays} onChange={(e) => void update({ retentionDays: Number(e.target.value) })}>
            {RETENTION_OPTIONS.map((r) => (
              <option key={r} value={r}>
                {t.common.days(r)}
              </option>
            ))}
          </select>
        )}
      </Field>
      <fieldset className="md:col-span-2">
        <legend className="mb-2 text-[13.5px] font-semibold">{s.ages}</legend>
        <div className="flex flex-wrap gap-2">
          {AGE_BANDS.map((a) => (
            <label key={a} className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-[10px] bg-surface px-3 text-[14px] ring-1 ring-inset ring-field/60">
              <input
                type="checkbox"
                className="h-4 w-4 accent-cobalt"
                checked={project.audience.ageBands.includes(a)}
                onChange={(e) => {
                  const next = e.target.checked ? AGE_BANDS.filter((b) => project.audience.ageBands.includes(b) || b === a) : project.audience.ageBands.filter((b) => b !== a);
                  if (next.length) void update({ audience: { ...project.audience, ageBands: next } });
                }}
              />
              {t.common.ageBands[a]}
            </label>
          ))}
        </div>
      </fieldset>
    </div>
  );
}
