import { useEffect, useMemo, useState } from 'react';
import { ApiError } from '../../api/types';
import { hashQuery } from '../../app/router';
import { useResearch } from '../../app/research';
import { errorCode } from '../../core/errors';
import { trackingHub } from '../../core/tracking/trackingHub';
import { I18nProvider, useT } from '../../i18n';
import { compactSamples } from '../../research/compact';
import { calibrationInfo, decodeStudyConfig, detectDevice, randomId } from '../../research/link';
import type { AgeBand, ConsentRecord, StudyConfig, ViewerSession } from '../../research/model';
import { cleanPid, panelReturnUrl } from '../../research/panel';
import { expiryDate } from '../../research/sessions';
import { exitFullscreen, leaveTo } from '../shared/browser';
import type { CalibrationOutcome } from '../shared/useCalibration';
import { CalibrationStage } from './CalibrationStage';
import { CameraCheck } from './CameraCheck';
import { ConsentScreen } from './Consent';
import { FinishScreen } from './Finish';
import { clearPending, pendingFor } from './outbox';
import { BigButton, Screen, Steps, Title } from './parts';
import { QuestionsScreen } from './Questions';
import { ScreenerScreen } from './Screener';
import { SoundCheck } from './SoundCheck';
import { WatchCarousel } from './WatchCarousel';
import { WatchFeed } from './WatchFeed';
import { WatchGrid } from './WatchGrid';
import { WatchFullscreen, type WatchResult } from './WatchFullscreen';

type Stage = 'device' | 'consent' | 'underage' | 'screenout' | 'screener' | 'prepare' | 'check' | 'sound' | 'calibrate' | 'watch' | 'questions' | 'finish';

/** Kody niedostępności badania (§10.13) — tekst w słowniku `viewer.unavailable`. */
type Problem = 'not_found' | 'closed' | 'paused' | 'project_sessions' | 'month_sessions' | 'link_broken' | 'link_incomplete' | 'local_media' | 'network' | 'unknown';

const isTouchDevice = () => detectDevice().type !== 'desktop';

/**
 * Badanie po stronie widza (§10). Do wczytania konfiguracji — język interfejsu; potem cały
 * przebieg w języku badania z projektu (zagnieżdżony provider językowy, §18).
 * `?sim=1` — tryb testowy twórcy: bez kamery, wzrok symulowany, sesja oznaczona jako symulacja.
 * `?pid=…` — widz z panelu (§16.5): identyfikator uczestnika tylko w pamięci, po badaniu powrót do
 * dostawcy. Serwer zapisuje wyłącznie skrót identyfikatora.
 */
export function ViewerApp({ token, payload }: { token?: string; payload?: string }) {
  const t = useT();
  const { api } = useResearch();
  const simulated = hashQuery().get('sim') === '1';
  const [pid] = useState(() => cleanPid(hashQuery().get('pid')));
  const [config, setConfig] = useState<StudyConfig | null>(null);
  const [problem, setProblem] = useState<Problem | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        let cfg: StudyConfig;
        if (payload) cfg = decodeStudyConfig(payload);
        else {
          const r = await api.study(token as string);
          if (!r.ok) {
            if (alive) setProblem(r.reason === 'active_projects' ? 'paused' : r.reason);
            return;
          }
          cfg = r.config;
          // Sesje, których wcześniej nie udało się wysłać — ponawiamy po cichu (§12.3).
          for (const s of await pendingFor(cfg.linkToken)) {
            try {
              await api.submitSession(cfg.linkToken, s);
              await clearPending(s.id);
            } catch {
              /* spróbujemy przy kolejnej wizycie */
            }
          }
        }
        if (alive) setConfig(cfg);
      } catch (e) {
        if (!alive) return;
        const code = e instanceof ApiError ? e.code : errorCode(e);
        setProblem((['link_broken', 'link_incomplete', 'local_media', 'not_found', 'closed', 'paused', 'project_sessions', 'month_sessions'] as string[]).includes(code) ? (code as Problem) : e instanceof ApiError && e.status === 0 ? 'network' : 'unknown');
      }
    })();
    return () => {
      alive = false;
    };
  }, [api, token, payload]);

  if (problem) {
    return (
      <Screen>
        <h1 className="mt-10 text-[28px] font-semibold leading-tight">{t.viewer.unavailable[problem]}</h1>
      </Screen>
    );
  }
  if (!config) return <Screen>{null}</Screen>;
  return (
    <I18nProvider locale={config.locale}>
      <div lang={config.locale} className="contents">
        <Study config={config} simulated={simulated} pid={config.panel && !simulated ? pid : null} />
      </div>
    </I18nProvider>
  );
}

