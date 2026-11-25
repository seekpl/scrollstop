import { useEffect, useRef, useState } from 'react';
import { trackingHub } from '../../core/tracking/trackingHub';
import { useT, type Messages } from '../../i18n';
import { useHubInfo } from '../shared/hooks';
import { STEADY_MS, usePositioning } from '../shared/positioning';
import { BigButton, CheckItem, Screen, Title } from './parts';

const isIos = () => /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.userAgent.includes('Mac') && navigator.maxTouchPoints > 1);

export function cameraErrorText(code: string | undefined, t: Messages): string {
  return (code && (t.errors as Record<string, string>)[code]) || t.errors.camera_unknown;
}

/**
 * Sprawdzenie kamery (§10.5): podgląd lustrzany (widzi go tylko widz), lista kontrolna co 330 ms.
 * „Dalej” aktywne, gdy kamera działa, orientacja jest dobra, a twarz i oczy są widoczne od 800 ms.
 */
export function CameraCheck({ mobile, portraitRequired, onReady }: { mobile: boolean; portraitRequired: boolean; onReady(): void }) {
  const t = useT();
  const k = t.viewer.check;
  const hub = useHubInfo();
  const box = useRef<HTMLDivElement>(null);
  const p = usePositioning(mobile ? 'mobile' : 'desktop');
  const [portrait, setPortrait] = useState(() => window.innerHeight >= window.innerWidth);

  useEffect(() => {
    if (hub.status === 'idle') void trackingHub.start();
  }, [hub.status]);
  useEffect(() => {
    if (!box.current || hub.status !== 'running') return;
    return trackingHub.adopt(box.current, 'absolute inset-0 h-full w-full object-cover -scale-x-100');
  }, [hub.status]);
  useEffect(() => {
    const on = () => setPortrait(window.innerHeight >= window.innerWidth);
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);

  const orientationOk = !mobile || !portraitRequired || portrait;
  const ready = hub.status === 'running' && orientationOk && !!p?.face && !!p.eyes && p.steadyMs >= STEADY_MS;
  return (
    <Screen>
      <div className="space-y-6">
        <Title>{k.title}</Title>
        <div ref={box} className={`relative overflow-hidden rounded-3xl bg-ink ${mobile ? 'aspect-[3/4]' : 'aspect-video'}`}>
          {hub.status !== 'running' && <div className="absolute inset-0 grid place-items-center p-6 text-center text-[15px] text-white/85">{hub.status === 'error' ? cameraErrorText(hub.error, t) : k.starting}</div>}
        </div>
        <p className="text-[13.5px] text-muted">{k.previewNote}</p>
        {hub.status === 'error' && (
          <div className="space-y-3">
            <p className="text-[14.5px] leading-relaxed text-muted">{hub.error === 'camera_denied' ? (isIos() ? k.unblockIos : k.unblock) : k.retryHint}</p>
            <BigButton variant="secondary" onClick={() => void trackingHub.start()}>
              {t.common.actions.retry}
            </BigButton>
          </div>
        )}
        {hub.status === 'running' && (
          <ul className="space-y-2.5" aria-live="polite">
            {mobile && portraitRequired && <CheckItem ok={orientationOk}>{orientationOk ? k.portraitOk : k.rotatePortrait}</CheckItem>}
            <CheckItem ok={!!p?.face}>{p?.face ? k.face : k.noFace}</CheckItem>
            <CheckItem ok={!!p?.eyes}>{p?.eyes ? k.eyes : k.noEyes}</CheckItem>
            <CheckItem ok={!!p?.centered} warn>
              {p?.centered ? k.centered : k.notCentered}
            </CheckItem>
            <CheckItem ok={p?.distance === 'ok'} warn>
              {p?.distance === 'near' ? k.tooClose : p?.distance === 'far' ? k.tooFar : p?.distance === 'ok' ? k.distanceOk : k.distanceUnknown}
            </CheckItem>
            <CheckItem ok={!p?.dark} warn>
              {p?.dark ? k.tooDark : k.lightOk}
            </CheckItem>
          </ul>
        )}
        <BigButton disabled={!ready} onClick={onReady}>
          {t.common.actions.next}
        </BigButton>
      </div>
    </Screen>
  );
}
