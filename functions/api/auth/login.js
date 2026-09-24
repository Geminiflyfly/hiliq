import {
  createSession,
  hashPassword,
  sessionCookieHeader,
  verifyPassword,
  publicUser,
  countUsers,
} from '../../../auth.js';
import { handleOptions, json } from '../../../utils.js';

export async function onRequestOptions() {
  return handleOptions();
}

export async function onRequestPost(context) {
  const { request, env } = context;

  if (!env.DB) {
    return json({ success: false, error: '未绑定 D1：请在 wrangler.toml 配置 DB' }, 500);
  }

  try {
    const n = await countUsers(env);
    if (n === 0) {
      return json({
        success: false,
        error: '尚未初始化管理员，请先完成 setup',
        needSetup: true,
      }, 400);
    }

    const body = await request.json().catch(() => ({}));
    const username = String(body.username || '').trim();
    const password = String(body.password || '');

    if (!username || !password) {
      return json({ success: false, error: '请输入用户名和密码' }, 400);
    }

    const row = await env.DB.prepare(
      'SELECT id, username, password_hash, salt, role, created_at FROM users WHERE username = ? COLLATE NOCASE',
    )
      .bind(username)
      .first();

    if (!row || !(await verifyPassword(password, row.password_hash, row.salt))) {
      return json({ success: false, error: '用户名或密码错误' }, 401);
    }

    const sessionId = await createSession(env, row.id);
    return json(
      { success: true, user: publicUser(row) },
      200,
      { 'Set-Cookie': sessionCookieHeader(sessionId) },
    );
  } catch (err) {
    return json({ success: false, error: err?.message || '登录失败' }, 500);
  }
}

export async function onRequest(context) {
  if (context.request.method === 'OPTIONS') return handleOptions();
  if (context.request.method === 'POST') return onRequestPost(context);
  return json({ success: false, error: '仅支持 POST' }, 405);
}