function Study({ config, simulated, pid }: { config: StudyConfig; simulated: boolean; pid: string | null }) {
  const t = useT();
  const mobile = useMemo(isTouchDevice, []);
  const portraitMedia = config.variant.height > config.variant.width;
  const [stage, setStage] = useState<Stage>(() => (config.targetDevice === 'mobile' && !mobile && !simulated ? 'device' : 'consent'));
  const [ageBand, setAgeBand] = useState<AgeBand | null>(null);
  const [consent, setConsent] = useState<ConsentRecord | null>(null);
  const [country, setCountry] = useState<string | null>(null);
  const [screener, setScreener] = useState<Record<string, string>>({});
  const [audio, setAudio] = useState<{ mode: 'on' | 'off'; confirmed: boolean }>({ mode: 'off', confirmed: false });
  const [calibration, setCalibration] = useState<CalibrationOutcome | null>(null);
  const [result, setResult] = useState<WatchResult | null>(null);
  const [session, setSession] = useState<ViewerSession | null>(null);

  const afterScreener = () => setStage(simulated ? (config.audio === 'off' ? 'watch' : 'sound') : 'prepare');
  const afterSound = () => setStage(simulated ? 'watch' : 'calibrate');

  const buildSession = (r: WatchResult, answers: Record<string, string>): ViewerSession => {
    const createdAt = new Date().toISOString();
    return {
      schemaVersion: '1.0',
      id: `ses_${randomId(12)}`,
      projectId: config.projectId,
      variantId: config.variant.id,
      participantId: `p_${randomId(9)}`,
      ageBand: ageBand as AgeBand,
      country,
      screener,
      device: r.device,
      consent: consent as ConsentRecord,
      source: simulated ? 'simulated' : 'webcam',
      calibration: simulated ? null : calibrationInfo(calibration?.summary),
      audio,
      watchedSeconds: r.watchedSeconds,
      mediaDuration: r.duration || config.variant.duration,
      completed: r.completed,
      answers,
      createdAt,
      expiresAt: expiryDate(createdAt, config.retentionDays),
      status: 'valid',
      rejectCode: null,
      manual: false,
      ...(r.items ? { items: r.items } : {}),
      ...(r.choice ? { choice: r.choice } : {}),
      data: compactSamples(r.samples, { t0: r.t0, item: r.itemOf }),
    };
  };

  switch (stage) {
    case 'device':
      return (
        <Screen>
          <div className="mt-6 space-y-5">
            <Title>{t.viewer.device.title}</Title>
            <p className="text-[16px] leading-relaxed text-muted">{t.viewer.device.body}</p>
            <BigButton variant="secondary" onClick={() => setStage('consent')}>
              {t.viewer.device.continueHere}
            </BigButton>
          </div>
        </Screen>
      );
    case 'consent':
      return (
        <ConsentScreen
          config={config}
          simulated={simulated}
          onUnderage={() => {
            // Widz z panelu poniżej 18 lat: bez żadnych danych wraca do dostawcy jako odrzucony.
            if (config.panel && pid) leaveTo(panelReturnUrl(config.panel, 'screenout', pid));
            setStage('underage');
          }}
          onScreenout={() => {
            if (config.panel && pid) leaveTo(panelReturnUrl(config.panel, 'screenout', pid));
            setStage('screenout');
          }}
          onAccept={(c, age) => {
            setConsent(c);
            setAgeBand(age);
            if (config.screenPlatforms) setStage('screener');
            else afterScreener();
          }}
        />
      );
    case 'underage':
    case 'screenout':
      return (
        <Screen>
          <Title>{stage === 'underage' ? t.viewer.consent.underageEnd : t.viewer.consent.screenoutEnd}</Title>
        </Screen>
      );
    case 'screener':
      return (
        <ScreenerScreen
          onDone={(c, a) => {
            setCountry(c);
            setScreener(a);
            afterScreener();
          }}
        />
      );
    case 'prepare': {
      const p = t.viewer.prepare;
      const items: Array<[string, string]> = mobile
        ? [
            [portraitMedia ? p.mobile.placePortrait : p.mobile.placeLandscape, p.mobile.placeBody],
            [p.seat, p.mobile.seatBody],
            [p.light, p.lightBody],
            [p.mobile.camera, p.mobile.cameraBody],
          ]
        : [
            [p.seat, p.desktop.seatBody],
            [p.light, p.lightBody],
            [p.desktop.notifications, p.desktop.notificationsBody],
          ];
      return (
        <Screen>
          <div className="space-y-7">
            <Title>{mobile ? p.titlePhone : p.titleComputer}</Title>
            <Steps items={items} />
            <p className="rounded-2xl bg-surface px-4 py-3 text-[14.5px] leading-relaxed text-muted ring-1 ring-line">{mobile ? p.stopTouch : p.stopDesktop}</p>
            <BigButton onClick={() => setStage('check')}>{p.startCamera}</BigButton>
          </div>
        </Screen>
      );
    }
    case 'check':
      return <CameraCheck mobile={mobile} portraitRequired={portraitMedia} onReady={() => setStage(config.audio === 'off' ? 'calibrate' : 'sound')} />;
    case 'sound':
      return (
        <SoundCheck
          mode={config.audio === 'viewer' ? 'viewer' : 'on'}
          onDone={(a) => {
            setAudio(a);
            afterSound();
          }}
        />
      );
    case 'calibrate':
      return (
        <CalibrationStage
          mobile={mobile}
          onDone={(o) => {
            setCalibration(o);
            setStage('watch');
          }}
        />
      );
    case 'watch': {
      const done = (r: WatchResult) => {
        setResult(r);
        exitFullscreen();
        if (!simulated) trackingHub.stop();
        // Feed i siatka to badania ślepe — pytania o „ten materiał” zdradziłyby badany element.
        const blind = config.kind === 'feed' || config.kind === 'thumbnail';
        const qs = blind ? [] : config.questions.filter((q) => q === 'finish' || q === 'brand_recall');
        if (r.completed && !r.reported && qs.length) setStage('questions');
        else {
          setSession(buildSession(r, {}));
          setStage('finish');
        }
      };
      const muted = !(audio.mode === 'on' && audio.confirmed);
      if (config.kind === 'feed') return <WatchFeed config={config} calibration={calibration} simulated={simulated} muted={muted} onFinish={done} />;
      if (config.kind === 'thumbnail') return <WatchGrid config={config} calibration={calibration} simulated={simulated} onFinish={done} />;
      if (config.kind === 'carousel' || config.kind === 'slides') return <WatchCarousel config={config} calibration={calibration} simulated={simulated} onFinish={done} />;
      return <WatchFullscreen config={config} calibration={calibration} simulated={simulated} muted={muted} onFinish={done} />;
    }
    case 'questions':
      return (
        <QuestionsScreen
          questions={config.questions}
          brand={config.creatorName}
          onDone={(answers) => {
            setSession(buildSession(result as WatchResult, answers));
            setStage('finish');
          }}
        />
      );
    case 'finish':
      return <FinishScreen config={config} session={session as ViewerSession} completed={!!result?.completed} reported={!!result?.reported} simulated={simulated} pid={pid} />;
  }
}
