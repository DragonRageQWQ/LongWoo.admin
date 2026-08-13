'use client'

/**
 * LW-I18N 动态页语言上下文
 * 语言读取优先级：URL 参数 ?lang= → cookie(lw_lang) → localStorage(lw_lang) → zh
 * 提供 { lang, t, setLang }；切换时写入 cookie + localStorage 并整页跳转（带 ?lang=）。
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { translate, type Lang } from '@/lib/i18n/dict'

const STORAGE_KEY = 'lw_lang'

export function detectLang(): Lang {
  if (typeof window === 'undefined') return 'zh'
  const urlLang = new URLSearchParams(window.location.search).get('lang')
  if (urlLang === 'en' || urlLang === 'zh') return urlLang
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'en' || stored === 'zh') return stored
  } catch {
    /* ignore */
  }
  const cookie = document.cookie
    .split('; ')
    .find((c) => c.startsWith(`${STORAGE_KEY}=`))
  if (cookie) {
    const v = cookie.split('=')[1]
    if (v === 'en' || v === 'zh') return v
  }
  return 'zh'
}

interface LanguageContextValue {
  lang: Lang
  t: (key: string) => string
  setLang: (lang: Lang) => void
}

const LanguageContext = createContext<LanguageContextValue>({
  lang: 'zh',
  t: (k) => k,
  setLang: () => {},
})

/**
 * 语言提供器
 * - SSR 阶段使用服务端注入的 initialLang（来自 cookie），保证服务端渲染与
 *   客户端首次渲染一致（避免 hydration mismatch）。
 * - 客户端挂载后，通过 detectLang() 以 URL 参数 → localStorage → cookie 的
 *   优先级做一次修正（覆盖开发预览 ?lang=en 等场景）。
 */
export function LanguageProvider({
  children,
  initialLang = 'zh',
}: {
  children: ReactNode
  initialLang?: Lang
}) {
  const [lang, setLangState] = useState<Lang>(initialLang)

  useEffect(() => {
    // 挂载后按 URL 参数/localStorage 修正一次；此为 hydration-safe 的标准模式，
    // SSR 首帧已与服务端 initialLang 一致，此处仅为客户端覆盖（URL/localStorage 优先级更高）
    // eslint-disable-next-line react-hooks/set-state-in-effect
    const detected = detectLang()
    if (detected !== lang) setLangState(detected)
  }, [])

  const t = useCallback(
    (key: string) => translate(lang, key),
    [lang]
  )

  const setLang = useCallback((next: Lang) => {
    setLangState(next)
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      /* ignore */
    }
    document.cookie = `${STORAGE_KEY}=${next}; path=/; max-age=31536000; SameSite=Lax`
    const url = new URL(window.location.href)
    url.searchParams.set('lang', next)
    window.location.href = url.toString()
  }, [])

  const value = useMemo(() => ({ lang, t, setLang }), [lang, t, setLang])

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

export function useLanguage() {
  return useContext(LanguageContext)
}
