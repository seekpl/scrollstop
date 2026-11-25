import type { IncomingMessage, ServerResponse } from 'node:http';
import { createGunzip, gzipSync } from 'node:zlib';
import { BRAND } from '../src/config/brand';
import { errors } from '../src/i18n/pl/errors';

/**
 * Błąd HTTP z kodem (§13.1): odpowiedź `{ error: { message, code } }`. Klient tłumaczy komunikat
 * po kodzie ze słownika `errors`; opis z serwera (po polsku) pokazuje tylko dla nieznanych kodów.
 */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly code: string = 'unknown',
  ) {
    super(message);
  }
}

/** Błąd z komunikatem ze słownika (po kodzie). */
export const fail = (status: number, code: string): HttpError => new HttpError(status, (errors as Record<string, string>)[code] ?? code, code);

export const KB = 1024;
export const MB = 1024 * KB;

/** Odczyt treści żądania z limitem (także po rozpakowaniu gzip). */
export function readBody(req: IncomingMessage, limit: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const declared = Number(req.headers['content-length'] ?? 0);
    const encoding = String(req.headers['content-encoding'] ?? 'identity').toLowerCase();
    if (encoding !== 'identity' && encoding !== 'gzip') return reject(fail(415, 'unsupported_type'));
    if (encoding === 'identity' && declared > limit) return reject(fail(413, 'too_large'));
    const stream = encoding === 'gzip' ? req.pipe(createGunzip()) : req;
    const chunks: Buffer[] = [];
    let size = 0;
    let done = false;
    const finish = (err: Error | null) => {
      if (done) return;
      done = true;
      if (err) reject(err);
      else resolve(Buffer.concat(chunks));
    };
    stream.on('data', (c: Buffer) => {
      if (done) return;
      size += c.length;
      if (size > limit) {
        finish(fail(413, 'too_large'));
        req.unpipe?.();
        req.resume();
        return;
      }
      chunks.push(c);
    });
    stream.on('end', () => finish(null));
    stream.on('error', () => finish(fail(400, 'bad_request')));
    req.on('aborted', () => finish(fail(400, 'bad_request')));
  });
}

export async function readJson<T = unknown>(req: IncomingMessage, limit: number): Promise<T> {
  const body = await readBody(req, limit);
  if (!body.length) return {} as T;
  try {
    return JSON.parse(body.toString('utf8')) as T;
  } catch {
    throw fail(400, 'bad_request');
  }
}

/** Nagłówki bezpieczeństwa (§15) dla każdej odpowiedzi. */
export const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(self), microphone=()',
} as const;

export function sendJson(req: IncomingMessage, res: ServerResponse, status: number, body: unknown, extra: Record<string, string> = {}): void {
  const raw = Buffer.from(JSON.stringify(body ?? null));
  const gzip = raw.length > 2 * KB && /\bgzip\b/.test(String(req.headers['accept-encoding'] ?? ''));
  const payload = gzip ? gzipSync(raw, { level: 6 }) : raw;
  res.writeHead(status, {
    ...SECURITY_HEADERS,
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Content-Length': String(payload.length),
    Vary: 'Origin, Accept-Encoding',
    ...(gzip ? { 'Content-Encoding': 'gzip' } : {}),
    ...extra,
  });
  res.end(req.method === 'HEAD' ? undefined : payload);
}

export function sendError(req: IncomingMessage, res: ServerResponse, err: unknown): void {
  if (err instanceof HttpError) {
    sendJson(req, res, err.status, { error: { message: err.message, code: err.code } });
    return;
  }
  console.error(`[${BRAND.code}] błąd serwera`, err);
  sendJson(req, res, 500, { error: { message: errors.unknown, code: 'server_error' } });
}

/** CORS (§15): tylko originy aplikacji (logowanie tokenem w nagłówku, bez ciasteczek); media publiczne z `*`. */
export function applyCors(req: IncomingMessage, res: ServerResponse, origins: readonly string[], publicResource = false): boolean {
  const origin = req.headers.origin;
  if (publicResource) res.setHeader('Access-Control-Allow-Origin', '*');
  else if (origin && (origins.includes(origin) || origins.includes('*'))) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      ...SECURITY_HEADERS,
      'Access-Control-Allow-Methods': 'GET, HEAD, POST, PATCH, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Authorization, Content-Type, Content-Encoding, Range, X-Panel-Ref',
      'Access-Control-Expose-Headers': 'Content-Range, Accept-Ranges, Content-Length',
      'Access-Control-Max-Age': '600',
    });
    res.end();
    return true;
  }
  return false;
}

export function clientIp(req: IncomingMessage, trustProxy: boolean): string {
  if (trustProxy) {
    const fwd = String(req.headers['x-forwarded-for'] ?? '').split(',')[0].trim();
    if (fwd) return fwd;
  }
  return req.socket.remoteAddress ?? 'unknown';
}

/** Prosty limiter (okno przesuwne w pamięci) — logowanie, zgłoszenia sesji, usuwanie kodem. */
export class RateLimiter {
  private hits = new Map<string, number[]>();

  constructor(private readonly now: () => number = Date.now) {}

  check(key: string, limit: number, windowMs: number): void {
    const t = this.now();
    const list = (this.hits.get(key) ?? []).filter((x) => x > t - windowMs);
    if (list.length >= limit) {
      this.hits.set(key, list);
      throw fail(429, 'rate_limited');
    }
    list.push(t);
    this.hits.set(key, list);
    if (this.hits.size > 50_000) this.sweep(windowMs);
  }

  private sweep(windowMs: number): void {
    const t = this.now();
    for (const [k, v] of this.hits) if (!v.some((x) => x > t - windowMs)) this.hits.delete(k);
  }
}

export function bearer(req: IncomingMessage): string | null {
  const h = String(req.headers.authorization ?? '');
  const m = /^Bearer\s+([A-Za-z0-9_-]{20,100})$/.exec(h);
  return m ? m[1] : null;
}
