import {
  folderFromKey,
  handleOptions,
  json,
  kindFromType,
  kindLabel,
  normalizeFolder,
  publicUrl,
} from '../utils.js';
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
    const kindFilter = (searchParams.get('kind') || '').trim().toLowerCase();
    const query = (searchParams.get('q') || '').trim().toLowerCase();
    const prefix = folder ? `${folder}/` : undefined;
    const filtering = Boolean(kindFilter || query);

    const files = [];
    let pageCursor = cursor;
    let truncated = false;
    let scanned = 0;
    const scanCap = filtering ? 800 : limit;

    while (files.length < limit && scanned < scanCap) {
      const pageSize = filtering ? 100 : limit;
      const listed = await env.BUCKET.list({
        limit: pageSize,
        cursor: pageCursor,
        prefix,
        include: ['httpMetadata', 'customMetadata'],
      });
      const objects = listed.objects || [];
      scanned += objects.length;

      for (const obj of objects) {
        if (!obj.key || obj.key.endsWith('/') || obj.size <= 0) continue;
        if (obj.key.endsWith('/.keep')) continue;
        if (obj.customMetadata?.folderMarker === '1') continue;
        if (obj.customMetadata?.hidden === '1') continue;
        const contentType = obj.httpMetadata?.contentType || null;
        const originalName = obj.customMetadata?.originalName || null;
        const kind = obj.customMetadata?.kind || kindFromType(contentType, originalName || obj.key);
        if (kindFilter && kind !== kindFilter) continue;
        const hay = `${originalName || ''} ${obj.key}`.toLowerCase();
        if (query && !hay.includes(query)) continue;
        const f = obj.customMetadata?.folder || folderFromKey(obj.key);
        files.push({
          key: obj.key,
          url: publicUrl(request, env, obj.key),
          folder: f || '',
          kind,
          kindLabel: kindLabel(kind),
          size: obj.size,
          uploaded: obj.uploaded?.toISOString?.() || obj.uploaded || null,
          contentType,
          originalName,
        });
      }

      if (!listed.truncated) {
        truncated = false;
        pageCursor = null;
        break;
      }
      truncated = true;
      pageCursor = listed.cursor;
      if (!filtering) break;
    }

    return json({
      success: true,
      images: files,
      files,
      folder: folder || '',
      kind: kindFilter || '',
      query,
      truncated,
      cursor: truncated ? pageCursor : null,
      count: files.length,
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
