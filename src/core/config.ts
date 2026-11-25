/**
 * Progi pomiaru dla DOROSŁYCH widzów (§5, §12.6). Wartości startowe — do strojenia na pilotażu
 * (20–30 dorosłych, 3 urządzenia, 2 warunki światła, §25). Wszystkie progi zależne od populacji
 * są w tym jednym miejscu, żeby pilotaż zmieniał konfigurację, a nie kod.
 */
export const MEASUREMENT = {
  /** Średni rozstaw źrenic dorosłego (cm) — tylko do wskazówki „bliżej / dalej” (§5.3). */
  interPupillaryCm: 6.3,
  /** Założony poziomy kąt widzenia kamery (°). */
  cameraHfovDeg: 65,
  calibration: {
    /**
     * Jakość z testu na nowych punktach (% szerokości / wysokości). W KidAttention (dzieci): GOOD ≤ 8/10,
     * FAIR ≤ 15/17. Dla dorosłych spodziewamy się ostrzejszych — start: GOOD ≤ 6/8, FAIR ≤ 13/15.
     * Cel pilotażu: GOOD w ≥ 60% sesji na komputerze.
     */
    thresholds: { good: { x: 6, y: 8 }, fair: { x: 13, y: 15 } },
    /** Komputer: przejście + postój (ms), rozmiar celu (px), margines punktów. Pilotaż: postój ~1500 ms. */
    desktop: { transitionMs: 800, dwellMs: 2000, targetPx: 92, marginX: 0.08, marginY: 0.08 },
    /** Telefon w pionie. */
    mobile: { transitionMs: 700, dwellMs: 1700, targetPx: 66, marginX: 0.13, marginY: 0.1 },
    /** Pierwsze ms postoju pomijamy — wzrok dopiero dochodzi do punktu. */
    skipMs: 450,
    pursuitLagMs: 150,
    pursuitWeight: 0.3,
    minDwellSamples: 8,
    /** Punkt do powtórki, gdy rozrzut cech oczu > k × mediana innych punktów. */
    retryDispersion: 2.5,
    /** Po tylu próbach z wynikiem POOR pojawia się „Kontynuuj mimo to”. */
    attemptsBeforeContinue: 2,
  },
  quality: { maxYawDelta: 25, maxPitchDelta: 20, maxScaleDelta: 0.25 },
  /** Dolna granica σ w metrykach stref (§5.16) — do strojenia. */
  aoiMinSigma: 0.05,
  /** Sprawdzenie kamery (§10.5): dopuszczalna odległość (cm). */
  distanceCm: { mobile: { min: 20, max: 55 }, desktop: { min: 45, max: 85 } },
} as const;
