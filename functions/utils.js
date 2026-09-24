/**
 * Shared helpers for Pages Functions.
 */

const KIND_RULES = [
  {
    kind: 'image',
    label: '图片',
    types: [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'image/svg+xml', 'image/avif', 'image/bmp', 'image/x-icon', 'image/heic', 'image/heif',
    ],
    exts: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'avif', 'bmp', 'ico', 'heic', 'heif'],
  },
  {
    kind: 'video',
    label: '视频',
    types: ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo', 'video/x-matroska'],
    exts: ['mp4', 'webm', 'mov', 'avi', 'mkv'],
  },
  {
    kind: 'audio',
    label: '音频',
    types: ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav', 'audio/ogg', 'audio/aac', 'audio/flac'],
    exts: ['mp3', 'wav', 'ogg', 'aac', 'flac', 'm4a'],
  },
  {
    kind: 'document',
    label: '文档',
    types: [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'text/plain',
      'text/markdown',
      'text/csv',
      'application/json',
    ],
    exts: ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'md', 'csv', 'json'],
  },
  {
    kind: 'archive',
    label: '压缩包',
    types: [
      'application/zip',
      'application/x-zip-compressed',
      'application/x-rar-compressed',
      'application/vnd.rar',
      'application/x-7z-compressed',
      'application/gzip',
      'application/x-tar',
    ],
    exts: ['zip', 'rar', '7z', 'gz', 'tar'],
  },
];

const ALLOWED_TYPES = new Set(KIND_RULES.flatMap((r) => r.types));
const ALLOWED_EXTS = new Set(KIND_RULES.flatMap((r) => r.exts));

const EXT_MAP = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
  'image/avif': 'avif',
  'image/bmp': 'bmp',
  'image/x-icon': 'ico',
  'image/heic': 'heic',
  'image/heif': 'heif',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/quicktime': 'mov',
  'video/x-msvideo': 'avi',
  'video/x-matroska': 'mkv',
  'audio/mpeg': 'mp3',
  'audio/mp3': 'mp3',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
  'audio/ogg': 'ogg',
  'audio/aac': 'aac',
  'audio/flac': 'flac',
  'application/pdf': 'pdf',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.ms-excel': 'xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/vnd.ms-powerpoint': 'ppt',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'pptx',
  'text/plain': 'txt',
  'text/markdown': 'md',
  'text/csv': 'csv',
  'application/json': 'json',
  'application/zip': 'zip',
  'application/x-zip-compressed': 'zip',
  'application/x-rar-compressed': 'rar',
  'application/vnd.rar': 'rar',
  'application/x-7z-compressed': '7z',
  'application/gzip': 'gz',
  'application/x-tar': 'tar',
};

export function kindFromType(type, filename = '') {
  const t = (type || '').toLowerCase();
  const ext = extFromFilename(filename);
  for (const rule of KIND_RULES) {
    if (t && rule.types.includes(t)) return rule.kind;
    if (ext && rule.exts.includes(ext)) return rule.kind;
  }
  if (t.startsWith('image/')) return 'image';
  if (t.startsWith('video/')) return 'video';
  if (t.startsWith('audio/')) return 'audio';
  return 'other';
}

export function kindLabel(kind) {
  return KIND_RULES.find((r) => r.kind === kind)?.label || '其他';
}

export function isAllowedType(type, filename = '') {
  const t = (type || '').toLowerCase();
  if (t && ALLOWED_TYPES.has(t)) return true;
  // Some browsers send empty or application/octet-stream — fall back to extension
  if (!t || t === 'application/octet-stream') {
    const ext = extFromFilename(filename);
    return Boolean(ext && ALLOWED_EXTS.has(ext));
  }
  // Allow broad image/video/audio prefixes for variants
  if (t.startsWith('image/') || t.startsWith('video/') || t.startsWith('audio/')) return true;
  const ext = extFromFilename(filename);
  return Boolean(ext && ALLOWED_EXTS.has(ext));
}

export function extFromFilename(filename) {
  const name = String(filename || '');
  const i = name.lastIndexOf('.');
  if (i < 0 || i === name.length - 1) return '';
  const ext = name.slice(i + 1).toLowerCase();
  if (ext.length > 10 || !/^[a-z0-9]+$/.test(ext)) return '';
  return ext;
}

export function extFromType(type) {
  return EXT_MAP[(type || '').toLowerCase()] || 'bin';
}

