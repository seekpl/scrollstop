// Kopiuje pliki WASM MediaPipe do public/, aby aplikacja nie pobierała ich z CDN
// (przetwarzanie obrazu z kamery odbywa się w 100% lokalnie).
import { cpSync, existsSync, mkdirSync } from 'node:fs';

const src = 'node_modules/@mediapipe/tasks-vision/wasm';
const dst = 'public/mediapipe/wasm';

if (existsSync(src)) {
  mkdirSync(dst, { recursive: true });
  cpSync(src, dst, { recursive: true });
  console.log(`[attn] MediaPipe WASM skopiowany do ${dst}`);
} else {
  console.warn('[attn] Nie znaleziono @mediapipe/tasks-vision/wasm — pomiń, jeśli instalujesz bez zależności.');
}
