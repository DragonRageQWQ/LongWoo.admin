/**
 * AI 角色创建草稿（游客登录接力）
 *
 * 场景：游客在首页 Agent 面板填写角色设定（人设最长 2000 字）后点击"创建角色"，
 * 此时若未登录，先把表单内容保存到 localStorage，再引导去登录；
 * 登录成功跳回首页后自动读取草稿并回填表单，确保文案不丢失。
 *
 * 为什么用 localStorage 而非 URL 参数：
 * - 草稿可达 2KB+，放 URL query 会撑爆地址栏且泄露隐私；
 * - localStorage 按站点隔离、刷新/跳转不丢，QQ OAuth 等任意登录路径都可用；
 * - 登录并创建成功后立即清除，不留敏感残留。
 */

export interface AiCharacterDraft {
  name: string
  persona: string
  tone: string
  greeting: string
  user_nickname: string
  /** 草稿保存时间戳（ms），用于过期清理 */
  savedAt: number
}

const DRAFT_KEY = 'lw_ai_character_draft_v1'

/** 草稿最长保留 7 天，超期视为过期草稿并清除 */
const DRAFT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000

function canUseStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
}

/** 保存草稿（游客点击创建但未登录时调用） */
export function saveAiCharacterDraft(draft: Omit<AiCharacterDraft, 'savedAt'>): void {
  if (!canUseStorage()) return
  try {
    const payload: AiCharacterDraft = { ...draft, savedAt: Date.now() }
    window.localStorage.setItem(DRAFT_KEY, JSON.stringify(payload))
  } catch {
    // 隐私模式/配额满等场景静默失败：不阻断登录引导
  }
}

/** 读取草稿；无草稿/格式损坏/已过期返回 null（过期草稿会被清除） */
export function loadAiCharacterDraft(): AiCharacterDraft | null {
  if (!canUseStorage()) return null
  try {
    const raw = window.localStorage.getItem(DRAFT_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<AiCharacterDraft>
    if (
      typeof parsed.name !== 'string' ||
      typeof parsed.persona !== 'string' ||
      typeof parsed.tone !== 'string' ||
      typeof parsed.greeting !== 'string' ||
      typeof parsed.user_nickname !== 'string'
    ) {
      return null
    }
    if (typeof parsed.savedAt === 'number' && Date.now() - parsed.savedAt > DRAFT_MAX_AGE_MS) {
      clearAiCharacterDraft()
      return null
    }
    return parsed as AiCharacterDraft
  } catch {
    return null
  }
}

/** 清除草稿（创建成功后调用） */
export function clearAiCharacterDraft(): void {
  if (!canUseStorage()) return
  try {
    window.localStorage.removeItem(DRAFT_KEY)
  } catch {
    // 忽略清理失败
  }
}

/**
 * 校验登录成功后的回跳地址（防开放重定向）：
 * 仅允许站内相对路径（以单个 / 开头），拒绝 //host、https://host、javascript: 等外部地址。
 */
export function safeLoginNext(raw: string | null | undefined, fallback = '/'): string {
  if (raw && raw.startsWith('/') && !raw.startsWith('//')) {
    return raw
  }
  return fallback
}
