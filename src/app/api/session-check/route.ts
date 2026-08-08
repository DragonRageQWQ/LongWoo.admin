import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getOrCreateProfile } from '@/lib/profile'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const user = await getSessionUser()

    if (!user) {
      return NextResponse.json({ loggedIn: false })
    }

    // 使用 admin 客户端查询 profile，绕过 anon key 的 API 问题
    const admin = createAdminClient()
    const { data: existingProfile, error: profileError } = await admin
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle()

    if (profileError) throw new Error(profileError.message)
    const profile = existingProfile ?? await getOrCreateProfile(admin, user.id, {
      email: user.email,
    })
    if (!profile.is_active) {
      return NextResponse.json({ loggedIn: false }, {
        headers: { 'Cache-Control': 'no-store' },
      })
    }

    return NextResponse.json({
      loggedIn: true,
      profile: profile ? {
        display_name: profile.display_name,
        avatar_url: profile.avatar_url,
        role: profile.role,
        uid: profile.uid,
      } : null,
    }, { headers: { 'Cache-Control': 'no-store' } })
  } catch (error) {
    console.error(
      '[Session Check] 异常:',
      error instanceof Error ? error.message : String(error)
    )
    return NextResponse.json({ loggedIn: false })
  }
}
