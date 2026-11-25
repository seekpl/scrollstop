/**
 * Błąd z kodem (§0, lekcja §24.2–24.3): rdzeń i API zgłaszają kody, a tekst dobiera słownik `errors`
 * dopiero przy wyświetlaniu. `message` służy wyłącznie do logów.
 */
export class CodedError extends Error {
  constructor(
    readonly code: string,
    message = code,
  ) {
    super(message);
    this.name = 'CodedError';
  }
}

/** Kod błędu z dowolnego wyjątku (nieznane → 'unknown'). */
export function errorCode(e: unknown): string {
  if (e instanceof CodedError) return e.code;
  if (e && typeof e === 'object' && 'code' in e && typeof (e as { code: unknown }).code === 'string') return (e as { code: string }).code;
  return 'unknown';
}
