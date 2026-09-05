"use client";

/**
 * 图片与毛布合体取样器（灰度测试 · 纸墨极简风格）
 *
 * 布局：
 * - 左侧 ~60%：图片工作区（自适应图片大小，点击像素选点 ≤10 点，
 *   长按/按住弹出像素放大镜精确取色；移动端长按、桌面端按住拖动；
 *   点击已选点可删除；窗口过窄时保持图片长宽比的最小高度不被挤压）
 * - 右侧 ~40%：参数区（可滚动），每个选点一张参数卡
 *
 * 参数卡排版（从左到右）：
 * - 左端：匹配色块（带坐标与数字编号，可删除）
 * - 中段：sRGB(hex) / 潘通参考色（Top 3，带色差 Δ）/ 折叠「详细参数」（内含 OKLab，默认收起）
 * - 右端：参考毛布 Top 3（图片缩略图按需加载，失败回退色块）
 *
 * 匹配全部在客户端（OKLab 欧氏距离），服务器零计算；
 * 毛布数据：真实 fabric-data.json 优先，缺失回退内置示例数据。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Upload, ImagePlus, MousePointerClick, X, Loader2, ChevronDown, Database, ZoomIn } from "lucide-react";
import {
  type FabricMatch,
  type NormalizedFabric,
  cidInfo,
  fabricHex,
  fabricImagePath,
  fabricOklab,
  fabricPhText,
  matchFabrics,
} from "@/lib/fabric-types";
import { loadFabricData } from "@/lib/fabric-data";
import { rgbToHex, matchPantones, type PantoneRef } from "@/lib/color-math";
import { PANTONE_DATA } from "@/lib/pantone-data";
import {
  IDENTITY_VIEW,
  PAN_THRESHOLD,
  ZOOM_STEP,
  clientToPixel,
  clampPan,
  panBy,
  pinchZoom,
  pixelToClient,
  zoomAt,
  type ViewState,
} from "@/lib/view-transform";
import { useLanguage } from "@/components/i18n/LanguageProvider";

/** 文案模板填充：把 {token} 替换为字典注入的动态值（数字 / 名称 / 坐标等），缺失时保留原文 */
const fill = (s: string, m: Record<string, string | number>) =>
  s.replace(/\{(\w+)\}/g, (_, k) => String(m[k] ?? `{${k}}`));

interface PickPoint {
  id: number
  x: number // 原始像素坐标（锚点，永不随视图变化）
  y: number
  r: number
  g: number
  b: number
}

/** 导出色卡快照（右上角「数据导出」面板读取） */
export interface SamplerSnapshot {
  app: "longwoo-fabric-sampler"
  version: 1
  exportedAt: string
  source: { name: string | null; width: number | null; height: number | null }
  database: {
    pantoneCount: number
    fabricCount: number
    fabricSource: "loading" | "sample" | "external"
    vendors: string[]
    vendorsOn: string[]
  }
  points: Array<{
    index: number
    x: number
    y: number
    hex: string
    rgb: { r: number; g: number; b: number }
    oklab: [number, number, number]
    pantones: PantoneRef[]
    fabrics: Array<{
      skuId: string
      name: string
      vendor: string
      fabricKind: string
      ph: number
      hex: string
      source: string
      delta: number
    }>
  }>
}

declare global {
  interface Window {
    /** 取样器最新快照：每次取色点/毛布库变化时由 UnifiedSampler 维护 */
    __longwooSamplerSnapshot?: SamplerSnapshot | null
  }
}

const MAX_POINTS = 10
const PREVIEW_N = 3 // 参数卡内毛布预览条数
const PANTONE_N = 3 // 参数卡内潘通参考色条数
const LONG_PRESS_MS = 380 // 长按判定阈值（毫秒）
const LOUPE_SIZE = 7
const LOUPE_CELL = 12
const LOUPE_PX = LOUPE_SIZE * LOUPE_CELL
/** 尚未导入数据库的毛布种类（折叠展示，仅提示不可选） */
const PENDING_KINDS = ["兔毛", "银狐绒", "麂皮"]

