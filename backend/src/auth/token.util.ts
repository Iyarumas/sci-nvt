import { createHmac, timingSafeEqual } from 'crypto';

/**
 * JWT HS256 minimo (sem dependencia externa).
 * Usado para o token de sessao e para assinar links temporarios de arquivos.
 */

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function fromBase64url(input: string): Buffer {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(normalized + '='.repeat((4 - (normalized.length % 4)) % 4), 'base64');
}

export function hmac(secret: string, data: string): string {
  return base64url(createHmac('sha256', secret).update(data).digest());
}

export function safeEqual(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function signToken(payload: Record<string, unknown>, secret: string, expiresInSeconds: number): string {
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = base64url(JSON.stringify({ ...payload, iat: now, exp: now + expiresInSeconds }));
  return `${header}.${body}.${hmac(secret, `${header}.${body}`)}`;
}

export function verifyToken<T extends Record<string, unknown>>(token: string, secret: string): (T & { exp: number; iat: number }) | null {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [header, body, signature] = parts;
  if (!safeEqual(signature, hmac(secret, `${header}.${body}`))) return null;
  try {
    const parsedHeader = JSON.parse(fromBase64url(header).toString('utf8')) as { alg?: string };
    if (parsedHeader.alg !== 'HS256') return null;
    const payload = JSON.parse(fromBase64url(body).toString('utf8')) as T & { exp: number; iat: number };
    if (typeof payload.exp !== 'number' || payload.exp < Math.floor(Date.now() / 1000)) return null;
    return payload;
  } catch {
    return null;
  }
}
