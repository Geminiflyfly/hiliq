import { handleOptions, json, requireAuth } from '../utils.js';

export async function onRequestOptions() {
  return handleOptions();
}

async function deleteHandler(context) {
  const { request, env } = context;

  const authError = requireAuth(request, env);
  if (authError) return authError;

  // Require token for delete even if UPLOAD_TOKEN is unset — use a soft check:
  // If no token configured, still allow delete (private deploy), but prefer setting UPLOAD_TOKEN.
  if (!env.BUCKET) {
    return json({ success: false, error: '未绑定 R2：请在 Pages 中绑定变量名 BUCKET' }, 500);
  }

  try {
    let key = '';

    if (request.method === 'DELETE') {
      const { searchParams } = new URL(request.url);
      key = (searchParams.get('key') || '').trim();
      if (!key) {
        try {
          const body = await request.json();
          key = (body.key || '').trim();
        } catch {
          // ignore empty body
        }
      }
    } else {
      const body = await request.json().catch(() => ({}));
      key = (body.key || '').trim();
    }

    if (!key) {
      return json({ success: false, error: '缺少参数 key' }, 400);
    }

    // Basic path traversal guard
    if (key.includes('..') || key.startsWith('/')) {
      return json({ success: false, error: '非法的对象键' }, 400);
    }

    const existing = await env.BUCKET.head(key);
    if (!existing) {
      return json({ success: false, error: '图片不存在' }, 404);
    }

    await env.BUCKET.delete(key);

    return json({ success: true, key, message: '已删除' });
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
