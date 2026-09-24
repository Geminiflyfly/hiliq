import {
  buildObjectKey,
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
        const ext = extFromFilename(baseName) || 'bin';
        // Keep unique name but preserve original leaf when possible
        const date = new Date();
        let newKey = buildObjectKey(folder, ext, date);
        // Prefer readable leaf: folder/originalName if unique-ish
        const originalName = obj.customMetadata?.originalName || baseName;
        const safeLeaf = String(originalName).replace(/[\\/]/g, '_').slice(0, 120);
        if (safeLeaf && safeLeaf.includes('.')) {
          const candidate = folder ? `${folder}/${Date.now()}-${safeLeaf}` : `${Date.now()}-${safeLeaf}`;
          if (!candidate.includes('..')) newKey = candidate;
        }

        if (newKey === oldKey) {
          moved.push({ key: oldKey, url: publicUrl(request, env, oldKey) });
          continue;
        }

        await env.BUCKET.put(newKey, obj.body, {
          httpMetadata: obj.httpMetadata,
          customMetadata: {
            ...(obj.customMetadata || {}),
            folder: folder || '',
            originalName: obj.customMetadata?.originalName || originalName,
            movedFrom: oldKey,
            movedAt: new Date().toISOString(),
          },
        });
        await env.BUCKET.delete(oldKey);
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
