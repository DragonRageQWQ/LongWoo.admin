import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * 中间件：三级权限路由保护
 *
 * 权限模型：
 *   游客 (未登录)      → 仅可访问公开页面，受保护路径重定向到 /login
 *   普通用户 (role=user) → 可访问 /profile（个人中心），不可访问 /admin/* 和 /studio/*
 *   管理员 (role=admin)  → 可访问所有路径（/admin/*, /studio/*, /profile）
 *
 * 零号用户 (uid=10001) 是超级管理员，拥有管理员权限并管理角色授权
 */
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

  const pathname = request.nextUrl.pathname

  // 受保护路径：需要登录才能访问
  const protectedPaths = ['/studio', '/admin', '/profile']
  // 仅管理员可访问的路径
  const adminOnlyPaths = ['/admin', '/studio']

  // 未登录用户访问受保护路径 → 重定向到登录页
  if (!user && protectedPaths.some(p => pathname.startsWith(p))) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // 已登录用户访问管理员专属路径 → 检查角色
  if (user && adminOnlyPaths.some(p => pathname.startsWith(p))) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    // 非管理员访问 /admin/* 或 /studio/* → 重定向到个人中心（防越级）
    if (profile?.role !== 'admin') {
      return NextResponse.redirect(new URL('/profile', request.url))
    }
  }

  return response
}

export const config = {
  // 匹配 /admin/*, /studio/*, /profile（含子路径和根路径）
  matcher: ['/studio/:path*', '/admin/:path*', '/profile/:path*', '/profile']
}
