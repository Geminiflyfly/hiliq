import { handleOptions, json, normalizeFolder } from '../utils.js';
import { requireUser } from '../auth.js';

export async function onRequestOptions() {
  return handleOptions();
}

/**
 * GET /api/folders — list top-level R2 prefixes (folders).
 */
export async function onRequestGet(context) {
  const { request, env } = context;
  const gate = await requireUser(request, env);
  if (gate.error) return gate.error;

  if (!env.BUCKET) {
    return json({ success: false, error: '未绑定 R2' }, 500);
  }

  try {
    const folders = new Set();
    let cursor;
    do {
      const listed = await env.BUCKET.list({
        limit: 1000,
        cursor,
        delimiter: '/',
      });
      for (const p of listed.delimitedPrefixes || []) {
        const name = String(p).replace(/\/+$/, '');
        if (name) folders.add(name);
      }
      // Also derive from flat keys if delimiter prefixes empty (some edge cases)
      for (const obj of listed.objects || []) {
        const key = obj.key || '';
        const i = key.indexOf('/');
        if (i > 0) folders.add(key.slice(0, i));
      }
      cursor = listed.truncated ? listed.cursor : undefined;
    } while (cursor);

    const list = [...folders].sort((a, b) => a.localeCompare(b, 'zh'));
    return json({ success: true, folders: list, count: list.length });
  } catch (err) {
    return json({ success: false, error: err?.message || '获取文件夹失败' }, 500);
  }
}

/**
 * POST /api/folders — create an empty folder marker { name }.
 */
export async function onRequestPost(context) {
  const { request, env } = context;
  const gate = await requireUser(request, env);
  if (gate.error) return gate.error;

  if (!env.BUCKET) {
    return json({ success: false, error: '未绑定 R2' }, 500);
  }

  try {
    const body = await request.json().catch(() => ({}));
    const folder = normalizeFolder(body.name || body.folder || '');
    if (folder === null || !folder) {
      return json({ success: false, error: '文件夹名称无效' }, 400);
    }

    const markerKey = `${folder}/.keep`;
    const existing = await env.BUCKET.head(markerKey);
    if (!existing) {
      // Check if any object already exists under this prefix
      const listed = await env.BUCKET.list({ prefix: `${folder}/`, limit: 1 });
      if (!listed.objects?.length) {
        await env.BUCKET.put(markerKey, '', {
          httpMetadata: { contentType: 'application/x-directory' },
          customMetadata: { folderMarker: '1' },
        });
      }
    }

    return json({ success: true, folder, message: '文件夹已就绪' });
  } catch (err) {
    return json({ success: false, error: err?.message || '创建文件夹失败' }, 500);
  }
}

export async function onRequest(context) {
  const method = context.request.method;
  if (method === 'OPTIONS') return handleOptions();
  if (method === 'GET') return onRequestGet(context);
  if (method === 'POST') return onRequestPost(context);
  return json({ success: false, error: '仅支持 GET / POST' }, 405);
}
