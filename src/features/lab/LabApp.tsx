import { useEffect } from 'react';
import { BRAND } from '../../config/brand';
import { useT } from '../../i18n';
import { BrandMark } from '../../ui/BrandMark';
import { LanguageSelect } from '../../ui/kit';
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
    <div className="min-h-dvh-safe bg-paper">
      <header className="sticky top-0 z-30 border-b border-line bg-paper/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3 sm:px-6">
          <a href="#/" className="flex min-w-0 items-center gap-3 rounded-lg">
            <BrandMark />
            <span className="hidden text-[13px] text-muted sm:inline">{t.lab.subtitle}</span>
          </a>
          <div className="ml-auto flex items-center gap-2">
            <LanguageSelect />
            <a href="#/app" className="rounded-[10px] px-3 py-2 text-[14px] font-semibold text-cobalt hover:bg-ink/[0.05]">
              {t.lab.studioLink}
            </a>
          </div>
          <nav aria-label={t.lab.navLabel} className="-mx-1 flex w-full gap-1 overflow-x-auto px-1">
            {NAV.map((v) => {
              const active = lab.view === v;
              return (
                <button
                  key={v}
                  type="button"
                  aria-current={active ? 'page' : undefined}
                  onClick={() => lab.setView(v)}
                  className={`min-h-9 shrink-0 rounded-[10px] px-3 text-[14px] font-semibold transition-colors ${active ? 'bg-ink text-white' : 'text-muted hover:bg-ink/[0.06] hover:text-ink'}`}
                >
                  {t.lab.nav[v]}
                </button>
              );
            })}
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 pb-20 pt-8 sm:px-6">
        {lab.view === 'setup' && <LabSetup />}
        {lab.view === 'live' && <LabLive />}
        {lab.view === 'sessions' && <LabSessions />}
        {lab.view === 'heatmap' && <LabHeatmap />}
        {lab.view === 'path' && <LabPath />}
        {lab.view === 'stats' && <LabStats />}
      </main>
      <footer className="mx-auto max-w-6xl px-4 pb-10 text-[12.5px] leading-relaxed text-muted sm:px-6">
        <p>{t.lab.footer.disclaimer}</p>
        <p className="mt-1">{t.lab.footer.privacy}</p>
      </footer>
    </div>
  );
}
