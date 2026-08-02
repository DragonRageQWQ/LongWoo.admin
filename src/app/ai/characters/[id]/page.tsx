'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import type { AiCharacter, AiChatMessage } from '@/types/database'

// ===== 内联 SVG 图标 =====
const BackIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 12H5" /><path d="M12 19l-7-7 7-7" />
  </svg>
)

const EditIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
)

const SendIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 2L11 13" /><path d="M22 2l-7 20-4-9-9-4 20-7z" />
  </svg>
)

const TrashIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 6h18" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
    <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </svg>
)

const PlusIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 5v14" /><path d="M5 12h14" />
  </svg>
)

// ===== 头像（角色或用户） =====
function Avatar({ src, name, size, className }: { src?: string | null; name: string; size: number; className?: string }) {
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={name} className={className} style={{ width: size, height: size }} />
  }
  return (
    <div className={className} style={{ width: size, height: size, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: size * 0.4, fontWeight: 700 }}>
      {name.charAt(0)}
    </div>
  )
}

/**
 * 龙灵工坊：角色对话页
 * 用户与自己的 AI 角色自由对话，消息按账号 + 角色持久化保存
 */
export default function CharacterChatPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const characterId = params.id

  const [character, setCharacter] = useState<AiCharacter | null>(null)
  const [messages, setMessages] = useState<AiChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [clearing, setClearing] = useState(false)

  const messagesRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const initialGreetingShown = useRef(false)

  // 加载角色 + 历史消息
  useEffect(() => {
    if (!characterId) return
    fetch(`/api/ai/characters/${characterId}`, { credentials: 'include' })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setCharacter(data.character)
          setMessages(data.messages ?? [])
          // 无历史时展示开场白
          if ((data.messages ?? []).length === 0 && data.character.greeting) {
            setMessages([{
              id: 'greeting',
              character_id: characterId,
              user_id: '',
              role: 'assistant',
              content: data.character.greeting,
              created_at: new Date().toISOString(),
            }])
            initialGreetingShown.current = true
          }
        } else if (data.error === '未登录') {
          router.push('/login')
        } else {
          setError(data.error || '加载失败')
        }
      })
      .catch(() => setError('网络错误，请稍后重试'))
      .finally(() => setLoading(false))
  }, [characterId, router])

  // 滚动到底部
  useEffect(() => {
    if (messagesRef.current) {
      messagesRef.current.scrollTop = messagesRef.current.scrollHeight
    }
  }, [messages, sending])

  // 自动调整输入框高度
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value)
    const el = e.target
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 120) + 'px'
  }, [])

  // 发送消息
  const handleSend = useCallback(async () => {
    const content = input.trim()
    if (!content || sending || !characterId) return

    // 立即显示用户消息（乐观更新）
    const tempUserMsg: AiChatMessage = {
      id: `temp-${Date.now()}`,
      character_id: characterId,
      user_id: '',
      role: 'user',
      content,
      created_at: new Date().toISOString(),
    }
    setMessages(prev => [...prev, tempUserMsg])
    setInput('')
    setSending(true)
    setError(null)
    if (inputRef.current) {
      inputRef.current.style.height = 'auto'
    }

    try {
      const res = await fetch(`/api/ai/characters/${characterId}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
        credentials: 'include',
      })
      const data = await res.json()

      if (data.success) {
        // 用服务端返回的消息替换乐观更新的临时消息
        setMessages(prev => [
          ...prev.filter(m => m.id !== tempUserMsg.id),
          data.userMessage,
          data.assistantMessage,
        ])
      } else {
        // 失败：移除临时消息并显示错误
        setMessages(prev => prev.filter(m => m.id !== tempUserMsg.id))
        setError(data.error || '发送失败，请稍后重试')
      }
    } catch {
      setMessages(prev => prev.filter(m => m.id !== tempUserMsg.id))
      setError('网络错误，请稍后重试')
    } finally {
      setSending(false)
    }
  }, [input, sending, characterId])

  // 清空对话
  const handleClear = useCallback(async () => {
    if (!characterId || clearing) return
    if (!window.confirm('确定要清空和这个角色的全部对话记录吗？')) return

    setClearing(true)
    try {
      const res = await fetch(`/api/ai/characters/${characterId}/clear`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      })
      const data = await res.json()
      if (data.success) {
        setMessages([])
        if (character?.greeting) {
          setMessages([{
            id: 'greeting',
            character_id: characterId,
            user_id: '',
            role: 'assistant',
            content: character.greeting,
            created_at: new Date().toISOString(),
          }])
        }
      } else {
        setError(data.error || '清空失败')
      }
    } catch {
      setError('网络错误，请稍后重试')
    } finally {
      setClearing(false)
    }
  }, [characterId, clearing, character])

  // 键盘发送
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }, [handleSend])

  if (loading) {
    return (
      <div className="page-wrapper">
        <header className="top-bar">
          <div className="top-bar-left">
            <Link href="/ai/characters" className="top-back" aria-label="返回"><BackIcon /></Link>
            <h1 className="top-title">龙灵工坊</h1>
          </div>
        </header>
        <div className="loading-wrap">
          <div className="spinner" />
          <span>正在召唤角色…</span>
        </div>
      </div>
    )
  }

  if (error && !character) {
    return (
      <div className="page-wrapper">
        <header className="top-bar">
          <div className="top-bar-left">
            <Link href="/ai/characters" className="top-back" aria-label="返回"><BackIcon /></Link>
            <h1 className="top-title">龙灵工坊</h1>
          </div>
        </header>
        <div className="empty-wrap">
          <p className="empty-desc">{error}</p>
          <Link href="/ai/characters" className="btn-primary">返回角色列表</Link>
        </div>
      </div>
    )
  }

  const charName = character?.name || '角色'
  const charAvatar = character?.avatar_url || null

  return (
    <div className="page-wrapper">
      <header className="top-bar">
        <div className="top-bar-left">
          <Link href="/ai/characters" className="top-back" aria-label="返回"><BackIcon /></Link>
          <div>
            <h1 className="top-title">龙灵工坊</h1>
          </div>
        </div>
        <div className="top-actions">
          <Link href="/ai/characters/new" className="chat-create-btn" title="创建新角色" aria-label="创建新角色">
            <PlusIcon />
            新建
          </Link>
          <button className="icon-btn" onClick={handleClear} disabled={clearing} title="清空对话" aria-label="清空对话">
            <TrashIcon />
          </button>
          <Link href={`/ai/characters/${characterId}/edit`} className="icon-btn" title="调整角色设定" aria-label="调整角色设定">
            <EditIcon />
          </Link>
        </div>
      </header>

      <div className="chat-main">
        <div className="chat-header">
          <Avatar src={charAvatar} name={charName} size={40} className="chat-header-avatar" />
          <div className="chat-header-info">
            <h2 className="chat-header-name">{charName}</h2>
            <p className="chat-header-status">
              {character?.user_nickname ? `叫你「${character.user_nickname}」` : '和你的角色对话'}
            </p>
          </div>
          <Link href={`/ai/characters/${characterId}/edit`} className="btn-ghost" style={{ fontSize: 'var(--font-size-xs)', padding: '6px 12px', flexShrink: 0 }}>
            调整设定
          </Link>
        </div>

        <div className="chat-messages" ref={messagesRef}>
          {messages.length === 0 && (
            <div className="chat-empty-hint">
              <p className="chat-greeting">和{charName}打个招呼吧</p>
              <p>它会以你设定的人设回应你</p>
            </div>
          )}

          {messages.map(msg => (
            <div key={msg.id} className={`chat-message ${msg.role}`}>
              {msg.role === 'assistant' ? (
                <Avatar src={charAvatar} name={charName} size={30} className="chat-message-avatar" />
              ) : (
                <div className="chat-message-avatar" style={{ background: 'var(--color-primary)' }}>我</div>
              )}
              <div className="chat-bubble">{msg.content}</div>
            </div>
          ))}

          {sending && (
            <div className="chat-message assistant">
              <Avatar src={charAvatar} name={charName} size={30} className="chat-message-avatar" />
              <div className="chat-bubble typing">
                <span className="chat-typing-dot" />
                <span className="chat-typing-dot" />
                <span className="chat-typing-dot" />
              </div>
            </div>
          )}
        </div>

        {error && <p style={{ padding: '0 var(--space-lg)', fontSize: 'var(--font-size-sm)', color: 'var(--color-error)', textAlign: 'center' }}>{error}</p>}

        <div className="chat-input-bar">
          <textarea
            ref={inputRef}
            className="chat-input"
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={`对${charName}说点什么…`}
            rows={1}
            maxLength={4000}
          />
          <button
            className="chat-send-btn"
            onClick={handleSend}
            disabled={sending || !input.trim()}
            aria-label="发送"
          >
            <SendIcon />
          </button>
        </div>
      </div>
    </div>
  )
}
