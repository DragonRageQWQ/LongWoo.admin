import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options))
        }
      }
    }
  )

  // 使用 getUser() 而非 getSession()，确保 JWT 与 Supabase 服务器验证
  // getSession() 仅从 cookie 读取，不验证有效性，可被伪造
  const { data: { user } } = await supabase.auth.getUser()

  const protectedPaths = ['/studio', '/admin', '/profile']
  const isAdminOnlyPath = request.nextUrl.pathname.startsWith('/admin') ||
    request.nextUrl.pathname.startsWith('/studio')

  if (!user && protectedPaths.some(p =>
    request.nextUrl.pathname.startsWith(p))) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // /admin 和 /studio 均要求管理员权限
  if (user && isAdminOnlyPath) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()
    if (profile?.role !== 'admin') {
      return NextResponse.redirect(
        new URL('/profile', request.url))
    }
  }

  return response
}

export const config = {
  matcher: ['/studio/:path*', '/admin/:path*', '/profile/:path*']
}
