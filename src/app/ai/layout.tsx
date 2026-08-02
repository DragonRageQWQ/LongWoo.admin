import type { Metadata } from 'next'
import './ai-styles.css'

export const metadata: Metadata = {
  title: '龙灵工坊 - LongWoo Studio',
  description: '创建你的专属 AI 角色，和它自由对话。LongWoo 龙坞 AI 角色扮演。',
  robots: { index: false, follow: false },
}

/**
 * 龙灵工坊共享布局
 * 负责导入共享样式，所有 /ai/* 页面共用
 */
export default function AiLayout({ children }: { children: React.ReactNode }) {
  return children
}
