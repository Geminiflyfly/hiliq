import { ensureSchema, hashPassword, requireUser, publicUser } from '../auth.js';
import { handleOptions, json, randomId } from '../utils.js';

export async function onRequestOptions() {
  return handleOptions();
}

/** GET — list users (admin) */
export async function onRequestGet(context) {
  const { request, env } = context;
  const gate = await requireUser(request, env, { admin: true });
  if (gate.error) return gate.error;

  if (!env.DB) {
    return json({ success: false, error: '未绑定 D1' }, 500);
  }

  try {
    await ensureSchema(env);
    const { results } = await env.DB.prepare(
      'SELECT id, username, role, created_at FROM users ORDER BY created_at ASC',
    ).all();

    return json({
      success: true,
      users: (results || []).map((r) => publicUser(r)),
    });
  } catch (err) {
    return json({ success: false, error: err?.message || '获取用户失败' }, 500);
  }
}

/** POST — create user (admin) { username, password, role? } */
export async function onRequestPost(context) {
  const { request, env } = context;
  const gate = await requireUser(request, env, { admin: true });
  if (gate.error) return gate.error;

  if (!env.DB) {
    return json({ success: false, error: '未绑定 D1' }, 500);
  }

  try {
    const body = await request.json().catch(() => ({}));
    const username = String(body.username || '').trim();
    const password = String(body.password || '');
    const role = body.role === 'admin' ? 'admin' : 'user';

    if (username.length < 2 || username.length > 32) {
      return json({ success: false, error: '用户名长度需 2–32' }, 400);
    }
    if (!/^[a-zA-Z0-9_\u4e00-\u9fa5.-]+$/.test(username)) {
      return json({ success: false, error: '用户名含非法字符' }, 400);
    }
    if (password.length < 6) {
      return json({ success: false, error: '密码至少 6 位' }, 400);
    }

    const exists = await env.DB.prepare(
      'SELECT id FROM users WHERE username = ? COLLATE NOCASE',
    )
      .bind(username)
      .first();
    if (exists) {
      return json({ success: false, error: '用户名已存在' }, 409);
    }

    const { hash, salt } = await hashPassword(password);
    const id = randomId(16);
    const now = new Date().toISOString();

    await env.DB.prepare(
      'INSERT INTO users (id, username, password_hash, salt, role, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    )
      .bind(id, username, hash, salt, role, now)
      .run();

    return json({
      success: true,
      user: publicUser({ id, username, role, created_at: now }),
    });
  } catch (err) {
    return json({ success: false, error: err?.message || '创建用户失败' }, 500);
  }
}

/** DELETE — remove user (admin) ?id= or body.key */
export async function onRequestDelete(context) {
  const { request, env } = context;
  const gate = await requireUser(request, env, { admin: true });
  if (gate.error) return gate.error;

  if (!env.DB) {
    return json({ success: false, error: '未绑定 D1' }, 500);
  }

  try {
    const { searchParams } = new URL(request.url);
    let id = (searchParams.get('id') || '').trim();
    if (!id) {
      const body = await request.json().catch(() => ({}));
      id = String(body.id || '').trim();
    }
    if (!id) {
      return json({ success: false, error: '缺少用户 id' }, 400);
    }
    if (gate.user.id === id) {
      return json({ success: false, error: '不能删除当前登录账号' }, 400);
    }

    const target = await env.DB.prepare('SELECT id, role FROM users WHERE id = ?').bind(id).first();
    if (!target) {
      return json({ success: false, error: '用户不存在' }, 404);
    }

    if (target.role === 'admin') {
      const admins = await env.DB.prepare(
        "SELECT COUNT(*) AS n FROM users WHERE role = 'admin'",
      ).first();
      if (Number(admins?.n || 0) <= 1) {
        return json({ success: false, error: '不能删除最后一个管理员' }, 400);
      }
    }

    await env.DB.prepare('DELETE FROM sessions WHERE user_id = ?').bind(id).run();
    await env.DB.prepare('DELETE FROM users WHERE id = ?').bind(id).run();

    return json({ success: true, id, message: '已删除' });
  } catch (err) {
    return json({ success: false, error: err?.message || '删除失败' }, 500);
  }
}

export async function onRequest(context) {
  const method = context.request.method;
  if (method === 'OPTIONS') return handleOptions();
  if (method === 'GET') return onRequestGet(context);
  if (method === 'POST') return onRequestPost(context);
  if (method === 'DELETE') return onRequestDelete(context);
  return json({ success: false, error: '不支持的方法' }, 405);
}
