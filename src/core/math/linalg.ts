/**
 * Minimalna algebra liniowa bez zależności — wystarcza do regresji grzbietowej
 * i kernel ridge przy N ≤ kilkuset próbek kalibracyjnych.
 * Macierze przechowywane wierszami (row-major) w Float64Array; używana jest dolna połowa.
 */

/** Rozkład Cholesky'ego A = L·Lᵀ dla macierzy symetrycznej dodatnio określonej. */
export function cholesky(A: Float64Array, n: number): Float64Array {
  const L = new Float64Array(n * n);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= i; j++) {
      let sum = A[i * n + j];
      for (let k = 0; k < j; k++) sum -= L[i * n + k] * L[j * n + k];
      if (i === j) L[i * n + i] = Math.sqrt(Math.max(sum, 1e-12));
      else L[i * n + j] = sum / L[j * n + j];
    }
  }
  return L;
}

/** Rozwiązuje L·y = b. */
export function forwardSubstitute(L: Float64Array, b: ArrayLike<number>, n: number): Float64Array {
  const y = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    let s = b[i];
    for (let k = 0; k < i; k++) s -= L[i * n + k] * y[k];
    y[i] = s / L[i * n + i];
  }
  return y;
}

/** Rozwiązuje Lᵀ·x = y. */
export function backSubstituteT(L: Float64Array, y: ArrayLike<number>, n: number): Float64Array {
  const x = new Float64Array(n);
  for (let i = n - 1; i >= 0; i--) {
    let s = y[i];
    for (let k = i + 1; k < n; k++) s -= L[k * n + i] * x[k];
    x[i] = s / L[i * n + i];
  }
  return x;
}

export function choleskySolve(L: Float64Array, b: ArrayLike<number>, n: number): Float64Array {
  return backSubstituteT(L, forwardSubstitute(L, b, n), n);
}
