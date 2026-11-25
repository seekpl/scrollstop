import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { LocalResearchApi } from '../src/api/local';
import { MemoryLocalStore } from '../src/api/localStore';
import { ResearchProvider } from '../src/app/research';
import { Root } from '../src/app/Root';
import { ReportView } from '../src/features/report/ReportView';
import { I18nProvider } from '../src/i18n';
import { RESEARCH_TEXT } from '../src/i18n/research';
import { audienceSegments, filterAudience, MIN_SEGMENT_SESSIONS, usesPlatform } from '../src/research/audience';
import type { ViewerSession } from '../src/research/model';
import { demoProject } from '../src/research/panelSim';
import { FULL_ACCESS } from '../src/research/plans';
import { sanitizeSession } from '../src/research/sanitize';

const NOW = '2026-11-20T10:00:00.000Z';
const tx = RESEARCH_TEXT.pl;

/** Film demo z 31 ważnymi sesjami; co druga osoba ogląda TikToka codziennie, reszta rzadziej. */
function withScreener(): { project: ReturnType<typeof demoProject>['project']; sessions: ViewerSession[] } {
  const { project, sessions } = demoProject('video', tx, { createdAt: NOW });
  return {
    project: { ...project, platform: 'tiktok' },
    sessions: sessions.map((s, i) => ({ ...s, screener: { platform_tiktok: i % 2 ? 'daily' : 'rarely', platform_reels: 'never', platform_shorts: 'weekly', platform_youtube: 'weekly' } })),
  };
}

describe('segmenty widzów (§4.9)', () => {
  it('regularny użytkownik platformy: codziennie albo co tydzień; brak odpowiedzi → null', () => {
    expect(usesPlatform({ screener: { platform_tiktok: 'weekly' } }, 'tiktok')).toBe(true);
    expect(usesPlatform({ screener: { platform_tiktok: 'rarely' } }, 'tiktok')).toBe(false);
    expect(usesPlatform({ screener: {} }, 'tiktok')).toBeNull();
  });

  it('bez pytań przesiewowych i bez panelu jest tylko „wszyscy”', () => {
    const { sessions } = demoProject('video', tx, { createdAt: NOW });
    expect(audienceSegments(sessions.map((s) => ({ ...s, panel: undefined })), 'youtube', { includeSimulated: true })).toEqual(['all']);
  });

  it('pytania przesiewowe dają segmenty platformy i pozostałych, które razem są całością', () => {
    const { sessions } = withScreener();
    expect(audienceSegments(sessions, 'tiktok', { includeSimulated: true })).toEqual(['all', 'platform', 'other']);
    // Platforma bez pytania przesiewowego (LinkedIn) — bez podziału.
    expect(audienceSegments(sessions, 'linkedin', { includeSimulated: true })).toEqual(['all']);
    const users = filterAudience(sessions, 'platform', 'tiktok');
    const others = filterAudience(sessions, 'other', 'tiktok');
    expect(users.length + others.length).toBe(sessions.length);
    expect(users.every((s) => s.screener.platform_tiktok === 'daily')).toBe(true);
  });

  it('panel i społeczność osobno dopiero od 10 ważnych sesji w każdym', () => {
    const { sessions } = demoProject('video', tx, { createdAt: NOW });
    const valid = sessions.filter((s) => s.status === 'valid');
    const mark = (n: number) => sessions.map((s) => (valid.indexOf(s) >= 0 && valid.indexOf(s) < n ? { ...s, panel: { provider: 'test', refHash: `h${s.id}` } } : { ...s, panel: undefined }));
    expect(audienceSegments(mark(MIN_SEGMENT_SESSIONS), 'youtube', { includeSimulated: true })).toContain('panel');
    expect(audienceSegments(mark(MIN_SEGMENT_SESSIONS - 1), 'youtube', { includeSimulated: true })).not.toContain('panel');
    expect(filterAudience(mark(12), 'panel', 'youtube').filter((s) => s.status === 'valid')).toHaveLength(12);
  });

  it('sanityzacja: pytania przesiewowe tylko z listy kluczy i wartości', () => {
    const { sessions } = demoProject('video', tx, { createdAt: NOW, valid: 1 });
    const s = sanitizeSession({ ...sessions[0], screener: { platform_tiktok: 'daily', platform_reels: 'sometimes', platform_myspace: 'daily', note: 'tekst' } });
    expect(s.screener).toEqual({ platform_tiktok: 'daily' });
  });

  it('raport: przełącznik widzów zmienia próbę', async () => {
    const { project, sessions } = withScreener();
    render(
      <I18nProvider locale="pl">
        <ResearchProvider api={new LocalResearchApi(new MemoryLocalStore())}>
          <ReportView project={project} sessions={sessions} can={FULL_ACCESS} sample />
        </ResearchProvider>
      </I18nProvider>,
    );
    const group = screen.getByRole('radiogroup', { name: 'Widzowie' });
    expect(screen.getByText(/^31 widzów/)).toBeInTheDocument();
    fireEvent.click(within(group).getByRole('radio', { name: 'Oglądający TikToka co tydzień lub częściej' }));
    const users = filterAudience(sessions, 'platform', 'tiktok').filter((s) => s.status === 'valid').length;
    expect(screen.getByText(new RegExp(`^${users} widz`))).toBeInTheDocument();
  });
});

describe('zamówienie panelu w projekcie', () => {
  it('projekt z panelem: e-mail z podsumowaniem projektu', async () => {
    const api = new LocalResearchApi(new MemoryLocalStore());
    const project = await api.createProject({
      name: 'Reklama kawy',
      creatorName: 'Marka testowa',
      kind: 'video',
      platform: 'reels',
      audio: 'off',
      context: 'fullscreen',
      platformUi: 'none',
      targetDevice: 'mobile',
      variants: [{ media: { kind: 'demo', demo: 'reel_b' }, mediaName: 'Rolka demo B', duration: 15, width: 1080, height: 1920, label: 'Wersja A' }],
      questions: ['finish'],
      audience: { source: 'panel', ageBands: ['25-34'], countries: [], screenPlatforms: false },
      targetSessions: 50,
      locale: 'pl',
    });
    window.history.replaceState(null, '', `/#/app/p/${project.id}/prepare`);
    render(
      <I18nProvider locale="pl">
        <Root api={api} />
      </I18nProvider>,
    );
    const order = await screen.findByRole('link', { name: 'Zamów badanie z panelem' });
    const href = decodeURIComponent(order.getAttribute('href') ?? '');
    expect(href).toMatch(/^mailto:/);
    expect(href).toContain('Projekt: Reklama kawy');
    expect(href).toContain('Długość materiału: 15 s');
    expect(href).toContain('Widzów: 50');
    expect(href).toContain('Wiek: 25–34 lata');
    window.history.replaceState(null, '', '/');
  });
});
