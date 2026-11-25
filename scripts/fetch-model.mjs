// Pobiera model Face Landmarker (≈3.7 MB) do public/models/, żeby aplikacja
// działała offline i nie odpytywała zewnętrznych serwerów w trakcie sesji.
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';

const URL =
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';
const OUT = 'public/models/face_landmarker.task';

if (existsSync(OUT)) {
  console.log(`[attn] Model już istnieje: ${OUT}`);
  process.exit(0);
}
mkdirSync('public/models', { recursive: true });
const res = await fetch(URL);
if (!res.ok) {
  console.error(`[attn] Nie udało się pobrać modelu (${res.status}). Aplikacja użyje zdalnego modelu jako fallback.`);
  process.exit(1);
}
writeFileSync(OUT, Buffer.from(await res.arrayBuffer()));
console.log(`[attn] Zapisano ${OUT}`);
