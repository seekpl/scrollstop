import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { LocalResearchApi } from '../src/api/local';
import { MemoryLocalStore } from '../src/api/localStore';
import { Root } from '../src/app/Root';
import { aspectFits, defaultDeviceFor, overlapsUnsafe } from '../src/config/platforms';
import { I18nProvider } from '../src/i18n';
import { Btn, ChoiceCards, Dialog } from '../src/ui/kit';

describe('strona w budowie', () => {
  it('pokazuje hasło produktu i kontakt po polsku', () => {
    window.history.replaceState(null, '', '/#/');
    render(
      <I18nProvider>
        <Root api={new LocalResearchApi(new MemoryLocalStore())} />
      </I18nProvider>,
    );
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('W której sekundzie widzowie przestają patrzeć na Twoją rolkę?');
    expect(screen.getByText('W budowie')).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /sebastian\.biel@me\.com/ }).length).toBeGreaterThan(0);
  });

  it('nieznany adres → strona 404', () => {
    window.history.replaceState(null, '', '/#/nie-ma');
    render(
      <I18nProvider>
        <Root api={new LocalResearchApi(new MemoryLocalStore())} />
      </I18nProvider>,
    );
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Nie ma takiej strony');
    window.history.replaceState(null, '', '/');
  });
});

describe('kit', () => {
  it('Dialog: Esc zamyka, fokus wraca do przycisku', () => {
    function Demo() {
      const [open, setOpen] = useState(false);
      return (
        <I18nProvider>
          <Btn onClick={() => setOpen(true)}>Otwórz plan</Btn>
          <Dialog open={open} onClose={() => setOpen(false)} title="Plan">
            <Btn>Zamów plan Pro</Btn>
          </Dialog>
        </I18nProvider>
      );
    }
    render(<Demo />);
    const opener = screen.getByRole('button', { name: 'Otwórz plan' });
    opener.focus();
    fireEvent.click(opener);
    expect(screen.getByRole('dialog', { name: 'Plan' })).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(opener);
  });

  it('ChoiceCards: strzałki zmieniają wybór', () => {
    function Demo() {
      const [v, setV] = useState<'a' | 'b'>('a');
      return <ChoiceCards<'a' | 'b'> label="Rodzaj" value={v} onChange={setV} options={[{ value: 'a', title: 'A' }, { value: 'b', title: 'B' }]} />;
    }
    render(<Demo />);
    const a = screen.getByRole('radio', { name: 'A' });
    fireEvent.keyDown(a, { key: 'ArrowRight' });
    expect(screen.getByRole('radio', { name: 'B' })).toHaveAttribute('aria-checked', 'true');
  });
});

describe('platformy (§4.8)', () => {
  it('proporcje i urządzenie docelowe', () => {
    expect(aspectFits('tiktok', 1080, 1920)).toBe(true);
    expect(aspectFits('tiktok', 1920, 1080)).toBe(false);
    expect(aspectFits('instagram_feed', 1080, 1080)).toBe(true);
    expect(defaultDeviceFor(1080, 1920)).toBe('mobile');
    expect(defaultDeviceFor(1080, 1350)).toBe('mobile');
    expect(defaultDeviceFor(1920, 1080)).toBe('desktop');
  });

  it('strefy zasłonięte: napis na dole kadru TikToka', () => {
    expect(overlapsUnsafe('tiktok', { x: 0.1, y: 0.82, w: 0.6, h: 0.1 })).toBe(true);
    expect(overlapsUnsafe('tiktok', { x: 0.1, y: 0.3, w: 0.6, h: 0.1 })).toBe(false);
    expect(overlapsUnsafe('youtube', { x: 0.1, y: 0.9, w: 0.6, h: 0.1 })).toBe(false);
  });
});
