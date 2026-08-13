import { redirect } from 'next/navigation'
import dynamic from 'next/dynamic'
import { cookies } from 'next/headers'
import { translate, type Lang } from '@/lib/i18n/dict'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSessionUser } from '@/lib/supabase/server'
import { isValidUUID } from '@/lib/order-utils'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'

// 性能优化：CharacterEditForm（448 行客户端组件）按需加载，避免阻塞首屏渲染
const CharacterEditForm = dynamic(() => import('../../../components/CharacterEditForm'), {
  loading: () => (
    <div className="space-y-4" aria-hidden="true">
      <div className="h-10 w-40 bg-gray-100 rounded animate-pulse" />
      <div className="h-12 bg-gray-100 rounded-lg animate-pulse" />
      <div className="h-32 bg-gray-100 rounded-lg animate-pulse" />
      <div className="h-12 bg-gray-100 rounded-lg animate-pulse" />
      <div className="h-12 bg-lw-accent/20 rounded-lg animate-pulse" />
    </div>
  ),
})

/**
 * 龙灵工坊：编辑角色
 * 服务端获取角色数据，交给客户端表单组件
 * 采用与委托提交页面一致的布局设计
 */
export default async function EditCharacterPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  // 服务端读取语言 cookie（与根布局注入 LanguageProvider 的方式一致，避免 hydration mismatch）
  const lang: Lang = (await cookies()).get('lw_lang')?.value === 'en' ? 'en' : 'zh'
  const t = (key: string) => translate(lang, key)

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
          <h1 className="text-2xl font-bold text-lw-black">{t('ai.edit.title')}</h1>
          <p className="mt-2 text-sm text-gray-500">
            {t('ai.edit.subtitle')}
          </p>
        </div>

        {/* 表单卡片 */}
        <CharacterEditForm mode="edit" characterId={id} initial={character} />
      </main>

      <Footer />
    </div>
  )
}
