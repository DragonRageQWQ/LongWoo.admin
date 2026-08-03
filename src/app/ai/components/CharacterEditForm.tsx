'use client'

import { useCallback, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Camera, Loader2, Trash2 } from 'lucide-react'
import Button from '@/components/ui/Button'
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
  const fileInputRef = useRef<HTMLInputElement>(null)

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

  // ===== 头像上传 =====
  const handleAvatarClick = () => {
    if (uploadingAvatar || saving) return
    fileInputRef.current?.click()
  }

  const handleAvatarChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    // 客户端预校验
    if (file.size > 2 * 1024 * 1024) {
      setError('图片大小不能超过 2MB')
      return
    }
    if (!['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(file.type)) {
      setError('仅支持 JPG、PNG、GIF、WebP 格式')
      return
    }

    setUploadingAvatar(true)
    setError(null)
    try {
      // 创建模式：头像上传需要角色 ID，所以先跳过后台上传
      if (mode === 'create') {
        // 本地预览（最终保存时若无角色 ID，先创建再补头像）
        const localUrl = URL.createObjectURL(file)
        setAvatarUrl(localUrl)
        return
      }

      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch(`/api/ai/characters/${characterId}/avatar`, {
        method: 'POST',
        body: formData,
        credentials: 'include',
      })
      const data = await res.json()
      if (data.success) {
        setAvatarUrl(data.avatar_url)
      } else {
        setError(data.error || '头像上传失败')
      }
    } catch {
      setError('头像上传失败，请稍后重试')
    } finally {
      setUploadingAvatar(false)
    }
  }, [mode, characterId])

  // ===== 保存 =====
  const handleSave = useCallback(async () => {
    const trimmedName = name.trim()
    if (!trimmedName) {
      setError('请填写角色名字')
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
          setError(createData.error || '创建失败')
          setSaving(false)
          return
        }

        const newId = createData.character.id

        // 若创建前选择了头像（本地预览），现在上传
        if (finalAvatarUrl && finalAvatarUrl.startsWith('blob:')) {
          const file = fileInputRef.current?.files?.[0]
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
        setError(data.error || '保存失败')
      }
    } catch {
      setError('网络错误，请稍后重试')
    } finally {
      setSaving(false)
    }
  }, [mode, characterId, name, persona, greeting, userNickname, avatarUrl, router])

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
        setError(data.error || '删除失败')
        setDeleting(false)
      }
    } catch {
      setError('网络错误，请稍后重试')
      setDeleting(false)
    }
  }, [characterId, name, deleting, router])

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
            <img src={avatarUrl} alt="角色头像" className="w-full h-full object-cover" />
          ) : (
            <span>{name.trim() ? name.charAt(0) : '灵'}</span>
          )}
          <span className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1">
            {uploadingAvatar ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Camera className="w-4 h-4" />
            )}
            <span className="text-[10px]">更换头像</span>
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
          {uploadingAvatar ? '上传中…' : '点击头像可更换图片（2MB以内）'}
        </p>
      </div>

      {/* ===== 表单字段 ===== */}
      <div className="space-y-5">
        {/* 名字 */}
        <div>
          <label className="block text-sm font-medium text-lw-black mb-1.5">
            角色名字 <span className="text-red-500">*</span>
            <span className="text-xs text-gray-400 font-normal ml-2">AI 的名字</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="例如：小灵、龙岚、阿焰…"
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
            对你的称呼
            <span className="text-xs text-gray-400 font-normal ml-2">AI 怎么叫你</span>
          </label>
          <input
            type="text"
            value={userNickname}
            onChange={(e) => setUserNickname(e.target.value)}
            placeholder="例如：主人、朋友、搭档…"
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
            角色人设
            <span className="text-xs text-gray-400 font-normal ml-2">性格、背景、说话风格</span>
          </label>
          <textarea
            rows={5}
            value={persona}
            onChange={(e) => setPersona(e.target.value)}
            placeholder={'例如：\n你是一只温柔又傲娇的银龙，喜欢晒太阳和收集亮晶晶的东西。\n说话简短带点小脾气，但心里很在意对方。'}
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
            语气风格
            <span className="text-xs text-gray-400 font-normal ml-2">点击选择，也可以自己写</span>
          </label>
          <div className="flex flex-wrap gap-2 mb-2">
            {TONE_PRESETS.map((t) => (
              <button
                key={t}
                type="button"
                className={`px-3 py-1.5 text-sm rounded-full border transition cursor-pointer ${
                  tone === t
                    ? 'bg-lw-accent text-white border-lw-accent'
                    : 'bg-white text-lw-black border-gray-200 hover:border-gray-300'
                }`}
                onClick={() => setTone(tone === t ? '' : t)}
              >
                {t}
              </button>
            ))}
          </div>
          <input
            type="text"
            value={tone}
            onChange={(e) => setTone(e.target.value)}
            placeholder="自定义语气，例如：带着点方言腔、喜欢说反话…"
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
            开场白
            <span className="text-xs text-gray-400 font-normal ml-2">对话开始时它说的第一句话</span>
          </label>
          <input
            type="text"
            value={greeting}
            onChange={(e) => setGreeting(e.target.value)}
            placeholder="例如：哼，你终于来了，我等你好久了。"
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
                  删除中…
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4 mr-1" />
                  删除角色
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
                  保存中…
                </>
              ) : (
                '保存'
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
              取消
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
                  创建中…
                </>
              ) : (
                '创建角色'
              )}
            </Button>
          </>
        )}
      </div>
    </div>
  )
}
