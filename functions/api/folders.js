import { folderFromKey, handleOptions, json, normalizeFolder } from '../utils.js';
import { requireUser } from '../auth.js';

export async function onRequestOptions() {
  return handleOptions();
}

/**
 * Recursively collect folder prefixes under optional parent.
 * Walks R2 with delimiter so empty (.keep) folders are included.
 */
async function collectFolders(env, parent = '') {
  const folders = new Set();
  const base = parent ? `${parent}/` : '';

  async function walk(prefix) {
    let cursor;
    do {
      const listed = await env.BUCKET.list({
        prefix: prefix || undefined,
        delimiter: '/',
        limit: 1000,
        cursor,
      });

      for (const p of listed.delimitedPrefixes || []) {
        const name = String(p).replace(/\/+$/, '');
        if (!name) continue;
        folders.add(name);
        // Recurse into subfolders
        await walk(`${name}/`);
      }

      // Derive intermediate folders from any file keys at this level
      for (const obj of listed.objects || []) {
        const key = obj.key || '';
        if (!key || key.endsWith('/.keep')) continue;
        const dir = folderFromKey(key);
        if (!dir) continue;
        // Add every ancestor path
        const parts = dir.split('/');
        let acc = '';
        for (const part of parts) {
          acc = acc ? `${acc}/${part}` : part;
          folders.add(acc);
        }
      }

      cursor = listed.truncated ? listed.cursor : undefined;
    } while (cursor);
  }

  await walk(base);
  return folders;
}

/**
 * GET /api/folders
 * - no query: all nested folders
 * - ?parent=a/b : only direct children of a/b (names relative or full paths)
 * Response: { folders: ["a", "a/b", ...], tree helper fields }
 */
export async function onRequestGet(context) {
  const { request, env } = context;
  const gate = await requireUser(request, env);
  if (gate.error) return gate.error;

  if (!env.BUCKET) {
    return json({ success: false, error: '未绑定 R2' }, 500);
  }

  try {
    const { searchParams } = new URL(request.url);
    const parentRaw = searchParams.get('parent');
    const parent = parentRaw == null || parentRaw === ''
      ? ''
      : normalizeFolder(parentRaw);

    if (parent === null) {
      return json({ success: false, error: '父目录路径非法' }, 400);
    }

    const all = await collectFolders(env, parent);
    let list = [...all].sort((a, b) => a.localeCompare(b, 'zh'));

    // If parent set, also include only descendants (collectFolders already scoped)
    // For root listing we already have everything nested.

    const children = parent
      ? list.filter((f) => {
          if (!f.startsWith(`${parent}/`)) return false;
          const rest = f.slice(parent.length + 1);
          return rest.length > 0 && !rest.includes('/');
        })
      : list.filter((f) => !f.includes('/'));

    return json({
      success: true,
      folders: list,
      children,
      parent: parent || '',
      count: list.length,
    });
  } catch (err) {
    return json({ success: false, error: err?.message || '获取文件夹失败' }, 500);
  }
}

/**
 * POST /api/folders — create folder (supports nested: { name, parent? }).
 * name can be "sub" with parent "a/b" → "a/b/sub", or full path "a/b/sub".
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
    let folder;

    if (body.parent != null && String(body.parent).trim() !== '') {
      const parent = normalizeFolder(body.parent);
      const name = normalizeFolder(body.name || body.folder || '');
      if (parent === null || name === null || !name) {
        return json({ success: false, error: '文件夹名称无效' }, 400);
      }
      // name should be a single segment when using parent
      if (name.includes('/')) {
        folder = normalizeFolder(`${parent}/${name}`);
      } else {
        folder = normalizeFolder(`${parent}/${name}`);
      }
    } else {
      folder = normalizeFolder(body.name || body.folder || '');
    }

    if (folder === null || !folder) {
      return json({ success: false, error: '文件夹名称无效' }, 400);
    }

    // Ensure every ancestor has a marker so empty parents appear in listings
    const parts = folder.split('/');
    let acc = '';
    for (const part of parts) {
      acc = acc ? `${acc}/${part}` : part;
      const markerKey = `${acc}/.keep`;
      const existing = await env.BUCKET.head(markerKey);
      if (existing) continue;
      const listed = await env.BUCKET.list({ prefix: `${acc}/`, limit: 1 });
      if (listed.objects?.length) continue;
      await env.BUCKET.put(markerKey, '', {
        httpMetadata: { contentType: 'application/x-directory' },
        customMetadata: { folderMarker: '1' },
      });
    }

    return json({ success: true, folder, message: '文件夹已就绪' });
  } catch (err) {
    return json({ success: false, error: err?.message || '创建文件夹失败' }, 500);
  }
}

export async function onRequest(context) {
  const method = context.request.method;
  if (method === 'OPTIONS') return handleOptions();
  if (method === 'GET') return onRequestGet(context);
  if (method === 'POST') return onRequestPost(context);
  return json({ success: false, error: '仅支持 GET / POST' }, 405);
}
