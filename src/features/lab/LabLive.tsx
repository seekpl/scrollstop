import { useEffect, useRef, useState } from 'react';
import { FULL_RECT } from '../../core/geometry/coords';
import { SampleBuilder } from '../../core/pipeline/sampleBuilder';
import type { DisplayGaze } from '../../core/pipeline/types';
import { WebcamGazeEstimator } from '../../core/pipeline/webcamEstimator';
import { estimateDistanceCm } from '../../core/tracking/features';
import type { TrackerFrame } from '../../core/tracking/faceTracker';
import { trackingHub } from '../../core/tracking/trackingHub';
import { useT } from '../../i18n';
import { Btn, Surface } from '../../ui/kit';
import { CameraPreview, drawEyeOverlay } from '../shared/CameraPreview';
import { Emitter } from '../shared/emitter';
import { GazeMarker } from '../shared/GazeMarker';
import { useHubInfo } from '../shared/hooks';
import { CameraControls } from './Camera';
import { useLab } from './LabContext';
import { Item, QualityBadge } from './parts';

interface Snapshot {
  frame: TrackerFrame;
  gaze: DisplayGaze | null;
  flags: string[];
}

const fmt = (v: number | undefined, d = 2) => (v === undefined || !Number.isFinite(v) ? '–' : v.toFixed(d));

/** Podgląd na żywo: kamera, punkty oczu, estymacja wzroku i diagnostyka (§12.7 lab). */
export function LabLive() {
  const lab = useLab();
  const hub = useHubInfo();
  const t = useT();
  const l = t.lab.live;
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [overlay, setOverlay] = useState(false);
  const bus = useRef(new Emitter<DisplayGaze | null>()).current;

  useEffect(() => {
    const estimator = lab.calibration ? new WebcamGazeEstimator(lab.calibration.model, lab.calibration.summary) : null;
    const builder = new SampleBuilder(lab.smoothing, null, () => FULL_RECT);
    let last = 0;
    return trackingHub.subscribe((f) => {
      let gaze: DisplayGaze | null = null;
      let flags: string[] = [];
      if (estimator) {
        const raw = estimator.estimate(f);
        const r = builder.build(raw);
        gaze = r.display;
        flags = raw.flags;
        bus.emit(r.display);
      }
      if (f.captureTime - last > 200) {
        last = f.captureTime;
        setSnap({ frame: f, gaze, flags });
      }
    });
  }, [lab.calibration, lab.smoothing, bus]);

  const face = snap?.frame.face;
  const flagText = snap?.flags.length ? (snap.flags.includes('no_face') ? t.lab.watch.status.noFace : snap.flags.includes('head_pose') ? t.lab.watch.status.headPose : snap.flags.join(', ')) : null;
  return (
    <div className="space-y-6">
      <div className="max-w-3xl">
        <h1 className="text-[28px] font-semibold tracking-[-0.02em] sm:text-[34px]">{l.title}</h1>
        <p className="mt-2 text-[15px] text-muted">{l.lead}</p>
      </div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Surface>
          <div className="mb-4">
            <CameraControls />
          </div>
          <CameraPreview overlay={drawEyeOverlay} />
          <p className="mt-3 text-[12.5px] text-muted">{l.mirrorNote}</p>
        </Surface>
        <div className="min-w-0 space-y-6">
          <Surface>
            <h2 className="mb-3 text-[17px] font-semibold">{l.gazeTitle}</h2>
            {lab.calibration ? (
              <div className="space-y-4">
                <QualityBadge quality={snap?.gaze?.quality ?? 'POOR'} prefix={t.lab.watch.qualityPrefix} />
                <dl className="tabular grid grid-cols-2 gap-3">
                  <Item label="gaze_x" value={fmt(snap?.gaze?.x, 3)} />
                  <Item label="gaze_y" value={fmt(snap?.gaze?.y, 3)} />
                  <Item label={l.confidence} value={snap?.gaze ? `${Math.round(snap.gaze.confidence * 100)}%` : '–'} />
                  <Item label={l.uncertainty} value={snap?.gaze ? `±${(snap.gaze.uncertainty * 100).toFixed(1)}%` : '–'} />
                </dl>
                {flagText && <p className="text-[14px] font-semibold text-poor">{flagText}</p>}
                <label className="flex items-center gap-2 font-semibold">
                  <input type="checkbox" className="h-4 w-4 accent-cobalt" checked={overlay} onChange={(e) => setOverlay(e.target.checked)} />
                  {l.showMarker}
                </label>
                <Btn onClick={lab.startCalibration} disabled={hub.status !== 'running'}>
                  {l.recalibrate}
                </Btn>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-muted">{l.needCalibration}</p>
                <Btn variant="primary" onClick={lab.startCalibration} disabled={hub.status !== 'running'}>
                  {t.lab.setup.startCalibration}
                </Btn>
              </div>
            )}
          </Surface>
          <Surface>
            <h2 className="mb-3 text-[17px] font-semibold">{l.diagTitle}</h2>
            <dl className="tabular grid grid-cols-2 gap-3">
              <Item label={l.diag.fps} value={String(hub.fps)} />
              <Item label={l.diag.inference} value={`${fmt(hub.inferenceMs, 1)} ms`} />
              <Item label={l.diag.clock} value={hub.clockSource ?? '–'} />
              <Item label={l.diag.face} value={face ? l.diag.detected : l.diag.none} />
              <Item label={l.diag.pose} value={face ? `${fmt(face.pose.yaw, 0)}° / ${fmt(face.pose.pitch, 0)}° / ${fmt(face.pose.roll, 0)}°` : '–'} />
              <Item label={l.diag.distance} value={face ? `${Math.round(estimateDistanceCm(face.scale))} cm` : '–'} />
              <Item label={l.diag.blink} value={face ? `${Math.round(face.blink * 100)}%` : '–'} />
              <Item label={l.diag.iris} value={face ? `${fmt(face.features[0])}, ${fmt(face.features[1])} / ${fmt(face.features[2])}, ${fmt(face.features[3])}` : '–'} />
            </dl>
          </Surface>
        </div>
      </div>
      <GazeMarker bus={bus} visible={overlay} size={lab.marker.size} color={lab.marker.color} />
    </div>
  );
}
