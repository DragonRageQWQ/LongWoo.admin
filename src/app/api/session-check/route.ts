import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ loggedIn: false })
    }
    
    const { data: profile } = await supabase
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
