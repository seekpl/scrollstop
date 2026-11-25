export class Emitter<T> {
  private readonly listeners = new Set<(v: T) => void>();

  on(l: (v: T) => void): () => void {
    this.listeners.add(l);
    return () => this.listeners.delete(l);
  }

  emit(v: T): void {
    this.listeners.forEach((l) => l(v));
  }
}
