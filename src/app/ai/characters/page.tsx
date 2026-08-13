'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type { AiCharacter } from '@/types/database'
import BottomNav from '@/components/layout/BottomNav'
import { useLanguage } from '@/components/i18n/LanguageProvider'

// ===== 内联 SVG 图标 =====
const BackIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 12H5" /><path d="M12 19l-7-7 7-7" />
  </svg>
)

const PlusIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 5v14" /><path d="M5 12h14" />
  </svg>
)

const SparkleIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3l1.9 5.8L20 10.7l-6.1 1.9L12 18.4l-1.9-5.8L4 10.7l6.1-1.9z" />
  </svg>
)

const ChatIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
)

const EditIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
)

// ===== 头像组件（无头像显示名字首字） =====
function CharacterAvatar({ character, size = 56 }: { character: AiCharacter; size?: number }) {
  if (character.avatar_url) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={character.avatar_url}
        alt={character.name}
        width={size}
        height={size}
        style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover' }}
        loading="lazy"
      />
    )
  }
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: size * 0.4,
        fontWeight: 700,
        color: '#fff',
        background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
      }}
    >
      {character.name.charAt(0)}
    </div>
  )
}

/**
 * 龙灵工坊首页：AI 角色列表
 * 展示当前账号的所有角色，点击进入对话，可创建新角色
 */
export default function CharactersPage() {
  const router = useRouter()
  const { t } = useLanguage()
  const [characters, setCharacters] = useState<AiCharacter[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/ai/characters', { credentials: 'include' })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setCharacters(data.characters ?? [])
        } else {
          setError(data.error || t('ai.characters.err.loadFailed'))
        }
      })
      .catch(() => setError(t('ai.characters.err.networkError')))
      .finally(() => setLoading(false))
  }, [t])

  if (loading) {
    return (
      <div className="page-wrapper">
        <TopBar />
        <div className="loading-wrap">
          <div className="spinner" />
          <span>{t('ai.characters.loading')}</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="page-wrapper">
        <TopBar />
        <div className="empty-wrap">
          <div className="empty-icon"><SparkleIcon /></div>
          <p className="empty-desc">{error}</p>
          <button className="btn-primary" onClick={() => router.push('/login')}>{t('ai.characters.relogin')}</button>
        </div>
      </div>
    )
  }

  const isEmpty = !characters || characters.length === 0

  return (
    <div className="page-wrapper" style={{ paddingBottom: 'calc(64px + 1.5rem)' }}>
      <TopBar />

      {isEmpty ? (
        <div className="empty-wrap">
          <div className="empty-icon"><SparkleIcon /></div>
          <h2 className="empty-title">{t('ai.characters.emptyTitle')}</h2>
          <p className="empty-desc">
            {t('ai.characters.emptyDesc1')}<br />
            {t('ai.characters.emptyDesc2')}
          </p>
          <Link href="/ai/characters/new" className="empty-create-btn">
            <PlusIcon />
            {t('ai.characters.add')}
          </Link>
        </div>
      ) : (
        <>
          <div className="character-list">
            {characters.map(char => (
              <div key={char.id} className="character-card-wrap">
                <Link
                  href={`/ai/characters/${char.id}`}
                  className="character-card"
                >
                  <CharacterAvatar character={char} size={48} />
                  <div className="character-info">
                    <div className="character-name-row">
                      <span className="character-name">{char.name}</span>
                      <ChatIcon />
                    </div>
                    <p className="character-desc">
                      {char.persona?.slice(0, 40) || (char.user_nickname ? `叫你「${char.user_nickname}」` : t('ai.characters.noPersona'))}
                      {char.persona && char.persona.length > 40 ? '…' : ''}
                    </p>
                  </div>
                </Link>
                <Link
                  href={`/ai/characters/${char.id}/edit`}
                  className="character-card-edit"
                  title={t('ai.characters.editTitle')}
                  aria-label={t('ai.characters.editTitle')}
                >
                  <EditIcon />
                </Link>
              </div>
            ))}
          </div>

          <div className="character-list-footer">
            <Link href="/ai/characters/new" className="footer-create-btn">
              <PlusIcon />
              {t('ai.characters.add')}
            </Link>
          </div>
        </>
      )}

      {/* 底部固定导航栏（与首页一致） */}
      <BottomNav />
    </div>
  )
}

function TopBar() {
  const { t } = useLanguage()
  return (
    <header className="top-bar">
      <div className="top-bar-left">
        <Link href="/" className="top-back" aria-label={t('ai.characters.backHome')}><BackIcon /></Link>
        <div>
          <h1 className="top-title">{t('nav.lingWork')}</h1>
          <span className="top-sub">{t('ai.characters.subtitle')}</span>
        </div>
      </div>
    </header>
  )
}
