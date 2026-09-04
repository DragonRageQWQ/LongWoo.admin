/**
 * 临时 i18n 一致性校验（仅本次翻译任务使用，验证后删除）
 */
import { describe, expect, it } from 'vitest'
import { I18N_DICTS, type Lang } from './dict'
import { ZH_EXTRA } from './zh-extra'
import { ZH_ADMIN } from './zh-admin'
import { ZH_HANT_PAGES } from './zh-hant-pages'
import { ZH_HANT_ADMIN } from './zh-hant-admin'
import { JA_PAGES } from './ja-pages'
import { JA_ADMIN } from './ja-admin'
import { KO_PAGES } from './ko-pages'
import { KO_ADMIN } from './ko-admin'
import { RU_PAGES } from './ru-pages'
import { RU_ADMIN } from './ru-admin'
import { FR_PAGES } from './fr-pages'
import { FR_ADMIN } from './fr-admin'
import { ZH_SAMPLER } from './zh-sampler'
import { EN_SAMPLER } from './en-sampler'
import { ZH_HANT_SAMPLER } from './zh-hant-sampler'
import { JA_SAMPLER } from './ja-sampler'
import { KO_SAMPLER } from './ko-sampler'
import { RU_SAMPLER } from './ru-sampler'
import { FR_SAMPLER } from './fr-sampler'
import { ZH_PET } from './zh-pet'
import { EN_PET } from './en-pet'
import { ZH_HANT_PET } from './zh-hant-pet'
import { JA_PET } from './ja-pet'
import { KO_PET } from './ko-pet'
import { RU_PET } from './ru-pet'
import { FR_PET } from './fr-pet'

const SAMPLER_OF: Record<Lang, Record<string, string>> = {
  zh: ZH_SAMPLER,
  en: EN_SAMPLER,
  'zh-Hant': ZH_HANT_SAMPLER,
  ja: JA_SAMPLER,
  ko: KO_SAMPLER,
  ru: RU_SAMPLER,
  fr: FR_SAMPLER,
}

const PET_OF: Record<Lang, Record<string, string>> = {
  zh: ZH_PET,
  en: EN_PET,
  'zh-Hant': ZH_HANT_PET,
  ja: JA_PET,
  ko: KO_PET,
  ru: RU_PET,
  fr: FR_PET,
}

const PAGES_OF: Record<Lang, Record<string, string>> = {
  zh: { ...I18N_DICTS.zh, ...ZH_EXTRA },
  en: { ...I18N_DICTS.en },
  'zh-Hant': ZH_HANT_PAGES,
  ja: JA_PAGES,
  ko: KO_PAGES,
  ru: RU_PAGES,
  fr: FR_PAGES,
}

const ADMIN_OF: Record<string, Record<string, string>> = {
  'zh-Hant': ZH_HANT_ADMIN,
  ja: JA_ADMIN,
  ko: KO_ADMIN,
  ru: RU_ADMIN,
  fr: FR_ADMIN,
}

const ALLOWED_EMPTY = new Set([
  'admin.order.pageUnit', 'admin.feedback.pageUnit', 'admin.user.pageUnit',
  'admin.order.page', 'admin.feedback.page', 'admin.user.page',
  'admin.order.items', 'admin.feedback.items', 'admin.user.items',
  'admin.drop.listUnit', 'admin.works.listUnit', 'admin.notice.people',
])

function placeholderTokens(v: string | undefined): string[] {
  return v ? [...v.matchAll(/\{[a-zA-Z]+\}/g)].map((m) => m[0]) : []
}

// 简体专用字（与日文汉字/繁中同码位不重叠，用于识别残留简中）
const ZH_HINT = /[您请让这还吗吧们网络单设头电邮验证码兽灵错输暂复询买关词题级顺发办从贝贡责员]/
const NEW_LANGS = ['zh-Hant', 'ja', 'ko', 'ru', 'fr'] as Lang[]

function diffKeys(a: Record<string, unknown>, b: Record<string, unknown>) {
  const ak = Object.keys(a).sort()
  const bk = Object.keys(b).sort()
  return { missing: bk.filter((k) => !(k in a)), extra: ak.filter((k) => !(k in b)) }
}

