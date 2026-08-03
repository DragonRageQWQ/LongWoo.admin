import { redirect } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSessionUser } from '@/lib/supabase/server'
import { isValidUUID } from '@/lib/order-utils'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import CharacterEditForm from '../../../components/CharacterEditForm'

/**
 * 龙灵工坊：编辑角色
 * 服务端获取角色数据，交给客户端表单组件
 * 采用与委托提交页面一致的布局设计
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
    <div className="min-h-screen flex flex-col bg-lw-gray">
      <Header />

      <main className="flex-1 max-w-3xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* 页面标题 */}
        <div className="text-center mb-10">
          <h1 className="text-2xl font-bold text-lw-black">编辑角色</h1>
          <p className="mt-2 text-sm text-gray-500">
            调整它的设定，随时让它焕然一新
          </p>
        </div>

        {/* 表单卡片 */}
        <CharacterEditForm mode="edit" characterId={id} initial={character} />
      </main>

      <Footer />
    </div>
  )
}
