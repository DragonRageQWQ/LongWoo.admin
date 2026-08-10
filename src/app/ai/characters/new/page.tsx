import dynamic from 'next/dynamic'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'

// 性能优化：CharacterEditForm（448 行客户端组件）按需加载，避免阻塞首屏渲染
const CharacterEditForm = dynamic(() => import('../../components/CharacterEditForm'), {
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
 * 龙灵工坊：创建新角色
 * 采用与委托提交页面一致的布局设计
 */
export default function NewCharacterPage() {
  return (
    <div className="min-h-screen flex flex-col bg-lw-gray">
      <Header />

      <main className="flex-1 max-w-3xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* 页面标题 */}
        <div className="text-center mb-10">
          <h1 className="text-2xl font-bold text-lw-black">创建角色</h1>
          <p className="mt-2 text-sm text-gray-500">
            设定名字、人设和称呼，赋予灵龙生命
          </p>
        </div>

        {/* 表单卡片 */}
        <CharacterEditForm mode="create" />
      </main>

      <Footer />
    </div>
  )
}
