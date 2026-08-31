/**
 * 色彩科学工具：sRGB / OKLab / Pantone 近似参考色
 *
 * - srgbToOklab：Björn Ottosson 提出的 OKLab 感知均匀色彩空间转换
 *   （参考 https://bottosson.github.io/posts/oklab/），用于色差计算与展示
 * - matchPantone：在潘通参考色库（见 pantone-data.ts）中，以 OKLab
 *   欧氏距离寻找最接近的参考色。色库为社区整理的近似值，仅作设计参考，
 *   正式交付请以官方潘通色卡为准。
 */
import { PANTONE_DATA, type PantoneDatum } from "./pantone-data";

export interface Oklab {
  /** 明度 L*（0 ~ 1） */
  L: number
  /** 绿-红轴 a*（约 -0.4 ~ 0.4） */
  a: number
  /** 蓝-黄轴 b*（约 -0.4 ~ 0.4） */
  b: number
}

export interface PantoneRef {
  /** 潘通编号，如 19-4052 或 100 C */
  code: string
  /** 名称（可能为空字符串，展示时回退为编号） */
  name: string
  /** 近似十六进制色值 */
  hex: string
  /** OKLab 欧氏色差（越小越接近，0 为完全一致） */
  delta: number
}

const toLinear = (c: number): number => {
  const v = c / 255
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
}

/** sRGB（8bit 通道）→ OKLab */
export function srgbToOklab(r8: number, g8: number, b8: number): Oklab {
  const r = toLinear(r8)
  const g = toLinear(g8)
  const b = toLinear(b8)

  // sRGB → LMS
  const l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b
  const m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b
  const s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b

  // LMS 立方根
  const l_ = Math.cbrt(l)
  const m_ = Math.cbrt(m)
  const s_ = Math.cbrt(s)

  // LMS → OKLab
  return {
    L: 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_,
    a: 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_,
    b: 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_,
  }
}

/** 通道 → 两位十六进制 */
const hx = (v: number): string => v.toString(16).padStart(2, "0").toUpperCase()

/** sRGB 通道 → #RRGGBB */
export function rgbToHex(r8: number, g8: number, b8: number): string {
  return `#${hx(r8)}${hx(g8)}${hx(b8)}`
}

/** OKLab 差（欧氏距离） */
export function oklabDelta(a: Oklab, b: Oklab): number {
  const dL = a.L - b.L
  const da = a.a - b.a
  const db = a.b - b.b
  return Math.sqrt(dL * dL + da * da + db * db)
}

const hexToRgb = (hex: string): [number, number, number] => {
  const n = parseInt(hex.slice(1), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

/** 参考色（name 为空时回退为 code） */
const PANTONE_REFERENCE: PantoneDatum[] = PANTONE_DATA.map((d) => ({
  ...d,
  name: d.name || d.code,
}))

/** 预计算参考色的 OKLab，避免每次匹配重复转换 */
const PANTONE_LAB_CACHE = PANTONE_REFERENCE.map((c) => {
  const [r, g, b] = hexToRgb(c.hex)
  return { ref: c, lab: srgbToOklab(r, g, b) }
})

/**
 * 在潘通参考色库中寻找最接近的颜色
 * 性能：比较阶段使用平方距离（免 sqrt），仅对最终结果开方一次；
 * 1391 色线性扫描单次 < 1ms，选点即时返回。
 * @returns 最接近的参考色；库为空时返回 null
 */
export function matchPantone(r8: number, g8: number, b8: number): PantoneRef | null {
  if (PANTONE_LAB_CACHE.length === 0) return null
  const lab = srgbToOklab(r8, g8, b8)
  let best: { ref: (typeof PANTONE_LAB_CACHE)[number]["ref"]; d2: number } | null = null
  for (const item of PANTONE_LAB_CACHE) {
    const dL = lab.L - item.lab.L
    const da = lab.a - item.lab.a
    const db = lab.b - item.lab.b
    const d2 = dL * dL + da * da + db * db
    if (!best || d2 < best.d2) {
      best = { ref: item.ref, d2 }
    }
  }
  if (!best) return null
  return { ...best.ref, delta: Math.sqrt(best.d2) }
}

/** 格式化 OKLab 为可读字符串（L / a / b 三位小数） */
export function formatOklab(lab: Oklab): { L: string; a: string; b: string } {
  return {
    L: lab.L.toFixed(3),
    a: (lab.a >= 0 ? "+" : "") + lab.a.toFixed(3),
    b: (lab.b >= 0 ? "+" : "") + lab.b.toFixed(3),
  }
}
