import { CodedError } from '../errors';

export async function listCameras(): Promise<MediaDeviceInfo[]> {
  if (!navigator.mediaDevices?.enumerateDevices) return [];
  const devices = await navigator.mediaDevices.enumerateDevices();
  return devices.filter((d) => d.kind === 'videoinput');
}

export async function openCamera(deviceId?: string | null): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new CodedError('camera_unsupported');
  }
  try {
    return await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        deviceId: deviceId ? { exact: deviceId } : undefined,
        // Telefon/tablet: przednia kamera (patrzy na widza). Przy wybranym deviceId bez facingMode (§5.1).
        facingMode: deviceId ? undefined : 'user',
        width: { ideal: 1280 },
        height: { ideal: 720 },
        frameRate: { ideal: 30 },
      },
    });
  } catch (e) {
    const name = (e as DOMException)?.name;
    if (name === 'NotAllowedError' || name === 'SecurityError') throw new CodedError('camera_denied');
    if (name === 'NotFoundError' || name === 'OverconstrainedError') throw new CodedError('camera_not_found');
    if (name === 'NotReadableError' || name === 'AbortError') throw new CodedError('camera_busy');
    throw new CodedError('camera_unknown', e instanceof Error ? e.message : String(e));
  }
}
