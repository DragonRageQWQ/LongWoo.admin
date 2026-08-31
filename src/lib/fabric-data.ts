/**
 * 毛布数据加载
 *
 * 数据优先级：
 * 1. public/fabric/fabric-data.json —— 真实毛布数据库（几千条），
 *    部署时由商家数据生成，结构与 FabricItem 一致；
 * 2. 内置示例数据 SAMPLE_FABRICS —— 覆盖 c00-c07 各色系，
 *    供无真实数据时开发与灰度演示（oklab 缺失由代码计算）。
 *
 * 图片：public/fabric/ 下的 PNG（source 文件名），按需加载（见 fabricImagePath）。
 * 数据加载后模块级缓存，多次进入取样器不重复请求。
 */
import {
  type FabricItem,
  type NormalizedFabric,
  normalizeFabric,
} from "./fabric-types";

/** 示例数据（真实数据部署后由 fabric-data.json 取代） */
export const SAMPLE_FABRICS: FabricItem[] = [
  // c00 黑白灰
  { id: "0001", cid: "c00", skuId: "mmm001", vendor: "咩咩毛", name: "漂白", ph: 50, fabricKind: "长毛", sRGB: [236, 232, 226], source: "0001漂白-5cm-咩咩毛-mmm001-长毛.png" },
  { id: "0002", cid: "c00", skuId: "mmm002", vendor: "咩咩毛", name: "米白", ph: 30, fabricKind: "短毛", sRGB: [226, 218, 204], source: "0002米白-3cm-咩咩毛-mmm002-短毛.png" },
  { id: "0003", cid: "c00", skuId: "mmm003", vendor: "咩咩毛", name: "浅灰", ph: 50, fabricKind: "长毛", sRGB: [176, 178, 180], source: "0003浅灰-5cm-咩咩毛-mmm003-长毛.png" },
  { id: "0004", cid: "c00", skuId: "mmm004", vendor: "咩咩毛", name: "深灰", ph: 40, fabricKind: "中长毛", sRGB: [96, 98, 102], source: "0004深灰-4cm-咩咩毛-mmm004-中长毛.png" },
  { id: "0005", cid: "c00", skuId: "mmm005", vendor: "咩咩毛", name: "碳黑", ph: 60, fabricKind: "长毛", sRGB: [36, 36, 40], source: "0005碳黑-6cm-咩咩毛-mmm005-长毛.png" },
  // c01 红色
  { id: "0101", cid: "c01", skuId: "mmm101", vendor: "咩咩毛", name: "正红", ph: 50, fabricKind: "长毛", sRGB: [198, 30, 42], source: "0101正红-5cm-咩咩毛-mmm101-长毛.png" },
  { id: "0102", cid: "c01", skuId: "mmm102", vendor: "咩咩毛", name: "酒红", ph: 40, fabricKind: "中长毛", sRGB: [128, 22, 42], source: "0102酒红-4cm-咩咩毛-mmm102-中长毛.png" },
  { id: "0103", cid: "c01", skuId: "mmm103", vendor: "咩咩毛", name: "珊瑚粉", ph: 30, fabricKind: "短毛", sRGB: [238, 140, 130], source: "0103珊瑚粉-3cm-咩咩毛-mmm103-短毛.png" },
  // c02 黄-橙
  { id: "0201", cid: "c02", skuId: "mmm201", vendor: "咩咩毛", name: "柠檬黄", ph: 30, fabricKind: "短毛", sRGB: [240, 214, 52], source: "0201柠檬黄-3cm-咩咩毛-mmm201-短毛.png" },
  { id: "0202", cid: "c02", skuId: "mmm202", vendor: "咩咩毛", name: "南瓜橙", ph: 50, fabricKind: "长毛", sRGB: [226, 120, 30], source: "0202南瓜橙-5cm-咩咩毛-mmm202-长毛.png" },
  { id: "0203", cid: "c02", skuId: "mmm203", vendor: "咩咩毛", name: "奶油黄", ph: 40, fabricKind: "中长毛", sRGB: [242, 218, 150], source: "0203奶油黄-4cm-咩咩毛-mmm203-中长毛.png" },
  // c03 褐色
  { id: "0301", cid: "c03", skuId: "mmm301", vendor: "咩咩毛", name: "浅棕", ph: 50, fabricKind: "长毛", sRGB: [176, 132, 92], source: "0301浅棕-5cm-咩咩毛-mmm301-长毛.png" },
  { id: "0302", cid: "c03", skuId: "mmm302", vendor: "咩咩毛", name: "咖啡", ph: 40, fabricKind: "中长毛", sRGB: [116, 78, 50], source: "0302咖啡-4cm-咩咩毛-mmm302-中长毛.png" },
  { id: "0303", cid: "c03", skuId: "mmm303", vendor: "咩咩毛", name: "奶茶", ph: 30, fabricKind: "短毛", sRGB: [206, 178, 150], source: "0303奶茶-3cm-咩咩毛-mmm303-短毛.png" },
  // c04 绿色
  { id: "0401", cid: "c04", skuId: "mmm401", vendor: "咩咩毛", name: "草绿", ph: 50, fabricKind: "长毛", sRGB: [104, 148, 66], source: "0401草绿-5cm-咩咩毛-mmm401-长毛.png" },
  { id: "0402", cid: "c04", skuId: "mmm402", vendor: "咩咩毛", name: "墨绿", ph: 40, fabricKind: "中长毛", sRGB: [40, 78, 52], source: "0402墨绿-4cm-咩咩毛-mmm402-中长毛.png" },
  { id: "0403", cid: "c04", skuId: "mmm403", vendor: "咩咩毛", name: "薄荷绿", ph: 30, fabricKind: "短毛", sRGB: [168, 210, 178], source: "0403薄荷绿-3cm-咩咩毛-mmm403-短毛.png" },
  // c05 青色
  { id: "0501", cid: "c05", skuId: "mmm501", vendor: "咩咩毛", name: "浅青", ph: 30, fabricKind: "短毛", sRGB: [150, 220, 214], source: "0501浅青-3cm-咩咩毛-mmm501-短毛.png" },
  { id: "0502", cid: "c05", skuId: "mmm502", vendor: "咩咩毛", name: "湖青", ph: 50, fabricKind: "长毛", sRGB: [50, 160, 158], source: "0502湖青-5cm-咩咩毛-mmm502-长毛.png" },
  { id: "0503", cid: "c05", skuId: "mmm503", vendor: "咩咩毛", name: "深青", ph: 40, fabricKind: "中长毛", sRGB: [26, 106, 110], source: "0503深青-4cm-咩咩毛-mmm503-中长毛.png" },
  // c06 蓝色
  { id: "0601", cid: "c06", skuId: "mmm601", vendor: "咩咩毛", name: "天空蓝", ph: 30, fabricKind: "短毛", sRGB: [128, 186, 228], source: "0601天空蓝-3cm-咩咩毛-mmm601-短毛.png" },
  { id: "0602", cid: "c06", skuId: "mmm602", vendor: "咩咩毛", name: "宝蓝", ph: 50, fabricKind: "长毛", sRGB: [44, 88, 178], source: "0602宝蓝-5cm-咩咩毛-mmm602-长毛.png" },
  { id: "0603", cid: "c06", skuId: "mmm603", vendor: "咩咩毛", name: "藏蓝", ph: 40, fabricKind: "中长毛", sRGB: [24, 44, 96], source: "0603藏蓝-4cm-咩咩毛-mmm603-中长毛.png" },
  // c07 紫色
  { id: "0701", cid: "c07", skuId: "mmm701", vendor: "咩咩毛", name: "薰衣草紫", ph: 30, fabricKind: "短毛", sRGB: [178, 152, 204], source: "0701薰衣草紫-3cm-咩咩毛-mmm701-短毛.png" },
  { id: "0702", cid: "c07", skuId: "mmm702", vendor: "咩咩毛", name: "葡萄紫", ph: 50, fabricKind: "长毛", sRGB: [110, 62, 148], source: "0702葡萄紫-5cm-咩咩毛-mmm702-长毛.png" },
  { id: "0703", cid: "c07", skuId: "mmm703", vendor: "咩咩毛", name: "深紫", ph: 40, fabricKind: "中长毛", sRGB: [62, 34, 86], source: "0703深紫-4cm-咩咩毛-mmm703-中长毛.png" },
]

