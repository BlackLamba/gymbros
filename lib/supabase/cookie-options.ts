/**
 * Параметры cookie с сессией.
 * httpOnly: скрипты в браузере не могут прочитать токен — браузеру он и не нужен,
 * с Supabase разговаривает только сервер.
 * secure: на Vercel сайт всегда открывается по HTTPS; локально (http://localhost) флаг выключен.
 */
export const authCookieOptions = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.VERCEL === '1',
  path: '/',
}
