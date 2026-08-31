/**
 * 毛布数据库类型定义与工具
 *
 * 数据来源约定：
 * - 真实数据：public/fabric/fabric-data.json（几千条，含图片名 source）
 * - 图片：public/fabric/ 目录下的 PNG（source 字段命名，缩略图同路径按需加载）
 * - 匹配：客户端以 oklab 欧氏距离线性扫描，毫秒级
 */

/** 色系编号（cid 分类规则） */
export type FabricCid = "c00" | "c01" | "c02" | "c03" | "c04" | "c05" | "c06" | "c07" | "c08" | "c09" | "c10"

export interface FabricCidInfo {
  cid: FabricCid
  label: string
  en: string
}

/** 色系分类规则（c08/c09/c10 预留） */
export const FABRIC_CIDS: FabricCidInfo[] = [
  { cid: "c00", label: "黑白灰", en: "Mono" },
  { cid: "c01", label: "红色", en: "Red" },
  { cid: "c02", label: "黄-橙", en: "Yellow-Orange" },
  { cid: "c03", label: "褐色", en: "Brown" },
  { cid: "c04", label: "绿色", en: "Green" },
  { cid: "c05", label: "青色", en: "Cyan" },
  { cid: "c06", label: "蓝色", en: "Blue" },
  { cid: "c07", label: "紫色", en: "Purple" },
  { cid: "c08", label: "预留", en: "Reserved" },
  { cid: "c09", label: "预留", en: "Reserved" },
  { cid: "c10", label: "预留", en: "Reserved" },
]

/** 毛布原始条目（与数据库 JSON 结构一致） */
export interface FabricItem {
  /** 整体编号，如 0001 */
  id: string
  /** 色系编号，如 c00 */
  cid: FabricCid
  /** 商家毛布编号，如 mmm001 */
  skuId: string
  /** 商家名称，如 咩咩毛 */
  vendor: string
  /** 毛布名称，如 漂白 */
  name: string
  /** 毛长，单位 mm（如 50 = 5cm） */
  ph: number
  /** 毛布种类，如 长毛 */
  fabricKind: string
  /** sRGB 色值 [r, g, b] */
  sRGB: [number, number, number]
  /** OKLab 色值 [L, a, b]（缺失时由代码从 sRGB 计算） */
  oklab?: [number, number, number]
  /** 潘通参考色（可选） */
  pantone?: string
  /** 展示提示文案（可选） */
  tips?: string
  /** 关联图片文件名，如 0001漂白-5cm-咩咩毛-mmm001-长毛.png */
  source: string
}

/** 归一化后的毛布条目（补齐 hex / oklab） */
export interface NormalizedFabric extends FabricItem {
  /** 十六进制色值（由 sRGB 计算） */
  hex: string
  /** OKLab 色值（保证存在） */
  oklab: [number, number, number]
}

/** 匹配结果 */
export interface FabricMatch {
  fabric: NormalizedFabric
  /** OKLab 欧氏色差（越小越接近） */
  delta: number
}

/** 色系信息查询 */
export function cidInfo(cid: string): FabricCidInfo {
  return (
    FABRIC_CIDS.find((c) => c.cid === cid) ?? { cid: cid as FabricCid, label: cid, en: cid }
  )
}

/** 图片静态路径（public/fabric/ 下，按需加载） */
export function fabricImagePath(source: string): string {
  return `/fabric/${encodeURIComponent(source)}`
}

/** 毛长显示（mm → mm + cm） */
export function fabricPhText(ph: number): string {
  const cm = ph / 10
  return Number.isInteger(cm) ? `${ph}mm（${cm}cm）` : `${ph}mm`
}

/** 通道 → 两位十六进制 */
const hx = (v: number): string => v.toString(16).padStart(2, "0").toUpperCase()

/** 毛布 sRGB → #RRGGBB */
export function fabricHex(r: number, g: number, b: number): string {
  return `#${hx(Math.round(r))}${hx(Math.round(g))}${hx(Math.round(b))}`
}

/** sRGB → OKLab（数据缺失时兜底计算，算法与 color-math 一致） */
export function fabricOklab(r: number, g: number, b: number): [number, number, number] {
  const lin = (c: number) => {
    const v = c / 255
    return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
  }
  const rl = lin(r)
  const gl = lin(g)
  const bl = lin(b)
  const l = 0.4122214708 * rl + 0.5363325363 * gl + 0.0514459929 * bl
  const m = 0.2119034982 * rl + 0.6806995451 * gl + 0.1073969566 * bl
  const s = 0.0883024619 * rl + 0.2817188376 * gl + 0.6299787005 * bl
  const l_ = Math.cbrt(l)
  const m_ = Math.cbrt(m)
  const s_ = Math.cbrt(s)
  return [
    0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_,
    1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_,
    0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_,
  ]
}

/** OKLab 欧氏距离 */
export function oklabDistance(a: [number, number, number], b: [number, number, number]): number {
  const dL = a[0] - b[0]
  const da = a[1] - b[1]
  const db = a[2] - b[2]
  return Math.sqrt(dL * dL + da * da + db * db)
}

/** 归一化原始条目（补 hex / oklab） */
export function normalizeFabric(item: FabricItem): NormalizedFabric {
  const [r, g, b] = item.sRGB
  return {
    ...item,
    hex: fabricHex(r, g, b),
    oklab: item.oklab ?? fabricOklab(r, g, b),
  }
}

/**
 * 客户端匹配：目标 OKLab 与全库线性扫描，返回色差升序 Top N
 * 几千条数据单次 < 5ms；排序阶段用平方距离比较免开方
 */
export function matchFabrics(
  target: [number, number, number],
  fabrics: NormalizedFabric[],
  topN = 20
): FabricMatch[] {
  const scored = fabrics.map((fabric) => {
    const [L, a, b] = fabric.oklab
    const dL = target[0] - L
    const da = target[1] - a
    const db = target[2] - b
    const d2 = dL * dL + da * da + db * db
    return { fabric, d2 }
  })
  scored.sort((x, y) => x.d2 - y.d2)
  const n = Math.min(topN, scored.length)
  const out: FabricMatch[] = new Array(n)
  for (let i = 0; i < n; i++) {
    out[i] = { fabric: scored[i].fabric, delta: Math.sqrt(scored[i].d2) }
  }
  return out
}
