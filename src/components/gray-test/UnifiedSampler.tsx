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
import { Upload, ImagePlus, MousePointerClick, X, Loader2, ChevronDown } from "lucide-react";
import {
  type FabricMatch,
  type NormalizedFabric,
  fabricHex,
  fabricImagePath,
  fabricOklab,
  fabricPhText,
  matchFabrics,
} from "@/lib/fabric-types";
import { loadFabricData } from "@/lib/fabric-data";
import { rgbToHex, matchPantones } from "@/lib/color-math";

interface PickPoint {
  id: number
  x: number // 原始像素坐标
  y: number
  r: number
  g: number
  b: number
  dispX: number // 显示坐标
  dispY: number
}

const MAX_POINTS = 10
const PREVIEW_N = 3 // 参数卡内毛布预览条数
const PANTONE_N = 3 // 参数卡内潘通参考色条数
const LONG_PRESS_MS = 380 // 长按判定阈值（毫秒）
const LOUPE_SIZE = 7
const LOUPE_CELL = 12
const LOUPE_PX = LOUPE_SIZE * LOUPE_CELL

export default function UnifiedSampler() {
  // ===== 图片 =====
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [imageSize, setImageSize] = useState<{ w: number; h: number } | null>(null)
  const [containerSize, setContainerSize] = useState<{ w: number; h: number } | null>(null)
  const [dragOver, setDragOver] = useState(false)

  // ===== 选点 =====
  const [points, setPoints] = useState<PickPoint[]>([])

  // ===== 长按精确取色状态 =====
  const [pressing, setPressing] = useState(false)
  const [longPressActive, setLongPressActive] = useState(false)

  // ===== 毛布数据 =====
  const [fabrics, setFabrics] = useState<NormalizedFabric[]>([])
  const [dataSource, setDataSource] = useState<"loading" | "sample" | "external">("loading")

  // ===== 状态 =====
  const [status, setStatus] = useState("")

  const containerRef = useRef<HTMLDivElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)
  const srcCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const loupeWrapRef = useRef<HTMLDivElement>(null)
  const loupeCanvasRef = useRef<HTMLCanvasElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const nextIdRef = useRef(1)
  const statusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // 长按按压状态（避免频繁 setState）
  const pressRef = useRef<{
    timer: ReturnType<typeof setTimeout> | null
    active: boolean
    fired: boolean
    source: "mouse" | "touch" | null
    px: number
    py: number
  }>({ timer: null, active: false, fired: false, source: null, px: 0, py: 0 })
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

  // 每点派生数据：OKLab / Pantone Top3 / 毛布 Top3
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
        previews: matchFabrics(oklab, fabrics, PREVIEW_N),
      })
    }
    return map
  }, [points, fabrics])

  const showStatus = useCallback((msg: string) => {
    setStatus(msg)
    if (statusTimerRef.current) clearTimeout(statusTimerRef.current)
    statusTimerRef.current = setTimeout(() => setStatus(""), 5000)
  }, [])

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
      showStatus(
        `毛布库已就绪（${result.fabrics.length} 条${result.external ? "，真实数据" : "，示例数据"}）· 上传图片后点击/长按取色`
      )
    })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ===== 上传 =====
  const handleFile = useCallback(
    (file: File) => {
      if (!file.type.startsWith("image/")) {
        showStatus("仅支持图片文件（jpg / png / webp / gif）")
        return
      }
      const reader = new FileReader()
      reader.onload = () => {
        const url = reader.result as string
        const img = new Image()
        img.onload = () => {
          setImageUrl(url)
          setImageSize({ w: img.naturalWidth, h: img.naturalHeight })
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
          showStatus(
            `已载入 ${img.naturalWidth} × ${img.naturalHeight}px · 点击选点 / 长按放大镜精确取色（最多 ${MAX_POINTS} 点）`
          )
        }
        img.src = url
      }
      reader.readAsDataURL(file)
    },
    [showStatus]
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

  // ===== 坐标换算 =====
  const toPixel = useCallback(
    (clientX: number, clientY: number): { px: number; py: number } | null => {
      if (!fitRect || !imageSize || !imgRef.current) return null
      const rect = imgRef.current.getBoundingClientRect()
      const ox = clientX - rect.left - fitRect.x
      const oy = clientY - rect.top - fitRect.y
      if (ox < 0 || oy < 0 || ox > fitRect.w || oy > fitRect.h) return null
      const px = Math.min(imageSize.w - 1, Math.max(0, Math.round((ox / fitRect.w) * imageSize.w)))
      const py = Math.min(imageSize.h - 1, Math.max(0, Math.round((oy / fitRect.h) * imageSize.h)))
      return { px, py }
    },
    [fitRect, imageSize]
  )

  // ===== 选点（点击 / 长按松手共用）=====
  const selectPixel = useCallback(
    (px: number, py: number) => {
      const src = srcCanvasRef.current
      if (!src || !fitRect || !imageSize) return
      const dispX = fitRect.x + (px / imageSize.w) * fitRect.w
      const dispY = fitRect.y + (py / imageSize.h) * fitRect.h

      // 命中已选点 → 删除
      const hitIdx = points.findIndex((p) => Math.hypot(p.dispX - dispX, p.dispY - dispY) < 14)
      if (hitIdx >= 0) {
        const removed = points[hitIdx]
        setPoints((prev) => prev.filter((_, i) => i !== hitIdx))
        showStatus(`已删除点 ${removed.id}（${px}, ${py}）`)
        return
      }

      if (points.length >= MAX_POINTS) {
        showStatus(`最多选择 ${MAX_POINTS} 个点，请先删除部分选点`)
        return
      }
      if (points.some((p) => p.x === px && p.y === py)) {
        showStatus(`该像素（${px}, ${py}）已选，请选择其他位置`)
        return
      }

      const ctx = src.getContext("2d", { willReadFrequently: true })
      if (!ctx) return
      const d = ctx.getImageData(px, py, 1, 1).data
      const id = nextIdRef.current++
      setPoints((prev) => [
        ...prev,
        { id, x: px, y: py, r: d[0], g: d[1], b: d[2], dispX, dispY },
      ])
      showStatus(`已选点 ${id} · 像素（${px}, ${py}）· #${rgbToHex(d[0], d[1], d[2])}`)
    },
    [points, fitRect, imageSize, showStatus]
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
    [isPostTouch, movePress, toPixel, drawLoupe, updateLoupeInfo, positionLoupe]
  )

  const handleMouseLeave = useCallback(() => {
    if (isPostTouch()) return
    const pr = pressRef.current
    if (pr.active) {
      // 按住时移出图片 → 取消本次按压（不取色）
      if (pr.timer) clearTimeout(pr.timer)
      pr.timer = null
      pr.active = false
      pr.source = null
      pr.fired = false
      setPressing(false)
      setLongPressActive(false)
      return
    }
    if (loupeWrapRef.current) loupeWrapRef.current.style.display = "none"
  }, [isPostTouch])

  // ===== 触屏事件（长按放大镜精确取色；轻点走 click）=====
  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      const t = e.touches[0]
      if (!t) return
      startPress(t.clientX, t.clientY, "touch")
    },
    [startPress]
  )

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      const t = e.touches[0]
      if (!t) return
      movePress(t.clientX, t.clientY)
    },
    [movePress]
  )

  const handleTouchEnd = useCallback(() => {
    lastTouchEndRef.current = Date.now()
    finalizePress()
  }, [finalizePress])

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
  const sourceLabel =
    dataSource === "external" ? "真实数据库" : dataSource === "loading" ? "加载中…" : "示例数据"

  return (
    <div className="flex flex-col lg:flex-row gap-6 h-full min-h-0">
      {/* ===== 左侧：图片工作区（约 60%，自适应图片大小）===== */}
      <div className="w-full lg:w-[60%] flex flex-col min-h-0">
        <div className="flex items-center justify-between gap-3 pb-3 flex-wrap">
          <p className="flex items-center gap-1.5 text-xs text-neutral-500 min-w-0">
            <MousePointerClick className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="truncate">
              点击选点（≤{MAX_POINTS}）· 长按放大镜精确取色 · 点已选点删除
            </span>
          </p>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span
              className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-medium border ${
                dataSource === "external"
                  ? "bg-emerald-50 border-emerald-200 text-emerald-700"
                  : dataSource === "loading"
                    ? "bg-neutral-50 border-neutral-200 text-neutral-400"
                    : "bg-amber-50 border-amber-200 text-amber-700"
              }`}
            >
              {dataSource === "loading" && <Loader2 className="w-3 h-3 animate-spin mr-1" />}
              {sourceLabel} · {fabrics.length} 条
            </span>
            <button
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 min-h-[36px] px-4 rounded-full text-xs font-semibold text-white bg-neutral-900 hover:bg-neutral-700 transition-colors cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              {hasImage ? "更换图片" : "上传图片"}
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
                <p className="text-sm font-medium text-neutral-600">拖拽图片到此处，或点击选择</p>
                <p className="text-xs text-neutral-400 mt-1">本地处理，不上传服务器 · 支持 jpg / png / webp / gif</p>
              </div>
            </button>
          ) : (
            <>
              {/* 源图：纯展示层，pointer-events 关闭 —— 浏览器无法对图片本体
                  触发长按「保存图片/查看图片」等系统菜单；坐标换算仍以 img 定位 */}
              {/* eslint-disable-next-line @next/next/no-img-element -- 本地 dataURL 需精确像素渲染与坐标换算 */}
              <img
                ref={imgRef}
                src={imageUrl}
                alt="取样源图"
                draggable={false}
                className="absolute inset-0 w-full h-full object-contain pointer-events-none select-none"
                style={{ userSelect: "none", WebkitTouchCallout: "none" }}
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
              {/* 选点标记（纸墨风格：墨色描边 + 白底编号） */}
              {points.map((p, idx) => (
                <div
                  key={p.id}
                  className="absolute z-10 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
                  style={{ left: p.dispX, top: p.dispY }}
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
              ))}
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
                    {longPressActive ? "松手取色" : "长按取色…"}
                  </div>
                )}
              </div>
              {imageSize && (
                <span className="absolute top-2 right-2 px-2 py-0.5 rounded-full bg-white/85 border border-neutral-200 text-[10px] font-mono text-neutral-500">
                  {imageSize.w} × {imageSize.h}px
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
              {longPressActive ? "已锁定像素，移动放大镜定位，松手取色" : "按住移动放大镜，长按锁定后松手取色…"}
            </span>
          ) : status ? (
            <span className="inline-flex items-center gap-1.5 text-neutral-600">
              <span className="w-1.5 h-1.5 rounded-full bg-neutral-900 animate-pulse" />
              {status}
            </span>
          ) : (
            <span className="text-neutral-400">{hasImage ? `已选 ${points.length} / ${MAX_POINTS} 点` : "等待上传图片"}</span>
          )}
        </div>
      </div>

      {/* ===== 右侧：参数区（约 40%，可滚动查看详细参数）===== */}
      <div className="w-full lg:w-[40%] min-h-0 flex flex-col">
        <div className="flex items-center justify-between pb-2">
          <p className="font-mono text-[10px] tracking-[0.2em] uppercase text-neutral-400">Sampler · 取样参数</p>
          {points.length > 0 && (
            <button
              onClick={() => {
                setPoints([])
                showStatus("已清空全部选点")
              }}
              className="inline-flex items-center gap-1 text-[11px] text-neutral-400 hover:text-neutral-900 transition-colors cursor-pointer"
            >
              <X className="w-3 h-3" />
              清空
            </button>
          )}
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto pr-1 space-y-3">
          {!hasImage ? (
            <div className="flex flex-col items-center justify-center gap-2 h-40 rounded-2xl border border-dashed border-neutral-300 text-xs text-neutral-400">
              <MousePointerClick className="w-5 h-5" />
              上传图片并点击/长按取色后，参数显示在这里
            </div>
          ) : points.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 h-40 rounded-2xl border border-dashed border-neutral-300 text-xs text-neutral-400">
              <MousePointerClick className="w-5 h-5" />
              在上方图片中点击或长按取色（最多 {MAX_POINTS} 点）
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
                  showStatus(`已删除点 ${idx + 1}`)
                }}
              />
            ))
          )}

          <p className="text-[10px] text-neutral-300 leading-relaxed">
            毛布色值来自商家色卡（社区/示例数据，非分光仪实测）；潘通为近似匹配，正式交付请以官方色卡为准
          </p>
        </div>
      </div>
    </div>
  );
}

// ==================== 参数卡（三栏：色块 | sRGB/Pantone×3/折叠OKLab | 参考毛布 Top3）====================

interface Derived {
  oklab: [number, number, number]
  pantones: ReturnType<typeof matchPantones>
  previews: FabricMatch[]
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
  const p = point
  const hex = rgbToHex(p.r, p.g, p.b)
  const oklab = derived?.oklab
  const pantones = derived?.pantones ?? []
  const previews = derived?.previews ?? []
  const [expanded, setExpanded] = useState(false)

  return (
    <div className="flex gap-4 rounded-2xl border border-neutral-200 bg-white p-3.5 shadow-sm">
      {/* 左端：匹配色块（带坐标与数字编号） */}
      <div className="relative w-[76px] h-[76px] rounded-xl flex-shrink-0 overflow-hidden" style={{ backgroundColor: hex }}>
        <span className="absolute top-1 left-1 inline-flex items-center justify-center w-5 h-5 rounded-full bg-neutral-900/70 text-[10px] font-bold text-white">
          {index + 1}
        </span>
        <span className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded bg-neutral-900/55 text-[9px] font-mono text-white">
          ({p.x}, {p.y})
        </span>
        <button
          onClick={onDelete}
          aria-label={`删除选点 ${index + 1}`}
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
              Pantone 参考 ×{pantones.length}
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
                  <span className="flex-shrink-0 text-[8px] font-mono text-neutral-400">Δ {pt.delta.toFixed(3)}</span>
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
          {expanded ? "收起详细参数" : "详细参数"}
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
        <p className="font-mono text-[9px] tracking-[0.18em] uppercase text-neutral-400">参考毛布 Top 3</p>
        {previews.length > 0 ? (
          previews.map((m) => <FabricRow key={m.fabric.id} match={m} />)
        ) : (
          <p className="text-[10px] text-neutral-400">毛布库加载中…</p>
        )}
      </div>
    </div>
  );
}

// ==================== 毛布紧凑行（参数卡内预览） ====================

function FabricRow({ match }: { match: FabricMatch }) {
  const { fabric, delta } = match
  const [imgFailed, setImgFailed] = useState(false)
  const [r, g, b] = fabric.sRGB
  const hex = fabric.hex ?? fabricHex(r, g, b)
  const imgPath = fabricImagePath(fabric.source)

  return (
    <div className="flex items-center gap-1.5 rounded-lg bg-neutral-50 border border-neutral-100 px-1.5 py-1">
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
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-medium text-neutral-800 truncate">
          {fabric.name}
          <span className="text-neutral-400 font-normal"> · {fabric.vendor}</span>
        </p>
        <p className="text-[8px] font-mono text-neutral-400 truncate">{fabricPhText(fabric.ph)} · {fabric.skuId}</p>
      </div>
      <span className="flex-shrink-0 text-[8px] font-mono text-emerald-600">Δ {delta.toFixed(3)}</span>
    </div>
  );
}
