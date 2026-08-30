import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  clearAiCharacterDraft,
  loadAiCharacterDraft,
  safeLoginNext,
  saveAiCharacterDraft,
} from './ai-character-draft'

// node 测试环境无 localStorage，注入最小内存实现
function createMemoryStorage() {
  const store = new Map<string, string>()
  return {
    getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
    setItem: (key: string, value: string) => {
      store.set(key, value)
    },
    removeItem: (key: string) => {
      store.delete(key)
    },
    clear: () => store.clear(),
  }
}

let storage: ReturnType<typeof createMemoryStorage>

beforeEach(() => {
  storage = createMemoryStorage()
  vi.stubGlobal('window', { localStorage: storage })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

const baseDraft = {
  name: '小灰',
  persona: '一只安静又傲娇的银狐，喜欢在雨天看书。'.repeat(20),
  tone: '傲娇',
  greeting: '哼，你终于来了。',
  user_nickname: '主人',
}

describe('ai-character-draft - 保存与读取', () => {
  it('保存后可完整读回（含长人设文案）', () => {
    saveAiCharacterDraft(baseDraft)
    const draft = loadAiCharacterDraft()
    expect(draft).not.toBeNull()
    expect(draft?.name).toBe(baseDraft.name)
    expect(draft?.persona).toBe(baseDraft.persona)
    expect(draft?.tone).toBe(baseDraft.tone)
    expect(draft?.greeting).toBe(baseDraft.greeting)
    expect(draft?.user_nickname).toBe(baseDraft.user_nickname)
    expect(typeof draft?.savedAt).toBe('number')
  })

  it('无草稿时返回 null', () => {
    expect(loadAiCharacterDraft()).toBeNull()
  })

  it('JSON 损坏时返回 null', () => {
    storage.setItem('lw_ai_character_draft_v1', '{broken json')
    expect(loadAiCharacterDraft()).toBeNull()
  })

  it('字段结构不完整时返回 null', () => {
    storage.setItem('lw_ai_character_draft_v1', JSON.stringify({ name: '只有名字' }))
    expect(loadAiCharacterDraft()).toBeNull()
  })

  it('清除后读取为 null', () => {
    saveAiCharacterDraft(baseDraft)
    clearAiCharacterDraft()
    expect(loadAiCharacterDraft()).toBeNull()
  })

  it('过期草稿返回 null 且被清除', () => {
    storage.setItem(
      'lw_ai_character_draft_v1',
      JSON.stringify({ ...baseDraft, savedAt: Date.now() - 8 * 24 * 60 * 60 * 1000 })
    )
    expect(loadAiCharacterDraft()).toBeNull()
    expect(storage.getItem('lw_ai_character_draft_v1')).toBeNull()
  })
})

describe('ai-character-draft - safeLoginNext 回跳校验', () => {
  it('站内相对路径放行', () => {
    expect(safeLoginNext('/')).toBe('/')
    expect(safeLoginNext('/profile')).toBe('/profile')
    expect(safeLoginNext('/ai/characters/new')).toBe('/ai/characters/new')
  })

  it('外部地址一律回退到首页', () => {
    expect(safeLoginNext('//evil.com')).toBe('/')
    expect(safeLoginNext('https://evil.com')).toBe('/')
    expect(safeLoginNext('javascript:alert(1)')).toBe('/')
    expect(safeLoginNext('')).toBe('/')
    expect(safeLoginNext(null)).toBe('/')
    expect(safeLoginNext(undefined)).toBe('/')
  })

  it('支持自定义兜底地址', () => {
    expect(safeLoginNext('https://evil.com', '/profile')).toBe('/profile')
  })
})