export function extFromFile(file) {
  const fromName = extFromFilename(file?.name);
  if (fromName) return fromName;
  return extFromType(file?.type);
}

export function maxBytesForKind(kind) {
  if (kind === 'video') return 100 * 1024 * 1024;
  if (kind === 'archive') return 50 * 1024 * 1024;
  if (kind === 'audio') return 30 * 1024 * 1024;
  return 20 * 1024 * 1024;
}

export function corsHeaders(origin = '*') {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Upload-Token, Cookie',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Max-Age': '86400',
  };
}

export function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...corsHeaders(),
      ...extraHeaders,
    },
  });
}

export function handleOptions() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}

/** Read upload token from Authorization Bearer or X-Upload-Token. */
export function extractToken(request) {
  const auth = request.headers.get('Authorization') || '';
  if (auth.toLowerCase().startsWith('bearer ')) {
    return auth.slice(7).trim();
  }
  return (request.headers.get('X-Upload-Token') || '').trim();
}

/**
 * When UPLOAD_TOKEN is set, require a matching client token.
 * When unset, endpoints are open (suitable for private deployments).
 */
export function requireAuth(request, env) {
  const expected = (env.UPLOAD_TOKEN || '').trim();
  if (!expected) return null;
  const provided = extractToken(request);
  if (!provided || provided !== expected) {
    return json({ success: false, error: '未授权：请提供正确的上传令牌' }, 401);
  }
  return null;
}

export function randomId(length = 10) {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  let out = '';
  for (let i = 0; i < length; i++) {
    out += alphabet[bytes[i] % alphabet.length];
  }
  return out;
}

/** Encode each path segment so spaces/unicode work in URLs. */
export function encodeObjectKey(key) {
  return String(key)
    .split('/')
    .map((seg) => encodeURIComponent(seg))
    .join('/');
}

/** Decode a URL path key back to the R2 object key. */
export function decodeObjectKey(raw) {
  const value = String(raw || '');
  try {
    // decodeURIComponent handles %20; replace bare + only in query, not path
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/** Build public image URL: CDN_URL override, else same-origin /img/{key}. */
export function publicUrl(request, env, key) {
  const encoded = encodeObjectKey(key);
  const base = (env.CDN_URL || '').replace(/\/+$/, '');
  if (base) return `${base}/${encoded}`;
  const url = new URL(request.url);
  return `${url.origin}/img/${encoded}`;
}

export function linkFormats(url, filename = 'file', kind = 'image') {
  const safeName = filename.replace(/"/g, '');
  if (kind === 'image') {
    return {
      url,
      markdown: `![${safeName}](${url})`,
      html: `<img src="${url}" alt="${safeName}" />`,
      bbcode: `[img]${url}[/img]`,
    };
  }
  return {
    url,
    markdown: `[${safeName}](${url})`,
    html: `<a href="${url}" target="_blank" rel="noopener">${safeName}</a>`,
    bbcode: `[url]${url}[/url]`,
  };
}

/**
 * Normalize a folder path for R2 keys.
 * Returns '' for root, or "name/sub" without leading/trailing slashes.
 */
export function normalizeFolder(raw) {
  let folder = String(raw || '')
    .replace(/\\/g, '/')
    .trim();
  folder = folder.replace(/^\/+|\/+$/g, '');
  if (!folder) return '';
  if (folder.includes('..')) return null;
  // Disallow control chars; allow spaces / unicode (e.g. "fizzy 50k")
  if (/[\u0000-\u001f]/.test(folder)) return null;
  // Collapse duplicate slashes
  folder = folder.replace(/\/+/g, '/');
  if (folder.length > 180) return null;
  return folder;
}

/** Build object key: optional folder + inverted timestamp filename. */
export function buildObjectKey(folder, ext, date = new Date()) {
  const invTs = String(9_999_999_999_999 - date.getTime());
  const name = `${invTs}-${randomId(8)}.${ext}`;
  return folder ? `${folder}/${name}` : name;
}

/** Parent directory of an object key (supports nested paths). */
export function folderFromKey(key) {
  const k = String(key || '');
  const i = k.lastIndexOf('/');
  if (i <= 0) return '';
  return k.slice(0, i);
}

/** Depth of a folder path (0 = top-level). */
export function folderDepth(folder) {
  const f = String(folder || '');
  if (!f) return 0;
  return f.split('/').length - 1;
}

export { ALLOWED_TYPES, EXT_MAP, KIND_RULES };
