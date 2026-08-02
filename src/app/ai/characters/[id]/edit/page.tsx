import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSessionUser } from '@/lib/supabase/server'
import { isValidUUID } from '@/lib/order-utils'
import CharacterEditForm from '../../../components/CharacterEditForm'

const BackIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 16, height: 16 }}>
    <path d="M19 12H5" /><path d="M12 19l-7-7 7-7" />
  </svg>
)

/**
 * 龙灵工坊：编辑角色
 * 服务端获取角色数据，交给客户端表单组件
 */
export default async function EditCharacterPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  // ID 校验
  if (!isValidUUID(id)) {
    redirect('/ai/characters')
  }

  // 获取当前用户（中间件已保护 /ai/*，此处兜底）
  const user = await getSessionUser()
  if (!user) {
    redirect('/login')
  }

  // 查询角色并校验归属
  const admin = createAdminClient()
  const { data: character, error } = await admin
    .from('ai_characters')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (error || !character) {
    redirect('/ai/characters')
  }

  return (
    <div className="page-wrapper">
      <header className="top-bar">
        <div className="top-bar-left">
          <Link href={`/ai/characters/${id}`} className="top-back" aria-label="返回"><BackIcon /></Link>
          <div>
            <h1 className="top-title">编辑角色</h1>
            <span className="top-sub">调整它的设定</span>
          </div>
        </div>
      </header>
      <CharacterEditForm mode="edit" characterId={id} initial={character} />
    </div>
  )
}
