import { describe, expect, it } from 'vitest';
import { afterEach } from 'vitest';
import { currentRoute, hrefOf, parseRoute, pathOf, pathRoute, PUBLIC_ROUTES, rootPrefix, type Route } from '../src/app/router';
import { PUBLIC_PAGES } from '../src/config/publicPages';

describe('router (hash, §9–§10)', () => {
  const routes: Route[] = [
    { name: 'landing' },
    { name: 'pricing' },
    { name: 'privacy' },
    { name: 'sample', sample: 'feed' },
    { name: 'login' },
    { name: 'register' },
    { name: 'projects' },
    { name: 'new-project' },
    { name: 'project', id: 'prj_abc-1', step: 'collect' },
    { name: 'account' },
    { name: 'workspace' },
    { name: 'study', token: 'tok_X-y' },
    { name: 'study-package', payload: 'eyJhIjoxfQ' },
    { name: 'delete-session', id: 'ses_1' },
    { name: 'delete-session', id: null },
    { name: 'invite', token: 'inv_Tok-1' },
    { name: 'shared-report', token: 'shr_Tok-2' },
    { name: 'lab' },
  ];
  for (const r of routes) it(`${r.name}: ${pathOf(r)}`, () => expect(parseRoute(pathOf(r))).toEqual(r));

  it('nieznane ścieżki → 404, domyślny krok projektu → prepare', () => {
    expect(parseRoute('#/nie-ma')).toEqual({ name: 'not-found' });
    expect(parseRoute('#/sample/xyz')).toEqual({ name: 'not-found' });
    expect(parseRoute('#/app/p/prj_1')).toEqual({ name: 'project', id: 'prj_1', step: 'prepare' });
    expect(parseRoute('')).toEqual({ name: 'landing' });
  });

  it('ładunek linku samowystarczalnego nie jest dekodowany jak URL, zapytanie po # pomijane', () => {
    const payload = 'eyJ%2Fa-_b';
    expect(parseRoute(`#/p/${payload}`)).toEqual({ name: 'study-package', payload });
    expect(parseRoute('#/s/tok?sim=1')).toEqual({ name: 'study', token: 'tok' });
    expect(parseRoute('#/app/account?payment=ok')).toEqual({ name: 'account' });
  });
});

describe('czyste adresy stron publicznych (wyszukiwarki, sitemap.xml)', () => {
  afterEach(() => window.history.replaceState(null, '', '/'));

  it('ścieżka → strona publiczna, także w podkatalogu serwera i z index.html', () => {
    expect(pathRoute('/pricing/')).toMatchObject({ route: { name: 'pricing' }, depth: 1 });
    expect(pathRoute('/pricing')).toMatchObject({ route: { name: 'pricing' } });
    expect(pathRoute('/scrollstop/sample/video/index.html')).toMatchObject({ route: { name: 'sample', sample: 'video' }, depth: 2 });
    expect(pathRoute('/')).toBeNull();
    expect(pathRoute('/xpricing/')).toBeNull();
    expect(rootPrefix('/sample/feed/')).toBe('../../');
    expect(PUBLIC_ROUTES.map((r) => r.path)).toEqual(PUBLIC_PAGES.map((p) => p.path));
  });

  it('część po „#” ma pierwszeństwo; bez niej trasa z czystego adresu', () => {
    window.history.replaceState(null, '', '/privacy/');
    expect(currentRoute()).toEqual({ name: 'privacy' });
    window.history.replaceState(null, '', '/privacy/#/app');
    expect(currentRoute()).toEqual({ name: 'projects' });
  });

  it('linki: strony publiczne pod czystym adresem, aplikacja przez „#” — względem katalogu głównego', () => {
    window.history.replaceState(null, '', '/');
    expect(hrefOf({ name: 'pricing' })).toBe('pricing/');
    expect(hrefOf({ name: 'landing' })).toBe('./');
    expect(hrefOf({ name: 'new-project' })).toBe('#/app/new');
    window.history.replaceState(null, '', '/sample/reel/');
    expect(hrefOf({ name: 'sample', sample: 'video' })).toBe('../../sample/video/');
    expect(hrefOf({ name: 'landing' })).toBe('../../');
    expect(hrefOf({ name: 'register' })).toBe('../../#/register');
  });
});
