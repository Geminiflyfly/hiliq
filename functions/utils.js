/**
 * Shared helpers for Pages Functions.
 */

const ALLOWED_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  'image/avif',
  'image/bmp',
  'image/x-icon',
]);

const EXT_MAP = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
  'image/avif': 'avif',
  'image/bmp': 'bmp',
  'image/x-icon': 'ico',
};

export function corsHeaders(origin = '*') {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Upload-Token',
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

export function isAllowedType(type) {
  return ALLOWED_TYPES.has((type || '').toLowerCase());
}

export function extFromType(type) {
  return EXT_MAP[(type || '').toLowerCase()] || 'bin';
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

/** Build public image URL: CDN_URL override, else same-origin /img/{key}. */
export function publicUrl(request, env, key) {
  const base = (env.CDN_URL || '').replace(/\/+$/, '');
  if (base) return `${base}/${key}`;
  const url = new URL(request.url);
  return `${url.origin}/img/${key}`;
}

export function linkFormats(url, filename = 'image') {
  const safeName = filename.replace(/"/g, '');
  return {
    url,
    markdown: `![${safeName}](${url})`,
    html: `<img src="${url}" alt="${safeName}" />`,
    bbcode: `[img]${url}[/img]`,
  };
}

export { ALLOWED_TYPES, EXT_MAP };
