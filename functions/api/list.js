import { handleOptions, json, publicUrl, requireAuth } from '../utils.js';

const DEFAULT_LIMIT = 24;
const MAX_LIMIT = 100;

export async function onRequestOptions() {
  return handleOptions();
}

export async function onRequestGet(context) {
  const { request, env } = context;

  const authError = requireAuth(request, env);
  if (authError) return authError;

  if (!env.BUCKET) {
    return json({ success: false, error: '未绑定 R2：请在 Pages 中绑定变量名 BUCKET' }, 500);
  }

  try {
    const { searchParams } = new URL(request.url);
    let limit = parseInt(searchParams.get('limit') || String(DEFAULT_LIMIT), 10);
    if (Number.isNaN(limit) || limit < 1) limit = DEFAULT_LIMIT;
    limit = Math.min(limit, MAX_LIMIT);

    const cursor = searchParams.get('cursor') || undefined;
    const prefix = searchParams.get('prefix') || undefined;

    const listed = await env.BUCKET.list({
      limit,
      cursor,
      prefix,
      include: ['httpMetadata', 'customMetadata'],
    });

    const images = (listed.objects || [])
      .filter((obj) => obj.key && !obj.key.endsWith('/') && obj.size > 0)
      .map((obj) => {
        const url = publicUrl(request, env, obj.key);
        return {
          key: obj.key,
          url,
          size: obj.size,
          uploaded: obj.uploaded?.toISOString?.() || obj.uploaded || null,
          contentType: obj.httpMetadata?.contentType || null,
          originalName: obj.customMetadata?.originalName || null,
        };
      });

    return json({
      success: true,
      images,
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
