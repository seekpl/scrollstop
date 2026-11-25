import type { MediaSource } from '../../research/model';

/**
 * Pliki lokalne twórcy (tryb lokalny): przeglądarka nie pamięta wybranych plików między odświeżeniami,
 * więc trzymamy adresy `blob:` w pamięci karty (§9.3). Klucz = nazwa + rozmiar.
 */
const library = new Map<string, string>();
const listeners = new Set<() => void>();

const key = (name: string, size: number) => `${name}|${size}`;

export function registerLocalFile(file: File): MediaSource {
  const k = key(file.name, file.size);
  const prev = library.get(k);
  if (prev) URL.revokeObjectURL(prev);
  library.set(k, URL.createObjectURL(file));
  listeners.forEach((l) => l());
  return { kind: 'local', fileName: file.name, fileSize: file.size };
}

export function localFileUrl(name: string, size: number): string | null {
  return library.get(key(name, size)) ?? null;
}

export function onLibraryChange(l: () => void): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

/** Adres pliku wideo/obrazu do odtworzenia; null, gdy materiał nie jest plikiem albo go nie ma na tym urządzeniu. */
export function playableUrl(media: MediaSource | null, apiBase = ''): string | null {
  if (!media) return null;
  switch (media.kind) {
    case 'hosted':
      return media.url.startsWith('/') ? `${apiBase.replace(/\/$/, '')}${media.url}` : media.url;
    case 'url':
      return media.url;
    case 'local':
      return localFileUrl(media.fileName, media.fileSize);
    default:
      return null;
  }
}
