import { Component, type ReactNode } from 'react';
import { BRAND } from '../config/brand';
import { useT } from '../i18n';
import { btnClass } from '../ui/kit';

/** Błąd w trakcie wyświetlania strony: komunikat i dwa wyjścia zamiast pustego ekranu (§21.3). */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error(`[${BRAND.code}] błąd aplikacji`, error);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return <ErrorScreen message={error.message} onHome={() => this.setState({ error: null })} />;
  }
}

function ErrorScreen({ message, onHome }: { message: string; onHome(): void }) {
  const t = useT();
  return (
    <div role="alert" className="mx-auto max-w-xl space-y-4 px-4 py-16 text-ink sm:px-6">
      <h1 className="text-[26px] font-semibold">{t.ui.errorBoundary.title}</h1>
      <p className="text-[15px] leading-relaxed text-muted">{t.ui.errorBoundary.body}</p>
      <pre className="overflow-x-auto whitespace-pre-wrap rounded-xl bg-surface p-4 text-[12.5px] ring-1 ring-line">{message}</pre>
      <div className="flex flex-wrap gap-3">
        <button type="button" className={btnClass('primary', 'md')} onClick={() => window.location.reload()}>
          {t.common.actions.refresh}
        </button>
        <a href="#/" className={btnClass('secondary', 'md')} onClick={onHome}>
          {t.common.actions.home}
        </a>
      </div>
    </div>
  );
}
