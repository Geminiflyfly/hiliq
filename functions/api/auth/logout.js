import {
  clearSessionCookieHeader,
  destroySession,
  parseCookies,
  SESSION_COOKIE,
} from '../../auth.js';
import { handleOptions, json } from '../../utils.js';

export async function onRequestOptions() {
  return handleOptions();
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const cookies = parseCookies(request);
  const sessionId = cookies[SESSION_COOKIE];

  try {
    if (env.DB && sessionId) {
      await destroySession(env, sessionId);
    }
    return json(
      { success: true, message: '已退出' },
      200,
      { 'Set-Cookie': clearSessionCookieHeader() },
    );
  } catch (err) {
    return json({ success: false, error: err?.message || '退出失败' }, 500);
  }
}

export async function onRequest(context) {
  if (context.request.method === 'OPTIONS') return handleOptions();
  if (context.request.method === 'POST') return onRequestPost(context);
  return json({ success: false, error: '仅支持 POST' }, 405);
}
