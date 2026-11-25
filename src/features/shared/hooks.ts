import { useEffect, useState } from 'react';
import { trackingHub, type HubInfo } from '../../core/tracking/trackingHub';

export function useHubInfo(): HubInfo {
  const [info, setInfo] = useState<HubInfo>(trackingHub.getInfo());
  useEffect(() => trackingHub.onInfo((i) => setInfo({ ...i })), []);
  return info;
}
