import { Fragment, useEffect, useRef, type ElementType } from 'react';
import { prefersReducedMotion } from './demoData';

/** Szerokość miętowego pasma (w słowach) przesuwającego się przez tekst. */
const BAND = 3;

/**
 * Nagłówek ujawniany przy przewijaniu (jak na nagraniu referencyjnym): słowa są blade, przechodzi
 * przez nie miętowe pasmo, a za nim tekst ma pełny kolor. Postęp zależy od położenia nagłówka
 * w oknie, więc cofnięcie przewijania cofa ujawnienie. Treść zostaje zwykłym tekstem (czytniki
 * ekranu, wyszukiwanie); blady kolor ma kontrast ≥ 3:1 dla dużego tekstu. Przy „ogranicz ruch”
 * tekst od razu ma pełny kolor.
 */
export function RevealText({ text, as: Tag = 'h2', tone, id, className = '' }: { text: string; as?: ElementType; tone: 'light' | 'night'; id?: string; className?: string }) {
  const ref = useRef<HTMLElement>(null);
  const words = text.split(' ');
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const spans = Array.from(el.querySelectorAll<HTMLSpanElement>('[data-state]'));
    let shown = -1;
    const paint = (front: number) => {
      if (front === shown) return;
      shown = front;
      spans.forEach((s, i) => {
        const state = i < front - BAND ? 'done' : i < front ? 'lit' : 'todo';
        if (s.dataset.state !== state) s.dataset.state = state;
      });
    };
    if (prefersReducedMotion()) {
      paint(spans.length + BAND);
      return;
    }
    let raf = 0;
    const update = () => {
      raf = 0;
      const r = el.getBoundingClientRect();
      const vh = window.innerHeight || 800;
      // Start, gdy nagłówek wchodzi w dolne 15% okna; koniec, gdy jego środek mija ~40% wysokości.
      const p = Math.min(1, Math.max(0, (vh * 0.88 - r.top) / (vh * 0.5 + r.height * 0.5)));
      paint(Math.round(p * (spans.length + BAND)));
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [text]);
  return (
    <Tag ref={ref} id={id} className={`l-reveal l-reveal-${tone} ${className}`}>
      {words.map((w, i) => (
        <Fragment key={i}>
          {i > 0 && ' '}
          <span data-state="todo">{w}</span>
        </Fragment>
      ))}
    </Tag>
  );
}
