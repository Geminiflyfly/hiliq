import {
  extFromFilename,
  folderFromKey,
  handleOptions,
  json,
  normalizeFolder,
  publicUrl,
} from '../utils.js';
import { requireUser } from '../auth.js';

export async function onRequestOptions() {
  return handleOptions();
}

/**
 * POST /api/move — move one or more objects into a folder.
 * Body: { keys: string[], folder: string }
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
    const keys = Array.isArray(body.keys)
      ? body.keys.map((k) => String(k || '').trim()).filter(Boolean)
      : body.key
        ? [String(body.key).trim()]
        : [];

    if (!keys.length) {
      return json({ success: false, error: '缺少 keys' }, 400);
    }
    if (keys.length > 50) {
      return json({ success: false, error: '单次最多移动 50 个文件' }, 400);
    }

    const folder = normalizeFolder(body.folder || '');
    if (folder === null) {
      return json({ success: false, error: '目标文件夹非法' }, 400);
    }

    const moved = [];
    const failed = [];

    for (const oldKey of keys) {
      if (oldKey.includes('..') || oldKey.startsWith('/')) {
        failed.push({ key: oldKey, error: '非法 key' });
        continue;
      }
      try {
        const obj = await env.BUCKET.get(oldKey);
        if (!obj) {
          failed.push({ key: oldKey, error: '不存在' });
          continue;
        }

        const baseName = oldKey.split('/').pop() || oldKey;
        const originalName = obj.customMetadata?.originalName || baseName;
        let leaf = baseName;
        let newKey = folder ? `${folder}/${leaf}` : leaf;
        if (newKey !== oldKey) {
          const taken = await env.BUCKET.head(newKey);
          if (taken && taken.customMetadata?.hidden !== '1') {
            const ext = extFromFilename(leaf);
            const stem = ext ? leaf.slice(0, -(ext.length + 1)) : leaf;
            leaf = ext ? `${stem}-${Date.now()}.${ext}` : `${stem}-${Date.now()}`;
            newKey = folder ? `${folder}/${leaf}` : leaf;
          }
        }

        if (newKey === oldKey) {
          moved.push({ key: oldKey, url: publicUrl(request, env, oldKey) });
          continue;
        }

        const bytes = await obj.arrayBuffer();
        const meta = {
          ...(obj.customMetadata || {}),
          folder: folder || '',
          originalName,
          movedFrom: oldKey,
          movedAt: new Date().toISOString(),
        };
        delete meta.hidden;
        delete meta.movedTo;
        await env.BUCKET.put(newKey, bytes, {
          httpMetadata: obj.httpMetadata,
          customMetadata: meta,
        });
        // Keep the old object so existing CDN links still return the file.
        await env.BUCKET.put(oldKey, bytes, {
          httpMetadata: obj.httpMetadata,
          customMetadata: {
            ...(obj.customMetadata || {}),
            hidden: '1',
            movedTo: newKey,
          },
        });
        moved.push({
          from: oldKey,
          key: newKey,
          folder: folder || '',
          url: publicUrl(request, env, newKey),
          folderLabel: folderFromKey(newKey) || folder || '',
        });
      } catch (err) {
        failed.push({ key: oldKey, error: err?.message || '移动失败' });
      }
    }

    return json({
      success: failed.length === 0,
      moved,
      failed,
      count: moved.length,
      message: `已移动 ${moved.length} 个${failed.length ? `，失败 ${failed.length} 个` : ''}`,
    });
  } catch (err) {
    return json({ success: false, error: err?.message || '移动失败' }, 500);
  }
}

export async function onRequest(context) {
  if (context.request.method === 'OPTIONS') return handleOptions();
  if (context.request.method === 'POST') return onRequestPost(context);
  return json({ success: false, error: '仅支持 POST' }, 405);
}
