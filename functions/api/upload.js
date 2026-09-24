import {
  buildObjectKey,
  extFromFile,
  folderFromKey,
  handleOptions,
  isAllowedType,
  json,
  kindFromType,
  kindLabel,
  linkFormats,
  maxBytesForKind,
  normalizeFolder,
  publicUrl,
} from '../utils.js';
import { requireUser } from '../auth.js';

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
        return json({ success: false, error: '请使用字段名 file 上传文件' }, 400);
      }
    } else if (contentType.startsWith('image/') || contentType.startsWith('video/') || contentType.startsWith('audio/')) {
      const buffer = await request.arrayBuffer();
      if (buffer.byteLength === 0) {
        return json({ success: false, error: '请求体为空' }, 400);
      }
      const ext = extFromFile({ name: '', type: contentType });
      file = new File([buffer], `paste.${ext}`, { type: contentType });
      folderRaw = new URL(request.url).searchParams.get('folder') || '';
    } else {
      return json({
        success: false,
        error: '请使用 multipart/form-data 上传',
      }, 400);
    }

    const folder = normalizeFolder(folderRaw);
    if (folder === null) {
      return json({ success: false, error: '文件夹路径非法' }, 400);
    }

    if (!isAllowedType(file.type, file.name)) {
      return json({
        success: false,
        error: `不支持的文件类型：${file.type || file.name || 'unknown'}`,
      }, 415);
    }

    const kind = kindFromType(file.type, file.name);
    const maxBytes = maxBytesForKind(kind);
    if (file.size > maxBytes) {
      return json({
        success: false,
        error: `文件过大：${kindLabel(kind)}最大允许 ${Math.round(maxBytes / 1024 / 1024)} MB`,
      }, 413);
    }

    const ext = extFromFile(file);
    const date = new Date();
    const key = buildObjectKey(folder, ext, date);

    const arrayBuffer = await file.arrayBuffer();
    await env.BUCKET.put(key, arrayBuffer, {
      httpMetadata: {
        contentType: file.type || 'application/octet-stream',
        cacheControl: 'public, max-age=31536000, immutable',
      },
      customMetadata: {
        originalName: file.name || '',
        uploadedAt: date.toISOString(),
        folder: folder || '',
        kind,
      },
    });

    const url = publicUrl(request, env, key);
    const formats = linkFormats(url, file.name || key, kind);

    return json({
      success: true,
      key,
      folder: folder || '',
      folderLabel: folderFromKey(key) || folder || '',
      kind,
      kindLabel: kindLabel(kind),
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
