import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  try {
    const user = await getSessionUser()

    if (!user) {
      return NextResponse.json({ loggedIn: false })
    }

    // 使用 admin 客户端查询 profile，绕过 anon key 的 API 问题
    const admin = createAdminClient()
    const { data: profile } = await admin
      .from('profiles')
      .select('display_name, avatar_url, role, uid')
      .eq('id', user.id)
      .single()

    return NextResponse.json({
      loggedIn: true,
      profile: profile ? {
        display_name: profile.display_name,
        avatar_url: profile.avatar_url,
        role: profile.role,
        uid: profile.uid,
      } : null,
    })
  } catch {
    return NextResponse.json({ loggedIn: false })
  }
}
