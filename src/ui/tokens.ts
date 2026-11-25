/** Wartości tokenów dla kodu (wykresy SVG, canvas). Muszą zgadzać się z `src/index.css` (sprawdza test). */
export const TOKENS = {
  paper: '#f4f6f9',
  surface: '#ffffff',
  mist: '#eef2f7',
  ink: '#1f2a44',
  muted: '#5b6478',
  line: '#d8dee9',
  field: '#8a93a6',
  cobalt: '#2747d6',
  cobaltDark: '#1d36a8',
  marker: '#f2b705',
  good: '#12784f',
  fair: '#8f5c00',
  poor: '#c03636',
} as const;

/** Kolory wersji A–D w stałej kolejności (§7 pkt 11, §19.4). */
export const SERIES = { A: '#2747d6', B: '#eb6834', C: '#0b8f8f', D: '#8a1f4a' } as const;
