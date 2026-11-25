import { useEffect, useState } from 'react';

/**
 * Routing przez fragment adresu (`#/…`, §9, §10, §12.1): działa na GitHub Pages i zwykłym hostingu
 * bez reguł przepisywania. Ścieżki po angielsku; jedno miejsce prawdy o adresach.
 */
export type ProjectStep = 'prepare' | 'collect' | 'report' | 'technical';
export const PROJECT_STEPS: ProjectStep[] = ['prepare', 'collect', 'report', 'technical'];

/** Przykładowe raporty na stronie publicznej (§23). */
export type SampleId = 'reel' | 'video' | 'feed';
export const SAMPLE_IDS: SampleId[] = ['reel', 'video', 'feed'];

export type Route =
  | { name: 'landing' }
  | { name: 'pricing' }
  | { name: 'privacy' }
  | { name: 'terms' }
  | { name: 'sample'; sample: SampleId }
  | { name: 'login' }
  | { name: 'register' }
  | { name: 'projects' }
  | { name: 'new-project' }
  | { name: 'project'; id: string; step: ProjectStep }
  | { name: 'account' }
  | { name: 'workspace' }
  | { name: 'study'; token: string }
  | { name: 'study-package'; payload: string }
  | { name: 'delete-session'; id: string | null }
  | { name: 'invite'; token: string }
  | { name: 'shared-report'; token: string }
  | { name: 'lab' }
  | { name: 'not-found' };

export function pathOf(r: Route): string {
  switch (r.name) {
    case 'landing':
      return '#/';
    case 'pricing':
      return '#/pricing';
    case 'privacy':
      return '#/privacy';
    case 'terms':
      return '#/terms';
    case 'sample':
      return `#/sample/${r.sample}`;
    case 'login':
      return '#/login';
    case 'register':
      return '#/register';
    case 'projects':
      return '#/app';
    case 'new-project':
      return '#/app/new';
    case 'project':
      return `#/app/p/${encodeURIComponent(r.id)}/${r.step}`;
    case 'account':
      return '#/app/account';
    case 'workspace':
      return '#/app/workspace';
    case 'study':
      return `#/s/${encodeURIComponent(r.token)}`;
    case 'study-package':
      return `#/p/${r.payload}`;
    case 'invite':
      return `#/invite/${encodeURIComponent(r.token)}`;
    case 'shared-report':
      return `#/r/${encodeURIComponent(r.token)}`;
    case 'delete-session':
      return r.id ? `#/delete/${encodeURIComponent(r.id)}` : '#/delete';
    case 'lab':
      return '#/lab';
    default:
      return '#/';
  }
}

const safeDecode = (s: string): string => {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
};

export function parseRoute(hash: string): Route {
  const path = hash.replace(/^#\/?/, '').split('?')[0];
  // Ładunek linku samowystarczalnego jest w base64url — nie dekodujemy go jak segmentu URL (§12.4).
  if (path.startsWith('p/')) {
    const payload = path.slice(2);
    return payload ? { name: 'study-package', payload } : { name: 'not-found' };
  }
  const parts = path.split('/').filter(Boolean).map(safeDecode);
  const [a, b, c, d] = parts;
  if (!a) return { name: 'landing' };
  if (a === 'pricing' && !b) return { name: 'pricing' };
  if (a === 'privacy' && !b) return { name: 'privacy' };
  if (a === 'terms' && !b) return { name: 'terms' };
  if (a === 'sample') return (SAMPLE_IDS as string[]).includes(b ?? '') ? { name: 'sample', sample: b as SampleId } : b ? { name: 'not-found' } : { name: 'sample', sample: 'reel' };
  if (a === 'login' && !b) return { name: 'login' };
  if (a === 'register' && !b) return { name: 'register' };
  if (a === 'lab') return { name: 'lab' };
  if (a === 's' && b) return { name: 'study', token: b };
  if (a === 'delete') return { name: 'delete-session', id: b ?? null };
  if (a === 'invite' && b) return { name: 'invite', token: b };
  if (a === 'r' && b) return { name: 'shared-report', token: b };
  if (a === 'app') {
    if (!b) return { name: 'projects' };
    if (b === 'new') return { name: 'new-project' };
    if (b === 'account') return { name: 'account' };
    if (b === 'workspace') return { name: 'workspace' };
    if (b === 'p' && c) return { name: 'project', id: c, step: (PROJECT_STEPS as string[]).includes(d ?? '') ? (d as ProjectStep) : 'prepare' };
  }
  return { name: 'not-found' };
}

/** Parametry zapytania po `#` (np. `#/app/account?payment=ok`, `#/s/x?sim=1`). */
export function hashQuery(hash = window.location.hash): URLSearchParams {
  return new URLSearchParams(hash.split('?')[1] ?? '');
}

export function navigate(r: Route | string, opts: { replace?: boolean } = {}): void {
  const target = typeof r === 'string' ? r : pathOf(r);
  if (opts.replace) {
    history.replaceState(null, '', target);
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  } else window.location.hash = target.slice(1);
  window.scrollTo({ top: 0 });
}

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parseRoute(window.location.hash));
  useEffect(() => {
    const on = () => setRoute(parseRoute(window.location.hash));
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
}

/** Pełny adres do udostępnienia (link dla widzów, link do raportu). */
export function absoluteUrl(r: Route | string): string {
  const { origin, pathname } = window.location;
  return `${origin}${pathname}${typeof r === 'string' ? r : pathOf(r)}`;
}
