import type { ReactElement } from 'react';
/**
 * Ilustracje strony głównej (SVG, bez zewnętrznych plików): formaty badań na ciemnym tle,
 * ikony problemów na jasnym tle i znaczniki momentów na wykresie. Wszystkie dekoracyjne
 * (`aria-hidden`) — znaczenie niesie podpis obok.
 */
const ACCENT = '#a3b4ff';
const W = { stroke: '#ffffff', strokeOpacity: 0.85, strokeWidth: 1.6, fill: 'rgba(255,255,255,0.06)' } as const;

export type FormatId = 'reel' | 'video' | 'feed' | 'thumbnail' | 'carousel' | 'versions';

function Shadow() {
  return <ellipse cx="60" cy="74" rx="26" ry="3.2" fill={ACCENT} fillOpacity="0.16" />;
}

const FORMAT_ART: Record<FormatId, ReactElement> = {
  reel: (
    <>
      <Shadow />
      <g transform="rotate(-9 60 40)">
        <rect x="44" y="7" width="32" height="62" rx="6.5" {...W} />
        <rect x="55" y="10.5" width="10" height="2.2" rx="1.1" fill="#fff" fillOpacity="0.55" />
        <path d="M56.5 27l9.5 5.6-9.5 5.6z" fill="#fff" fillOpacity="0.92" />
        <path d="M48 55c4 0 5-2.6 8.4-2.6s4.4 7 8.6 7 4.6-4.2 7.4-4.2" fill="none" stroke={ACCENT} strokeWidth="2.3" strokeLinecap="round" />
      </g>
    </>
  ),
  video: (
    <>
      <Shadow />
      <rect x="20" y="13" width="80" height="47" rx="5" {...W} />
      <path d="M55 29l11 6.5-11 6.5z" fill="#fff" fillOpacity="0.92" />
      <rect x="27" y="51.5" width="66" height="2.4" rx="1.2" fill="#fff" fillOpacity="0.22" />
      <rect x="27" y="51.5" width="38" height="2.4" rx="1.2" fill={ACCENT} />
      <path d="M52 60v6M68 60v6M46 66.5h28" stroke="#fff" strokeOpacity="0.5" strokeWidth="1.6" strokeLinecap="round" />
    </>
  ),
  feed: (
    <>
      <Shadow />
      <rect x="64" y="5" width="28" height="54" rx="6" {...W} strokeOpacity={0.3} />
      <rect x="54" y="10" width="28" height="56" rx="6" {...W} strokeOpacity={0.5} />
      <rect x="40" y="14" width="30" height="58" rx="6.5" fill="rgba(163,180,255,0.10)" stroke={ACCENT} strokeWidth="1.8" />
      <path d="M50.5 34l8.5 5-8.5 5z" fill="#fff" fillOpacity="0.92" />
      <path d="M33 30v18M29.5 33.5L33 30l3.5 3.5" fill="none" stroke="#fff" strokeOpacity="0.6" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  thumbnail: (
    <>
      <Shadow />
      <rect x="18" y="9" width="84" height="56" rx="5" {...W} />
      {[0, 1, 2].map((c) =>
        [0, 1].map((r) => {
          const active = c === 1 && r === 0;
          return <rect key={`${c}-${r}`} x={24 + c * 25.5} y={15 + r * 24} width="22" height="19" rx="2.5" fill={active ? 'rgba(163,180,255,0.22)' : 'rgba(255,255,255,0.10)'} stroke={active ? ACCENT : 'none'} strokeWidth="1.6" />;
        }),
      )}
      <circle cx="60.5" cy="24.5" r="3.2" fill="none" stroke={ACCENT} strokeWidth="1.5" />
      <circle cx="60.5" cy="24.5" r="1.1" fill={ACCENT} />
    </>
  ),
  carousel: (
    <>
      <Shadow />
      <rect x="22" y="15" width="34" height="42" rx="4" {...W} strokeOpacity={0.4} transform="rotate(-8 39 36)" />
      <rect x="64" y="15" width="34" height="42" rx="4" {...W} strokeOpacity={0.4} transform="rotate(8 81 36)" />
      <rect x="41" y="10" width="38" height="48" rx="4.5" fill="rgba(255,255,255,0.09)" stroke="#fff" strokeOpacity="0.9" strokeWidth="1.7" />
      <path d="M48 47l8-9 6 6 4-4 6 7" fill="none" stroke={ACCENT} strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx="66" cy="22" r="3" fill="#fff" fillOpacity="0.7" />
      {[52, 60, 68].map((x, i) => (
        <circle key={x} cx={x} cy="66" r="2" fill={i === 1 ? ACCENT : '#fff'} fillOpacity={i === 1 ? 1 : 0.4} />
      ))}
    </>
  ),
  versions: (
    <>
      <Shadow />
      <rect x="18" y="12" width="38" height="50" rx="5" {...W} />
      <rect x="64" y="12" width="38" height="50" rx="5" fill="rgba(163,180,255,0.10)" stroke={ACCENT} strokeWidth="1.7" />
      <path d="M23 46c5 0 6-9 11-9s6 12 11 12 5-4 7-4" fill="none" stroke="#fff" strokeOpacity="0.8" strokeWidth="2" strokeLinecap="round" />
      <path d="M69 40c5 0 6-6 11-6s6 3 11 3 5-2 7-2" fill="none" stroke={ACCENT} strokeWidth="2" strokeLinecap="round" />
      <text x="24" y="25" fontSize="10" fontWeight="700" fill="#fff" fillOpacity="0.85" fontFamily="inherit">
        A
      </text>
      <text x="70" y="25" fontSize="10" fontWeight="700" fill={ACCENT} fontFamily="inherit">
        B
      </text>
    </>
  ),
};

export function FormatArt({ id }: { id: FormatId }) {
  return (
    <svg viewBox="0 0 120 80" className="h-[64px] w-[96px]" aria-hidden focusable="false">
      {FORMAT_ART[id]}
    </svg>
  );
}

const INK = '#1f2a44';
const ACCENT_INK = '#2747d6';

/** Ikony problemów: statystyki bez odpowiedzi, opinia znajomych, wersje na żywym koncie. */
export function ProblemIcon({ i }: { i: number }) {
  return (
    <svg viewBox="0 0 32 32" width="32" height="32" aria-hidden focusable="false">
      {i === 0 && (
        <>
          <path d="M5 26h22" stroke={INK} strokeWidth="1.6" strokeLinecap="round" />
          <rect x="7" y="16" width="4" height="10" rx="1" fill={INK} fillOpacity="0.85" />
          <rect x="14" y="11" width="4" height="15" rx="1" fill={INK} fillOpacity="0.85" />
          <rect x="21" y="19" width="4" height="7" rx="1" fill={ACCENT_INK} />
          <path d="M22.5 6.5a2.6 2.6 0 115 .6c-.6.9-1.9 1.3-1.9 2.6" fill="none" stroke={ACCENT_INK} strokeWidth="1.6" strokeLinecap="round" />
          <circle cx="25.6" cy="12.6" r="0.9" fill={ACCENT_INK} />
        </>
      )}
      {i === 1 && (
        <>
          <path d="M6 8.5A3.5 3.5 0 019.5 5h13A3.5 3.5 0 0126 8.5v8a3.5 3.5 0 01-3.5 3.5H14l-5.5 4.5V20h0A3 3 0 016 17z" fill="none" stroke={INK} strokeWidth="1.6" strokeLinejoin="round" />
          {[11, 16, 21].map((x) => (
            <circle key={x} cx={x} cy="12.5" r="1.5" fill={x === 21 ? ACCENT_INK : INK} />
          ))}
        </>
      )}
      {i === 2 && (
        <>
          <rect x="4" y="9" width="10" height="16" rx="2" fill="none" stroke={INK} strokeWidth="1.6" />
          <rect x="11" y="6" width="10" height="16" rx="2" fill="#f4f6f9" stroke={INK} strokeWidth="1.6" />
          <rect x="18" y="10" width="10" height="16" rx="2" fill="#f4f6f9" stroke={ACCENT_INK} strokeWidth="1.8" />
          <path d="M21 19l2 2 3.5-4" fill="none" stroke={ACCENT_INK} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </>
      )}
    </svg>
  );
}

/** Znaczniki momentów na wykresie: hook (oko), spadek (strzałka w dół), koniec materiału. */
export function MomentIcon({ kind }: { kind: 'hook' | 'drop' | 'end' }) {
  return (
    <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden focusable="false">
      {kind === 'hook' && (
        <>
          <path d="M2 10s3-5.5 8-5.5S18 10 18 10s-3 5.5-8 5.5S2 10 2 10z" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
          <circle cx="10" cy="10" r="2.4" fill="currentColor" />
        </>
      )}
      {kind === 'drop' && <path d="M10 3v12M5 10.5l5 5 5-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />}
      {kind === 'end' && (
        <>
          <path d="M5 17V3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
          <path d="M5 4h10l-2.5 3.5L15 11H5" fill="currentColor" fillOpacity="0.9" />
        </>
      )}
    </svg>
  );
}
