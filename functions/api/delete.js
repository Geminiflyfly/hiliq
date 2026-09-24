import { handleOptions, json } from '../utils.js';
import { requireUser } from '../auth.js';

export async function onRequestOptions() {
  return handleOptions();
}

async function deleteHandler(context) {
  const { request, env } = context;

  const gate = await requireUser(request, env);
  if (gate.error) return gate.error;

  if (!env.BUCKET) {
    return json({ success: false, error: '未绑定 R2：请在 Pages 中绑定变量名 BUCKET' }, 500);
  }

  try {
    let keys = [];

    if (request.method === 'DELETE') {
      const { searchParams } = new URL(request.url);
      const single = (searchParams.get('key') || '').trim();
      if (single) keys = [single];
    }

    if (!keys.length) {
      const body = await request.json().catch(() => ({}));
      if (Array.isArray(body.keys)) {
        keys = body.keys.map((k) => String(k || '').trim()).filter(Boolean);
      } else if (body.key) {
        keys = [String(body.key).trim()];
      }
    }

    if (!keys.length) {
      return json({ success: false, error: '缺少参数 key / keys' }, 400);
    }
    if (keys.length > 50) {
      return json({ success: false, error: '单次最多删除 50 个' }, 400);
    }

    const deleted = [];
    const failed = [];
    for (const key of keys) {
      if (key.includes('..') || key.startsWith('/')) {
        failed.push({ key, error: '非法的对象键' });
        continue;
      }
      try {
        const existing = await env.BUCKET.head(key);
        if (!existing) {
          failed.push({ key, error: '不存在' });
          continue;
        }
        await env.BUCKET.delete(key);
        deleted.push(key);
      } catch (err) {
        failed.push({ key, error: err?.message || '删除失败' });
      }
    }

    return json({
      success: failed.length === 0,
      deleted,
      failed,
      key: deleted[0] || null,
      message: `已删除 ${deleted.length} 个`,
    });
  } catch (err) {
    return json({
      success: false,
      error: err?.message || '删除失败',
    }, 500);
  }
}

export async function onRequestDelete(context) {
  return deleteHandler(context);
}

export async function onRequestPost(context) {
  return deleteHandler(context);
}

export async function onRequest(context) {
  const method = context.request.method;
  if (method === 'OPTIONS') return handleOptions();
  if (method === 'DELETE' || method === 'POST') return deleteHandler(context);
  return json({ success: false, error: '仅支持 DELETE / POST' }, 405);
}
