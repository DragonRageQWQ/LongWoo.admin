"use client";

/**
 * 毛布取样器（灰度测试）
 *
 * 流程：上传图片 → 点击像素取色（目标 oklab）→ 客户端全库匹配
 *       （oklab 欧氏距离，几千条毫秒级）→ Top N 毛布结果卡片。
 *
 * 架构要点（性能设计）：
 * - 毛布 JSON 数据客户端一次性加载（真实数据走 public/fabric/fabric-data.json，
 *   缺失时回退内置示例），匹配在浏览器完成，服务器零计算；
 * - 毛布图片只对 Top N 结果按需加载（lazy + 失败回退 sRGB 色块占位），
 *   不预载全量图片。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Upload, ImagePlus, MousePointerClick, RefreshCw, Ruler, Tag, Layers } from "lucide-react";
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
import { rgbToHex } from "@/lib/color-math";

interface TargetPoint {
  x: number
  y: number
  r: number
  g: number
  b: number
  oklab: [number, number, number]
}

const TOP_N = 20

export default function FabricSampler() {
  // ===== 图片 =====
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [imageSize, setImageSize] = useState<{ w: number; h: number } | null>(null)
  const [containerSize, setContainerSize] = useState<{ w: number; h: number } | null>(null)
  const [dragOver, setDragOver] = useState(false)

  // ===== 数据与匹配 =====
  const [fabrics, setFabrics] = useState<NormalizedFabric[]>([])
  const [dataSource, setDataSource] = useState<"loading" | "sample" | "external">("loading")
  const [target, setTarget] = useState<TargetPoint | null>(null)
  const [results, setResults] = useState<FabricMatch[]>([])
  const [matchTime, setMatchTime] = useState<number | null>(null)

  // ===== 状态 =====
  const [status, setStatus] = useState("")

  const containerRef = useRef<HTMLDivElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)
  const srcCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const statusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // object-contain 渲染矩形
  const fitRect = useMemo(() => {
    if (!containerSize || !imageSize) return null
    const scale = Math.min(containerSize.w / imageSize.w, containerSize.h / imageSize.h)
    const w = imageSize.w * scale
    const h = imageSize.h * scale
    return { x: (containerSize.w - w) / 2, y: (containerSize.h - h) / 2, w, h }
  }, [containerSize, imageSize])

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

  // 加载毛布数据（真实 JSON 优先，回退示例）
  useEffect(() => {
    let cancelled = false
    loadFabricData().then((result) => {
      if (cancelled) return
      setFabrics(result.fabrics)
      setDataSource(result.external ? "external" : "sample")
      showStatus(
        `毛布库已就绪（${result.fabrics.length} 条${result.external ? "，真实数据" : "，示例数据"}）· 上传图片后点击取色即可匹配`
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
        showStatus("仅支持图片文件（jpg / png / webp 等）")
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
          setTarget(null)
          setResults([])
          setMatchTime(null)
          showStatus("图片已载入 · 点击图片任意像素位置取色匹配毛布")
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

  // ===== 取色 → 匹配 =====
  const handleImageClick = useCallback(
    (e: React.MouseEvent) => {
      if (!srcCanvasRef.current || !fitRect || !imageSize || !imgRef.current || fabrics.length === 0)
        return
      const rect = imgRef.current.getBoundingClientRect()
      const ox = e.clientX - rect.left - fitRect.x
      const oy = e.clientY - rect.top - fitRect.y
      if (ox < 0 || oy < 0 || ox > fitRect.w || oy > fitRect.h) return
      const px = Math.min(imageSize.w - 1, Math.max(0, Math.round((ox / fitRect.w) * imageSize.w)))
      const py = Math.min(imageSize.h - 1, Math.max(0, Math.round((oy / fitRect.h) * imageSize.h)))

      const ctx = srcCanvasRef.current.getContext("2d", { willReadFrequently: true })
      if (!ctx) return
      const d = ctx.getImageData(px, py, 1, 1).data
      const point: TargetPoint = {
        x: px,
        y: py,
        r: d[0],
        g: d[1],
        b: d[2],
        oklab: fabricOklab(d[0], d[1], d[2]),
      }

      const start = performance.now()
      const matched = matchFabrics(point.oklab, fabrics, TOP_N)
      const elapsed = performance.now() - start

      setTarget(point)
      setResults(matched)
      setMatchTime(elapsed)
      showStatus(`像素（${px}, ${py}）· 匹配 ${fabrics.length} 条毛布，耗时 ${elapsed.toFixed(1)}ms`)
    },
    [fitRect, imageSize, fabrics, showStatus]
  )

  // ===== 渲染 =====
  const hasImage = imageUrl && imageSize && fitRect
  const targetHex = target ? rgbToHex(target.r, target.g, target.b) : null
  const sourceLabel =
    dataSource === "external"
      ? "真实数据库"
      : dataSource === "loading"
        ? "加载中…"
        : "示例数据"

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* ===== 顶部操作栏 ===== */}
      <div className="flex items-center justify-between gap-3 pb-4 flex-wrap">
        <div className="flex items-center gap-2 text-xs text-slate-400 flex-wrap">
          <MousePointerClick className="w-4 h-4 text-blue-400 flex-shrink-0" />
          <span>上传图片 → 点击像素取色 → 自动匹配毛布 Top {TOP_N}</span>
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
              setTarget(null)
              setResults([])
              setMatchTime(null)
              showStatus("已清空匹配结果，可重新点击图片取色")
            }}
            disabled={!target}
            className="inline-flex items-center gap-1.5 min-h-[36px] px-3 rounded-lg text-xs font-medium text-slate-300 border border-white/10 hover:bg-white/10 hover:text-white transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            清空结果
          </button>
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
              alt="毛布取样源图"
              draggable={false}
              className="absolute inset-0 w-full h-full object-contain"
              onClick={handleImageClick}
              style={{ cursor: fabrics.length > 0 ? "crosshair" : "not-allowed" }}
            />
            {/* 当前目标色标记 */}
            {target && fitRect && (
              <div
                className="absolute z-10 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
                style={{
                  left: fitRect.x + (target.x / imageSize!.w) * fitRect.w,
                  top: fitRect.y + (target.y / imageSize!.h) * fitRect.h,
                }}
              >
                <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 block w-5 h-px bg-white/90" />
                <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 block w-px h-5 bg-white/90" />
                <span
                  className="relative flex items-center justify-center w-6 h-6 rounded-full border-2 bg-black/55 shadow-lg"
                  style={{ borderColor: targetHex ?? "#fff" }}
                />
              </div>
            )}
            {imageSize && (
              <span className="absolute top-2 right-2 px-2 py-0.5 rounded-md bg-black/50 text-[10px] font-mono text-slate-300 border border-white/10">
                {imageSize.w} × {imageSize.h}px
              </span>
            )}
          </>
        )}
      </div>

      {/* ===== 状态条 + 目标色信息 ===== */}
      <div className="mt-2 flex items-center gap-3 min-h-6 text-xs">
        {status ? (
          <span className="inline-flex items-center gap-1.5 text-slate-300">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
            {status}
          </span>
        ) : (
          <span className="text-slate-600">等待上传图片并取色</span>
        )}
        {target && targetHex && (
          <span className="ml-auto inline-flex items-center gap-2 font-mono text-slate-300">
            <span className="w-3.5 h-3.5 rounded border border-white/20" style={{ backgroundColor: targetHex }} />
            <span className="font-semibold">{targetHex}</span>
            <span className="text-slate-500">rgb({target.r},{target.g},{target.b})</span>
            <span className="text-slate-500">
              OKLab L {target.oklab[0].toFixed(3)} a {target.oklab[1].toFixed(3)} b {target.oklab[2].toFixed(3)}
            </span>
            <span className="text-slate-600">({target.x}, {target.y})</span>
          </span>
        )}
      </div>

      {/* ===== 匹配结果 ===== */}
      {target && (
        <div className="mt-3 pb-2">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-blue-400" />
              匹配结果
              <span className="text-slate-500 font-normal">
                {results.length} 条 · 匹配耗时 {matchTime?.toFixed(1) ?? "-"}ms · 按色差 Δ 升序
              </span>
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {results.map((m, idx) => (
              <FabricCard key={m.fabric.id} match={m} rank={idx + 1} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ==================== 毛布结果卡片 ====================

function FabricCard({ match, rank }: { match: FabricMatch; rank: number }) {
  const { fabric, delta } = match
  const cid = cidInfo(fabric.cid)
  const [imgFailed, setImgFailed] = useState(false)
  const [r, g, b] = fabric.sRGB
  const hex = fabric.hex ?? fabricHex(r, g, b)
  const imgPath = fabricImagePath(fabric.source)

  return (
    <div className="flex flex-col rounded-xl bg-white/[0.04] border border-white/10 overflow-hidden transition-colors hover:border-blue-400/30">
      {/* 图片区（失败回退 sRGB 色块占位） */}
      <div className="relative aspect-square bg-slate-900" style={{ backgroundColor: hex }}>
        {!imgFailed && (
          // eslint-disable-next-line @next/next/no-img-element -- 静态图片按需懒加载，不走 next/image 优化
          <img
            src={imgPath}
            alt={`${fabric.name}（${fabric.vendor} ${fabric.skuId}）`}
            loading="lazy"
            decoding="async"
            onError={() => setImgFailed(true)}
            className="w-full h-full object-cover"
          />
        )}
        {/* 排名角标 */}
        <span className="absolute top-1.5 left-1.5 inline-flex items-center justify-center w-5 h-5 rounded-full bg-black/60 text-[10px] font-bold text-white border border-white/30">
          {rank}
        </span>
        {/* 色差徽章 */}
        <span className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded bg-black/60 text-[9px] font-mono text-emerald-300 border border-white/10">
          Δ {delta.toFixed(3)}
        </span>
        {/* 色系标签 */}
        <span className="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 rounded bg-black/55 text-[9px] text-slate-200 border border-white/10">
          {cid.label} · {cid.en}
        </span>
      </div>

      {/* 信息区 */}
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
        {fabric.pantone && (
          <p className="text-[10px] text-blue-300/80 truncate">Pantone ≈ {fabric.pantone}</p>
        )}
        {fabric.tips && (
          <p className="text-[9px] text-amber-300/70 leading-relaxed mt-auto pt-1">{fabric.tips}</p>
        )}
      </div>
    </div>
  );
}
