import { countUsers, createSession, hashPassword, sessionCookieHeader, publicUser } from '../../auth.js';
import { handleOptions, json, randomId } from '../../utils.js';

export async function onRequestOptions() {
  return handleOptions();
}

/**
 * Bootstrap first admin when the users table is empty.
 * POST { username, password }
 */
export async function onRequestPost(context) {
  const { request, env } = context;

  if (!env.DB) {
    return json({ success: false, error: '未绑定 D1：请在 wrangler.toml 配置 DB' }, 500);
  }

  try {
    const n = await countUsers(env);
    if (n > 0) {
      return json({ success: false, error: '已完成初始化，请直接登录' }, 400);
    }

    const body = await request.json().catch(() => ({}));
    const username = String(body.username || '').trim();
    const password = String(body.password || '');

    if (username.length < 2 || username.length > 32) {
      return json({ success: false, error: '用户名长度需 2–32' }, 400);
    }
    if (!/^[a-zA-Z0-9_\u4e00-\u9fa5.-]+$/.test(username)) {
      return json({ success: false, error: '用户名含非法字符' }, 400);
    }
    if (password.length < 6) {
      return json({ success: false, error: '密码至少 6 位' }, 400);
    }

    const { hash, salt } = await hashPassword(password);
    const id = randomId(16);
    const now = new Date().toISOString();

    await env.DB.prepare(
      'INSERT INTO users (id, username, password_hash, salt, role, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    )
      .bind(id, username, hash, salt, 'admin', now)
      .run();

    const sessionId = await createSession(env, id);
    const user = publicUser({ id, username, role: 'admin', created_at: now });

    return json(
      { success: true, user, message: '管理员已创建' },
      200,
      { 'Set-Cookie': sessionCookieHeader(sessionId) },
    );
  } catch (err) {
    return json({ success: false, error: err?.message || '初始化失败' }, 500);
  }
}

export async function onRequest(context) {
  if (context.request.method === 'OPTIONS') return handleOptions();
  if (context.request.method === 'POST') return onRequestPost(context);
  return json({ success: false, error: '仅支持 POST' }, 405);
}