describe('i18n 全语言一致性', () => {
  it('pages 键集合与 zh 等价', () => {
    const zh = PAGES_OF.zh
    for (const lang of NEW_LANGS) {
      const { missing, extra } = diffKeys(PAGES_OF[lang], zh)
      if (missing.length || extra.length) {
        // eslint-disable-next-line no-console
        console.log(`[pages:${lang}] 缺 ${missing.length} / 多 ${extra.length}`, { missing, extra })
      }
      expect(missing, `${lang} pages 缺键`).toEqual([])
      expect(extra, `${lang} pages 多键`).toEqual([])
    }
  })

  it('admin 键集合与 zh-admin 等价', () => {
    for (const lang of NEW_LANGS) {
      const { missing, extra } = diffKeys(ADMIN_OF[lang], ZH_ADMIN)
      if (missing.length || extra.length) {
        // eslint-disable-next-line no-console
        console.log(`[admin:${lang}] 缺 ${missing.length} / 多 ${extra.length}`, { missing, extra })
      }
      expect(missing, `${lang} admin 缺键`).toEqual([])
      expect(extra, `${lang} admin 多键`).toEqual([])
    }
  })

  it('无裸键/空值（白名单外）', () => {
    for (const lang of NEW_LANGS) {
      for (const [key, value] of Object.entries(PAGES_OF[lang])) {
        expect(value, `${lang} pages ${key} 裸键`).not.toBe(key)
        if (!ALLOWED_EMPTY.has(key)) expect(value.trim(), `${lang} pages ${key} 空值`).not.toBe('')
      }
      for (const [key, value] of Object.entries(ADMIN_OF[lang])) {
        expect(value, `${lang} admin ${key} 裸键`).not.toBe(key)
        if (!ALLOWED_EMPTY.has(key)) expect(value.trim(), `${lang} admin ${key} 空值`).not.toBe('')
      }
    }
  })

  it('占位符与 \\n 保留', () => {
    for (const lang of NEW_LANGS) {
      for (const [key, zhVal] of Object.entries(PAGES_OF.zh)) {
        const v = PAGES_OF[lang][key]
        expect(placeholderTokens(v), `${lang} pages ${key}`).toEqual(placeholderTokens(zhVal))
        if (zhVal.includes('\\n')) expect(v, `${lang} pages ${key}`).toContain('\\n')
      }
      for (const [key, zhVal] of Object.entries(ZH_ADMIN)) {
        expect(placeholderTokens(ADMIN_OF[lang][key]), `${lang} admin ${key}`).toEqual(placeholderTokens(zhVal))
      }
    }
  })

  it('sampler 字典七语言键等价 + token 保留', () => {
    const zhKeys = Object.keys(SAMPLER_OF.zh).sort()
    for (const lang of ['en', 'zh-Hant', 'ja', 'ko', 'ru', 'fr'] as Lang[]) {
      const target = Object.keys(SAMPLER_OF[lang]).sort()
      expect(target, `${lang} sampler 键`).toEqual(zhKeys)
    }
    for (const lang of ['en', 'zh-Hant', 'ja', 'ko', 'ru', 'fr'] as Lang[]) {
      for (const [key, zhVal] of Object.entries(SAMPLER_OF.zh)) {
        const v = SAMPLER_OF[lang][key]
        expect(v, `${lang} sampler ${key}`).toBeTruthy()
        expect(v, `${lang} sampler ${key} 裸键`).not.toBe(key)
        expect(placeholderTokens(v), `${lang} sampler ${key} token`).toEqual(placeholderTokens(zhVal))
      }
    }
  })

  it('pet 字典七语言键等价 + token 保留', () => {
    const zhKeys = Object.keys(PET_OF.zh).sort()
    for (const lang of ['en', 'zh-Hant', 'ja', 'ko', 'ru', 'fr'] as Lang[]) {
      const target = Object.keys(PET_OF[lang]).sort()
      expect(target, `${lang} pet 键`).toEqual(zhKeys)
    }
    for (const lang of ['en', 'zh-Hant', 'ja', 'ko', 'ru', 'fr'] as Lang[]) {
      for (const [key, zhVal] of Object.entries(PET_OF.zh)) {
        const v = PET_OF[lang][key]
        expect(v, `${lang} pet ${key}`).toBeTruthy()
        expect(v, `${lang} pet ${key} 裸键`).not.toBe(key)
        expect(placeholderTokens(v), `${lang} pet ${key} token`).toEqual(placeholderTokens(zhVal))
      }
    }
  })

  it('ja/ko/ru/fr 无整条简中残留', () => {
    for (const lang of ['ja', 'ko', 'ru', 'fr'] as Lang[]) {
      for (const [key, value] of Object.entries(PAGES_OF[lang])) {
        if (key.includes('.tone.')) continue
        expect(ZH_HINT.test(value), `${lang} pages ${key}: ${value}`).toBe(false)
      }
      for (const [key, value] of Object.entries(ADMIN_OF[lang])) {
        expect(ZH_HINT.test(value), `${lang} admin ${key}: ${value}`).toBe(false)
      }
    }
  })
})
