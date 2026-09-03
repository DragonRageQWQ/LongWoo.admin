'use client'

/**
 * LW-I18N 语言切换器（旧版页面顶部 / 登录页使用）
 * 全站统一为「地球 icon + hover 提示 + 点击语言下拉」：委托 GlobeLangMenu 渲染，
 * 列表由 LANG_META 驱动（未来新增语言自动出现）；选择后整站语言生效（写
 * cookie/localStorage 并跳转 ?lang=，由 LanguageProvider.setLang 实现）。
 */
import { useLanguage } from '@/components/i18n/LanguageProvider'
import GlobeLangMenu from '@/components/i18n/GlobeLangMenu'

export default function LangSwitcher({ enabled = true }: { enabled?: boolean }) {
  const { lang, setLang, t } = useLanguage()
  if (!enabled) return null
  return (
    <GlobeLangMenu value={lang} onSelect={(next) => setLang(next)} tip={t('lang.switchHint')} />
  )
}
