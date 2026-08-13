'use client'

/**
 * LW-I18N 语言切换器（动态页）
 * 全站语言功能整体上线前，enabled 保持 false：组件不渲染任何内容（功能未上线）；
 * 上线时将 enabled 置 true 即可在页面渲染「中 / EN」切换按钮。
 */
import { useLanguage } from '@/components/i18n/LanguageProvider'

export default function LangSwitcher({ enabled = true }: { enabled?: boolean }) {
  const { lang, setLang } = useLanguage()
  if (!enabled) return null
  return (
    <div className="lw-lang-switcher inline-flex items-center gap-1 text-sm">
      <button
        type="button"
        onClick={() => setLang('zh')}
        className={`cursor-pointer px-1.5 py-0.5 rounded ${
          lang === 'zh' ? 'text-lw-accent font-bold' : 'text-gray-400 hover:text-gray-600'
        }`}
      >
        中
      </button>
      <span className="text-gray-300">/</span>
      <button
        type="button"
        onClick={() => setLang('en')}
        className={`cursor-pointer px-1.5 py-0.5 rounded ${
          lang === 'en' ? 'text-lw-accent font-bold' : 'text-gray-400 hover:text-gray-600'
        }`}
      >
        EN
      </button>
    </div>
  )
}
