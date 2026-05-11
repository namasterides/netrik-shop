import crypto from 'crypto';
import { NextResponse } from 'next/server';

// Stateless HMAC-signed session cookie.
// Payload shape: { type, userId, restaurantId?, serverId?, exp }
// Cookie value: base64url(payload) + '.' + base64url(hmac)

const COOKIE_NAME = 'netrik_session';
const DEFAULT_TTL_SECONDS = 60 * 60 * 24 * 7;

function getSecret() {
  const s = process.env.SESSION_SECRET || process.env.AUTH_SECRET || '';
  if (!s || s.length < 32) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('SESSION_SECRET env var is required in production (>=32 chars).');
    }
    // Dev-only fallback to keep local boots working; emits warning once.
    if (!global.__netrik_session_dev_warn) {
      global.__netrik_session_dev_warn = true;
      console.warn('[auth] SESSION_SECRET missing or too short — using insecure dev fallback. Set SESSION_SECRET (>=32 chars) before deploying.');
    }
    return 'dev-only-insecure-fallback-secret-do-not-use-in-prod';
  }
  return s;
}

function b64urlEncode(buf) {
  return Buffer.from(buf).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function b64urlDecode(str) {
  const pad = str.length % 4 === 0 ? '' : '='.repeat(4 - (str.length % 4));
  return Buffer.from(str.replace(/-/g, '+').replace(/_/g, '/') + pad, 'base64');
}

function sign(payload) {
  const body = b64urlEncode(JSON.stringify(payload));
  const sig = crypto.createHmac('sha256', getSecret()).update(body).digest();
  return `${body}.${b64urlEncode(sig)}`;
}

function verify(token) {
  if (!token || typeof token !== 'string' || !token.includes('.')) return null;
  const [body, sigStr] = token.split('.');
  if (!body || !sigStr) return null;
  const expected = crypto.createHmac('sha256', getSecret()).update(body).digest();
  let provided;
  try { provided = b64urlDecode(sigStr); } catch { return null; }
  if (provided.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(provided, expected)) return null;
  let payload;
  try { payload = JSON.parse(b64urlDecode(body).toString('utf8')); } catch { return null; }
  if (!payload || typeof payload !== 'object') return null;
  if (typeof payload.exp !== 'number' || payload.exp * 1000 < Date.now()) return null;
  return payload;
}

export function readSession(request) {
  const cookie = request.cookies?.get?.(COOKIE_NAME);
  if (!cookie) return null;
  return verify(cookie.value);
}

export function attachSession(response, session, ttlSeconds = DEFAULT_TTL_SECONDS) {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const payload = { ...session, exp };
  response.cookies.set(COOKIE_NAME, sign(payload), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: ttlSeconds,
  });
  return response;
}

export function clearSession(response) {
  response.cookies.set(COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
  return response;
}

// Guard helper. Returns either { ok: true, session } or { ok: false, response }.
// opts:
//   roles: string[]  — allowed user types ('central', 'manager', 'chef', 'server')
//   restaurantId: string  — if set, requires session to be bound to this restaurant
//                           (central bypasses this check)
export function requireSession(request, opts = {}) {
  const session = readSession(request);
  if (!session) {
    return { ok: false, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }
  if (opts.roles && !opts.roles.includes(session.type)) {
    return { ok: false, response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }
  if (opts.restaurantId && session.type !== 'central' && session.restaurantId !== opts.restaurantId) {
    return { ok: false, response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }
  return { ok: true, session };
}

export const SESSION_COOKIE_NAME = COOKIE_NAME;
