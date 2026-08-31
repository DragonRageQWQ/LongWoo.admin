/**
 * 色彩科学工具：sRGB / OKLab / Pantone 近似参考色
 *
 * - srgbToOklab：Björn Ottosson 提出的 OKLab 感知均匀色彩空间转换
 *   （参考 https://bottosson.github.io/posts/oklab/），用于色差计算与展示
 * - matchPantone：在内置潘通参考色库中，以 OKLab 欧氏距离寻找最接近的
 *   参考色。潘通色卡为商业数据，本库内置值为社区整理的十六进制近似值，
 *   仅作设计参考，正式交付请以官方潘通色卡为准。
 */

export interface Oklab {
  /** 明度 L*（0 ~ 1） */
  L: number
  /** 绿-红轴 a*（约 -0.4 ~ 0.4） */
  a: number
  /** 蓝-黄轴 b*（约 -0.4 ~ 0.4） */
  b: number
}

export interface PantoneRef {
  /** 潘通编号，如 19-4052 */
  code: string
  /** 名称，如 Classic Blue */
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

/**
 * 内置潘通参考色库（近似值）
 * 年度色来自 Pantone 官方年度色发布；其余为广泛使用的社区近似值。
 */
const PANTONE_REFERENCE: Array<{ code: string; name: string; hex: string }> = [
  // ===== 年度色（2007-2024）=====
  { code: "13-1023", name: "Peach Fuzz", hex: "#FFBE98" },
  { code: "18-1750", name: "Viva Magenta", hex: "#BB2649" },
  { code: "17-3938", name: "Very Peri", hex: "#6667AB" },
  { code: "17-5104", name: "Ultimate Gray", hex: "#939597" },
  { code: "13-0647", name: "Illuminating", hex: "#F5BF23" },
  { code: "19-4052", name: "Classic Blue", hex: "#0F4C81" },
  { code: "16-1546", name: "Living Coral", hex: "#FF6F61" },
  { code: "18-3838", name: "Ultra Violet", hex: "#5F4B8B" },
  { code: "15-0343", name: "Greenery", hex: "#88B04B" },
  { code: "13-1520", name: "Rose Quartz", hex: "#F7CAC9" },
  { code: "15-3919", name: "Serenity", hex: "#92A8D1" },
  { code: "18-1438", name: "Marsala", hex: "#955251" },
  { code: "18-3224", name: "Radiant Orchid", hex: "#B163A3" },
  { code: "17-5641", name: "Emerald", hex: "#009473" },
  { code: "17-1463", name: "Tangerine Tango", hex: "#DD4124" },
  { code: "18-2120", name: "Honeysuckle", hex: "#D94F70" },
  { code: "15-5519", name: "Turquoise", hex: "#45B8AC" },
  { code: "14-0848", name: "Mimosa", hex: "#F0C05A" },
  { code: "18-3943", name: "Blue Iris", hex: "#5B5EA6" },
  { code: "19-1557", name: "Chili Pepper", hex: "#9B1B30" },
  // ===== C 系列基础色（Pantone 印刷基础色）=====
  { code: "Yellow C", name: "Pantone Yellow", hex: "#FEDD00" },
  { code: "100 C", name: "Pantone 100", hex: "#F6EB61" },
  { code: "102 C", name: "Pantone 102", hex: "#FCE514" },
  { code: "Red 032 C", name: "Pantone Red 032", hex: "#EF3340" },
  { code: "Warm Red C", name: "Pantone Warm Red", hex: "#F9423A" },
  { code: "Rubine Red C", name: "Pantone Rubine Red", hex: "#CE0058" },
  { code: "Rhodamine Red C", name: "Pantone Rhodamine Red", hex: "#E10098" },
  { code: "Purple C", name: "Pantone Purple", hex: "#BB29BB" },
  { code: "Violet C", name: "Pantone Violet", hex: "#440099" },
  { code: "Blue 072 C", name: "Pantone Blue 072", hex: "#10069F" },
  { code: "Reflex Blue C", name: "Pantone Reflex Blue", hex: "#001489" },
  { code: "Process Blue C", name: "Pantone Process Blue", hex: "#0085CA" },
  { code: "Green C", name: "Pantone Green", hex: "#00AB84" },
  { code: "Orange 021 C", name: "Pantone Orange 021", hex: "#FE5000" },
  { code: "Black C", name: "Pantone Black", hex: "#2D2926" },
  // ===== 常用设计色 =====
  { code: "13-0858", name: "Cyber Yellow", hex: "#FFD400" },
  { code: "14-0760", name: "Empire Yellow", hex: "#F1C400" },
  { code: "15-1142", name: "Apricot", hex: "#F8B878" },
  { code: "16-1324", name: "Warm Taupe", hex: "#A58C7B" },
  { code: "17-1547", name: "Grenadine", hex: "#E03C31" },
  { code: "18-1661", name: "Flame Scarlet", hex: "#CD212A" },
  { code: "19-1664", name: "True Red", hex: "#BC243C" },
  { code: "17-2030", name: "Fandango Pink", hex: "#DE5B8C" },
  { code: "18-2043", name: "Raspberry Sorbet", hex: "#D2386C" },
  { code: "18-1755", name: "Teaberry", hex: "#DC3855" },
  { code: "16-3913", name: "Lavender", hex: "#C4BFDA" },
  { code: "17-2623", name: "Orchid", hex: "#D15B9E" },
  { code: "19-2420", name: "Orchid Haze", hex: "#AD5E99" },
  { code: "18-3520", name: "Prism Violet", hex: "#9B7BB2" },
  { code: "17-3617", name: "Pansy", hex: "#7C6BA0" },
  { code: "18-3820", name: "Grape", hex: "#6E4E9E" },
  { code: "16-4529", name: "Cerulean", hex: "#9BB7D4" },
  { code: "15-4020", name: "Limpet Shell", hex: "#98DDDE" },
  { code: "17-5024", name: "Blue Lagoon", hex: "#00647A" },
  { code: "19-4241", name: "Deep Pacific", hex: "#114A68" },
  { code: "18-4051", name: "Liberty", hex: "#34558B" },
  { code: "19-3830", name: "Skydiver", hex: "#204E9A" },
  { code: "17-0123", name: "Jelly Bean", hex: "#B7C94A" },
  { code: "18-0135", name: "Garden Green", hex: "#3B7A57" },
  { code: "18-6034", name: "Jade Cream", hex: "#00A86B" },
  { code: "19-5232", name: "Bottle Green", hex: "#0A5C36" },
  { code: "16-0111", name: "Desert Sage", hex: "#B6BAA4" },
  { code: "18-1007", name: "Mocha Mousse", hex: "#A47864" },
  { code: "19-1016", name: "Darkest Spruce", hex: "#3E4E49" },
  { code: "19-1116", name: "Dark Charcoal", hex: "#4A4747" },
]

/** 预计算参考色的 OKLab，避免每次匹配重复转换 */
const PANTONE_LAB_CACHE = PANTONE_REFERENCE.map((c) => {
  const [r, g, b] = hexToRgb(c.hex)
  return { ref: c, lab: srgbToOklab(r, g, b) }
})

/**
 * 在潘通参考色库中寻找最接近的颜色
 * @returns 最接近的参考色；库为空时返回 null
 */
export function matchPantone(r8: number, g8: number, b8: number): PantoneRef | null {
  if (PANTONE_LAB_CACHE.length === 0) return null
  const lab = srgbToOklab(r8, g8, b8)
  let best: { ref: (typeof PANTONE_LAB_CACHE)[number]["ref"]; delta: number } | null = null
  for (const item of PANTONE_LAB_CACHE) {
    const delta = oklabDelta(lab, item.lab)
    if (!best || delta < best.delta) {
      best = { ref: item.ref, delta }
    }
  }
  if (!best) return null
  return { ...best.ref, delta: best.delta }
}

/** 格式化 OKLab 为可读字符串（L / a / b 三位小数） */
export function formatOklab(lab: Oklab): { L: string; a: string; b: string } {
  return {
    L: lab.L.toFixed(3),
    a: (lab.a >= 0 ? "+" : "") + lab.a.toFixed(3),
    b: (lab.b >= 0 ? "+" : "") + lab.b.toFixed(3),
  }
}
