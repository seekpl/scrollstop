import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { LocalResearchApi } from '../src/api/local';
import { MemoryLocalStore } from '../src/api/localStore';
import type { NewProject } from '../src/api/types';
import { Root } from '../src/app/Root';
import { DEMO_SPECS } from '../src/demo/demoScene';
import { I18nProvider, type Locale } from '../src/i18n';
import { RESEARCH_TEXT } from '../src/i18n/research';
import { decodePackage, encodePackage } from '../src/research/compact';
import { PROFILES, simulateSessions } from '../src/research/panelSim';
import { PRICING_ITEMS, PRICING_SOON } from '../src/research/plans';

function renderAt(hash: string, api = new LocalResearchApi(new MemoryLocalStore()), locale: Locale = 'pl') {
  window.history.replaceState(null, '', `/${hash}`);
  render(
    <I18nProvider locale={locale}>
      <Root api={api} />
    </I18nProvider>,
  );
  return api;
}

const demoInput = (patch: Partial<NewProject> = {}): NewProject => ({
  name: 'Rolka testowa',
  creatorName: 'Studio testowe',
  kind: 'video',
  platform: 'tiktok',
  audio: 'off',
  context: 'fullscreen',
  platformUi: 'none',
  targetDevice: 'mobile',
  variants: [{ media: { kind: 'demo', demo: 'reel_b' }, mediaName: 'Rolka demo B', duration: 15, width: 1080, height: 1920, label: 'Wersja A' }],
  questions: ['finish'],
  audience: { source: 'community', ageBands: ['18-24', '25-34'], countries: [], screenPlatforms: false },
  targetSessions: 30,
  locale: 'pl',
  ...patch,
});

afterEach(() => window.history.replaceState(null, '', '/'));

