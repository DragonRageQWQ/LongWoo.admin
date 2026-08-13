import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { translate, type Lang } from '@/lib/i18n/dict'
import './ai-styles.css'

export async function generateMetadata(): Promise<Metadata> {
  // 服务端读取语言 cookie（与根布局注入 LanguageProvider 的方式一致，避免 hydration mismatch）
  const lang: Lang = (await cookies()).get('lw_lang')?.value === 'en' ? 'en' : 'zh'
  const t = (key: string) => translate(lang, key)
  return {
    title: t('ai.layout.title'),
    description: t('ai.layout.desc'),
    robots: { index: false, follow: false },
  }
}

/**
 * 龙灵工坊共享布局
 * 负责导入共享样式，所有 /ai/* 页面共用
 */
export default function AiLayout({ children }: { children: React.ReactNode }) {
  return children
}
