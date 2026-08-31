'use client'

import { useCallback, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Camera, Loader2, Trash2 } from 'lucide-react'
import Button from '@/components/ui/Button'
import { useLanguage } from '@/components/i18n/LanguageProvider'
import AvatarCropModal from '@/components/avatar/AvatarCropModal'
import type { AiCharacter } from '@/types/database'

const MAX_LENGTHS = {
  name: 30,
  persona: 2000,
  tone: 50,
  greeting: 300,
  user_nickname: 20,
}

// 语气风格预设
const TONE_PRESETS = ['温柔', '活泼', '傲娇', '高冷', '幽默', '可爱', '沉稳', '热情', '毒舌', '元气', '慵懒', '神秘']

const inputClass =
  'w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-lw-accent focus:border-transparent transition'

/**
 * 角色编辑表单（新建 / 编辑共用）
 * 采用与委托提交页面一致的卡片式 Tailwind 设计
 *
 * @param mode         'create' | 'edit'
 * @param characterId  编辑模式下的角色 ID
 * @param initial      编辑模式下加载的初始数据
 */
export default function CharacterEditForm({
  mode,
  characterId,
  initial,
}: {
  mode: 'create' | 'edit'
  characterId?: string
  initial?: AiCharacter | null
}) {
  const router = useRouter()
  const { t } = useLanguage()
  const fileInputRef = useRef<HTMLInputElement>(null)
  // 创建模式下保存选中的头像文件（input 的 value 会被清空，不能依赖 fileInputRef.current.files）
  const pendingAvatarFileRef = useRef<File | null>(null)

  const [name, setName] = useState(initial?.name || '')
  const [persona, setPersona] = useState(initial?.persona || '')
  const [tone, setTone] = useState(initial?.tone || '')
  const [greeting, setGreeting] = useState(initial?.greeting || '')
  const [userNickname, setUserNickname] = useState(initial?.user_nickname || '')
  const [avatarUrl, setAvatarUrl] = useState<string | null>(initial?.avatar_url || null)

  const [saving, setSaving] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // 头像裁切：选图后先进入裁切弹窗（null=未在裁切）
  const [cropSrc, setCropSrc] = useState<string | null>(null)

  // ===== 头像上传 =====
  const handleAvatarClick = () => {
    if (uploadingAvatar || saving) return
    fileInputRef.current?.click()
  }

  const handleAvatarChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    // 客户端预校验
    if (file.size > 2 * 1024 * 1024) {
      setError(t('ai.form.err.avatarTooLarge'))
      return
    }
    if (!['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(file.type)) {
      setError(t('ai.form.err.avatarFormat'))
      return
    }

    // 先进入裁切弹窗（自由选区 + 缩放），确认后再保存/上传
    setError(null)
    const reader = new FileReader()
    reader.onload = () => {
      setCropSrc(typeof reader.result === 'string' ? reader.result : null)
    }
    reader.onerror = () => setError(t('ai.form.err.avatarUploadRetry'))
    reader.readAsDataURL(file)
  }, [t])

  // 裁切确认：创建模式保存本地预览（随创建一并上传），编辑模式立即上传
  const handleCropConfirm = useCallback(async (blob: Blob) => {
    const file = new File([blob], 'avatar.jpg', { type: blob.type || 'image/jpeg' })

    if (mode === 'create') {
      pendingAvatarFileRef.current = file
      const localUrl = URL.createObjectURL(file)
      setAvatarUrl(localUrl)
      setCropSrc(null)
      return
    }

    setUploadingAvatar(true)
    setError(null)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch(`/api/ai/characters/${characterId}/avatar`, {
        method: 'POST',
        body: formData,
        credentials: 'include',
      })
      const data = await res.json()
      if (!data.success) {
        throw new Error(data.error || t('ai.form.err.avatarUploadFailed'))
      }
      setAvatarUrl(data.avatar_url)
      setCropSrc(null)
    } catch (err) {
      throw err instanceof Error ? err : new Error(t('ai.form.err.avatarUploadRetry'))
    } finally {
      setUploadingAvatar(false)
    }
  }, [mode, characterId, t])

  // ===== 保存 =====
  const handleSave = useCallback(async () => {
    const trimmedName = name.trim()
    if (!trimmedName) {
      setError(t('ai.form.err.nameRequired'))
      return
    }

    setSaving(true)
    setError(null)
    try {
      let finalAvatarUrl = avatarUrl

      // 创建模式：先创建角色，若本地预览了头像则上传
      if (mode === 'create') {
        const createRes = await fetch('/api/ai/characters', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: trimmedName,
            persona: persona.trim(),
            tone: tone.trim(),
            greeting: greeting.trim(),
            user_nickname: userNickname.trim(),
          }),
          credentials: 'include',
        })
        const createData = await createRes.json()
        if (!createData.success) {
          setError(createData.error || t('ai.form.err.createFailed'))
          setSaving(false)
          return
        }

        const newId = createData.character.id

        // 若创建前选择了头像（本地预览），现在用保存的文件引用上传
        if (finalAvatarUrl && finalAvatarUrl.startsWith('blob:')) {
          const file = pendingAvatarFileRef.current
          if (file) {
            const formData = new FormData()
            formData.append('file', file)
            const avatarRes = await fetch(`/api/ai/characters/${newId}/avatar`, {
              method: 'POST',
              body: formData,
              credentials: 'include',
            })
            const avatarData = await avatarRes.json()
            if (avatarData.success) finalAvatarUrl = avatarData.avatar_url
          }
        }

        router.push(`/ai/characters/${newId}`)
        router.refresh()
        return
      }

      // 编辑模式：PATCH 更新
      const res = await fetch(`/api/ai/characters/${characterId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: trimmedName,
          persona: persona.trim(),
          tone: tone.trim(),
          greeting: greeting.trim(),
          user_nickname: userNickname.trim(),
          avatar_url: avatarUrl,
        }),
        credentials: 'include',
      })
      const data = await res.json()
      if (data.success) {
        router.push(`/ai/characters/${characterId}`)
        router.refresh()
      } else {
        setError(data.error || t('ai.form.err.saveFailed'))
      }
    } catch {
      setError(t('ai.form.err.networkError'))
    } finally {
      setSaving(false)
    }
  }, [mode, characterId, name, persona, greeting, userNickname, avatarUrl, router, t])

  // ===== 删除角色 =====
  const handleDelete = useCallback(async () => {
    if (!characterId || deleting) return
    if (!window.confirm(`确定要删除角色「${name}」吗？它的全部对话记录也会被删除，此操作不可恢复。`)) return

    setDeleting(true)
    setError(null)
    try {
      const res = await fetch(`/api/ai/characters/${characterId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      })
      const data = await res.json()
      if (data.success) {
        router.push('/ai/characters')
        router.refresh()
      } else {
        setError(data.error || t('ai.form.err.deleteFailed'))
        setDeleting(false)
      }
    } catch {
      setError(t('ai.form.err.networkError'))
      setDeleting(false)
    }
  }, [characterId, name, deleting, router, t])

  return (
    <div className="bg-white rounded-2xl shadow-sm p-6 sm:p-8">
      {/* ===== 头像 ===== */}
      <div className="flex flex-col items-center gap-2 mb-6">
        <button
          type="button"
          onClick={handleAvatarClick}
          disabled={uploadingAvatar || saving}
          className="relative w-20 h-20 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white text-2xl font-bold overflow-hidden cursor-pointer group disabled:opacity-60"
        >
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarUrl} alt={t('ai.form.avatarAlt')} className="w-full h-full object-cover" />
          ) : (
            <span>{name.trim() ? name.charAt(0) : t('ai.form.avatarFallback')}</span>
          )}
          <span className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1">
            {uploadingAvatar ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Camera className="w-4 h-4" />
            )}
            <span className="text-[10px]">{t('ai.form.changeAvatar')}</span>
          </span>
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp"
          onChange={handleAvatarChange}
          className="hidden"
        />
        <p className="text-xs text-gray-400">
          {uploadingAvatar ? t('ai.form.uploading') : t('ai.form.avatarHint')}
        </p>
      </div>

      {/* ===== 表单字段 ===== */}
      <div className="space-y-5">
        {/* 名字 */}
        <div>
          <label className="block text-sm font-medium text-lw-black mb-1.5">
            {t('ai.form.nameLabel')} <span className="text-red-500">*</span>
            <span className="text-xs text-gray-400 font-normal ml-2">{t('ai.form.nameHint')}</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('ai.form.namePh')}
            maxLength={MAX_LENGTHS.name}
            className={inputClass}
          />
          <p className="mt-1.5 text-xs text-gray-400 text-right">
            {name.length}/{MAX_LENGTHS.name}
          </p>
        </div>

        {/* 称呼 */}
        <div>
          <label className="block text-sm font-medium text-lw-black mb-1.5">
            {t('ai.form.nicknameLabel')}
            <span className="text-xs text-gray-400 font-normal ml-2">{t('ai.form.nicknameHint')}</span>
          </label>
          <input
            type="text"
            value={userNickname}
            onChange={(e) => setUserNickname(e.target.value)}
            placeholder={t('ai.form.nicknamePh')}
            maxLength={MAX_LENGTHS.user_nickname}
            className={inputClass}
          />
          <p className="mt-1.5 text-xs text-gray-400 text-right">
            {userNickname.length}/{MAX_LENGTHS.user_nickname}
          </p>
        </div>

        {/* 人设 */}
        <div>
          <label className="block text-sm font-medium text-lw-black mb-1.5">
            {t('ai.form.personaLabel')}
            <span className="text-xs text-gray-400 font-normal ml-2">{t('ai.form.personaHint')}</span>
          </label>
          <textarea
            rows={5}
            value={persona}
            onChange={(e) => setPersona(e.target.value)}
            placeholder={t('ai.form.personaPh')}
            maxLength={MAX_LENGTHS.persona}
            className={`${inputClass} resize-none`}
          />
          <p className="mt-1.5 text-xs text-gray-400 text-right">
            {persona.length}/{MAX_LENGTHS.persona}
          </p>
        </div>

        {/* 语气风格 */}
        <div>
          <label className="block text-sm font-medium text-lw-black mb-1.5">
            {t('ai.form.toneLabel')}
            <span className="text-xs text-gray-400 font-normal ml-2">{t('ai.form.toneHint')}</span>
          </label>
          <div className="flex flex-wrap gap-2 mb-2">
            {TONE_PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                className={`px-3 py-1.5 text-sm rounded-full border transition cursor-pointer ${
                  tone === preset
                    ? 'bg-lw-accent text-white border-lw-accent'
                    : 'bg-white text-lw-black border-gray-200 hover:border-gray-300'
                }`}
                onClick={() => setTone(tone === preset ? '' : preset)}
              >
                {t(`ai.form.tone.${preset}`)}
              </button>
            ))}
          </div>
          <input
            type="text"
            value={tone}
            onChange={(e) => setTone(e.target.value)}
            placeholder={t('ai.form.tonePh')}
            maxLength={MAX_LENGTHS.tone}
            className={inputClass}
          />
          <p className="mt-1.5 text-xs text-gray-400 text-right">
            {tone.length}/{MAX_LENGTHS.tone}
          </p>
        </div>

        {/* 开场白 */}
        <div>
          <label className="block text-sm font-medium text-lw-black mb-1.5">
            {t('ai.form.greetingLabel')}
            <span className="text-xs text-gray-400 font-normal ml-2">{t('ai.form.greetingHint')}</span>
          </label>
          <input
            type="text"
            value={greeting}
            onChange={(e) => setGreeting(e.target.value)}
            placeholder={t('ai.form.greetingPh')}
            maxLength={MAX_LENGTHS.greeting}
            className={inputClass}
          />
          <p className="mt-1.5 text-xs text-gray-400 text-right">
            {greeting.length}/{MAX_LENGTHS.greeting}
          </p>
        </div>
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="mt-4 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
          {error}
        </div>
      )}

      {/* ===== 底部操作按钮 ===== */}
      <div className="flex gap-3 mt-8 pt-6 border-t border-gray-100">
        {mode === 'edit' && characterId ? (
          <>
            <Button
              variant="outline"
              onClick={handleDelete}
              disabled={deleting || saving}
              className="flex-1"
            >
              {deleting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                  {t('ai.form.deleting')}
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4 mr-1" />
                  {t('ai.form.delete')}
                </>
              )}
            </Button>
            <Button
              variant="primary"
              onClick={handleSave}
              disabled={saving || !name.trim()}
              className="flex-1"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                  {t('ai.form.saving')}
                </>
              ) : (
                t('ai.form.save')
              )}
            </Button>
          </>
        ) : (
          <>
            <Button
              variant="outline"
              onClick={() => router.push('/ai/characters')}
              disabled={saving}
              className="flex-1"
            >
              {t('ai.form.cancel')}
            </Button>
            <Button
              variant="primary"
              onClick={handleSave}
              disabled={saving || !name.trim()}
              className="flex-1"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                  {t('ai.form.creating')}
                </>
              ) : (
                t('ai.form.create')
              )}
            </Button>
          </>
        )}
      </div>

      {/* 头像裁切弹窗：选图后自由选区 + 缩放 */}
      <AvatarCropModal
        open={Boolean(cropSrc)}
        imageSrc={cropSrc}
        onCancel={() => setCropSrc(null)}
        onConfirm={handleCropConfirm}
      />
    </div>
  )
}
