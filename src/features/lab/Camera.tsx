import { useEffect, useState } from 'react';
import { listCameras } from '../../core/tracking/camera';
import { trackingHub } from '../../core/tracking/trackingHub';
import { useT } from '../../i18n';
import { Btn, Icon } from '../../ui/kit';
import { useHubInfo } from '../shared/hooks';
import { usePositioning } from '../shared/positioning';
import { useLab } from './LabContext';

export function CameraControls() {
  const lab = useLab();
  const info = useHubInfo();
  const t = useT();
  const c = t.lab.camera;
  const [cams, setCams] = useState<MediaDeviceInfo[]>([]);
  useEffect(() => {
    listCameras().then(setCams, () => setCams([]));
  }, [info.status]);
  return (
    <div className="flex flex-wrap items-center gap-3">
      <label className="flex min-w-0 items-center gap-2 text-[14px]">
        <span className="text-muted">{c.label}</span>
        <select
          className="h-9 max-w-[14rem] min-w-0 rounded-[10px] bg-surface px-2 font-semibold ring-1 ring-inset ring-field"
          value={lab.cameraId ?? info.deviceId ?? ''}
          onChange={(e) => {
            lab.setCameraId(e.target.value || null);
            if (info.status === 'running') void trackingHub.start(e.target.value || null);
          }}
        >
          <option value="">{c.default}</option>
          {cams.map((cam, i) => (
            <option key={cam.deviceId || i} value={cam.deviceId}>
              {cam.label || c.nth(i + 1)}
            </option>
          ))}
        </select>
      </label>
      {info.status === 'running' ? (
        <Btn size="sm" onClick={() => trackingHub.stop()}>
          {c.turnOff}
        </Btn>
      ) : (
        <Btn size="sm" variant="primary" disabled={info.status === 'starting'} onClick={() => void trackingHub.start(lab.cameraId)}>
          {info.status === 'starting' ? c.starting : c.turnOn}
        </Btn>
      )}
      {info.status === 'running' && (
        <span className="tabular text-[12.5px] text-muted">
          {c.info(info.width ?? 0, info.height ?? 0, info.fps, info.delegate ?? '–')}
          {info.modelLocal === false ? `, ${c.remoteModel}` : ''}
        </span>
      )}
      {info.error && <p className="w-full text-[14px] font-semibold text-poor">{(t.errors as Record<string, string>)[info.error] ?? t.errors.camera_unknown}</p>}
    </div>
  );
}

function Check({ ok, warn = false, children }: { ok: boolean; warn?: boolean; children: string }) {
  return (
    <li className="flex items-start gap-2.5">
      <span aria-hidden className={`mt-0.5 shrink-0 ${ok ? 'text-good' : warn ? 'text-fair' : 'text-poor'}`}>
        <Icon name={ok ? 'check' : 'alert'} size={17} />
      </span>
      <span>{children}</span>
    </li>
  );
}

/** Lista kontrolna ustawienia przed kamerą (laboratorium, komputer). */
export function PositioningChecklist() {
  const t = useT();
  const k = t.lab.checks;
  const p = usePositioning('desktop');
  if (!p) return <p className="text-[14px] text-muted">{k.enableCamera}</p>;
  return (
    <ul className="space-y-2 text-[14px]">
      <Check ok={p.face}>{p.face ? k.faceOk : k.faceNo}</Check>
      <Check ok={p.eyes}>{p.eyes ? k.eyesOk : k.eyesNo}</Check>
      <Check ok={p.centered} warn>
        {p.centered ? k.centeredOk : k.centeredNo}
      </Check>
      <Check ok={p.distance === 'ok'} warn>
        {p.distance === 'unknown' ? k.distanceUnknown : k.distance(Math.round(p.distanceCm), k.distanceState[p.distance])}
      </Check>
      <Check ok={!p.dark} warn>
        {p.dark ? k.dark : k.brightOk}
      </Check>
    </ul>
  );
}
