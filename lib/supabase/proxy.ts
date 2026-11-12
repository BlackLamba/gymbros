import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { authCookieOptions } from '@/lib/supabase/cookie-options'

/**
 * Обновляет сессию Supabase и делает быстрый редирект гостей на /login.
 * Это удобство, а не граница безопасности: доступ к данным проверяется
 * в каждой серверной операции и политиками RLS в базе.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request })

  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_PUBLISHABLE_KEY
  if (!url || !key) return response

  const supabase = createServerClient(url, key, {
    cookieOptions: authCookieOptions,
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        response = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
        Object.entries(headers ?? {}).forEach(([k, v]) => response.headers.set(k, v))
      },
    },
  })

  // Между созданием клиента и getClaims() не должно быть другого кода:
  // именно этот вызов проверяет токен и при необходимости обновляет его.
  const { data } = await supabase.auth.getClaims()
  const isSignedIn = Boolean(data?.claims?.sub)

  const { pathname } = request.nextUrl
  const isLogin = pathname === '/login'
  const isApi = pathname.startsWith('/api/')

  if (!isSignedIn && !isLogin && !isApi) {
    return redirectWithCookies(request, response, '/login')
  }
  if (isSignedIn && isLogin) {
    return redirectWithCookies(request, response, '/')
  }
  return response
}

function redirectWithCookies(request: NextRequest, from: NextResponse, pathname: string) {
  const url = request.nextUrl.clone()
  url.pathname = pathname
  url.search = ''
  const redirect = NextResponse.redirect(url)
  from.cookies.getAll().forEach((c) => redirect.cookies.set(c))
  return redirect
}
