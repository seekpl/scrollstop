import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(() => cleanup());

// jsdom nie implementuje canvas — komponenty muszą to tolerować (getContext → null).
// Testy serwera działają w środowisku node (bez DOM).
if (typeof HTMLCanvasElement !== 'undefined') HTMLCanvasElement.prototype.getContext = (() => null) as unknown as HTMLCanvasElement['getContext'];

if (typeof URL !== 'undefined' && !URL.createObjectURL) URL.createObjectURL = () => 'blob:test';
if (typeof URL !== 'undefined' && !URL.revokeObjectURL) URL.revokeObjectURL = () => undefined;
if (!globalThis.requestAnimationFrame) {
  globalThis.requestAnimationFrame = (cb: FrameRequestCallback) => setTimeout(() => cb(performance.now()), 16) as unknown as number;
  globalThis.cancelAnimationFrame = (id: number) => clearTimeout(id);
}

// Testy sprawdzają polskie teksty (język źródłowy słowników).
try {
  if (typeof localStorage !== 'undefined') localStorage.setItem('attn-lang', 'pl');
} catch {
  /* środowisko bez localStorage */
}
