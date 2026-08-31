"use client";

/**
 * 图片与毛布合体取样器（灰度测试）
 *
 * 操作逻辑（与图片取色器一致）：
 * 1. 上传图片（拖拽 / 点击选择）
 * 2. 点击图片任意像素选点（最多 10 个，悬停像素放大镜辅助，点击已选点可删除）
 * 3. 底部参数框：每个选点直接显示 sRGB（hex/rgb）、OKLab、潘通参考色（1391 色近似匹配）
 * 4. 参数框内同时显示该选点的毛布匹配（Top 3 预览）；
 *    点击参数框选中该点，下方主区域展示完整毛布匹配 Top 20
 *
 * 架构要点：
 * - 匹配全部在客户端（毛布库 OKLab 欧氏距离 + 潘通参考匹配），服务器零计算；
 * - 毛布图片只按需加载（lazy + 失败回退 sRGB 色块占位）；
 * - 毛布数据：真实 fabric-data.json 优先，缺失回退内置示例数据。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Upload, ImagePlus, MousePointerClick, RefreshCw, Ruler, Tag, Layers, X } from "lucide-react";
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
import { rgbToHex, matchPantone } from "@/lib/color-math";

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
const PREVIEW_N = 3 // 参数框内毛布预览条数
const MAIN_N = 20 // 主区域毛布完整条数
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
  const [selectedId, setSelectedId] = useState<number | null>(null)

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

  // object-contain 渲染矩形
  const fitRect = useMemo(() => {
    if (!containerSize || !imageSize) return null
    const scale = Math.min(containerSize.w / imageSize.w, containerSize.h / imageSize.h)
    const w = imageSize.w * scale
    const h = imageSize.h * scale
    return { x: (containerSize.w - w) / 2, y: (containerSize.h - h) / 2, w, h }
  }, [containerSize, imageSize])

  // 当前选中点（默认最近选点）
  const selectedPoint = useMemo(() => {
    if (points.length === 0) return null
    return points.find((p) => p.id === selectedId) ?? points[points.length - 1]
  }, [points, selectedId])

  // 每点派生数据：OKLab / Pantone / 毛布 Top3 预览
  const pointDerived = useMemo(() => {
    const map = new Map<number, { oklab: [number, number, number]; pantone: ReturnType<typeof matchPantone>; previews: FabricMatch[] }>()
    for (const p of points) {
      const oklab = fabricOklab(p.r, p.g, p.b)
      map.set(p.id, {
        oklab,
        pantone: matchPantone(p.r, p.g, p.b),
        previews: matchFabrics(oklab, fabrics, PREVIEW_N),
      })
    }
    return map
  }, [points, fabrics])

  // 选中点的毛布完整匹配 Top 20
  const mainMatches = useMemo(() => {
    if (!selectedPoint) return []
    return matchFabrics(fabricOklab(selectedPoint.r, selectedPoint.g, selectedPoint.b), fabrics, MAIN_N)
  }, [selectedPoint, fabrics])

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
    return () => {
      if (statusTimerRef.current) clearTimeout(statusTimerRef.current)
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
        `毛布库已就绪（${result.fabrics.length} 条${result.external ? "，真实数据" : "，示例数据"}）· 上传图片后点击取色`
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
          setSelectedId(null)
          nextIdRef.current = 1
          showStatus(`已载入 ${img.naturalWidth} × ${img.naturalHeight}px · 点击图片选点（最多 ${MAX_POINTS} 点）`)
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

  // ===== 点击选点 / 删除 =====
  const handleImageClick = useCallback(
    (e: React.MouseEvent) => {
      if (!srcCanvasRef.current || !fitRect || !imageSize) return
      const pos = toPixel(e.clientX, e.clientY)
      if (!pos) return
      const { px, py } = pos
      const dispX = fitRect.x + (px / imageSize.w) * fitRect.w
      const dispY = fitRect.y + (py / imageSize.h) * fitRect.h

      // 命中已选点 → 删除
      const hitIdx = points.findIndex((p) => Math.hypot(p.dispX - dispX, p.dispY - dispY) < 14)
      if (hitIdx >= 0) {
        const removed = points[hitIdx]
        setPoints((prev) => prev.filter((_, i) => i !== hitIdx))
        setSelectedId((cur) => (cur === removed.id ? null : cur))
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

      const ctx = srcCanvasRef.current.getContext("2d", { willReadFrequently: true })
      if (!ctx) return
      const d = ctx.getImageData(px, py, 1, 1).data
      const id = nextIdRef.current++
      const point: PickPoint = { id, x: px, y: py, r: d[0], g: d[1], b: d[2], dispX, dispY }
      setPoints((prev) => [...prev, point])
      setSelectedId(id)
      showStatus(`已选点 ${id} · 像素（${px}, ${py}）· #${rgbToHex(d[0], d[1], d[2])}`)
    },
    [points, fitRect, imageSize, toPixel, showStatus]
  )

  // ===== 悬停放大镜（DOM 直改）=====
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
      ctx.strokeStyle = "rgba(255,255,255,0.14)"
      ctx.lineWidth = 1
      for (let i = 1; i < LOUPE_SIZE; i++) {
        ctx.beginPath(); ctx.moveTo(i * LOUPE_CELL, 0); ctx.lineTo(i * LOUPE_CELL, LOUPE_PX); ctx.stroke()
        ctx.beginPath(); ctx.moveTo(0, i * LOUPE_CELL); ctx.lineTo(LOUPE_PX, i * LOUPE_CELL); ctx.stroke()
      }
      const cx = (px - sx) * LOUPE_CELL
      const cy = (py - sy) * LOUPE_CELL
      ctx.strokeStyle = "rgba(255,255,255,0.9)"
      ctx.lineWidth = 1.5
      ctx.strokeRect(cx + 0.5, cy + 0.5, LOUPE_CELL - 1, LOUPE_CELL - 1)
      ctx.fillStyle = "rgba(255,255,255,0.12)"
      ctx.fillRect(cx, cy, LOUPE_CELL, LOUPE_CELL)
      ctx.strokeStyle = "rgba(255,255,255,0.55)"
      ctx.lineWidth = 1
      ctx.beginPath(); ctx.moveTo(LOUPE_PX / 2, 0); ctx.lineTo(LOUPE_PX / 2, LOUPE_PX); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(0, LOUPE_PX / 2); ctx.lineTo(LOUPE_PX, LOUPE_PX / 2); ctx.stroke()
    },
    [imageSize]
  )

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      const wrap = loupeWrapRef.current
      const container = containerRef.current
      if (!wrap || !container) return
      const pos = toPixel(e.clientX, e.clientY)
      if (!pos) {
        wrap.style.display = "none"
        return
      }
      drawLoupe(pos.px, pos.py)
      const rect = container.getBoundingClientRect()
      const relX = e.clientX - rect.left
      const relY = e.clientY - rect.top
      const GAP = 14
      let left = relX + GAP
      let top = relY + GAP
      if (left + LOUPE_PX > rect.width) left = relX - LOUPE_PX - GAP
      if (top + LOUPE_PX + 24 > rect.height) top = relY - LOUPE_PX - 24 - GAP
      wrap.style.display = "block"
      wrap.style.left = `${Math.max(4, left)}px`
      wrap.style.top = `${Math.max(4, top)}px`
      const info = wrap.querySelector<HTMLElement>("[data-loupe-info]")
      if (info && srcCanvasRef.current) {
        const ctx = srcCanvasRef.current.getContext("2d", { willReadFrequently: true })
        if (ctx) {
          const d = ctx.getImageData(pos.px, pos.py, 1, 1).data
          info.textContent = `${pos.px}, ${pos.py} · #${rgbToHex(d[0], d[1], d[2])}`
        }
      }
    },
    [toPixel, drawLoupe]
  )

  const handleMouseLeave = useCallback(() => {
    if (loupeWrapRef.current) loupeWrapRef.current.style.display = "none"
  }, [])

  // ===== 渲染 =====
  const hasImage = imageUrl && imageSize && fitRect
  const sourceLabel =
    dataSource === "external" ? "真实数据库" : dataSource === "loading" ? "加载中…" : "示例数据"

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* ===== 顶部操作栏 ===== */}
      <div className="flex items-center justify-between gap-3 pb-4 flex-wrap">
        <div className="flex items-center gap-2 text-xs text-slate-400 flex-wrap">
          <MousePointerClick className="w-4 h-4 text-blue-400 flex-shrink-0" />
          <span>上传图片 → 点击像素选点 → 参数框显示 sRGB / OKLab / 潘通 / 毛布匹配</span>
          <span
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium border ${
              dataSource === "external"
                ? "bg-emerald-400/10 border-emerald-400/25 text-emerald-300"
                : dataSource === "loading"
                  ? "bg-white/5 border-white/10 text-slate-400"
                  : "bg-amber-400/10 border-amber-400/25 text-amber-300"
            }`}
          >
            {sourceLabel} · {fabrics.length} 条
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setPoints([])
              setSelectedId(null)
              showStatus("已清空全部选点")
            }}
            disabled={points.length === 0}
            className="inline-flex items-center gap-1.5 min-h-[36px] px-3 rounded-lg text-xs font-medium text-slate-300 border border-white/10 hover:bg-white/10 hover:text-white transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            清空全部
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-1.5 min-h-[36px] px-4 rounded-lg text-xs font-semibold text-slate-900 bg-blue-400 hover:bg-blue-300 transition-colors cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5" />
            {hasImage ? "更换图片" : "上传图片"}
          </button>
          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePickFile} />
        </div>
      </div>

      {/* ===== 图片工作区 ===== */}
      <div
        ref={containerRef}
        className="relative h-[300px] rounded-2xl overflow-hidden border border-white/10 bg-slate-900/50 select-none"
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
      >
        {!hasImage ? (
          <button
            onClick={() => fileInputRef.current?.click()}
            className={`absolute inset-0 flex flex-col items-center justify-center gap-3 transition-colors cursor-pointer ${
              dragOver ? "bg-blue-500/10 border-blue-400/50" : ""
            }`}
          >
            <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
              <ImagePlus className="w-7 h-7 text-slate-400" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-slate-300">拖拽图片到此处，或点击选择</p>
              <p className="text-xs text-slate-500 mt-1">本地处理，不上传服务器 · 支持 jpg / png / webp / gif</p>
            </div>
          </button>
        ) : (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element -- 本地 dataURL 需精确像素渲染与坐标换算 */}
            <img
              ref={imgRef}
              src={imageUrl}
              alt="取样源图"
              draggable={false}
              className="absolute inset-0 w-full h-full object-contain"
              onClick={handleImageClick}
              onMouseMove={handleMouseMove}
              onMouseLeave={handleMouseLeave}
              style={{ cursor: "crosshair" }}
            />
            {/* 选点标记 */}
            {points.map((p, idx) => (
              <div
                key={p.id}
                className="absolute z-10 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
                style={{ left: p.dispX, top: p.dispY }}
              >
                <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 block w-5 h-px bg-white/90" />
                <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 block w-px h-5 bg-white/90" />
                <span
                  className="relative flex items-center justify-center w-7 h-7 rounded-full border-2 text-[11px] font-bold text-white shadow-lg"
                  style={{
                    borderColor: `rgb(${p.r},${p.g},${p.b})`,
                    backgroundColor: p.id === selectedPoint?.id ? "rgba(37,99,235,0.8)" : "rgba(0,0,0,0.55)",
                    animation: "colorPickPop 0.22s ease-out",
                  }}
                >
                  {idx + 1}
                </span>
              </div>
            ))}
            {/* 像素放大镜 */}
            <div ref={loupeWrapRef} className="absolute z-20 hidden" style={{ display: "none" }}>
              <canvas
                ref={loupeCanvasRef}
                width={LOUPE_PX}
                height={LOUPE_PX}
                className="block rounded-lg border border-white/25 shadow-xl bg-slate-900"
              />
              <div
                data-loupe-info
                className="mt-1 px-2 py-1 rounded-md bg-slate-900/90 border border-white/10 text-[10px] font-mono text-slate-200 text-center"
              />
            </div>
            {imageSize && (
              <span className="absolute top-2 right-2 px-2 py-0.5 rounded-md bg-black/50 text-[10px] font-mono text-slate-300 border border-white/10">
                {imageSize.w} × {imageSize.h}px
              </span>
            )}
          </>
        )}
      </div>

      {/* ===== 状态条 ===== */}
      <div className="mt-2 flex items-center gap-3 min-h-6 text-xs">
        {status ? (
          <span className="inline-flex items-center gap-1.5 text-slate-300">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
            {status}
          </span>
        ) : (
          <span className="text-slate-600">
            {hasImage ? `已选 ${points.length} / ${MAX_POINTS} 点` : "等待上传图片"}
          </span>
        )}
        {fabrics.length > 0 && (
          <span className="ml-auto text-slate-600 hidden sm:inline">
            点击参数框切换查看各选点的完整毛布匹配（Top {MAIN_N}）
          </span>
        )}
      </div>

      {/* ===== 底部参数框（每点：sRGB / OKLab / Pantone / 毛布 Top3）===== */}
      {hasImage && (
        <div className="mt-2 pb-1">
          {points.length === 0 ? (
            <div className="flex items-center gap-2 justify-center h-16 rounded-xl border border-dashed border-white/10 text-xs text-slate-500">
              <MousePointerClick className="w-4 h-4" />
              在上方图片中点击像素，参数与毛布匹配将显示在这里
            </div>
          ) : (
            <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">
              {points.map((p, idx) => {
                const derived = pointDerived.get(p.id)
                const isSelected = p.id === selectedPoint?.id
                return (
                  <button
                    key={p.id}
                    onClick={() => setSelectedId(p.id)}
                    className={`flex-shrink-0 w-72 text-left rounded-xl border transition-colors cursor-pointer overflow-hidden ${
                      isSelected
                        ? "bg-blue-500/[0.07] border-blue-400/60"
                        : "bg-white/[0.04] border-white/10 hover:border-white/25"
                    }`}
                    style={{ animation: "colorPickPop 0.22s ease-out" }}
                  >
                    {/* 色块头 */}
                    <div className="relative h-12 flex items-end" style={{ backgroundColor: `rgb(${p.r},${p.g},${p.b})` }}>
                      <span className="absolute top-1.5 left-1.5 inline-flex items-center justify-center w-5 h-5 rounded-full bg-black/45 text-[10px] font-bold text-white border border-white/40">
                        {idx + 1}
                      </span>
                      <span className="absolute bottom-1 right-1.5 px-1.5 py-0.5 rounded bg-black/45 text-[9px] font-mono text-white/90">
                        ({p.x}, {p.y})
                      </span>
                      <span
                        role="button"
                        tabIndex={-1}
                        onClick={(e) => {
                          e.stopPropagation()
                          setPoints((prev) => prev.filter((q) => q.id !== p.id))
                          setSelectedId((cur) => (cur === p.id ? null : cur))
                        }}
                        className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-black/45 text-white/80 hover:bg-black/70 hover:text-white flex items-center justify-center"
                        aria-label={`删除选点 ${idx + 1}`}
                      >
                        <X className="w-3 h-3" />
                      </span>
                    </div>

                    <div className="p-3 space-y-2">
                      {/* sRGB */}
                      <div>
                        <p className="text-[9px] uppercase tracking-wider text-slate-500 mb-0.5">sRGB</p>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-semibold font-mono text-slate-100">
                            {rgbToHex(p.r, p.g, p.b)}
                          </span>
                          <span className="text-[10px] font-mono text-slate-400">
                            rgb({p.r}, {p.g}, {p.b})
                          </span>
                        </div>
                      </div>

                      {/* OKLab */}
                      {derived && (
                        <div>
                          <p className="text-[9px] uppercase tracking-wider text-slate-500 mb-0.5">OKLab</p>
                          <p className="text-[10px] font-mono text-slate-300">
                            L {derived.oklab[0].toFixed(3)} · a{" "}
                            {(derived.oklab[1] >= 0 ? "+" : "") + derived.oklab[1].toFixed(3)} · b{" "}
                            {(derived.oklab[2] >= 0 ? "+" : "") + derived.oklab[2].toFixed(3)}
                          </p>
                        </div>
                      )}

                      {/* 潘通参考 */}
                      {derived?.pantone && (
                        <div>
                          <p className="text-[9px] uppercase tracking-wider text-slate-500 mb-0.5">Pantone 参考</p>
                          <div className="flex items-center gap-1.5">
                            <span
                              className="w-3.5 h-3.5 rounded border border-white/20 flex-shrink-0"
                              style={{ backgroundColor: derived.pantone.hex }}
                            />
                            <span className="text-[10px] font-medium text-slate-200 truncate">
                              {derived.pantone.name === derived.pantone.code
                                ? derived.pantone.code
                                : `${derived.pantone.code} ${derived.pantone.name}`}
                            </span>
                          </div>
                        </div>
                      )}

                      {/* 毛布匹配 Top3 */}
                      <div>
                        <p className="text-[9px] uppercase tracking-wider text-slate-500 mb-1">
                          毛布匹配（Top {PREVIEW_N}）
                        </p>
                        {fabrics.length === 0 ? (
                          <p className="text-[10px] text-slate-500">毛布库加载中…</p>
                        ) : derived && derived.previews.length > 0 ? (
                          <div className="space-y-1">
                            {derived.previews.map((m) => (
                              <FabricRow key={m.fabric.id} match={m} />
                            ))}
                          </div>
                        ) : (
                          <p className="text-[10px] text-slate-500">无匹配</p>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
          <p className="text-[9px] text-slate-600 mt-1">
            毛布色值来自商家色卡（社区/示例数据，非分光仪实测），潘通为近似匹配，正式交付请以官方色卡为准 · 点击参数框切换查看完整 Top {MAIN_N}
          </p>
        </div>
      )}

      {/* ===== 主区域：选中点完整毛布匹配 Top 20 ===== */}
      {selectedPoint && (
        <div className="mt-3 pb-2">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-blue-400" />
              毛布完整匹配
              <span className="text-slate-500 font-normal">
                · 目标 #{selectedPoint.id} {rgbToHex(selectedPoint.r, selectedPoint.g, selectedPoint.b)}（{selectedPoint.x}, {selectedPoint.y}）
                · {mainMatches.length} 条按色差 Δ 升序
              </span>
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {mainMatches.map((m, idx) => (
              <FabricCard key={m.fabric.id} match={m} rank={idx + 1} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ==================== 毛布紧凑行（参数框内预览） ====================

function FabricRow({ match }: { match: FabricMatch }) {
  const { fabric, delta } = match
  const [imgFailed, setImgFailed] = useState(false)
  const [r, g, b] = fabric.sRGB
  const hex = fabric.hex ?? fabricHex(r, g, b)
  const imgPath = fabricImagePath(fabric.source)

  return (
    <div className="flex items-center gap-2 rounded-lg bg-white/[0.04] border border-white/5 px-1.5 py-1">
      <span className="relative w-7 h-7 rounded flex-shrink-0 overflow-hidden" style={{ backgroundColor: hex }}>
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
        <p className="text-[11px] font-medium text-slate-200 truncate">
          {fabric.name}
          <span className="text-slate-500 font-normal"> · {fabric.vendor} · {fabric.skuId}</span>
        </p>
        <p className="text-[9px] font-mono text-slate-500 truncate">
          {fabricPhText(fabric.ph)} · {fabric.fabricKind} · {hex}
        </p>
      </div>
      <span className="flex-shrink-0 text-[9px] font-mono text-emerald-300">Δ {delta.toFixed(3)}</span>
    </div>
  );
}

// ==================== 毛布完整卡片（主区域） ====================

function FabricCard({ match, rank }: { match: FabricMatch; rank: number }) {
  const { fabric, delta } = match
  const cid = cidInfo(fabric.cid)
  const [imgFailed, setImgFailed] = useState(false)
  const [r, g, b] = fabric.sRGB
  const hex = fabric.hex ?? fabricHex(r, g, b)
  const imgPath = fabricImagePath(fabric.source)

  return (
    <div className="flex flex-col rounded-xl bg-white/[0.04] border border-white/10 overflow-hidden transition-colors hover:border-blue-400/30">
      <div className="relative aspect-square bg-slate-900" style={{ backgroundColor: hex }}>
        {!imgFailed && (
          // eslint-disable-next-line @next/next/no-img-element -- 静态图片按需懒加载
          <img
            src={imgPath}
            alt={`${fabric.name}（${fabric.vendor} ${fabric.skuId}）`}
            loading="lazy"
            decoding="async"
            onError={() => setImgFailed(true)}
            className="w-full h-full object-cover"
          />
        )}
        <span className="absolute top-1.5 left-1.5 inline-flex items-center justify-center w-5 h-5 rounded-full bg-black/60 text-[10px] font-bold text-white border border-white/30">
          {rank}
        </span>
        <span className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded bg-black/60 text-[9px] font-mono text-emerald-300 border border-white/10">
          Δ {delta.toFixed(3)}
        </span>
        <span className="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 rounded bg-black/55 text-[9px] text-slate-200 border border-white/10">
          {cid.label} · {cid.en}
        </span>
      </div>
      <div className="p-3 space-y-1.5 flex-1 flex flex-col">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold text-slate-100 truncate">{fabric.name}</p>
          <span className="flex-shrink-0 text-[9px] font-mono text-slate-500">{fabric.id}</span>
        </div>
        <p className="text-[11px] text-slate-400 truncate flex items-center gap-1">
          <Tag className="w-3 h-3 flex-shrink-0" />
          {fabric.vendor} · {fabric.skuId}
        </p>
        <p className="text-[11px] text-slate-400 flex items-center gap-1">
          <Ruler className="w-3 h-3 flex-shrink-0" />
          {fabricPhText(fabric.ph)} · {fabric.fabricKind}
        </p>
        <p className="text-[10px] font-mono text-slate-500">
          {hex} · rgb({r},{g},{b})
        </p>
        <p className="text-[10px] font-mono text-slate-500">
          OKLab L {fabric.oklab[0].toFixed(3)} a {fabric.oklab[1].toFixed(3)} b {fabric.oklab[2].toFixed(3)}
        </p>
        {fabric.pantone && <p className="text-[10px] text-blue-300/80 truncate">Pantone ≈ {fabric.pantone}</p>}
        {fabric.tips && (
          <p className="text-[9px] text-amber-300/70 leading-relaxed mt-auto pt-1">{fabric.tips}</p>
        )}
      </div>
    </div>
  );
}
