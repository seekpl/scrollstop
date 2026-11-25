import { clamp } from '../math/util';

/**
 * Standaryzacja z-score cech. Wartości po transformacji są przycinane do ±6σ,
 * żeby pojedyncza cecha (np. nietypowy obrót głowy) nie „wystrzeliła” predykcji.
 */
export class Standardizer {
  constructor(
    readonly mean: number[],
    readonly std: number[],
  ) {}

  static fit(X: number[][]): Standardizer {
    const d = X[0]?.length ?? 0;
    const n = Math.max(X.length, 1);
    const mean = new Array<number>(d).fill(0);
    const variance = new Array<number>(d).fill(0);
    for (const x of X) for (let j = 0; j < d; j++) mean[j] += x[j] / n;
    for (const x of X) for (let j = 0; j < d; j++) variance[j] += (x[j] - mean[j]) ** 2 / n;
    return new Standardizer(
      mean,
      variance.map((v) => Math.max(Math.sqrt(v), 1e-4)),
    );
  }

  transform(x: readonly number[]): number[] {
    return x.map((v, j) => clamp((v - this.mean[j]) / this.std[j], -6, 6));
  }
}