/** 内置示例数据的提示文案（真实数据自带 tips 字段） */
const SAMPLE_TIPS = "数据来自商家色卡图片，非分光仪实测，务必采购小样确认"

const SAMPLE_NORMALIZED: NormalizedFabric[] = SAMPLE_FABRICS.map((f) =>
  normalizeFabric({ ...f, tips: f.tips ?? SAMPLE_TIPS })
)

/** 真实数据 JSON 约定路径（public/fabric/fabric-data.json） */
const FABRIC_DATA_URL = "/fabric/fabric-data.json"

export interface FabricDataResult {
  fabrics: NormalizedFabric[]
  /** true = 使用真实 fabric-data.json；false = 回退内置示例数据 */
  external: boolean
}

let cachePromise: Promise<FabricDataResult> | null = null

async function fetchExternalData(): Promise<FabricDataResult> {
  try {
    const res = await fetch(FABRIC_DATA_URL, { cache: "no-store" })
    if (!res.ok) return { fabrics: SAMPLE_NORMALIZED, external: false }
    const raw: unknown = await res.json()
    if (!Array.isArray(raw) || raw.length === 0) {
      return { fabrics: SAMPLE_NORMALIZED, external: false }
    }
    const list = raw as FabricItem[]
    return {
      fabrics: list.map((f) => normalizeFabric({ ...f, tips: f.tips ?? SAMPLE_TIPS })),
      external: true,
    }
  } catch {
    return { fabrics: SAMPLE_NORMALIZED, external: false }
  }
}

/**
 * 加载毛布数据（模块级缓存）：
 * 优先真实 fabric-data.json，缺失时回退内置示例数据
 */
export function loadFabricData(): Promise<FabricDataResult> {
  if (!cachePromise) {
    cachePromise = fetchExternalData()
  }
  return cachePromise
}
