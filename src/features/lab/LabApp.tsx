import { useEffect } from 'react';
import { BRAND } from '../../config/brand';
import { useT } from '../../i18n';
import { BrandMark } from '../../ui/BrandMark';
import { LanguageSelect } from '../../ui/kit';
import { SiteFooter } from '../site/SiteShell';
import type { SessionStore } from '../../storage/sessionStore';
import { LabCalibration } from './LabCalibration';
import { LabProvider, useLab, type LabView } from './LabContext';
import { LabHeatmap } from './LabHeatmap';
import { LabLive } from './LabLive';
import { LabPath } from './LabPath';
import { LabSessions } from './LabSessions';
import { LabSetup } from './LabSetup';
import { LabStats } from './LabStats';
import { LabWatch } from './LabWatch';

const NAV: Array<Exclude<LabView, 'calibration' | 'watch'>> = ['setup', 'live', 'sessions', 'heatmap', 'path', 'stats'];

/**
 * Laboratorium (§12.7): narzędzia techniczne zespołu dla jednej osoby na jednym urządzeniu —
 * podgląd na żywo, kalibracja, oglądanie z markerem, heat mapa, ścieżka wzroku, statystyki, eksport.
 * Produkt dla twórców to studio badań.
 */
export function LabApp({ store, initialSessionId = null }: { store: SessionStore; initialSessionId?: string | null }) {
  return (
    <LabProvider store={store} initialSessionId={initialSessionId}>
      <Shell />
    </LabProvider>
  );
}

function Shell() {
  const lab = useLab();
  const t = useT();
  useEffect(() => {
    document.title = `${t.lab.title} — ${BRAND.name}`;
  }, [t]);
  if (lab.view === 'calibration') return <LabCalibration />;
  if (lab.view === 'watch') return <LabWatch />;
  return (
    // Układ serwisu: granatowy nagłówek z zakładkami laboratorium, jasna treść, stopka z właścicielem.
    <div className="site-theme flex min-h-dvh-safe flex-col bg-[var(--l-light)]">
      <header className="l-night no-print sticky top-0 z-30 border-b border-white/10">
        <div className="mx-auto flex max-w-[1152px] flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3 sm:px-6">
          <a href="#/" className="flex min-w-0 items-center gap-3 rounded-lg">
            <BrandMark tone="night" />
            <span className="hidden text-[13px] text-white/65 sm:inline">{t.lab.subtitle}</span>
          </a>
          <div className="ml-auto flex items-center gap-2">
            <LanguageSelect tone="night" />
            <a href="#/app" className="inline-flex min-h-9 items-center rounded-[10px] px-3 text-[14px] font-semibold text-white ring-1 ring-inset ring-white/25 hover:bg-white/[0.07]">
              {t.lab.studioLink}
            </a>
          </div>
          <nav aria-label={t.lab.navLabel} className="-mx-1 flex w-full gap-1 relative overflow-x-auto px-1">
            {NAV.map((v) => {
              const active = lab.view === v;
              return (
                <button
                  key={v}
                  type="button"
                  aria-current={active ? 'page' : undefined}
                  onClick={() => lab.setView(v)}
                  className={`min-h-9 shrink-0 rounded-[10px] px-3 text-[14px] font-semibold transition-colors ${active ? 'bg-white text-ink' : 'text-white/80 hover:bg-white/[0.08] hover:text-white'}`}
                >
                  {t.lab.nav[v]}
                </button>
              );
            })}
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-[1152px] flex-1 px-4 pb-20 pt-8 sm:px-6">
        {lab.view === 'setup' && <LabSetup />}
        {lab.view === 'live' && <LabLive />}
        {lab.view === 'sessions' && <LabSessions />}
        {lab.view === 'heatmap' && <LabHeatmap />}
        {lab.view === 'path' && <LabPath />}
        {lab.view === 'stats' && <LabStats />}
      </main>
      <div className="mx-auto w-full max-w-[1152px] px-4 pb-10 text-[12.5px] leading-relaxed text-muted sm:px-6">
        <p>{t.lab.footer.disclaimer}</p>
        <p className="mt-1">{t.lab.footer.privacy}</p>
      </div>
      <SiteFooter night />
    </div>
  );
}
