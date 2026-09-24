/**
 * D1 session auth helpers (PBKDF2 passwords + cookie sessions).
 */

import { json, randomId } from './utils.js';

const SESSION_COOKIE = 'hiliq_session';
const SESSION_DAYS = 7;
const PBKDF2_ITERATIONS = 100_000;

/** Create users/sessions tables if missing (so console-created D1 works without CLI migrate). */
export async function ensureSchema(env) {
  if (!env.DB) return;
  await env.DB.batch([
    env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT NOT NULL UNIQUE COLLATE NOCASE,
        password_hash TEXT NOT NULL,
        salt TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
        created_at TEXT NOT NULL
      )
    `),
    env.DB.prepare(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `),
    env.DB.prepare(
      'CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id)',
    ),
    env.DB.prepare(
      'CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at)',
    ),
  ]);
}

function bufToB64(buf) {
  const bytes = buf instanceof ArrayBuffer ? new Uint8Array(buf) : buf;
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

function b64ToBuf(b64) {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

export async function hashPassword(password, existingSaltB64) {
  const salt = existingSaltB64
    ? b64ToBuf(existingSaltB64)
    : crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const derived = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    256,
  );
  return { hash: bufToB64(derived), salt: bufToB64(salt) };
}

export async function verifyPassword(password, hash, salt) {
  const { hash: next } = await hashPassword(password, salt);
  if (next.length !== hash.length) return false;
  let ok = 0;
  for (let i = 0; i < next.length; i++) ok |= next.charCodeAt(i) ^ hash.charCodeAt(i);
  return ok === 0;
}

export function parseCookies(request) {
  const header = request.headers.get('Cookie') || '';
  const out = {};
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    if (k) out[k] = decodeURIComponent(v);
  }
  return out;
}

export function sessionCookieHeader(sessionId, maxAgeSec = SESSION_DAYS * 86400) {
  const parts = [
    `${SESSION_COOKIE}=${encodeURIComponent(sessionId)}`,
    'Path=/',
    'HttpOnly',
    'Secure',
    'SameSite=Lax',
    `Max-Age=${maxAgeSec}`,
  ];
  return parts.join('; ');
}

export function clearSessionCookieHeader() {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

export function publicUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    username: row.username,
    role: row.role,
    createdAt: row.created_at,
  };
}

export async function countUsers(env) {
  if (!env.DB) return 0;
  const row = await env.DB.prepare('SELECT COUNT(*) AS n FROM users').first();
  return Number(row?.n || 0);
}

export async function createSession(env, userId) {
  const id = randomId(32);
  const now = new Date();
  const expires = new Date(now.getTime() + SESSION_DAYS * 86400 * 1000);
  await env.DB.prepare(
    'INSERT INTO sessions (id, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)',
  )
    .bind(id, userId, expires.toISOString(), now.toISOString())
    .run();
  return id;
}

export async function destroySession(env, sessionId) {
  if (!env.DB || !sessionId) return;
  await env.DB.prepare('DELETE FROM sessions WHERE id = ?').bind(sessionId).run();
}

export async function getSessionUser(request, env) {
  if (!env.DB) return null;
  const cookies = parseCookies(request);
  const sessionId = cookies[SESSION_COOKIE];
  if (!sessionId) return null;

  const row = await env.DB.prepare(
    `SELECT u.id, u.username, u.role, u.created_at, s.expires_at, s.id AS session_id
     FROM sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.id = ?`,
  )
    .bind(sessionId)
    .first();

  if (!row) return null;
  if (Date.parse(row.expires_at) < Date.now()) {
    await destroySession(env, sessionId);
    return null;
  }
  return publicUser(row);
}

/**
 * Require logged-in user (or UPLOAD_TOKEN fallback).
 * Returns { user } or { error: Response }.
 */
export async function requireUser(request, env, { admin = false } = {}) {
  const sessionUser = await getSessionUser(request, env);
  if (sessionUser) {
    if (admin && sessionUser.role !== 'admin') {
      return { error: json({ success: false, error: '需要管理员权限' }, 403) };
    }
    return { user: sessionUser };
  }

  // Legacy / automation: UPLOAD_TOKEN acts as admin
  const expected = (env.UPLOAD_TOKEN || '').trim();
  if (expected) {
    const auth = request.headers.get('Authorization') || '';
    const bearer = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : '';
    const header = (request.headers.get('X-Upload-Token') || '').trim();
    const provided = bearer || header;
    if (provided && provided === expected) {
      return { user: { id: 'token', username: 'token', role: 'admin' } };
    }
  }

  const n = await countUsers(env);
  if (env.DB && n > 0) {
    return { error: json({ success: false, error: '请先登录' }, 401) };
  }

  // No D1 users yet and no token → open (bootstrap phase)
  if (admin) {
    return { error: json({ success: false, error: '请先登录' }, 401) };
  }
  return { user: null };
}

export { SESSION_COOKIE, SESSION_DAYS };
