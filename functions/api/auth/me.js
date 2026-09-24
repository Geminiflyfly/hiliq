import { countUsers, ensureSchema, getSessionUser } from '../../auth.js';
import { handleOptions, json } from '../../utils.js';

export async function onRequestOptions() {
  return handleOptions();
}

export async function onRequestGet(context) {
  const { request, env } = context;

  try {
    if (!env.DB) {
      return json({
        success: true,
        user: null,
        needSetup: false,
        authEnabled: false,
        error: null,
      });
    }

    await ensureSchema(env);
    const needSetup = (await countUsers(env)) === 0;
    const user = await getSessionUser(request, env);
    return json({
      success: true,
      user,
      needSetup,
      authEnabled: true,
    });
  } catch (err) {
    return json({
      success: false,
      user: null,
      needSetup: false,
      authEnabled: Boolean(env.DB),
      error: err?.message || '获取状态失败',
    }, 500);
  }
}

export async function onRequest(context) {
  if (context.request.method === 'OPTIONS') return handleOptions();
  if (context.request.method === 'GET') return onRequestGet(context);
  return json({ success: false, error: '仅支持 GET' }, 405);
}
