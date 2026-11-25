import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LocalResearchApi } from '../src/api/local';
import { MemoryLocalStore } from '../src/api/localStore';
import type { SubmitResult } from '../src/api/types';
import { ResearchProvider } from '../src/app/research';
import { FinishScreen } from '../src/features/viewer/Finish';
import { I18nProvider } from '../src/i18n';
import { RESEARCH_TEXT } from '../src/i18n/research';
import { CONSENT_VERSION, type StudyConfig, type ViewerSession } from '../src/research/model';
import { demoProject } from '../src/research/panelSim';

const leaveTo = vi.hoisted(() => vi.fn<(url: string) => void>());
vi.mock('../src/features/shared/browser', async (orig) => ({ ...(await orig<typeof import('../src/features/shared/browser')>()), leaveTo }));

const config: StudyConfig = {
  projectId: 'prj_panel',
  projectName: 'Panel',
  creatorName: 'Marka',
  kind: 'video',
  platform: 'tiktok',
  audio: 'off',
  context: 'fullscreen',
  platformUi: 'none',
  targetDevice: 'any',
  variant: { id: 'A', media: { kind: 'demo', demo: 'reel_b' }, mediaName: 'Rolka', duration: 15, width: 1080, height: 1920 },
  fillers: [],
  questions: [],
  ageBands: ['18-24'],
  screenPlatforms: false,
  consentVersion: CONSENT_VERSION,
  transport: 'server',
  linkToken: 'tok_panel',
  retentionDays: 90,
  locale: 'pl',
  panel: { provider: 'cint', completeUrl: 'https://panel.example/c?rid={PID}', screenoutUrl: 'https://panel.example/s?rid={PID}', qualityFailUrl: 'https://panel.example/q?rid={PID}' },
};

const session = (): ViewerSession => demoProject('reel', RESEARCH_TEXT.pl, { valid: 1, createdAt: new Date().toISOString() }).sessions[0];

function renderFinish(status: SubmitResult['status'], pid: string | null) {
  const api = new LocalResearchApi(new MemoryLocalStore());
  const submit = vi.fn(async (): Promise<SubmitResult> => ({ sessionId: 'ses_1', deletionCode: 'K7QM-4XPA', status }));
  api.submitSession = submit;
  render(
    <I18nProvider locale="pl">
      <ResearchProvider api={api}>
        <FinishScreen config={config} session={session()} completed reported={false} simulated={false} pid={pid} />
      </ResearchProvider>
    </I18nProvider>,
  );
  return submit;
}

afterEach(() => leaveTo.mockReset());

describe('powrót widza do dostawcy panelu (§16.5)', () => {
  it('ważna sesja → adres „complete” z identyfikatorem; identyfikator idzie w nagłówku, nie w sesji', async () => {
    const submit = renderFinish('valid', 'RID:7@x');
    await waitFor(() => expect(leaveTo).toHaveBeenCalledWith('https://panel.example/c?rid=RID%3A7%40x'));
    expect(submit).toHaveBeenCalledWith('tok_panel', expect.not.objectContaining({ panel: expect.anything() }), { panelRef: 'RID:7@x' });
    expect(await screen.findByText('Przekierowuję…')).toBeInTheDocument();
  });

  it('odrzucona przez kontrolę jakości → „quality_fail”', async () => {
    renderFinish('rejected', 'RID-9');
    await waitFor(() => expect(leaveTo).toHaveBeenCalledWith('https://panel.example/q?rid=RID-9'));
  });

  it('bez identyfikatora (zwykły link) — bez przekierowania, kod usunięcia na ekranie', async () => {
    const submit = renderFinish('valid', null);
    expect(await screen.findByText('K7QM-4XPA')).toBeInTheDocument();
    expect(submit).toHaveBeenCalledWith('tok_panel', expect.anything(), {});
    expect(leaveTo).not.toHaveBeenCalled();
  });
});
