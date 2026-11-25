import type { GazeSample, SessionMeta } from '../contracts/types';
import type { SessionStore } from '../../storage/sessionStore';

/**
 * Zapisuje próbki do lokalnej bazy porcjami co sekundę — przerwanie sesji
 * (np. zamknięcie karty) nie kasuje zebranych danych.
 */
export class SessionRecorder {
  readonly samples: GazeSample[] = [];
  private flushed = 0;
  private chunkIndex = 0;
  private timer: ReturnType<typeof setInterval> | null = null;
  private pending: Promise<void> = Promise.resolve();
  private finished = false;

  constructor(
    public meta: SessionMeta,
    private readonly store: SessionStore,
  ) {}

  async begin(): Promise<void> {
    await this.store.saveMeta(this.meta);
    this.timer = setInterval(() => void this.flush(), 1000);
  }

  add(sample: GazeSample): void {
    if (!this.finished) this.samples.push(sample);
  }

  flush(): Promise<void> {
    this.pending = this.pending.then(async () => {
      if (this.flushed >= this.samples.length) return;
      const chunk = this.samples.slice(this.flushed);
      this.flushed = this.samples.length;
      await this.store.appendSamples(this.meta.id, this.chunkIndex++, chunk);
    });
    return this.pending;
  }

  async finish(patch: Partial<SessionMeta> = {}): Promise<SessionMeta> {
    this.finished = true;
    if (this.timer) clearInterval(this.timer);
    await this.flush();
    this.meta = {
      ...this.meta,
      ...patch,
      endedAt: new Date().toISOString(),
      sampleCount: this.samples.length,
    };
    await this.store.saveMeta(this.meta);
    return this.meta;
  }
}
