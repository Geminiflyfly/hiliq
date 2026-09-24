import { folderFromKey, handleOptions, json, normalizeFolder } from '../utils.js';
import { requireUser } from '../auth.js';

export async function onRequestOptions() {
  return handleOptions();
}

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
        await walk(`${name}/`);
      }

      for (const obj of listed.objects || []) {
        const key = obj.key || '';
        if (!key || key.endsWith('/.keep')) continue;
        const dir = folderFromKey(key);
        if (!dir) continue;
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

async function countObjectsUnder(env, folder) {
  const prefix = `${folder}/`;
  let files = 0;
  let cursor;
  do {
    const listed = await env.BUCKET.list({ prefix, limit: 1000, cursor });
    for (const obj of listed.objects || []) {
      const key = obj.key || '';
      if (!key || key.endsWith('/.keep') || key.endsWith('/')) continue;
      if ((obj.size || 0) <= 0 && obj.customMetadata?.folderMarker === '1') continue;
      files += 1;
    }
    cursor = listed.truncated ? listed.cursor : undefined;
  } while (cursor);
  return files;
}

async function deletePrefix(env, folder) {
  const prefix = `${folder}/`;
  let deleted = 0;
  let cursor;
  // R2 list+delete loop (cursor invalid after deletes — always restart from start)
  for (;;) {
    const listed = await env.BUCKET.list({ prefix, limit: 1000 });
    const keys = (listed.objects || []).map((o) => o.key).filter(Boolean);
    if (!keys.length) break;
    await Promise.all(keys.map((k) => env.BUCKET.delete(k)));
    deleted += keys.length;
    if (!listed.truncated) break;
  }
  return deleted;
}

async function renamePrefix(env, from, to) {
  const src = `${from}/`;
  const dst = `${to}/`;
  let moved = 0;
  let cursor;
  do {
    const listed = await env.BUCKET.list({
      prefix: src,
      limit: 100,
      cursor,
      include: ['httpMetadata', 'customMetadata'],
    });
    for (const obj of listed.objects || []) {
      const oldKey = obj.key;
      if (!oldKey) continue;
      const newKey = dst + oldKey.slice(src.length);
      const body = await env.BUCKET.get(oldKey);
      if (!body) continue;
      await env.BUCKET.put(newKey, body.body, {
        httpMetadata: body.httpMetadata,
        customMetadata: {
          ...(body.customMetadata || {}),
          folder: folderFromKey(newKey) || '',
        },
      });
      await env.BUCKET.delete(oldKey);
      moved += 1;
    }
    cursor = listed.truncated ? listed.cursor : undefined;
  } while (cursor);

  // Ensure destination marker exists
  const markerKey = `${to}/.keep`;
  if (!(await env.BUCKET.head(markerKey))) {
    await env.BUCKET.put(markerKey, '', {
      httpMetadata: { contentType: 'application/x-directory' },
      customMetadata: { folderMarker: '1' },
    });
  }
  return moved;
}

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
    const withStats = searchParams.get('stats') === '1';

    if (parent === null) {
      return json({ success: false, error: '父目录路径非法' }, 400);
    }

    const all = await collectFolders(env, parent);
    const list = [...all].sort((a, b) => a.localeCompare(b, 'zh'));

    const children = parent
      ? list.filter((f) => {
          if (!f.startsWith(`${parent}/`)) return false;
          const rest = f.slice(parent.length + 1);
          return rest.length > 0 && !rest.includes('/');
        })
      : list.filter((f) => !f.includes('/'));

    const items = [];
    for (const path of list) {
      const depth = path.split('/').length - 1;
      const childCount = list.filter(
        (f) => f.startsWith(`${path}/`) && !f.slice(path.length + 1).includes('/'),
      ).length;
      const item = { path, depth, childCount };
      if (withStats) {
        item.files = await countObjectsUnder(env, path);
      }
      items.push(item);
    }

    return json({
      success: true,
      folders: list,
      items,
      children,
      parent: parent || '',
      count: list.length,
    });
  } catch (err) {
    return json({ success: false, error: err?.message || '获取文件夹失败' }, 500);
  }
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const gate = await requireUser(request, env);
  if (gate.error) return gate.error;

  if (!env.BUCKET) {
    return json({ success: false, error: '未绑定 R2' }, 500);
  }

  try {
    const body = await request.json().catch(() => ({}));

    // Rename: { action: 'rename', from, to }
    if (body.action === 'rename') {
      const from = normalizeFolder(body.from || '');
      const to = normalizeFolder(body.to || '');
      if (!from || !to || from === null || to === null) {
        return json({ success: false, error: '重命名路径无效' }, 400);
      }
      if (to === from || to.startsWith(`${from}/`)) {
        return json({ success: false, error: '目标路径不能是自身或其子路径' }, 400);
      }
      const conflict = await env.BUCKET.list({ prefix: `${to}/`, limit: 1 });
      if (conflict.objects?.length) {
        return json({ success: false, error: '目标文件夹已存在' }, 409);
      }
      const moved = await renamePrefix(env, from, to);
      return json({ success: true, from, to, moved, message: '已重命名' });
    }

    let folder;
    if (body.parent != null && String(body.parent).trim() !== '') {
      const parent = normalizeFolder(body.parent);
      const name = normalizeFolder(body.name || body.folder || '');
      if (parent === null || name === null || !name) {
        return json({ success: false, error: '文件夹名称无效' }, 400);
      }
      folder = normalizeFolder(`${parent}/${name}`);
    } else {
      folder = normalizeFolder(body.name || body.folder || '');
    }

    if (folder === null || !folder) {
      return json({ success: false, error: '文件夹名称无效' }, 400);
    }

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
    return json({ success: false, error: err?.message || '操作失败' }, 500);
  }
}

export async function onRequestDelete(context) {
  const { request, env } = context;
  const gate = await requireUser(request, env);
  if (gate.error) return gate.error;

  if (!env.BUCKET) {
    return json({ success: false, error: '未绑定 R2' }, 500);
  }

  try {
    const { searchParams } = new URL(request.url);
    let folder = (searchParams.get('folder') || searchParams.get('path') || '').trim();
    if (!folder) {
      const body = await request.json().catch(() => ({}));
      folder = String(body.folder || body.path || body.name || '').trim();
    }
    folder = normalizeFolder(folder);
    if (folder === null || !folder) {
      return json({ success: false, error: '缺少文件夹路径' }, 400);
    }

    const deleted = await deletePrefix(env, folder);
    return json({
      success: true,
      folder,
      deleted,
      message: `已删除文件夹及 ${deleted} 个对象`,
    });
  } catch (err) {
    return json({ success: false, error: err?.message || '删除失败' }, 500);
  }
}

export async function onRequest(context) {
  const method = context.request.method;
  if (method === 'OPTIONS') return handleOptions();
  if (method === 'GET') return onRequestGet(context);
  if (method === 'POST') return onRequestPost(context);
  if (method === 'DELETE') return onRequestDelete(context);
  return json({ success: false, error: '不支持的方法' }, 405);
}
