import { useState } from 'react';
import type { GazeSourceKind, SessionMode, SmoothingLevel } from '../../core/contracts/types';
import { DEMO_SPECS, type DemoId } from '../../demo/demoScene';
import { generateDemoSession } from '../../demo/simulator';
import { useT } from '../../i18n';
import { Btn, Callout, Segmented, Surface } from '../../ui/kit';
import { CameraPreview } from '../shared/CameraPreview';
import { useHubInfo } from '../shared/hooks';
import { CameraControls, PositioningChecklist } from './Camera';
import { useLab } from './LabContext';

const PARTICIPANTS = ['P1', 'P2', 'P3'];
const COLORS = ['#F2B705', '#C03636', '#2747D6', '#12784F'];
const LAB_DEMOS: DemoId[] = ['reel', 'reel_b', 'video'];

function StepTitle({ n, children }: { n: number; children: string }) {
  return (
    <span className="flex items-center gap-3">
      <span className="grid h-7 w-7 place-items-center rounded-full bg-ink text-[13px] font-bold text-white">{n}</span>
      {children}
    </span>
  );
}

export function LabSetup() {
  const lab = useLab();
  const hub = useHubInfo();
  const t = useT();
  const s = t.lab.setup;
  const [busy, setBusy] = useState(false);
  const needsCamera = lab.source === 'webcam';
  const cameraReady = hub.status === 'running';
  const blockers: string[] = [];
  if (!lab.media) blockers.push(s.blockers.media);
  if (needsCamera && !cameraReady) blockers.push(s.blockers.camera);

  const generateDemo = async (demo: DemoId) => {
    setBusy(true);
    const session = generateDemoSession(DEMO_SPECS[demo], { participant: lab.participant, name: demo });
    await lab.store.saveMeta(session.meta);
    await lab.store.appendSamples(session.meta.id, 0, session.samples);
    setBusy(false);
    lab.openSession(session.meta.id);
  };

  const mediaName = lab.media ? (lab.media.kind === 'file' ? lab.media.name : t.lab.demoNames[lab.media.demo as keyof typeof t.lab.demoNames]) : null;

  return (
    <div className="space-y-8">
      <div className="max-w-3xl">
        <h1 className="text-[28px] font-semibold tracking-[-0.02em] sm:text-[34px]">{s.title}</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-muted">{s.lead}</p>
      </div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-6">
          <Surface>
            <h2 className="mb-4 text-[17px] font-semibold">
              <StepTitle n={1}>{s.mediaTitle}</StepTitle>
            </h2>
            <div className="flex flex-wrap items-center gap-2">
              <label className="inline-flex min-h-10 cursor-pointer items-center rounded-[10px] bg-cobalt px-4 text-[14px] font-semibold text-white hover:bg-cobalt-dark">
                {s.pickFile}
                <input
                  type="file"
                  accept="video/*"
                  className="sr-only"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) lab.selectFile(f);
                  }}
                />
              </label>
              {LAB_DEMOS.map((d) => (
                <Btn key={d} onClick={() => lab.selectDemo(d)} aria-pressed={lab.media?.kind === 'demo' && lab.media.demo === d}>
                  {t.lab.demoNames[d as keyof typeof t.lab.demoNames]}
                </Btn>
              ))}
            </div>
            <p className="mt-3 text-[14px] text-muted">{mediaName ? s.selected(mediaName) : s.fileNote}</p>
          </Surface>

          <Surface>
            <h2 className="mb-4 text-[17px] font-semibold">
              <StepTitle n={2}>{s.sourceTitle}</StepTitle>
            </h2>
            <Segmented<GazeSourceKind>
              label={s.sourceTitle}
              value={lab.source}
              onChange={lab.setSource}
              options={(['webcam', 'simulated', 'mouse'] as GazeSourceKind[]).map((v) => ({ value: v, label: s.sources[v] }))}
            />
            <p className="mt-3 text-[14px] text-muted">{s.sourceHints[lab.source]}</p>
            {needsCamera && (
              <div className="mt-5 space-y-4">
                <CameraControls />
                <CameraPreview />
              </div>
            )}
          </Surface>

          <Surface>
            <h2 className="mb-4 text-[17px] font-semibold">
              <StepTitle n={3}>{s.optionsTitle}</StepTitle>
            </h2>
            <div className="space-y-5">
              <div>
                <div className="mb-2 text-[13.5px] font-semibold">{s.participant}</div>
                <Segmented label={s.participant} value={lab.participant} onChange={lab.setParticipant} options={PARTICIPANTS.map((c) => ({ value: c, label: c }))} />
              </div>
              <div>
                <div className="mb-2 text-[13.5px] font-semibold">{s.mode}</div>
                <Segmented<SessionMode> label={s.mode} value={lab.mode} onChange={lab.setMode} options={(['measurement', 'demo_overlay'] as SessionMode[]).map((m) => ({ value: m, label: s.modes[m] }))} />
                <p className="mt-2 max-w-prose text-[13.5px] text-muted">{s.modeHints[lab.mode]}</p>
              </div>
              <div>
                <div className="mb-2 text-[13.5px] font-semibold">{s.smoothing}</div>
                <Segmented<string>
                  label={s.smoothing}
                  value={String(lab.smoothing)}
                  onChange={(v) => lab.setSmoothing(Number(v) as SmoothingLevel)}
                  options={[0, 1, 2, 3].map((l) => ({ value: String(l), label: s.smoothingLevels[l] }))}
                />
              </div>
              <div className="flex flex-wrap items-center gap-4">
                <span className="text-[13.5px] font-semibold">{s.marker}</span>
                <div className="flex gap-2">
                  {COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      aria-label={s.markerColor(c)}
                      aria-pressed={lab.marker.color === c}
                      onClick={() => lab.setMarker({ ...lab.marker, color: c })}
                      className={`h-8 w-8 rounded-full ring-offset-2 ${lab.marker.color === c ? 'ring-2 ring-ink' : ''}`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
                <label className="flex items-center gap-2 text-[14px]">
                  <span className="text-muted">{s.markerSize}</span>
                  <input type="range" min={24} max={96} value={lab.marker.size} className="accent-cobalt" onChange={(e) => lab.setMarker({ ...lab.marker, size: Number(e.target.value) })} />
                </label>
              </div>
            </div>
          </Surface>
        </div>

        <div className="min-w-0 space-y-6">
          <Surface>
            <h2 className="mb-3 text-[17px] font-semibold">{s.prepTitle}</h2>
            <ul className="list-disc space-y-1.5 pl-5 text-[14.5px] leading-relaxed">
              {s.prep.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
            {needsCamera && (
              <div className="mt-5 border-t border-line pt-5">
                <PositioningChecklist />
              </div>
            )}
          </Surface>
          <Surface>
            {needsCamera ? (
              <div className="space-y-3">
                <Btn size="lg" variant="primary" className="w-full" disabled={blockers.length > 0} onClick={lab.startCalibration}>
                  {s.startCalibration}
                </Btn>
                {lab.calibration && lab.media && (
                  <Btn className="w-full" disabled={!cameraReady} onClick={lab.startWatching}>
                    {s.watchWithCalibration(t.common.quality[lab.calibration.summary.quality])}
                  </Btn>
                )}
              </div>
            ) : (
              <Btn size="lg" variant="primary" className="w-full" disabled={blockers.length > 0} onClick={lab.startWatching}>
                {s.startWatching}
              </Btn>
            )}
            {blockers.length > 0 && <p className="mt-3 text-[14px] text-muted">{s.blockersPrefix(blockers.join(', '))}</p>}
          </Surface>
          <Surface>
            <h2 className="mb-2 text-[17px] font-semibold">{s.noCameraTitle}</h2>
            <p className="mb-4 text-[14px] text-muted">{s.noCameraBody}</p>
            <div className="flex flex-wrap gap-2">
              {LAB_DEMOS.map((d) => (
                <Btn key={d} disabled={busy} onClick={() => void generateDemo(d)}>
                  {s.generate(t.lab.demoNames[d as keyof typeof t.lab.demoNames])}
                </Btn>
              ))}
            </div>
          </Surface>
          <Callout title={s.privacyTitle}>{s.privacyBody}</Callout>
        </div>
      </div>
    </div>
  );
}
