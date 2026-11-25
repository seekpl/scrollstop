import { describe, expect, it } from 'vitest';
import { parseRoute, pathOf, type Route } from '../src/app/router';

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
