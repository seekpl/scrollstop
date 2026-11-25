import { cholesky, choleskySolve, forwardSubstitute } from '../math/linalg';

export interface Prediction {
  x: number;
  y: number;
  /** 0 = punkt dobrze pokryty danymi kalibracyjnymi, 1 = ekstrapolacja daleko od nich. */
  novelty: number;
}

export interface Regressor {
  readonly name: string;
  fit(X: number[][], Y: Array<[number, number]>, w: number[]): void;
  predict(x: number[]): Prediction;
  params(): Record<string, number>;
}

export type Basis = 'linear' | 'poly2';

export function expandBasis(x: readonly number[], basis: Basis): number[] {
  const out = [1, ...x];
  if (basis === 'poly2') {
    for (let i = 0; i < x.length; i++) for (let j = i; j < x.length; j++) out.push(x[i] * x[j]);
  }
  return out;
}

/** Ważona regresja grzbietowa (Ridge) na bazie liniowej lub wielomianowej 2. stopnia. */
export class RidgeRegression implements Regressor {
  readonly name: string;
  private bx: Float64Array | null = null;
  private by: Float64Array | null = null;

  constructor(
    readonly basis: Basis = 'poly2',
    readonly lambda = 1,
  ) {
    this.name = `ridge-${basis}`;
  }

  fit(X: number[][], Y: Array<[number, number]>, w: number[]): void {
    const Phi = X.map((x) => expandBasis(x, this.basis));
    const p = Phi[0].length;
    const A = new Float64Array(p * p);
    const bx = new Float64Array(p);
    const by = new Float64Array(p);
    for (let i = 0; i < Phi.length; i++) {
      const f = Phi[i];
      const wi = w[i];
      for (let a = 0; a < p; a++) {
        const fa = f[a] * wi;
        bx[a] += fa * Y[i][0];
        by[a] += fa * Y[i][1];
        for (let b = 0; b <= a; b++) A[a * p + b] += fa * f[b];
      }
    }
    // Wyraz wolny (indeks 0) praktycznie bez regularyzacji.
    for (let a = 0; a < p; a++) A[a * p + a] += a === 0 ? 1e-6 : this.lambda;
    const L = cholesky(A, p);
    this.bx = choleskySolve(L, bx, p);
    this.by = choleskySolve(L, by, p);
  }

  predict(x: number[]): Prediction {
    if (!this.bx || !this.by) throw new Error('model not fitted');
    const f = expandBasis(x, this.basis);
    let px = 0;
    let py = 0;
    for (let i = 0; i < f.length; i++) {
      px += this.bx[i] * f[i];
      py += this.by[i] * f[i];
    }
    return { x: px, y: py, novelty: 0 };
  }

  params(): Record<string, number> {
    return { lambda: this.lambda };
  }
}

/**
 * Model hybrydowy: regresja liniowa (łagodna ekstrapolacja na brzegach ekranu)
 * + kernel ridge z jądrem RBF na resztach (nieliniowości).
 * Daje też miarę „nowości” punktu — wariancję predykcyjną jak w procesie gaussowskim.
 */
export class LinearKernelRidge implements Regressor {
  readonly name = 'linear+krr-rbf';
  private readonly base: RidgeRegression;
  private Xt: number[][] = [];
  private ax: Float64Array = new Float64Array(0);
  private ay: Float64Array = new Float64Array(0);
  private L: Float64Array = new Float64Array(0);
  private n = 0;

  constructor(
    readonly gamma = 1,
    readonly lambda = 0.1,
    readonly baseLambda = 1,
  ) {
    this.base = new RidgeRegression('linear', baseLambda);
  }

  private kernel(a: readonly number[], b: readonly number[]): number {
    let s = 0;
    for (let j = 0; j < a.length; j++) {
      const d = a[j] - b[j];
      s += d * d;
    }
    return Math.exp((-this.gamma * s) / a.length);
  }

  fit(X: number[][], Y: Array<[number, number]>, w: number[]): void {
    this.base.fit(X, Y, w);
    const n = X.length;
    const K = new Float64Array(n * n);
    const rx = new Float64Array(n);
    const ry = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < i; j++) K[i * n + j] = this.kernel(X[i], X[j]);
      // Próbki o mniejszej wadze (np. z płynnego ruchu celu) mają słabszy wpływ.
      K[i * n + i] = 1 + this.lambda / Math.max(w[i], 1e-3);
      const b = this.base.predict(X[i]);
      rx[i] = Y[i][0] - b.x;
      ry[i] = Y[i][1] - b.y;
    }
    this.L = cholesky(K, n);
    this.ax = choleskySolve(this.L, rx, n);
    this.ay = choleskySolve(this.L, ry, n);
    this.Xt = X;
    this.n = n;
  }

  predict(x: number[]): Prediction {
    const b = this.base.predict(x);
    const kv = new Float64Array(this.n);
    let rx = 0;
    let ry = 0;
    for (let i = 0; i < this.n; i++) {
      const k = this.kernel(x, this.Xt[i]);
      kv[i] = k;
      rx += this.ax[i] * k;
      ry += this.ay[i] * k;
    }
    const v = forwardSubstitute(this.L, kv, this.n);
    let q = 0;
    for (let i = 0; i < this.n; i++) q += v[i] * v[i];
    return { x: b.x + rx, y: b.y + ry, novelty: Math.min(1, Math.max(0, 1 - q)) };
  }

  params(): Record<string, number> {
    return { gamma: this.gamma, lambda: this.lambda, baseLambda: this.baseLambda };
  }
}
