import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { LabApp } from '../src/features/lab/LabApp';
import { I18nProvider } from '../src/i18n';
import { MemorySessionStore } from '../src/storage/sessionStore';

describe('laboratorium', () => {
  it('generuje sesję demo i pokazuje wyniki, heat mapę, ścieżkę i statystyki', async () => {
    const store = new MemorySessionStore();
    render(
      <I18nProvider>
        <LabApp store={store} />
      </I18nProvider>,
    );
    expect(screen.getByRole('heading', { level: 1, name: 'Nowa sesja' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Wygeneruj sesję: Rolka demo B (15 s, 9:16)' }));
    await waitFor(() => expect(screen.getByRole('heading', { level: 1, name: 'Sesje laboratorium' })).toBeInTheDocument());
    expect(await screen.findByText('Wiarygodny pomiar')).toBeInTheDocument();
    expect((await store.listSessions())[0].sampleCount).toBe(450);

    fireEvent.click(screen.getAllByRole('button', { name: 'Heat mapa' })[0]);
    expect(screen.getByRole('heading', { level: 1, name: 'Heat mapa' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Generuj heat mapę' }));
    expect(screen.getByText(/ważn\w+ prób\w+, .* s danych/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Pobierz PNG' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Ścieżka wzroku' }));
    expect(screen.getByRole('heading', { level: 1, name: 'Ścieżka wzroku' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Statystyki' }));
    expect(screen.getByRole('heading', { level: 1, name: 'Statystyki' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Oś czasu szacowanego patrzenia na ekran' })).toBeInTheDocument();
  });
});
