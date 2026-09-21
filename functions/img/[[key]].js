/**
 * Serve images from R2 so the host works without enabling R2 public access.
 * Route: /img/<key>  (key may contain slashes, e.g. 2026/09/21/xxx.jpg)
 */

export async function onRequestGet(context) {
  const { request, env, params } = context;

  if (!env.BUCKET) {
    return new Response('R2 bucket not bound', { status: 500 });
  }

  const parts = params.key;
  const key = Array.isArray(parts) ? parts.join('/') : String(parts || '');

  if (!key || key.includes('..')) {
    return new Response('Not Found', { status: 404 });
  }

  const object = await env.BUCKET.get(key);
  if (!object) {
    return new Response('Not Found', { status: 404 });
  }

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('etag', object.httpEtag);
  headers.set('Cache-Control', object.httpMetadata?.cacheControl || 'public, max-age=31536000, immutable');
  headers.set('Access-Control-Allow-Origin', '*');

  // Conditional request
  const ifNoneMatch = request.headers.get('If-None-Match');
  if (ifNoneMatch && ifNoneMatch === object.httpEtag) {
    return new Response(null, { status: 304, headers });
  }

  return new Response(object.body, { headers });
}

export async function onRequestHead(context) {
  const { env, params } = context;

  if (!env.BUCKET) {
    return new Response(null, { status: 500 });
  }

  const parts = params.key;
  const key = Array.isArray(parts) ? parts.join('/') : String(parts || '');
  if (!key || key.includes('..')) {
    return new Response(null, { status: 404 });
  }

  const object = await env.BUCKET.head(key);
  if (!object) {
    return new Response(null, { status: 404 });
  }

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('etag', object.httpEtag);
  headers.set('Cache-Control', object.httpMetadata?.cacheControl || 'public, max-age=31536000, immutable');
  headers.set('Access-Control-Allow-Origin', '*');

  return new Response(null, { headers });
}
