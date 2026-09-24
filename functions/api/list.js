import { folderFromKey, handleOptions, json, normalizeFolder, publicUrl } from '../utils.js';
import { requireUser } from '../auth.js';

const DEFAULT_LIMIT = 24;
const MAX_LIMIT = 100;

export async function onRequestOptions() {
  return handleOptions();
}

export async function onRequestGet(context) {
  const { request, env } = context;

  const gate = await requireUser(request, env);
  if (gate.error) return gate.error;

  if (!env.BUCKET) {
    return json({ success: false, error: '未绑定 R2：请在 Pages 中绑定变量名 BUCKET' }, 500);
  }

  try {
    const { searchParams } = new URL(request.url);
    let limit = parseInt(searchParams.get('limit') || String(DEFAULT_LIMIT), 10);
    if (Number.isNaN(limit) || limit < 1) limit = DEFAULT_LIMIT;
    limit = Math.min(limit, MAX_LIMIT);

    const cursor = searchParams.get('cursor') || undefined;
    const folder = normalizeFolder(searchParams.get('folder') || searchParams.get('prefix') || '');
    if (folder === null) {
      return json({ success: false, error: '文件夹路径非法' }, 400);
    }
    const prefix = folder ? `${folder}/` : undefined;

    const listed = await env.BUCKET.list({
      limit,
      cursor,
      prefix,
      include: ['httpMetadata', 'customMetadata'],
    });

    const images = (listed.objects || [])
      .filter((obj) => {
        if (!obj.key || obj.key.endsWith('/') || obj.size <= 0) return false;
        if (obj.key.endsWith('/.keep')) return false;
        if (obj.customMetadata?.folderMarker === '1') return false;
        return true;
      })
      .map((obj) => {
        const url = publicUrl(request, env, obj.key);
        const f = obj.customMetadata?.folder || folderFromKey(obj.key);
        return {
          key: obj.key,
          url,
          folder: f || '',
          size: obj.size,
          uploaded: obj.uploaded?.toISOString?.() || obj.uploaded || null,
          contentType: obj.httpMetadata?.contentType || null,
          originalName: obj.customMetadata?.originalName || null,
        };
      });

    return json({
      success: true,
      images,
      folder: folder || '',
      truncated: Boolean(listed.truncated),
      cursor: listed.truncated ? listed.cursor : null,
      count: images.length,
    });
  } catch (err) {
    return json({
      success: false,
      error: err?.message || '获取列表失败',
    }, 500);
  }
}

export async function onRequest(context) {
  if (context.request.method === 'OPTIONS') return handleOptions();
  if (context.request.method === 'GET') return onRequestGet(context);
  return json({ success: false, error: '仅支持 GET' }, 405);
}
