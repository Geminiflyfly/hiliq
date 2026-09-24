/**
 * Serve images from R2 so the host works without enabling R2 public access.
 * Route: /img/<key>  (key may contain slashes / spaces, e.g. fizzy 50k/a.png)
 */

import { decodeObjectKey } from '../utils.js';

function resolveKey(request, params) {
  const parts = params.key;
  let key = Array.isArray(parts) ? parts.join('/') : String(parts || '');

  // Fallback: parse from pathname (more reliable with encoded spaces)
  if (!key) {
    const path = new URL(request.url).pathname;
    key = path.replace(/^\/img\/?/, '');
  }

  key = decodeObjectKey(key);

  // Strip leading slash; reject traversal
  key = key.replace(/^\/+/, '');
  if (!key || key.includes('..')) return null;
  return key;
}

export async function onRequestGet(context) {
  const { request, env, params } = context;

  if (!env.BUCKET) {
    return new Response('R2 bucket not bound', { status: 500 });
  }

  const key = resolveKey(request, params);
  if (!key) {
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

  const ifNoneMatch = request.headers.get('If-None-Match');
  if (ifNoneMatch && ifNoneMatch === object.httpEtag) {
    return new Response(null, { status: 304, headers });
  }

  return new Response(object.body, { headers });
}

export async function onRequestHead(context) {
  const { env, params, request } = context;

  if (!env.BUCKET) {
    return new Response(null, { status: 500 });
  }

  const key = resolveKey(request, params);
  if (!key) {
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