describe('strona publiczna (M4)', () => {
  it('pierwszy ekran: krzywa i podpis liczone z symulowanego panelu', async () => {
    renderAt('#/');
    expect(await screen.findByText('Przykład: krzywa uwagi rolki demo, symulowany panel 31 widzów')).toBeInTheDocument();
    // Zdanie i liczby z raportu przykładu (spadek w hooku wersji A), nie wpisane na sztywno.
    expect(await screen.findByText(/^Największy spadek uwagi wystąpił między 00:00 a 00:0\d/)).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Rolka: test hooka A/B' })).toHaveAttribute('aria-selected', 'true');
  });

  it('cennik w PLN: zamówienie e-mailem, okres roczny = 10 × miesięczna, „wkrótce” przy brakujących funkcjach', () => {
    renderAt('#/pricing');
    expect(screen.getByRole('heading', { level: 1, name: 'Cennik' })).toBeInTheDocument();
    const creator = screen.getByRole('listitem', { name: 'Creator' });
    expect(within(creator).getByText(/^79\s?zł$/)).toBeInTheDocument();
    const order = within(creator).getByRole('link', { name: 'Zamów plan Creator' });
    expect(order.getAttribute('href')).toMatch(/^mailto:[^?]+\?subject=Zam%C3%B3wienie%20planu%20Creator/);
    fireEvent.click(screen.getByRole('radio', { name: /Rocznie/ }));
    expect(within(creator).getByText(/^790\s?zł$/)).toBeInTheDocument();
    const soon = PLAN_SOON_COUNT();
    expect(screen.getAllByText('wkrótce')).toHaveLength(soon);
    // Badanie z panelem: formularz (bez serwera kończy się e-mailem z podsumowaniem).
    fireEvent.click(screen.getByRole('button', { name: 'Zamów badanie z panelem' }));
    expect(screen.getByRole('dialog', { name: 'Zamów badanie z panelem' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Przygotuj e-mail z zamówieniem' })).toBeInTheDocument();
  });

  it('cennik po angielsku: USD z przełącznikiem EUR', async () => {
    renderAt('#/pricing', undefined, 'en');
    const pro = await screen.findByRole('listitem', { name: 'Pro' });
    expect(within(pro).getByText('$49')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('radio', { name: 'EUR' }));
    expect(within(pro).getByText('€49')).toBeInTheDocument();
  });

  it('prywatność: dane operatora z company.ts i link do usuwania sesji', () => {
    renderAt('#/privacy');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Prywatność i zasady etyczne');
    expect(screen.getByText(/^Właściciel i operator serwisu \(administrator danych z kont twórców\): Sebastian Biel, Wąska 5, 32-765 Rzezawa, NIP 8681879901\./)).toBeInTheDocument();
    expect(screen.getByText(/^Obowiązuje od 26 listopada 2026/)).toBeInTheDocument();
    expect(screen.queryByText(/wersja robocza|przeglądu prawn/i)).toBeNull();
    expect(screen.getByRole('link', { name: 'Usuń swoją sesję' })).toHaveAttribute('href', '#/delete');
  });

  it('przykładowy raport rolki: odznaka symulacji i porównanie wersji', async () => {
    renderAt('#/sample/reel');
    expect(await screen.findByText('Przykładowy raport z symulowanego panelu')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Rolka: test hooka A/B' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByText('Porównanie wersji A/B')).toBeInTheDocument();
  });
});

function PLAN_SOON_COUNT(): number {
  return Object.values(PRICING_ITEMS)
    .flat()
    .filter((i) => PRICING_SOON.has(i)).length;
}

describe('studio lokalne (M4)', () => {
  it('pusty stan listy projektów', async () => {
    renderAt('#/app');
    expect(await screen.findByText('Pierwszy projekt zajmuje 2 minuty')).toBeInTheDocument();
    expect(screen.getByText(/Plan Free: 0 z 1 aktywnych projektów/)).toBeInTheDocument();
  });

  it('karta projektu: meta, postęp i status', async () => {
    const api = new LocalResearchApi(new MemoryLocalStore());
    await api.createProject(demoInput());
    renderAt('#/app', api);
    expect(await screen.findByText('Rolka testowa')).toBeInTheDocument();
    expect(screen.getByText('Cały materiał · 9:16 · TikTok')).toBeInTheDocument();
    expect(screen.getAllByText('0 z 30 widzów').length).toBeGreaterThan(0);
    expect(screen.getByText('Otwarte')).toBeInTheDocument();
  });

  it('import plików sesji: kontrola jakości, duplikat pominięty, tabela sesji', async () => {
    const api = new LocalResearchApi(new MemoryLocalStore());
    const project = await api.createProject(demoInput());
    const [s] = simulateSessions({ projectId: 'inny', variantId: 'A', spec: DEMO_SPECS.reel_b, profile: PROFILES.reelStrongHook, valid: 1, phoneShare: 1, seed: 5, audio: 'off' });
    const pkg = encodePackage({ ...s, source: 'webcam' });
    renderAt(`#/app/p/${project.id}/collect`, api);
    expect(await screen.findByText('Nikt jeszcze nie wziął udziału')).toBeInTheDocument();
    const input = screen.getByLabelText('Dodaj pliki sesji (.json)');
    const files = [new File([pkg], 'a.json', { type: 'application/json' }), new File([pkg], 'b.json', { type: 'application/json' }), new File(['{zepsuty'], 'c.json', { type: 'application/json' })];
    await act(async () => {
      fireEvent.change(input, { target: { files } });
    });
    expect(await screen.findByText('Dodano 1 sesję, pominięto 2 (duplikaty, limit planu albo uszkodzone dane).')).toBeInTheDocument();
    await waitFor(() => expect(screen.getAllByText(s.participantId).length).toBeGreaterThan(0));
    expect(screen.getAllByText('W raporcie').length).toBeGreaterThan(0);
    expect(screen.getAllByText('1 z 30 widzów').length).toBeGreaterThan(0);
  });

  it('plan Free: po 5 sesjach link wstrzymany i komunikat o pierwszej krzywej', async () => {
    const api = new LocalResearchApi(new MemoryLocalStore());
    const project = await api.createProject(demoInput());
    const sessions = simulateSessions({ projectId: project.id, variantId: 'A', spec: DEMO_SPECS.reel_b, profile: PROFILES.reelStrongHook, valid: 5, phoneShare: 1, seed: 9, audio: 'off' });
    await api.importSessions(
      project.id,
      sessions.map((x) => decodePackage(encodePackage({ ...x, source: 'webcam' }))),
    );
    renderAt(`#/app/p/${project.id}/collect`, api);
    expect(await screen.findByText('Masz już pierwszą krzywą uwagi.')).toBeInTheDocument();
  });

  it('analiza techniczna: eksport surowych danych zablokowany w planie Free', async () => {
    const api = new LocalResearchApi(new MemoryLocalStore());
    const project = await api.createProject(demoInput());
    renderAt(`#/app/p/${project.id}/technical`, api);
    expect(await screen.findByText('Eksport surowych danych (JSON, CSV) jest dostępny od planu Agency.')).toBeInTheDocument();
  });

  it('przygotuj test: gotowe wiadomości w języku badania z linkiem', async () => {
    const api = new LocalResearchApi(new MemoryLocalStore());
    const project = await api.createProject(demoInput({ locale: 'en' }));
    renderAt(`#/app/p/${project.id}/prepare`, api);
    expect(await screen.findByText('Gotowe wiadomości')).toBeInTheDocument();
    const story = screen.getByLabelText('Story') as HTMLTextAreaElement;
    expect(story.value).toMatch(/^Help me improve my new reel/);
    expect(story.value).toContain('#/p/');
  });

  it('konto: usunięcie wymaga wpisania słowa potwierdzenia', async () => {
    renderAt('#/app/account');
    fireEvent.click(await screen.findByRole('button', { name: 'Usuń konto i dane' }));
    const dialog = screen.getByRole('dialog');
    const confirm = within(dialog).getByRole('button', { name: 'Usuń konto i dane' });
    expect(confirm).toBeDisabled();
    fireEvent.change(within(dialog).getByLabelText('Wpisz „USUŃ”, aby potwierdzić'), { target: { value: 'usuń' } });
    expect(confirm).toBeEnabled();
  });
});

describe('teksty analityczne', () => {
  it('słowniki raportu dla każdego języka', () => {
    expect(Object.keys(RESEARCH_TEXT).sort()).toEqual(['en', 'pl']);
  });
});