export default function UnifiedSampler() {
  const { t, lang } = useLanguage();
  // ===== 图片 =====
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [imageSize, setImageSize] = useState<{ w: number; h: number } | null>(null)
  const [fileName, setFileName] = useState<string>("")
  const [containerSize, setContainerSize] = useState<{ w: number; h: number } | null>(null)
  const [dragOver, setDragOver] = useState(false)
  // 图片视图变换：缩放 + 平移（滚轮 / 双指捏合，放大后可拖动平移）
  const [view, setView] = useState<ViewState>(IDENTITY_VIEW)

  // ===== 选点 =====
  const [points, setPoints] = useState<PickPoint[]>([])

  // ===== 长按精确取色状态 =====
  const [pressing, setPressing] = useState(false)
  const [longPressActive, setLongPressActive] = useState(false)

  // ===== 毛布数据 =====
  const [fabrics, setFabrics] = useState<NormalizedFabric[]>([])
  const [dataSource, setDataSource] = useState<"loading" | "sample" | "external">("loading")

  // ===== 数据库筛选：商家开关（默认全部开启，关闭后不出现在匹配结果）=====
  const [vendorOn, setVendorOn] = useState<Record<string, boolean>>({})
  const [dbOpen, setDbOpen] = useState(false)
  const [moreKindsOpen, setMoreKindsOpen] = useState(false)

  // ===== 状态 =====
  const [status, setStatus] = useState("")

  const containerRef = useRef<HTMLDivElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)
  const srcCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const loupeWrapRef = useRef<HTMLDivElement>(null)
  const loupeCanvasRef = useRef<HTMLCanvasElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dbRef = useRef<HTMLDivElement>(null)
  const nextIdRef = useRef(1)
  const statusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // 镜像状态到 ref：语言切换后重发「数据库已就绪」提示时，仅当尚无图片/选点才覆盖状态条
  const imageLoadedRef = useRef(false)
  const pointCountRef = useRef(0)
  imageLoadedRef.current = imageUrl !== null
  pointCountRef.current = points.length

  // 长按按压状态（避免频繁 setState）
  const pressRef = useRef<{
    timer: ReturnType<typeof setTimeout> | null
    active: boolean
    fired: boolean
    source: "mouse" | "touch" | null
    px: number
    py: number
    panMode: boolean // 放大后拖动平移模式
    downX: number
    downY: number
    lastX: number
    lastY: number
  }>({ timer: null, active: false, fired: false, source: null, px: 0, py: 0, panMode: false, downX: 0, downY: 0, lastX: 0, lastY: 0 })
  // 双指捏合状态
  const pinchRef = useRef<{ active: boolean; init: boolean; lastDist: number }>({ active: false, init: false, lastDist: 0 })
  // 长按松手后吞掉紧随的 click（触屏合成事件 / 桌面松手触发）
  const suppressClickRef = useRef(false)
  // 触屏结束时间戳：用于屏蔽触屏后 700ms 内浏览器派发的合成鼠标事件
  const lastTouchEndRef = useRef(0)

  // object-contain 渲染矩形
  const fitRect = useMemo(() => {
    if (!containerSize || !imageSize) return null
    const scale = Math.min(containerSize.w / imageSize.w, containerSize.h / imageSize.h)
    const w = imageSize.w * scale
    const h = imageSize.h * scale
    return { x: (containerSize.w - w) / 2, y: (containerSize.h - h) / 2, w, h }
  }, [containerSize, imageSize])

  // 图片栏最小高度：按图片长宽比计算（宽度铺满时的高度），
  // 窗口过窄/选点过多挤压图片栏时也不低于该值，避免图片被压成异常尺寸
  const aspectMinH = useMemo(() => {
    if (!imageSize || !containerSize) return undefined
    const ratio = imageSize.w / imageSize.h
    if (!Number.isFinite(ratio) || ratio <= 0) return undefined
    const fittedH = containerSize.w / ratio
    if (!Number.isFinite(fittedH)) return undefined
    const viewportCap = typeof window !== "undefined" ? Math.round(window.innerHeight * 0.72) : 560
    return Math.round(Math.min(Math.max(fittedH, 260), Math.min(560, viewportCap)))
  }, [imageSize, containerSize])

  const showStatus = useCallback((msg: string) => {
    setStatus(msg)
    if (statusTimerRef.current) clearTimeout(statusTimerRef.current)
    statusTimerRef.current = setTimeout(() => setStatus(""), 5000)
  }, [])

  // ===== 数据库筛选派生：商家清单 / 开启商家 / 种类分组 / 全量判断 =====
  const vendorList = useMemo(() => [...new Set(fabrics.map((f) => f.vendor))], [fabrics])
  // 关闭的商家完全不参与匹配（含预览 TopN 与计数）
  const activeFabrics = useMemo(
    () => fabrics.filter((f) => vendorOn[f.vendor] !== false),
    [fabrics, vendorOn]
  )
  const allVendorsOn = useMemo(
    () => vendorList.length > 0 && vendorList.every((v) => vendorOn[v] !== false),
    [vendorList, vendorOn]
  )
  // 商家按 fabricKind 分组（真实库均为"长毛"；示例数据含多种类用于开发演示）
  const kindGroups = useMemo(() => {
    const byKind = new Map<string, { vendor: string; count: number }[]>()
    for (const f of fabrics) {
      const list = byKind.get(f.fabricKind) ?? []
      const row = list.find((r) => r.vendor === f.vendor)
      if (row) row.count++
      else list.push({ vendor: f.vendor, count: 1 })
      byKind.set(f.fabricKind, list)
    }
    return [...byKind.entries()].map(([kind, vendors]) => ({ kind, vendors }))
  }, [fabrics])

  const toggleVendor = useCallback(
    (vendor: string) => {
      setVendorOn((prev) => {
        const currentlyOn = prev[vendor] !== false
        // 关闭最后一个开启商家 → 拒绝（毛布色库不能为空）
        if (currentlyOn) {
          const onCount = Object.values(prev).filter((v) => v !== false).length
          if (onCount <= 1) {
            showStatus(t("sampler.status.keepOneVendor"))
            return prev
          }
          return { ...prev, [vendor]: false }
        }
        return { ...prev, [vendor]: true }
      })
    },
    [showStatus, t]
  )

  // 点击面板外部 → 收起数据库面板
  useEffect(() => {
    if (!dbOpen) return
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (dbRef.current && !dbRef.current.contains(e.target as Node)) setDbOpen(false)
    }
    document.addEventListener("mousedown", onDown)
    document.addEventListener("touchstart", onDown)
    return () => {
      document.removeEventListener("mousedown", onDown)
      document.removeEventListener("touchstart", onDown)
    }
  }, [dbOpen])

  // 面板展开期间锁定页面背景滚动（桌面下拉 / 移动端抽屉各自内部滚动）
  useEffect(() => {
    if (!dbOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = prev
    }
  }, [dbOpen])

  // 每点派生数据：OKLab / Pantone Top3 / 毛布 Top3（仅来自开启的商家）
  const pointDerived = useMemo(() => {
    const map = new Map<
      number,
      { oklab: [number, number, number]; pantones: ReturnType<typeof matchPantones>; previews: FabricMatch[] }
    >()
    for (const p of points) {
      const oklab = fabricOklab(p.r, p.g, p.b)
      map.set(p.id, {
        oklab,
        pantones: matchPantones(p.r, p.g, p.b, PANTONE_N),
        previews: matchFabrics(oklab, activeFabrics, PREVIEW_N),
      })
    }
    return map
  }, [points, activeFabrics])

  // 最新取色快照同步到 window（右上角「数据导出」面板读取）
  useEffect(() => {
    if (typeof window === "undefined") return
    window.__longwooSamplerSnapshot = {
      app: "longwoo-fabric-sampler",
      version: 1,
      exportedAt: new Date().toISOString(),
      source: {
        name: fileName || null,
        width: imageSize?.w ?? null,
        height: imageSize?.h ?? null,
      },
      database: {
        pantoneCount: PANTONE_DATA.length,
        fabricCount: fabrics.length,
        fabricSource: dataSource,
        vendors: Object.keys(vendorOn),
        vendorsOn: Object.keys(vendorOn).filter((v) => vendorOn[v]),
      },
      points: points.map((p, idx) => {
        const d = pointDerived.get(p.id)
        return {
          index: idx + 1,
          x: p.x,
          y: p.y,
          hex: rgbToHex(p.r, p.g, p.b),
          rgb: { r: p.r, g: p.g, b: p.b },
          oklab: d?.oklab ?? [0, 0, 0],
          pantones: d?.pantones ?? [],
          fabrics: (d?.previews ?? []).map((m) => ({
            skuId: m.fabric.skuId,
            name: m.fabric.name,
            vendor: m.fabric.vendor,
            fabricKind: m.fabric.fabricKind,
            ph: m.fabric.ph,
            hex: m.fabric.hex,
            source: m.fabric.source,
            delta: Number(m.delta.toFixed(3)),
          })),
        }
      }),
    }
  }, [points, pointDerived, imageSize, fileName, fabrics, vendorOn, dataSource])

  // 容器尺寸监听
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      const r = entries[0].contentRect
      setContainerSize({ w: r.width, h: r.height })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // 桌面滚轮缩放：以光标为锚点（非 passive，阻止页面滚动）；
  // 滚轮向下缩小至 100% 时平移自动归零
  useEffect(() => {
    const el = containerRef.current
    if (!el || !fitRect || !containerSize) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const crect = el.getBoundingClientRect()
      const rx = e.clientX - crect.left
      const ry = e.clientY - crect.top
      const factor = e.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP
      setView((v) =>
        clampPan(zoomAt(v, rx, ry, factor, containerSize.w, containerSize.h), fitRect.w, fitRect.h, containerSize.w, containerSize.h),
      )
    }
    el.addEventListener("wheel", onWheel, { passive: false })
    return () => el.removeEventListener("wheel", onWheel)
  }, [fitRect, containerSize])

  useEffect(() => {
    const press = pressRef.current
    return () => {
      if (statusTimerRef.current) clearTimeout(statusTimerRef.current)
      if (press.timer) clearTimeout(press.timer)
    }
  }, [])

  // 加载毛布数据
  useEffect(() => {
    let cancelled = false
    loadFabricData().then((result) => {
      if (cancelled) return
      setFabrics(result.fabrics)
      setDataSource(result.external ? "external" : "sample")
      // 默认全部开启（数据库按钮 → 全量）
      const vendors = [...new Set(result.fabrics.map((f) => f.vendor))]
      setVendorOn(Object.fromEntries(vendors.map((v) => [v, true])))
      const vendorCount = vendors.length
      // 语言切换后本 effect 会随 lang 重跑：仅在空闲状态（未上图/未选点）才刷新提示文案
      if (!imageLoadedRef.current && pointCountRef.current === 0) {
        showStatus(
          fill(t("sampler.status.dbReady"), {
            pantone: PANTONE_DATA.length,
            fabric: result.fabrics.length,
            vendor: vendorCount,
            dataNote: result.external ? t("sampler.status.liveData") : t("sampler.status.sampleData"),
          })
        )
      }
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang])

  // ===== 上传 =====
  const handleFile = useCallback(
    (file: File) => {
      if (!file.type.startsWith("image/")) {
        showStatus(t("sampler.status.imageOnly"))
        return
      }
      const reader = new FileReader()
      reader.onload = () => {
        const url = reader.result as string
        const img = new Image()
        img.onload = () => {
          setImageUrl(url)
          setImageSize({ w: img.naturalWidth, h: img.naturalHeight })
          setFileName(file.name)
          const c = document.createElement("canvas")
          c.width = img.naturalWidth
          c.height = img.naturalHeight
          const ctx = c.getContext("2d", { willReadFrequently: true })
          if (ctx) {
            ctx.drawImage(img, 0, 0)
            srcCanvasRef.current = c
          }
          setPoints([])
          nextIdRef.current = 1
          setView(IDENTITY_VIEW)
          showStatus(
            fill(t("sampler.status.imgLoaded"), {
              w: img.naturalWidth,
              h: img.naturalHeight,
              max: MAX_POINTS,
            })
          )
        }
        img.src = url
      }
      reader.readAsDataURL(file)
    },
    [showStatus, t]
  )

  const handlePickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
    e.target.value = ""
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file) handleFile(file)
  }

  // ===== 坐标换算（缩放模型：client 为容器相对坐标）=====
  const toPixel = useCallback(
    (clientX: number, clientY: number): { px: number; py: number } | null => {
      if (!fitRect || !imageSize || !containerSize || !containerRef.current) return null
      const crect = containerRef.current.getBoundingClientRect()
      return clientToPixel(
        clientX - crect.left,
        clientY - crect.top,
        view,
        fitRect.w,
        fitRect.h,
        imageSize.w,
        imageSize.h,
        containerSize.w,
        containerSize.h,
      )
    },
    [fitRect, imageSize, containerSize, view]
  )

  // ===== 选点（点击 / 长按松手共用）=====
  const selectPixel = useCallback(
    (px: number, py: number) => {
      const src = srcCanvasRef.current
      if (!src || !fitRect || !imageSize || !containerSize) return
      // 点击位置在容器中的显示坐标（用于命中已选点）
      const clickDisp = pixelToClient(
        px,
        py,
        view,
        fitRect.w,
        fitRect.h,
        imageSize.w,
        imageSize.h,
        containerSize.w,
        containerSize.h,
      )

      // 命中已选点 → 删除（以像素坐标 + 当前视图实时换算显示位置，避免缩放/平移后错位）
      const hitIdx = points.findIndex((p) => {
        const d = pixelToClient(
          p.x,
          p.y,
          view,
          fitRect.w,
          fitRect.h,
          imageSize.w,
          imageSize.h,
          containerSize.w,
          containerSize.h,
        )
        return Math.hypot(d.x - clickDisp.x, d.y - clickDisp.y) < 14
      })
      if (hitIdx >= 0) {
        const removed = points[hitIdx]
        setPoints((prev) => prev.filter((_, i) => i !== hitIdx))
        showStatus(fill(t("sampler.status.pointDeleted"), { id: removed.id, x: px, y: py }))
        return
      }

      if (points.length >= MAX_POINTS) {
        showStatus(fill(t("sampler.status.maxPoints"), { max: MAX_POINTS }))
        return
      }
      if (points.some((p) => p.x === px && p.y === py)) {
        showStatus(fill(t("sampler.status.pixelAlready"), { x: px, y: py }))
        return
      }

      const ctx = src.getContext("2d", { willReadFrequently: true })
      if (!ctx) return
      const d = ctx.getImageData(px, py, 1, 1).data
      const id = nextIdRef.current++
      setPoints((prev) => [...prev, { id, x: px, y: py, r: d[0], g: d[1], b: d[2] }])
      showStatus(
        fill(t("sampler.status.pointAdded"), {
          id,
          x: px,
          y: py,
          hex: rgbToHex(d[0], d[1], d[2]),
        })
      )
    },
    [points, fitRect, imageSize, containerSize, view, showStatus, t]
  )

  // ===== 放大镜：绘制 / 定位 / 信息 =====
  const drawLoupe = useCallback(
    (px: number, py: number) => {
      const src = srcCanvasRef.current
      const cv = loupeCanvasRef.current
      if (!src || !cv || !imageSize) return
      const ctx = cv.getContext("2d")
      if (!ctx) return
      cv.width = LOUPE_PX
      cv.height = LOUPE_PX
      ctx.imageSmoothingEnabled = false
      const half = Math.floor(LOUPE_SIZE / 2)
      const sx = Math.min(imageSize.w - LOUPE_SIZE, Math.max(0, px - half))
      const sy = Math.min(imageSize.h - LOUPE_SIZE, Math.max(0, py - half))
      ctx.drawImage(src, sx, sy, LOUPE_SIZE, LOUPE_SIZE, 0, 0, LOUPE_PX, LOUPE_PX)
      ctx.strokeStyle = "rgba(10,10,10,0.14)"
      ctx.lineWidth = 1
      for (let i = 1; i < LOUPE_SIZE; i++) {
        ctx.beginPath(); ctx.moveTo(i * LOUPE_CELL, 0); ctx.lineTo(i * LOUPE_CELL, LOUPE_PX); ctx.stroke()
        ctx.beginPath(); ctx.moveTo(0, i * LOUPE_CELL); ctx.lineTo(LOUPE_PX, i * LOUPE_CELL); ctx.stroke()
      }
      const cx = (px - sx) * LOUPE_CELL
      const cy = (py - sy) * LOUPE_CELL
      ctx.strokeStyle = "rgba(10,10,10,0.85)"
      ctx.lineWidth = 1.5
      ctx.strokeRect(cx + 0.5, cy + 0.5, LOUPE_CELL - 1, LOUPE_CELL - 1)
      ctx.fillStyle = "rgba(10,10,10,0.10)"
      ctx.fillRect(cx, cy, LOUPE_CELL, LOUPE_CELL)
      ctx.strokeStyle = "rgba(10,10,10,0.45)"
      ctx.lineWidth = 1
      ctx.beginPath(); ctx.moveTo(LOUPE_PX / 2, 0); ctx.lineTo(LOUPE_PX / 2, LOUPE_PX); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(0, LOUPE_PX / 2); ctx.lineTo(LOUPE_PX, LOUPE_PX / 2); ctx.stroke()
    },
    [imageSize]
  )

  const positionLoupe = useCallback((clientX: number, clientY: number) => {
    const wrap = loupeWrapRef.current
    const container = containerRef.current
    if (!wrap || !container) return
    const rect = container.getBoundingClientRect()
    const relX = clientX - rect.left
    const relY = clientY - rect.top
    const GAP = 14
    let left = relX + GAP
    let top = relY + GAP
    if (left + LOUPE_PX > rect.width) left = relX - LOUPE_PX - GAP
    if (top + LOUPE_PX + 24 > rect.height) top = relY - LOUPE_PX - 24 - GAP
    wrap.style.display = "block"
    wrap.style.left = `${Math.max(4, left)}px`
    wrap.style.top = `${Math.max(4, top)}px`
  }, [])

  const updateLoupeInfo = useCallback((px: number, py: number) => {
    const wrap = loupeWrapRef.current
    const info = wrap?.querySelector<HTMLElement>("[data-loupe-info]")
    if (info && srcCanvasRef.current) {
      const ctx = srcCanvasRef.current.getContext("2d", { willReadFrequently: true })
      if (ctx) {
        const d = ctx.getImageData(px, py, 1, 1).data
        info.textContent = `${px}, ${py} · #${rgbToHex(d[0], d[1], d[2])}`
      }
    }
  }, [])

  // ===== 长按精确取色：按住 → 放大镜跟随 → 松手取色 =====
  const startPress = useCallback(
    (clientX: number, clientY: number, source: "mouse" | "touch") => {
      if (!srcCanvasRef.current || !fitRect || !imageSize) return
      const pos = toPixel(clientX, clientY)
      if (!pos) return
      const pr = pressRef.current
      if (pr.timer) clearTimeout(pr.timer)
      pr.active = true
      pr.fired = false
      pr.source = source
      pr.px = pos.px
      pr.py = pos.py
      drawLoupe(pos.px, pos.py)
      updateLoupeInfo(pos.px, pos.py)
      positionLoupe(clientX, clientY)
      setPressing(true)
      pr.timer = setTimeout(() => {
        if (pressRef.current.active) {
          pressRef.current.fired = true
          setLongPressActive(true)
        }
      }, LONG_PRESS_MS)
    },
    [fitRect, imageSize, toPixel, drawLoupe, updateLoupeInfo, positionLoupe]
  )

  const movePress = useCallback(
    (clientX: number, clientY: number) => {
      const pr = pressRef.current
      if (!pr.active) return
      const pos = toPixel(clientX, clientY)
      if (!pos) return
      pr.px = pos.px
      pr.py = pos.py
      drawLoupe(pos.px, pos.py)
      updateLoupeInfo(pos.px, pos.py)
      positionLoupe(clientX, clientY)
    },
    [toPixel, drawLoupe, updateLoupeInfo, positionLoupe]
  )

  const finalizePress = useCallback(() => {
    const pr = pressRef.current
    if (pr.timer) {
      clearTimeout(pr.timer)
      pr.timer = null
    }
    if (!pr.active) return
    pr.active = false
    // 平移模式结束：不取色，吞掉紧随的合成 click
    if (pr.panMode) {
      pr.panMode = false
      pr.source = null
      setPressing(false)
      setLongPressActive(false)
      suppressClickRef.current = true
      setTimeout(() => {
        suppressClickRef.current = false
      }, 400)
      return
    }
    const { fired, source, px, py } = pr
    pr.source = null
    setPressing(false)
    setLongPressActive(false)
    if (source === "touch" || fired) {
      // 触屏：松手即取色（长按精确 / 轻点快速）；鼠标：仅长按后松手取色（轻点交给 click）
      suppressClickRef.current = true
      // 400ms 后自动复位，避免「松手位置不在图片上 → click 未触发」时残留吞点
      setTimeout(() => {
        suppressClickRef.current = false
      }, 400)
      selectPixel(px, py)
    }
  }, [selectPixel])

  // 窗口级松手兜底（鼠标在图片外松开 / 手指滑出图片）
  useEffect(() => {
    const onUp = () => finalizePress()
    window.addEventListener("mouseup", onUp)
    window.addEventListener("touchend", onUp)
    return () => {
      window.removeEventListener("mouseup", onUp)
      window.removeEventListener("touchend", onUp)
    }
  }, [finalizePress])

  const isPostTouch = useCallback(() => Date.now() - lastTouchEndRef.current < 700, [])

  // ===== 鼠标事件 =====
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return
      if (isPostTouch()) return
      const pr = pressRef.current
      pr.downX = e.clientX
      pr.downY = e.clientY
      pr.panMode = false
      startPress(e.clientX, e.clientY, "mouse")
    },
    [isPostTouch, startPress]
  )

  const handleMouseUp = useCallback(() => {
    if (isPostTouch()) return
    finalizePress()
  }, [isPostTouch, finalizePress])

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (isPostTouch()) return
      const pr = pressRef.current
      if (pr.active) {
        // 放大（zoom > 1）后按住拖动 → 平移；位移超过阈值才进入平移模式，
        // 未移动的按住保持放大镜取色
        if (!pr.panMode && view.zoom > 1 && Math.hypot(e.clientX - pr.downX, e.clientY - pr.downY) > PAN_THRESHOLD) {
          pr.panMode = true
          pr.lastX = e.clientX
          pr.lastY = e.clientY
          if (pr.timer) {
            clearTimeout(pr.timer)
            pr.timer = null
          }
          setPressing(false)
          setLongPressActive(false)
          if (loupeWrapRef.current) loupeWrapRef.current.style.display = "none"
        }
        if (pr.panMode) {
          const dx = e.clientX - pr.lastX
          const dy = e.clientY - pr.lastY
          pr.lastX = e.clientX
          pr.lastY = e.clientY
          if (fitRect && containerSize) {
            setView((v) => panBy(v, dx, dy, fitRect.w, fitRect.h, containerSize.w, containerSize.h))
          }
          return
        }
        movePress(e.clientX, e.clientY)
        return
      }
      const wrap = loupeWrapRef.current
      if (!wrap) return
      const pos = toPixel(e.clientX, e.clientY)
      if (!pos) {
        wrap.style.display = "none"
        return
      }
      drawLoupe(pos.px, pos.py)
      updateLoupeInfo(pos.px, pos.py)
      positionLoupe(e.clientX, e.clientY)
    },
    [isPostTouch, movePress, toPixel, drawLoupe, updateLoupeInfo, positionLoupe, view.zoom, fitRect, containerSize]
  )

  const handleMouseLeave = useCallback(() => {
    if (isPostTouch()) return
    const pr = pressRef.current
    if (pr.active) {
      // 按住时移出图片 → 取消本次按压（平移 / 放大镜均不取色）
      if (pr.timer) clearTimeout(pr.timer)
      pr.timer = null
      pr.active = false
      pr.panMode = false
      pr.source = null
      pr.fired = false
      setPressing(false)
      setLongPressActive(false)
      return
    }
    if (loupeWrapRef.current) loupeWrapRef.current.style.display = "none"
  }, [isPostTouch])

  // ===== 触屏事件（双指捏合缩放；放大后单指拖动平移；单指长按放大镜取色）=====
  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      const pr = pressRef.current
      if (e.touches.length >= 2) {
        // 两指 → 进入捏合模式，取消单指按压
        const [t1, t2] = [e.touches[0], e.touches[1]]
        const crect = containerRef.current?.getBoundingClientRect()
        if (!crect) return
        pinchRef.current = {
          active: true,
          init: false,
          lastDist: Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY),
        }
        if (pr.timer) {
          clearTimeout(pr.timer)
          pr.timer = null
        }
        pr.active = false
        pr.panMode = false
        setPressing(false)
        setLongPressActive(false)
        return
      }
      const t = e.touches[0]
      if (!t) return
      pr.downX = t.clientX
      pr.downY = t.clientY
      pr.panMode = false
      startPress(t.clientX, t.clientY, "touch")
    },
    [startPress]
  )

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      const crect = containerRef.current?.getBoundingClientRect()
      if (!crect) return
      const pin = pinchRef.current
      const pr = pressRef.current
      if (e.touches.length >= 2) {
        const [t1, t2] = [e.touches[0], e.touches[1]]
        const dist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY)
        const cx = (t1.clientX + t2.clientX) / 2 - crect.left
        const cy = (t1.clientY + t2.clientY) / 2 - crect.top
        if (pin.active) {
          // 首次 move 只记录基准距离，之后按距离增量缩放（避免锚点漂移）
          if (!pin.init) {
            pin.init = true
            pin.lastDist = dist
            return
          }
          const ratio = dist / pin.lastDist
          if (ratio > 0 && fitRect && containerSize) {
            setView((v) =>
              clampPan(zoomAt(v, cx, cy, ratio, containerSize.w, containerSize.h), fitRect.w, fitRect.h, containerSize.w, containerSize.h),
            )
          }
          pin.lastDist = dist
        }
        return
      }
      if (pin.active) {
        // 两指抬至一指：结束捏合，残余单指 move 不处理（防误平移）
        return
      }
      const t = e.touches[0]
      if (!t) return
      if (pr.active) {
        if (!pr.panMode && view.zoom > 1 && Math.hypot(t.clientX - pr.downX, t.clientY - pr.downY) > PAN_THRESHOLD) {
          pr.panMode = true
          pr.lastX = t.clientX
          pr.lastY = t.clientY
          if (pr.timer) {
            clearTimeout(pr.timer)
            pr.timer = null
          }
          setPressing(false)
          setLongPressActive(false)
          if (loupeWrapRef.current) loupeWrapRef.current.style.display = "none"
        }
        if (pr.panMode) {
          const dx = t.clientX - pr.lastX
          const dy = t.clientY - pr.lastY
          pr.lastX = t.clientX
          pr.lastY = t.clientY
          if (fitRect && containerSize) {
            setView((v) => panBy(v, dx, dy, fitRect.w, fitRect.h, containerSize.w, containerSize.h))
          }
          return
        }
        movePress(t.clientX, t.clientY)
      }
    },
    [view.zoom, fitRect, containerSize, movePress]
  )

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      lastTouchEndRef.current = Date.now()
      const pin = pinchRef.current
      const pr = pressRef.current
      if (pin.active) {
        // 捏合结束：吞掉浏览器随后的合成 click，防止误取色
        pin.active = false
        pr.active = false
        pr.panMode = false
        suppressClickRef.current = true
        setTimeout(() => {
          suppressClickRef.current = false
        }, 400)
        return
      }
      if (pr.panMode) {
        pr.active = false
        pr.panMode = false
        suppressClickRef.current = true
        setTimeout(() => {
          suppressClickRef.current = false
        }, 400)
        return
      }
      finalizePress()
    },
    [finalizePress]
  )

  const handleImageClick = useCallback(
    (e: React.MouseEvent) => {
      if (suppressClickRef.current) {
        suppressClickRef.current = false
        return
      }
      const pos = toPixel(e.clientX, e.clientY)
      if (!pos) return
      selectPixel(pos.px, pos.py)
    },
    [toPixel, selectPixel]
  )

  // ===== 渲染 =====
  const hasImage = imageUrl && imageSize && fitRect
  // 数据库按钮 hover 概要
  const dbSummary = useMemo(() => {
    if (dataSource === "loading") return t("sampler.db.loadingSummary")
    const onCount = vendorList.filter((v) => vendorOn[v] !== false).length
    const detail = kindGroups
      .map((g) => {
        const on = g.vendors.filter((v) => vendorOn[v.vendor] !== false).length
        return fill(t("sampler.db.kindSummary"), { kind: g.kind, on, total: g.vendors.length })
      })
      .join(t("sampler.db.summarySep"))
    return fill(t("sampler.db.summary"), {
      pantone: PANTONE_DATA.length,
      vendor: vendorList.length,
      on: onCount,
      detail,
    })
  }, [dataSource, vendorList, vendorOn, kindGroups, t])

  return (
    <div className="flex flex-col lg:flex-row gap-6 min-h-0 lg:h-full">
      {/* ===== 左侧：图片工作区（约 60%，自适应图片大小）===== */}
      <div className="w-full lg:w-[60%] flex flex-col min-h-0">
        <div className="flex items-center justify-between gap-3 pb-3 flex-wrap">
          <p className="flex items-center gap-1.5 text-xs text-neutral-500 min-w-0">
            <MousePointerClick className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="truncate">
              {fill(t("sampler.hint.clickGuide"), { max: MAX_POINTS })}
            </span>
          </p>
          <div className="flex items-center gap-2 flex-wrap min-w-0">
            {/* 数据库按钮：点击展开数据库分类选择面板（潘通必选 + 毛布商家开关） */}
            <div ref={dbRef} className="relative">
              <button
                type="button"
                onClick={() => setDbOpen((o) => !o)}
                disabled={dataSource === "loading"}
                title={dbSummary}
                aria-expanded={dbOpen}
                className={`inline-flex items-center gap-1.5 min-h-[36px] px-3 rounded-full text-xs font-semibold border transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-wait ${
                  dataSource === "loading"
                    ? "bg-neutral-50 border-neutral-200 text-neutral-400"
                    : allVendorsOn
                      ? "bg-emerald-50 border-emerald-300 text-emerald-800 hover:bg-emerald-100"
                      : "bg-blue-50 border-blue-300 text-blue-800 hover:bg-blue-100"
                }`}
              >
                {dataSource === "loading" ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin flex-shrink-0" />
                ) : (
                  <Database className="w-3.5 h-3.5 flex-shrink-0" />
                )}
                <span>{t("sampler.db.button")}</span>
                {/* 副标题：全量（绿）/ 自定义（蓝） */}
                <span
                  className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold leading-none ${
                    dataSource === "loading"
                      ? "bg-neutral-200 text-neutral-400"
                      : allVendorsOn
                        ? "bg-emerald-600 text-white"
                        : "bg-blue-600 text-white"
                  }`}
                >
                  {dataSource === "loading" ? "…" : allVendorsOn ? t("sampler.db.all") : t("sampler.db.custom")}
                </span>
                <ChevronDown className={`w-3 h-3 flex-shrink-0 transition-transform ${dbOpen ? "rotate-180" : ""}`} />
              </button>

              {dbOpen && (
                <>
                  {/* 移动端遮罩：点击关闭并隔离背景（桌面端隐藏） */}
                  <div
                    className="fixed inset-0 z-40 bg-black/25 sm:hidden"
                    onClick={() => setDbOpen(false)}
                    aria-hidden
                  />
                  {/* 面板：移动端 = 底部抽屉（全宽，不超出屏幕）；桌面端 = 按钮下方下拉 */}
                  <div className="fixed inset-x-0 bottom-0 z-50 p-2.5 sm:p-0 sm:absolute sm:inset-auto sm:right-0 sm:top-full sm:mt-1.5 sm:w-[330px] sm:z-40">
                    <div className="max-h-[min(72vh,560px)] overflow-y-auto overscroll-contain rounded-2xl border border-neutral-200 bg-white shadow-xl p-2.5 sm:max-h-[min(560px,72vh)]">
                  {/* 移动端抽屉标题栏（桌面端隐藏） */}
                  <div className="flex items-center justify-between gap-2 px-1 pb-2 sm:hidden">
                    <p className="text-sm font-semibold text-neutral-800 flex items-center gap-1.5">
                      <Database className="w-3.5 h-3.5" />
                      {t("sampler.db.mobileTitle")}
                    </p>
                    <button
                      type="button"
                      onClick={() => setDbOpen(false)}
                      aria-label={t("sampler.db.closePanel")}
                      className="shrink-0 w-7 h-7 rounded-full bg-neutral-100 text-neutral-500 hover:bg-neutral-200 hover:text-neutral-900 flex items-center justify-center transition-colors cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  {/* 潘通色库（必选，不可关闭） */}
                  <div className="rounded-xl px-2.5 py-2 bg-neutral-50 border border-neutral-100">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-neutral-800">{t("sampler.pantone.title")}</p>
                        <p className="text-[10px] text-neutral-400">
                          {fill(t("sampler.pantone.sub"), { n: PANTONE_DATA.length })}
                        </p>
                      </div>
                      <KindSwitch on disabled />
                    </div>
                  </div>

                  <div className="my-2 h-px bg-neutral-100" />

                  {/* 毛布色库：已导入种类（含商家开关） */}
                  <div className="px-1">
                    <p className="px-1.5 pb-1 text-[9px] font-mono tracking-[0.18em] uppercase text-neutral-400">
                      {t("sampler.fabricLib.label")}
                    </p>
                    {kindGroups.map((g) => (
                      <div key={g.kind} className="mb-1">
                        <p className="px-1.5 py-1 text-[10px] font-medium text-neutral-500">
                          {fill(t("sampler.fabricLib.kindPrefix"), { kind: g.kind })}
                        </p>
                        <div className="rounded-xl border border-neutral-100 overflow-hidden">
                          {g.vendors.map((v) => {
                            const on = vendorOn[v.vendor] !== false
                            return (
                              <button
                                key={v.vendor}
                                type="button"
                                role="switch"
                                aria-checked={on}
                                onClick={() => toggleVendor(v.vendor)}
                                title={on ? t("sampler.fabricLib.vendorOnTitle") : t("sampler.fabricLib.vendorOffTitle")}
                                className={`w-full flex items-center justify-between gap-2 px-2.5 py-2 text-left transition-colors cursor-pointer ${
                                  on ? "bg-white hover:bg-emerald-50/60" : "bg-neutral-50 hover:bg-neutral-100"
                                }`}
                              >
                                <span className="min-w-0">
                                  <span className={`block text-xs ${on ? "text-neutral-800" : "text-neutral-400 line-through decoration-neutral-300"}`}>
                                    {v.vendor}
                                  </span>
                                  <span className="block text-[9px] font-mono text-neutral-400">
                                    {fill(t("sampler.fabricLib.colorCount"), { count: v.count })}
                                  </span>
                                </span>
                                <KindSwitch on={on} />
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    ))}

                    {/* 暂未开启的种类（默认折叠） */}
                    <div className="mt-1.5">
                      <button
                        type="button"
                        onClick={() => setMoreKindsOpen((o) => !o)}
                        aria-expanded={moreKindsOpen}
                        className="w-full flex items-center justify-between gap-2 px-1.5 py-1.5 text-[10px] text-neutral-400 hover:text-neutral-700 transition-colors cursor-pointer"
                      >
                        <span>{t("sampler.fabricLib.moreKinds")}</span>
                        <ChevronDown className={`w-3 h-3 transition-transform ${moreKindsOpen ? "rotate-180" : ""}`} />
                      </button>
                      {moreKindsOpen && (
                        <div className="rounded-xl border border-neutral-100 overflow-hidden">
                          {PENDING_KINDS.map((k) => (
                            <div
                              key={k}
                              className="flex items-center justify-between gap-2 px-2.5 py-2 bg-neutral-50 opacity-70"
                            >
                              <span className="text-xs text-neutral-400">{k}</span>
                              <span className="rounded-full bg-neutral-200/70 px-1.5 py-0.5 text-[9px] text-neutral-500">
                                {t("sampler.fabricLib.notImported")}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <p className="mt-2 px-1.5 text-[9px] text-neutral-300 leading-relaxed">
                    {t("sampler.fabricLib.panelNote")}
                  </p>
                    </div>
                    </div>
                </>
              )}
            </div>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 min-h-[36px] px-4 rounded-full text-xs font-semibold text-white bg-neutral-900 hover:bg-neutral-700 transition-colors cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              {hasImage ? t("sampler.upload.replace") : t("sampler.upload.new")}
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePickFile} />
          </div>
        </div>

        {/* 图片容器：桌面撑满剩余高度，移动端/窄窗口按图片长宽比保持最小高度 */}
        <div
          ref={containerRef}
          className={`relative rounded-2xl border border-neutral-200 overflow-hidden select-none ${
            hasImage ? "lg:flex-1 lg:min-h-0 min-h-[280px]" : "h-[320px] lg:h-auto lg:flex-1"
          } bg-neutral-50`}
          style={hasImage && aspectMinH ? { minHeight: aspectMinH } : undefined}
          onDragOver={(e) => {
            e.preventDefault()
            setDragOver(true)
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onContextMenu={(e) => e.preventDefault()}
        >
          {!hasImage ? (
            <button
              onClick={() => fileInputRef.current?.click()}
              className={`absolute inset-0 flex flex-col items-center justify-center gap-3 transition-colors cursor-pointer rounded-2xl border-2 border-dashed ${
                dragOver ? "border-neutral-900 bg-neutral-100" : "border-neutral-300 hover:border-neutral-500"
              }`}
            >
              <div className="w-14 h-14 rounded-full bg-neutral-100 border border-neutral-200 flex items-center justify-center">
                <ImagePlus className="w-6 h-6 text-neutral-400" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-neutral-600">{t("sampler.drop.title")}</p>
                <p className="text-xs text-neutral-400 mt-1">{t("sampler.drop.sub")}</p>
              </div>
            </button>
          ) : (
            <>
              {/* 源图：纯展示层，pointer-events 关闭 —— 浏览器无法对图片本体
                  触发长按「保存图片/查看图片」等系统菜单；坐标换算仍以 img 定位。
                  缩放模型：以 fitRect 中心为原点 scale(zoom) + translate(pan) */}
              {/* eslint-disable-next-line @next/next/no-img-element -- 本地 dataURL 需精确像素渲染与坐标换算 */}
              <img
                ref={imgRef}
                src={imageUrl}
                alt={t("sampler.img.sourceAlt")}
                draggable={false}
                className="absolute pointer-events-none select-none"
                style={{
                  left: fitRect.x,
                  top: fitRect.y,
                  width: fitRect.w,
                  height: fitRect.h,
                  transform: `translate(${view.panX}px, ${view.panY}px) scale(${view.zoom})`,
                  transformOrigin: "center",
                  willChange: "transform",
                  userSelect: "none",
                  WebkitTouchCallout: "none",
                }}
              />
              {/* 交互层：承载全部取色事件（点击/长按/触屏），
                  长按发生在普通 div 上而非图片上，配合 contextmenu 拦截不再弹出系统菜单 */}
              <div
                className="absolute inset-0 z-[5] select-none"
                style={{ cursor: "crosshair", touchAction: "none", userSelect: "none", WebkitTouchCallout: "none" }}
                onClick={handleImageClick}
                onMouseMove={handleMouseMove}
                onMouseLeave={handleMouseLeave}
                onMouseDown={handleMouseDown}
                onMouseUp={handleMouseUp}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                onContextMenu={(e) => e.preventDefault()}
              />
              {/* 选点标记（纸墨风格：墨色描边 + 白底编号）。
                  位置由原始像素坐标 + 当前视图实时换算，缩放/平移后标记始终贴住对应像素 */}
              {points.map((p, idx) => {
                // hasImage 分支内 fitRect/containerSize 均已非空（fitRect 依赖 containerSize）
                const disp = pixelToClient(
                  p.x,
                  p.y,
                  view,
                  fitRect.w,
                  fitRect.h,
                  imageSize.w,
                  imageSize.h,
                  containerSize!.w,
                  containerSize!.h,
                )
                return (
                  <div
                    key={p.id}
                    className="absolute z-10 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
                    style={{ left: disp.x, top: disp.y }}
                  >
                    <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 block w-5 h-px bg-neutral-900/80" />
                    <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 block w-px h-5 bg-neutral-900/80" />
                    <span
                      className="relative flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-bold shadow border"
                      style={{
                        borderColor: `rgb(${p.r},${p.g},${p.b})`,
                        color: "#0a0a0a",
                        backgroundColor: "rgba(255,255,255,0.92)",
                        animation: "colorPickPop 0.22s ease-out",
                      }}
                    >
                      {idx + 1}
                    </span>
                  </div>
                )
              })}
              {/* 像素放大镜（浅色；长按/按住时显示取色提示） */}
              <div ref={loupeWrapRef} className="absolute z-20 hidden" style={{ display: "none" }}>
                <canvas
                  ref={loupeCanvasRef}
                  width={LOUPE_PX}
                  height={LOUPE_PX}
                  className="block rounded-lg border border-neutral-300 shadow-lg bg-white"
                />
                <div
                  data-loupe-info
                  className="mt-1 px-2 py-1 rounded-md bg-white border border-neutral-200 text-[10px] font-mono text-neutral-700 text-center shadow"
                />
                {pressing && (
                  <div className="mt-1 px-2 py-1 rounded-md bg-neutral-900 text-white text-[10px] font-medium text-center shadow">
                    {longPressActive ? t("sampler.loupe.release") : t("sampler.loupe.press")}
                  </div>
                )}
              </div>
              {imageSize && (
                <span className="absolute top-2 right-2 flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-white/85 border border-neutral-200 text-[10px] font-mono text-neutral-500">
                  <span>{imageSize.w} × {imageSize.h}px</span>
                  {view.zoom > 1 ? (
                    <button
                      onClick={() => setView(IDENTITY_VIEW)}
                      title={t("sampler.zoom.restore")}
                      className="inline-flex items-center gap-0.5 text-neutral-700 hover:text-neutral-900 cursor-pointer"
                    >
                      <span>{Math.round(view.zoom * 100)}%</span>
                      <X className="w-2.5 h-2.5" />
                    </button>
                  ) : (
                    <span>100%</span>
                  )}
                </span>
              )}
            </>
          )}
        </div>

        {/* 状态条 */}
        <div className="mt-2 flex items-center gap-3 min-h-5 text-xs">
          {pressing ? (
            <span className="inline-flex items-center gap-1.5 text-neutral-600">
              <span className="w-1.5 h-1.5 rounded-full bg-neutral-900 animate-pulse" />
              {longPressActive ? t("sampler.statusBar.pressLocked") : t("sampler.statusBar.pressMove")}
            </span>
          ) : status ? (
            <span className="inline-flex items-center gap-1.5 text-neutral-600">
              <span className="w-1.5 h-1.5 rounded-full bg-neutral-900 animate-pulse" />
              {status}
            </span>
          ) : (
            <span className="text-neutral-400">
              {hasImage
                ? fill(t("sampler.statusBar.pointsSelected"), { count: points.length, max: MAX_POINTS })
                : t("sampler.statusBar.waiting")}
            </span>
          )}
        </div>
      </div>

      {/* ===== 右侧：参数区（约 40%，可滚动查看详细参数）===== */}
      <div className="w-full lg:w-[40%] min-h-0 flex flex-col">
        <div className="flex items-center justify-between pb-2">
          <p className="font-mono text-[10px] tracking-[0.2em] uppercase text-neutral-400">{t("sampler.params.title")}</p>
          {points.length > 0 && (
            <button
              onClick={() => {
                setPoints([])
                showStatus(t("sampler.status.cleared"))
              }}
              className="inline-flex items-center gap-1 text-[11px] text-neutral-400 hover:text-neutral-900 transition-colors cursor-pointer"
            >
              <X className="w-3 h-3" />
              {t("sampler.params.clear")}
            </button>
          )}
        </div>

        {/* 参数列表：移动端自然向下延伸（随整页滚动），桌面端固定高度内部滚动 */}
        <div className="space-y-3 pr-1 lg:flex-1 lg:min-h-0 lg:overflow-y-auto">
          {!hasImage ? (
            <div className="flex flex-col items-center justify-center gap-2 h-40 rounded-2xl border border-dashed border-neutral-300 text-xs text-neutral-400">
              <MousePointerClick className="w-5 h-5" />
              {t("sampler.params.emptyNoImage")}
            </div>
          ) : points.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 h-40 rounded-2xl border border-dashed border-neutral-300 text-xs text-neutral-400">
              <MousePointerClick className="w-5 h-5" />
              {fill(t("sampler.params.emptyNoPoints"), { max: MAX_POINTS })}
            </div>
          ) : (
            points.map((p, idx) => (
              <PointCard
                key={p.id}
                point={p}
                index={idx}
                derived={pointDerived.get(p.id)}
                onDelete={() => {
                  setPoints((prev) => prev.filter((q) => q.id !== p.id))
                  showStatus(fill(t("sampler.status.pointRemoved"), { id: idx + 1 }))
                }}
              />
            ))
          )}

          {/* Δ 色差分级图例 */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[9px] font-mono text-neutral-400">
            <span className="inline-flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-600 inline-block" />
              {t("sampler.legend.direct")}
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-neutral-500 inline-block" />
              {t("sampler.legend.reference")}
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-red-800 inline-block" />
              {t("sampler.legend.none")}
            </span>
          </div>

          <p className="text-[10px] text-neutral-300 leading-relaxed">
            {t("sampler.disclaimer")}
          </p>
        </div>
      </div>
    </div>
  );
}

// ==================== 数据库面板开关（纯视觉，容器行负责点击切换）====================

function KindSwitch({ on, disabled }: { on: boolean; disabled?: boolean }) {
  return (
    <span
      aria-hidden
      className={`relative inline-block w-8 h-[18px] shrink-0 rounded-full transition-colors ${
        on ? "bg-emerald-500" : "bg-neutral-300"
      } ${disabled ? "opacity-80" : ""}`}
    >
      <span
        className={`absolute top-[2px] left-[2px] w-[14px] h-[14px] rounded-full bg-white shadow transition-transform ${
          on ? "translate-x-[14px]" : "translate-x-0"
        }`}
      />
    </span>
  )
}

// ==================== 参数卡（三栏：色块 | sRGB/Pantone×3/折叠OKLab | 参考毛布 Top3）====================

interface Derived {
  oklab: [number, number, number]
  pantones: ReturnType<typeof matchPantones>
  previews: FabricMatch[]
}

/**
 * 色差 Δ 分级配色（潘通 / 毛布匹配共用）：
 * - ≤0.030 绿色：可直接使用（色差肉眼几乎看不出）
 * - ≤0.090 灰色：可参考使用（存在肉眼可辨色差）
 * - >0.090 暗红：无色彩参考价值
 */
function deltaTone(delta: number): string {
  if (delta <= 0.03) return "text-emerald-600"
  if (delta <= 0.09) return "text-neutral-500"
  return "text-red-800"
}

function PointCard({
  point,
  index,
  derived,
  onDelete,
}: {
  point: PickPoint
  index: number
  derived?: Derived
  onDelete: () => void
}) {
  const { t } = useLanguage();
  const p = point
  const hex = rgbToHex(p.r, p.g, p.b)
  const oklab = derived?.oklab
  const pantones = derived?.pantones ?? []
  const previews = derived?.previews ?? []
  const [expanded, setExpanded] = useState(false)
  // 展开查看的毛布详情（点击参考毛布图标触发）
  const [detail, setDetail] = useState<NormalizedFabric | null>(null)

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-3.5 shadow-sm">
      <div className="flex gap-4">
      {/* 左端：匹配色块（70×140 竖长方形，带坐标与数字编号） */}
      <div className="relative w-[70px] h-[140px] rounded-xl flex-shrink-0 overflow-hidden" style={{ backgroundColor: hex }}>
        <span className="absolute top-1 left-1 inline-flex items-center justify-center w-5 h-5 rounded-full bg-neutral-900/70 text-[10px] font-bold text-white">
          {index + 1}
        </span>
        <span className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded bg-neutral-900/55 text-[9px] font-mono text-white">
          ({p.x}, {p.y})
        </span>
        <button
          onClick={onDelete}
          aria-label={fill(t("sampler.card.deleteAria"), { n: index + 1 })}
          className="absolute top-1 right-1 w-5 h-5 rounded-full bg-neutral-900/55 text-white/90 hover:bg-neutral-900 hover:text-white flex items-center justify-center cursor-pointer"
        >
          <X className="w-3 h-3" />
        </button>
      </div>

      {/* 中段：sRGB / 潘通参考色 ×3 / 折叠详细参数（OKLab） */}
      <div className="flex-1 min-w-0 space-y-1.5">
        <div>
          <p className="font-mono text-[9px] tracking-[0.18em] uppercase text-neutral-400">sRGB</p>
          <p className="text-xs font-semibold font-mono text-neutral-900">{hex}</p>
          <p className="text-[10px] font-mono text-neutral-500">rgb({p.r}, {p.g}, {p.b})</p>
        </div>
        {pantones.length > 0 && (
          <div>
            <p className="font-mono text-[9px] tracking-[0.18em] uppercase text-neutral-400">
              {fill(t("sampler.card.pantoneRef"), { n: pantones.length })}
            </p>
            <div className="space-y-0.5">
              {pantones.map((pt) => (
                <div key={pt.code} className="flex items-center gap-1.5 min-w-0">
                  <span
                    className="w-3.5 h-3.5 rounded border border-neutral-200 flex-shrink-0"
                    style={{ backgroundColor: pt.hex }}
                  />
                  <span className="text-[11px] text-neutral-700 truncate">
                    {pt.name === pt.code ? pt.code : `${pt.code} ${pt.name}`}
                  </span>
                  <span className={`flex-shrink-0 text-[8px] font-mono ${deltaTone(pt.delta)}`}>Δ {pt.delta.toFixed(3)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        {/* 折叠详情：OKLab（默认收起，供内部校验/排障） */}
        <button
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="inline-flex items-center gap-1 text-[10px] text-neutral-400 hover:text-neutral-900 transition-colors cursor-pointer"
        >
          <ChevronDown className={`w-3 h-3 transition-transform ${expanded ? "rotate-180" : ""}`} />
          {expanded ? t("sampler.card.collapse") : t("sampler.card.expand")}
        </button>
        {expanded && oklab && (
          <div className="rounded-lg bg-neutral-50 border border-neutral-100 px-2 py-1.5">
            <p className="font-mono text-[9px] tracking-[0.18em] uppercase text-neutral-400">OKLab</p>
            <p className="text-[10px] font-mono text-neutral-600">
              L {oklab[0].toFixed(3)} · a {(oklab[1] >= 0 ? "+" : "") + oklab[1].toFixed(3)} · b{" "}
              {(oklab[2] >= 0 ? "+" : "") + oklab[2].toFixed(3)}
            </p>
          </div>
        )}
      </div>

      {/* 右端：参考毛布 Top3 */}
      <div className="w-[36%] flex-shrink-0 space-y-1">
        <p className="font-mono text-[9px] tracking-[0.18em] uppercase text-neutral-400">{t("sampler.card.fabricsTop")}</p>
        {previews.length > 0 ? (
          previews.map((m) => (
            <FabricRow
              key={m.fabric.id}
              match={m}
              active={detail?.id === m.fabric.id}
              onOpen={(f) => setDetail((cur) => (cur?.id === f.id ? null : f))}
            />
          ))
        ) : (
          <p className="text-[10px] text-neutral-400">{t("sampler.card.fabricsLoading")}</p>
        )}
      </div>
      </div>
      {/* 毛布详情：再次点击同一毛布行可收回（无右上角关闭按钮） */}
      {detail && <FabricDetail fabric={detail} />}
    </div>
  );
}

// ==================== 毛布紧凑行（参数卡内预览，点击展开详情） ====================

function FabricRow({
  match,
  onOpen,
  active,
}: {
  match: FabricMatch
  onOpen?: (f: NormalizedFabric) => void
  active?: boolean
}) {
  const { t } = useLanguage();
  const { fabric, delta } = match
  const [imgFailed, setImgFailed] = useState(false)
  const [r, g, b] = fabric.sRGB
  const hex = fabric.hex ?? fabricHex(r, g, b)
  const imgPath = fabricImagePath(fabric.source)

  return (
    <button
      type="button"
      onClick={() => onOpen?.(fabric)}
      title={
        active
          ? fill(t("sampler.fabricRow.collapseTitle"), { name: fabric.name, vendor: fabric.vendor })
          : fill(t("sampler.fabricRow.viewTitle"), { name: fabric.name, vendor: fabric.vendor })
      }
      aria-expanded={active}
      className={`w-full text-left flex items-center gap-1.5 rounded-lg border px-1.5 py-1 transition-colors cursor-pointer ${
        active
          ? "bg-neutral-100 border-neutral-400 hover:bg-neutral-100"
          : "bg-neutral-50 border-neutral-100 hover:border-neutral-300 hover:bg-neutral-100"
      }`}
    >
      <span className="relative w-6 h-6 rounded flex-shrink-0 overflow-hidden" style={{ backgroundColor: hex }}>
        {!imgFailed && (
          // eslint-disable-next-line @next/next/no-img-element -- 静态缩略图按需懒加载
          <img
            src={imgPath}
            alt={fabric.name}
            loading="lazy"
            decoding="async"
            onError={() => setImgFailed(true)}
            className="w-full h-full object-cover"
          />
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[10px] font-medium text-neutral-800 truncate">
          {fabric.name}
          <span className="text-neutral-400 font-normal"> · {fabric.vendor}</span>
        </span>
        <span className="block text-[8px] font-mono text-neutral-400 truncate">{fabricPhText(fabric.ph)} · {fabric.skuId}</span>
      </span>
      <span className={`flex-shrink-0 text-[8px] font-mono ${deltaTone(delta)}`}>Δ {delta.toFixed(3)}</span>
    </button>
  );
}

// ==================== 毛布详情面板（点击参考毛布图标展开） ====================

function DetailRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-baseline gap-1.5 min-w-0">
      <span className="shrink-0 text-neutral-400">{label}</span>
      <span className={`truncate text-neutral-700 ${mono ? "font-mono" : ""}`}>{value}</span>
    </div>
  );
}

function FabricDetail({ fabric }: { fabric: NormalizedFabric }) {
  const { t } = useLanguage();
  const [imgFailed, setImgFailed] = useState(false)
  const [zoom, setZoom] = useState(false)
  const [r, g, b] = fabric.sRGB
  const hex = fabric.hex ?? fabricHex(r, g, b)
  const imgPath = fabricImagePath(fabric.source)
  const cid = cidInfo(fabric.cid)
  const lab = fabric.oklab ?? fabricOklab(r, g, b)

  return (
    <div className="mt-2 rounded-xl border border-neutral-200 bg-neutral-50 p-3">
      <div className="flex gap-3">
        {/* 毛布大图：点击查看大图预览（图片加载失败时禁用） */}
        <button
          type="button"
          onClick={() => setZoom(true)}
          disabled={imgFailed}
          title={imgFailed ? t("sampler.detail.largeImgFailed") : t("sampler.detail.viewLarge")}
          className="relative w-24 h-24 rounded-lg overflow-hidden flex-shrink-0 border border-neutral-200 group cursor-zoom-in disabled:cursor-default"
          style={{ backgroundColor: hex }}
        >
          {!imgFailed && (
            // eslint-disable-next-line @next/next/no-img-element -- 详情缩略图
            <img
              src={imgPath}
              alt={fabric.name}
              loading="lazy"
              decoding="async"
              onError={() => setImgFailed(true)}
              className="w-full h-full object-cover"
            />
          )}
          {!imgFailed && (
            <span className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/25">
              <ZoomIn className="w-5 h-5 text-white drop-shadow" />
            </span>
          )}
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-neutral-900 truncate">
                {fabric.name}
                <span className="text-neutral-400 font-normal text-xs"> · {fabric.vendor}</span>
              </p>
              <p className="text-[10px] font-mono text-neutral-400 truncate">{fabric.skuId} · #{fabric.id}</p>
            </div>
          </div>
          <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[10px]">
            <DetailRow label={t("sampler.detail.colorFamily")} value={`${cid.label}（${fabric.cid}）`} />
            <DetailRow label={t("sampler.detail.furLength")} value={fabricPhText(fabric.ph)} />
            <DetailRow label={t("sampler.detail.kind")} value={fabric.fabricKind} />
            <DetailRow label="sRGB" value={hex} mono />
            <DetailRow
              label="OKLab"
              value={`L ${lab[0].toFixed(3)} a ${(lab[1] >= 0 ? "+" : "") + lab[1].toFixed(3)} b ${(lab[2] >= 0 ? "+" : "") + lab[2].toFixed(3)}`}
              mono
            />
            {fabric.pantone && <DetailRow label={t("sampler.detail.pantone")} value={fabric.pantone} mono />}
          </div>
          {fabric.tips && <p className="mt-2 text-[9px] text-neutral-400 leading-relaxed">{fabric.tips}</p>}
        </div>
      </div>

      {/* 大图预览（点击遮罩 / 右上角关闭；点开时再次点击同毛布行亦可直接收回） */}
      {zoom && (
        <div
          className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-4 bg-black/80 backdrop-blur-sm p-6"
          onClick={() => setZoom(false)}
          role="dialog"
          aria-modal="true"
          aria-label={fill(t("sampler.detail.zoomAria"), { name: fabric.name, vendor: fabric.vendor })}
        >
          <button
            type="button"
            onClick={() => setZoom(false)}
            aria-label={t("sampler.detail.closeZoom")}
            className="absolute top-4 right-4 w-9 h-9 rounded-full bg-white/10 text-white hover:bg-white/25 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
          <div
            className="rounded-xl overflow-hidden shadow-2xl border border-white/15 max-w-[88vw]"
            style={{ backgroundColor: hex }}
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={imgPath}
              alt={fabric.name}
              draggable={false}
              className="max-w-[88vw] max-h-[72vh] object-contain"
              style={{ backgroundColor: hex }}
            />
          </div>
          <p className="text-xs text-white/85">
            {fabric.name} · {fabric.vendor} · {fabricPhText(fabric.ph)}
            <span className="text-white/50"> · {t("sampler.detail.overlayHint")}</span>
          </p>
        </div>
      )}
    </div>
  );
}
