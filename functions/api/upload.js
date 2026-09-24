import {
  buildObjectKey,
  extFromType,
  folderFromKey,
  handleOptions,
  isAllowedType,
  json,
  linkFormats,
  normalizeFolder,
  publicUrl,
} from '../utils.js';
import { requireUser } from '../auth.js';

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

export async function onRequestOptions() {
  return handleOptions();
}

export async function onRequestPost(context) {
  const { request, env } = context;

  const gate = await requireUser(request, env);
  if (gate.error) return gate.error;

  if (!env.BUCKET) {
    return json({ success: false, error: '未绑定 R2：请在 Pages 中绑定变量名 BUCKET' }, 500);
  }

  try {
    const contentType = request.headers.get('Content-Type') || '';
    let file;
    let folderRaw = '';

    if (contentType.includes('multipart/form-data')) {
      const form = await request.formData();
      file = form.get('file') || form.get('image');
      folderRaw = form.get('folder') || form.get('prefix') || '';
      if (!file || typeof file === 'string') {
        return json({ success: false, error: '请使用字段名 file 上传图片' }, 400);
      }
    } else if (contentType.startsWith('image/')) {
      const buffer = await request.arrayBuffer();
      if (buffer.byteLength === 0) {
        return json({ success: false, error: '请求体为空' }, 400);
      }
      file = new File([buffer], `paste.${extFromType(contentType)}`, { type: contentType });
      folderRaw = new URL(request.url).searchParams.get('folder') || '';
    } else {
      return json({
        success: false,
        error: '请使用 multipart/form-data 或直接发送 image/* 请求体',
      }, 400);
    }

    const folder = normalizeFolder(folderRaw);
    if (folder === null) {
      return json({ success: false, error: '文件夹路径非法' }, 400);
    }

    if (!isAllowedType(file.type)) {
      return json({
        success: false,
        error: `不支持的文件类型：${file.type || 'unknown'}`,
      }, 415);
    }

    if (file.size > MAX_BYTES) {
      return json({
        success: false,
        error: `文件过大：最大允许 ${MAX_BYTES / 1024 / 1024} MB`,
      }, 413);
    }

    const ext = extFromType(file.type);
    const date = new Date();
    const key = buildObjectKey(folder, ext, date);

    const arrayBuffer = await file.arrayBuffer();
    await env.BUCKET.put(key, arrayBuffer, {
      httpMetadata: {
        contentType: file.type,
        cacheControl: 'public, max-age=31536000, immutable',
      },
      customMetadata: {
        originalName: file.name || '',
        uploadedAt: date.toISOString(),
        folder: folder || '',
      },
    });

    const url = publicUrl(request, env, key);
    const formats = linkFormats(url, file.name || key);

    return json({
      success: true,
      key,
      folder: folder || '',
      folderLabel: folderFromKey(key) || folder || '',
      size: file.size,
      contentType: file.type,
      uploadedAt: date.toISOString(),
      ...formats,
    });
  } catch (err) {
    return json({
      success: false,
      error: err?.message || '上传失败',
    }, 500);
  }
}

export async function onRequest(context) {
  if (context.request.method === 'OPTIONS') return handleOptions();
  if (context.request.method === 'POST') return onRequestPost(context);
  return json({ success: false, error: '仅支持 POST' }, 405);
}
