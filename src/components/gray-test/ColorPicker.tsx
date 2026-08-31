"use client";

/**
 * 图片像素取色器（灰度测试）
 *
 * 功能：
 * - 上传本地图片（点击 / 拖拽）
 * - 在图片上点击进行像素级选点（最多 10 个点，可点选已选点删除）
 * - 悬停显示像素放大镜（7×7 像素网格 + 坐标），辅助精确定位
 * - 每个选点自动计算并展示：sRGB（hex / rgb）、OKLab、潘通参考色（近似）
 * - 选点色卡展示在图片下方菜单中
 *
 * 实现说明：
 * - 像素读取：离屏 canvas 以原始尺寸加载图片，getImageData(1x1) 精确取色
 * - 坐标换算：object-contain 渲染矩形 + ResizeObserver，点击/悬停坐标映射回原始像素
 * - 放大镜：DOM 直改（ref + 直接写样式/canvas），避免 mousemove 高频 setState
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Upload, Trash2, ImagePlus, MousePointerClick, X } from "lucide-react";
import {
  srgbToOklab,
  rgbToHex,
  formatOklab,
  matchPantone,
} from "@/lib/color-math";

interface PickPoint {
  id: number
  x: number // 原始像素坐标
  y: number
  r: number
  g: number
  b: number
  dispX: number // 显示坐标（用于标记定位/命中检测）
  dispY: number
}

const MAX_POINTS = 10
const LOUPE_SIZE = 7 // 放大镜展示 7×7 像素
const LOUPE_CELL = 12 // 每像素显示尺寸 px
const LOUPE_PX = LOUPE_SIZE * LOUPE_CELL // 84

export default function ColorPicker() {
  // ===== 图片状态 =====
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [imageSize, setImageSize] = useState<{ w: number; h: number } | null>(null)
  const [points, setPoints] = useState<PickPoint[]>([])
  const [status, setStatus] = useState("")
  const [containerSize, setContainerSize] = useState<{ w: number; h: number } | null>(null)
  const [dragOver, setDragOver] = useState(false)

  // ===== refs =====
  const containerRef = useRef<HTMLDivElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)
  const srcCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const loupeWrapRef = useRef<HTMLDivElement>(null)
  const loupeCanvasRef = useRef<HTMLCanvasElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const nextIdRef = useRef(1)
  const statusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // object-contain 渲染矩形（图片实际显示区域，含 letterbox 偏移）
  const fitRect = useMemo(() => {
    if (!containerSize || !imageSize) return null
    const cw = containerSize.w
    const ch = containerSize.h
    const scale = Math.min(cw / imageSize.w, ch / imageSize.h)
    const w = imageSize.w * scale
    const h = imageSize.h * scale
    return { x: (cw - w) / 2, y: (ch - h) / 2, w, h }
  }, [containerSize, imageSize])

  // 提示状态（自动清除）
  const showStatus = useCallback((msg: string) => {
    setStatus(msg)
    if (statusTimerRef.current) clearTimeout(statusTimerRef.current)
    statusTimerRef.current = setTimeout(() => setStatus(""), 4000)
  }, [])

  // ===== 容器尺寸监听 =====
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

  // ===== 上传图片 =====
  const handleFile = useCallback(
    (file: File) => {
      if (!file.type.startsWith("image/")) {
        showStatus("仅支持图片文件（jpg / png / webp / gif 等）")
        return
      }
      const reader = new FileReader()
      reader.onload = () => {
        const url = reader.result as string
        const img = new Image()
        img.onload = () => {
          setImageUrl(url)
          setImageSize({ w: img.naturalWidth, h: img.naturalHeight })
          // 离屏 canvas（原始尺寸）用于像素读取
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
            `已载入 ${img.naturalWidth} × ${img.naturalHeight}px · 点击图片选点，最多 ${MAX_POINTS} 点（点击已选点可删除）`
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

  // ===== 显示坐标 → 原始像素坐标 =====
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
  const handleImageClick = (e: React.MouseEvent) => {
    if (!srcCanvasRef.current || !fitRect) return
    const pos = toPixel(e.clientX, e.clientY)
    if (!pos) return
    const { px, py } = pos
    const dispX = fitRect.x + (px / imageSize!.w) * fitRect.w
    const dispY = fitRect.y + (py / imageSize!.h) * fitRect.h

    // 命中已选点（显示距离阈值 14px）→ 删除
    const hitIdx = points.findIndex(
      (p) => Math.hypot(p.dispX - dispX, p.dispY - dispY) < 14
    )
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

    const ctx = srcCanvasRef.current.getContext("2d", { willReadFrequently: true })
    if (!ctx) return
    const d = ctx.getImageData(px, py, 1, 1).data
    const id = nextIdRef.current++
    setPoints((prev) => [
      ...prev,
      { id, x: px, y: py, r: d[0], g: d[1], b: d[2], dispX, dispY },
    ])
    showStatus(`已选点 ${id} · 像素（${px}, ${py}）· #${rgbToHex(d[0], d[1], d[2])}`)
  }

  // ===== 悬停放大镜（DOM 直改，无 setState）=====
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

      // 像素网格线
      ctx.strokeStyle = "rgba(255,255,255,0.14)"
      ctx.lineWidth = 1
      for (let i = 1; i < LOUPE_SIZE; i++) {
        ctx.beginPath()
        ctx.moveTo(i * LOUPE_CELL, 0)
        ctx.lineTo(i * LOUPE_CELL, LOUPE_PX)
        ctx.stroke()
        ctx.beginPath()
        ctx.moveTo(0, i * LOUPE_CELL)
        ctx.lineTo(LOUPE_PX, i * LOUPE_CELL)
        ctx.stroke()
      }

      // 中心像素高亮（白色外框 + 半透明填充）
      const cx = (px - sx) * LOUPE_CELL
      const cy = (py - sy) * LOUPE_CELL
      ctx.strokeStyle = "rgba(255,255,255,0.9)"
      ctx.lineWidth = 1.5
      ctx.strokeRect(cx + 0.5, cy + 0.5, LOUPE_CELL - 1, LOUPE_CELL - 1)
      ctx.fillStyle = "rgba(255,255,255,0.12)"
      ctx.fillRect(cx, cy, LOUPE_CELL, LOUPE_CELL)

      // 中心十字准星
      ctx.strokeStyle = "rgba(255,255,255,0.55)"
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(LOUPE_PX / 2, 0)
      ctx.lineTo(LOUPE_PX / 2, LOUPE_PX)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(0, LOUPE_PX / 2)
      ctx.lineTo(LOUPE_PX, LOUPE_PX / 2)
      ctx.stroke()
    },
    [imageSize]
  )

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      const wrap = loupeWrapRef.current
      const imgEl = imgRef.current
      const container = containerRef.current
      if (!wrap || !imgEl || !container) return
      const pos = toPixel(e.clientX, e.clientY)
      if (!pos) {
        wrap.style.display = "none"
        return
      }
      drawLoupe(pos.px, pos.py)

      // 放大镜定位（跟随光标，越界翻转）
      const rect = container.getBoundingClientRect()
      const relX = e.clientX - rect.left
      const relY = e.clientY - rect.top
      const LOUPE_GAP = 14
      let left = relX + LOUPE_GAP
      let top = relY + LOUPE_GAP
      if (left + LOUPE_PX > rect.width) left = relX - LOUPE_PX - LOUPE_GAP
      if (top + LOUPE_PX + 24 > rect.height) top = relY - LOUPE_PX - 24 - LOUPE_GAP
      wrap.style.display = "block"
      wrap.style.left = `${Math.max(4, left)}px`
      wrap.style.top = `${Math.max(4, top)}px`

      // 信息条：坐标 + 像素 RGB（直接写入 DOM）
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

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* ===== 顶部操作栏 ===== */}
      <div className="flex items-center justify-between gap-3 pb-4">
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <MousePointerClick className="w-4 h-4 text-blue-400" />
          <span>点击图片选点（最多 {MAX_POINTS} 点）· 点击已选点可删除 · 悬停显示像素放大镜</span>
        </div>
        <div className="flex items-center gap-2">
          {points.length > 0 && (
            <button
              onClick={() => {
                setPoints([])
                nextIdRef.current = 1
                showStatus("已清空全部选点")
              }}
              className="inline-flex items-center gap-1.5 min-h-[36px] px-3 rounded-lg text-xs font-medium text-slate-300 border border-white/10 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              清空全部
            </button>
          )}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-1.5 min-h-[36px] px-4 rounded-lg text-xs font-semibold text-slate-900 bg-blue-400 hover:bg-blue-300 transition-colors cursor-pointer"
          >
            <Upload className="w-3.5 h-3.5" />
            {hasImage ? "更换图片" : "上传图片"}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handlePickFile}
          />
        </div>
      </div>

      {/* ===== 图片工作区 ===== */}
      <div
        ref={containerRef}
        className="relative flex-1 min-h-[260px] rounded-2xl overflow-hidden border border-white/10 bg-slate-900/50 select-none"
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
      >
        {!hasImage ? (
          /* 上传占位 */
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
              <p className="text-xs text-slate-500 mt-1">支持 jpg / png / webp / gif · 本地处理，不上传服务器</p>
            </div>
          </button>
        ) : (
          <>
            {/* 图片（object-contain 填满容器） */}
            {/* eslint-disable-next-line @next/next/no-img-element -- 本地 dataURL 需精确像素渲染与坐标换算，不适用 next/image 优化 */}
            <img
              ref={imgRef}
              src={imageUrl}
              alt="取色源图"
              draggable={false}
              className="absolute inset-0 w-full h-full object-contain"
              onClick={handleImageClick}
              onMouseMove={handleMouseMove}
              onMouseLeave={handleMouseLeave}
            />

            {/* 选点标记 */}
            {points.map((p, idx) => (
              <div
                key={p.id}
                className="absolute z-10 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
                style={{ left: p.dispX, top: p.dispY }}
              >
                {/* 十字准星 */}
                <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 block w-5 h-px bg-white/90" />
                <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 block w-px h-5 bg-white/90" />
                {/* 圆环 + 编号 */}
                <span
                  className="relative flex items-center justify-center w-7 h-7 rounded-full border-2 text-[11px] font-bold text-white shadow-lg"
                  style={{
                    borderColor: `rgb(${p.r},${p.g},${p.b})`,
                    backgroundColor: "rgba(0,0,0,0.55)",
                    animation: "colorPickPop 0.22s ease-out",
                  }}
                >
                  {idx + 1}
                </span>
              </div>
            ))}

            {/* 像素放大镜 */}
            <div
              ref={loupeWrapRef}
              className="absolute z-20 hidden"
              style={{ display: "none" }}
            >
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

            {/* 图片尺寸角标 */}
            {imageSize && (
              <span className="absolute top-2 right-2 px-2 py-0.5 rounded-md bg-black/50 text-[10px] font-mono text-slate-300 border border-white/10">
                {imageSize.w} × {imageSize.h}px
              </span>
            )}
          </>
        )}
      </div>

      {/* ===== 状态条 ===== */}
      <div className="h-6 mt-2 flex items-center text-xs text-slate-400">
        {status ? (
          <span className="inline-flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
            {status}
          </span>
        ) : (
          <span className="text-slate-600">
            {hasImage ? `已选 ${points.length} / ${MAX_POINTS} 点` : "等待上传图片"}
          </span>
        )}
      </div>

      {/* ===== 下方色卡菜单 ===== */}
      {hasImage && (
        <div className="mt-2 pb-1">
          {points.length === 0 ? (
            <div className="flex items-center gap-2 justify-center h-20 rounded-xl border border-dashed border-white/10 text-xs text-slate-500">
              <MousePointerClick className="w-4 h-4" />
              在上方图片中点击像素选点，色值将显示在这里
            </div>
          ) : (
            <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">
              {points.map((p, idx) => {
                const lab = srgbToOklab(p.r, p.g, p.b)
                const fmt = formatOklab(lab)
                const pantone = matchPantone(p.r, p.g, p.b)
                return (
                  <div
                    key={p.id}
                    className="flex-shrink-0 w-60 rounded-xl bg-white/[0.04] border border-white/10 overflow-hidden"
                    style={{ animation: "colorPickPop 0.22s ease-out" }}
                  >
                    {/* 色块 + 删除 */}
                    <div
                      className="relative h-16"
                      style={{ backgroundColor: `rgb(${p.r},${p.g},${p.b})` }}
                    >
                      <span className="absolute top-1.5 left-1.5 inline-flex items-center justify-center w-5 h-5 rounded-full bg-black/45 text-[10px] font-bold text-white border border-white/40">
                        {idx + 1}
                      </span>
                      <span className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded bg-black/45 text-[9px] font-mono text-white/90">
                        {p.x}, {p.y}
                      </span>
                      <button
                        onClick={() => {
                          setPoints((prev) => prev.filter((q) => q.id !== p.id))
                          showStatus(`已删除点 ${idx + 1}`)
                        }}
                        aria-label={`删除选点 ${idx + 1}`}
                        className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-black/45 text-white/80 hover:bg-black/70 hover:text-white flex items-center justify-center cursor-pointer"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>

                    {/* 色值信息 */}
                    <div className="p-3 space-y-2">
                      {/* sRGB */}
                      <div>
                        <p className="text-[9px] uppercase tracking-wider text-slate-500 mb-1">sRGB</p>
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold font-mono text-slate-100">
                            {rgbToHex(p.r, p.g, p.b)}
                          </span>
                          <span className="text-[10px] font-mono text-slate-400">
                            rgb({p.r}, {p.g}, {p.b})
                          </span>
                        </div>
                      </div>

                      {/* OKLab */}
                      <div>
                        <p className="text-[9px] uppercase tracking-wider text-slate-500 mb-1">OKLab</p>
                        <p className="text-[10px] font-mono text-slate-300 leading-relaxed">
                          L {fmt.L} · a {fmt.a} · b {fmt.b}
                        </p>
                      </div>

                      {/* 潘通参考色 */}
                      <div>
                        <p className="text-[9px] uppercase tracking-wider text-slate-500 mb-1">
                          Pantone 参考
                        </p>
                        {pantone ? (
                          <div className="flex items-center gap-2">
                            <span
                              className="w-5 h-5 rounded border border-white/20 flex-shrink-0"
                              style={{ backgroundColor: pantone.hex }}
                            />
                            <div className="min-w-0">
                              <p className="text-[11px] font-semibold text-slate-200 truncate">
                                {pantone.name === pantone.code
                                  ? pantone.code
                                  : `${pantone.code} ${pantone.name}`}
                              </p>
                              <p className="text-[9px] text-slate-500 font-mono">
                                ≈ {pantone.hex} · Δ {pantone.delta.toFixed(3)}
                              </p>
                            </div>
                          </div>
                        ) : (
                          <p className="text-[10px] text-slate-500">无可匹配参考色</p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          <p className="text-[9px] text-slate-600 mt-1">
            潘通参考色为 1391 色近似匹配（C 系列全集 + 年度色补充，社区整理非官方数据；OKLab 色差 Δ 越小越接近），正式交付请以官方潘通色卡为准
          </p>
        </div>
      )}
    </div>
  );
}
