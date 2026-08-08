"use client";

/**
 * 灰度测试页 - 交互式背景画布
 *
 * 功能：
 * - 每次打开页面随机选择一张作品图为背景（来源：works 表 image_url）
 * - 毛玻璃蒙版（默认 30% 不透明度），用户可调（10%~60%）
 * - 鼠标/触摸点附近蒙版局部增强（峰值约 75%，保证可读性）
 * - 底部小气泡调节器：不透明度滑块 + 随机切换背景按钮（10 秒冷却）
 * - PC 端 16:9 画布（letterbox 居中）；移动端全屏触控
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Shuffle, X, SlidersHorizontal } from "lucide-react";

interface GrayTestCanvasProps {
  /** 作品图片 URL 列表（背景库） */
  images: string[];
}

// 常量
const DEFAULT_OPACITY = 0.3; // 默认蒙版不透明度 30%
const MIN_OPACITY = 0.1;
const MAX_OPACITY = 0.6;
const LOCAL_STORAGE_KEY = "gray-test-mask-opacity";
const LOCAL_STORAGE_LAST_INDEX = "gray-test-last-index";
const COOLDOWN_MS = 10_000; // 随机切换冷却 10 秒
const ENHANCE_PEAK = 0.45; // 鼠标局部增强峰值增量
const FADE_DURATION = 900; // 背景切换淡出时长 ms
const ENHANCE_RADIUS_PC = 340; // PC 端增强半径 px
const ENHANCE_RADIUS_MOBILE = 220; // 移动端增强半径 px
const MASK_COLOR = "15,23,42"; // 蒙版底色（深蓝灰 RGB）

export default function GrayTestCanvas({ images }: GrayTestCanvasProps) {
  const [bgIndex, setBgIndex] = useState<number | null>(null);
  const [prevIndex, setPrevIndex] = useState<number | null>(null);
  const [fadePrev, setFadePrev] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const [imgLoaded, setImgLoaded] = useState(false);
  const [opacity, setOpacity] = useState(DEFAULT_OPACITY);
  const [panelOpen, setPanelOpen] = useState(false);
  const [cooldownLeft, setCooldownLeft] = useState(0);
  const [isMobile, setIsMobile] = useState(false);
  const [isClient, setIsClient] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const enhanceRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);
  const pointerRef = useRef({ x: -9999, y: -9999, active: false });
  const smoothRef = useRef({ x: -9999, y: -9999, strength: 0 });
  const lastRandomTsRef = useRef(0);
  const cooldownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const opacityRef = useRef(DEFAULT_OPACITY);

  // 初始化：设备检测 + 读取本地偏好
  useEffect(() => {
    setIsClient(true);
    const mq = window.matchMedia("(pointer: coarse)");
    setIsMobile(mq.matches);

    let saved = DEFAULT_OPACITY;
    try {
      const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (raw !== null) {
        const n = parseFloat(raw);
        if (!Number.isNaN(n)) saved = Math.min(MAX_OPACITY, Math.max(MIN_OPACITY, n));
      }
    } catch { /* 隐私模式忽略 */ }
    opacityRef.current = saved;
    setOpacity(saved);
  }, []);

  // 首次打开：随机选一张背景（排除上次，避免连续相同）
  useEffect(() => {
    if (!isClient || images.length === 0 || bgIndex !== null) return;
    let candidates = images.map((_, i) => i);
    try {
      const last = parseInt(localStorage.getItem(LOCAL_STORAGE_LAST_INDEX) || "", 10);
      if (!Number.isNaN(last) && candidates.length > 1) {
        candidates = candidates.filter((i) => i !== last);
      }
    } catch { /* 忽略 */ }
    const pick = candidates[Math.floor(Math.random() * candidates.length)];
    setBgIndex(pick);
    setImgLoaded(false);
    try {
      localStorage.setItem(LOCAL_STORAGE_LAST_INDEX, String(pick));
    } catch { /* 忽略 */ }
  }, [isClient, images, bgIndex]);

  // 随机切换（气泡按钮触发，10 秒冷却）
  const handleRandom = useCallback(() => {
    if (images.length <= 1 || cooldownLeft > 0 || transitioning) return;
    const now = Date.now();
    if (now - lastRandomTsRef.current < COOLDOWN_MS) return;
    lastRandomTsRef.current = now;

    let next = bgIndex;
    while (next === bgIndex && images.length > 1) {
      next = Math.floor(Math.random() * images.length);
    }
    if (next === bgIndex) return;

    setPrevIndex(bgIndex);
    setFadePrev(true);
    setBgIndex(next);
    setImgLoaded(false);
    setTransitioning(true);
    try {
      localStorage.setItem(LOCAL_STORAGE_LAST_INDEX, String(next));
    } catch { /* 忽略 */ }

    // 冷却计时
    setCooldownLeft(COOLDOWN_MS / 1000);
    if (cooldownTimerRef.current) clearInterval(cooldownTimerRef.current);
    cooldownTimerRef.current = setInterval(() => {
      setCooldownLeft((c) => {
        if (c <= 1) {
          if (cooldownTimerRef.current) clearInterval(cooldownTimerRef.current);
          return 0;
        }
        return c - 1;
      });
    }, 1000);
  }, [images.length, bgIndex, cooldownLeft, transitioning]);

  // 淡出动画：先显示旧图（opacity 1），下一帧触发 transition 到 0
  useEffect(() => {
    if (!transitioning) return;
    const raf = requestAnimationFrame(() => setFadePrev(false));
    const t = setTimeout(() => {
      setPrevIndex(null);
      setFadePrev(false);
      setTransitioning(false);
    }, FADE_DURATION);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(t);
    };
  }, [transitioning, bgIndex]);

  // 不透明度持久化
  const handleOpacityChange = useCallback((v: number) => {
    const clamped = Math.min(MAX_OPACITY, Math.max(MIN_OPACITY, v));
    opacityRef.current = clamped;
    setOpacity(clamped);
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, String(clamped));
    } catch { /* 忽略 */ }
  }, []);

  // 指针位置追踪
  const updatePointer = useCallback((x: number, y: number) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    pointerRef.current = { x: x - rect.left, y: y - rect.top, active: true };
  }, []);

  const clearPointer = useCallback(() => {
    pointerRef.current.active = false;
  }, []);

  // rAF 平滑动画循环（蒙版局部增强跟随指针）
  useEffect(() => {
    const loop = () => {
      const s = smoothRef.current;
      const p = pointerRef.current;
      const targetX = p.active ? p.x : -9999;
      const targetY = p.active ? p.y : -9999;
      const targetStrength = p.active ? 1 : 0;

      // lerp 平滑插值
      s.x += (targetX - s.x) * 0.12;
      s.y += (targetY - s.y) * 0.12;
      s.strength += (targetStrength - s.strength) * 0.1;

      const el = enhanceRef.current;
      if (el) {
        const radius = isMobile ? ENHANCE_RADIUS_MOBILE : ENHANCE_RADIUS_PC;
        const base = Math.min(0.6, opacityRef.current);
        // 局部增强：基础不透明度 + 峰值增量，总峰值 ≈ 0.75（绝不接近 100%）
        const alpha = Math.min(0.8, base + ENHANCE_PEAK * s.strength);
        el.style.background = `radial-gradient(circle ${radius}px at ${s.x.toFixed(1)}px ${s.y.toFixed(1)}px, rgba(${MASK_COLOR},${alpha.toFixed(3)}) 0%, rgba(${MASK_COLOR},${base.toFixed(3)}) 55%, rgba(${MASK_COLOR},${(base * 0.92).toFixed(3)}) 100%)`;
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [isMobile]);

  // 卸载清理
  useEffect(() => {
    return () => {
      if (cooldownTimerRef.current) clearInterval(cooldownTimerRef.current);
    };
  }, []);

  // 未挂载或无可展示背景
  if (!isClient || images.length === 0 || bgIndex === null) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gray-900">
        <p className="text-gray-500 text-sm tracking-wide">背景加载中...</p>
      </div>
    );
  }

  const currentImg = images[bgIndex];
  const prevImg = prevIndex !== null ? images[prevIndex] : null;

  return (
    <div
      ref={containerRef}
      className={`relative overflow-hidden select-none ${
        isMobile
          ? "w-screen h-screen"
          : "aspect-video"
      }`}
      style={!isMobile ? { width: "min(100vw, calc(100vh * 16 / 9))", maxHeight: "100vh" } : undefined}
      onPointerMove={(e) => updatePointer(e.clientX, e.clientY)}
      onPointerDown={(e) => updatePointer(e.clientX, e.clientY)}
      onPointerLeave={clearPointer}
      onTouchStart={(e) => {
        const t = e.touches[0];
        if (t) updatePointer(t.clientX, t.clientY);
      }}
      onTouchMove={(e) => {
        const t = e.touches[0];
        if (t) updatePointer(t.clientX, t.clientY);
      }}
      onTouchEnd={clearPointer}
    >
      {/* ===== 背景层 ===== */}
      {/* 当前背景（下层） */}
      <img
        src={currentImg}
        alt=""
        draggable={false}
        onLoad={() => setImgLoaded(true)}
        className="absolute inset-0 w-full h-full object-cover transition-opacity duration-500"
        style={{ opacity: imgLoaded ? 1 : 0 }}
      />
      {/* 上一张背景（上层，淡出中） */}
      {prevImg && (
        <img
          src={prevImg}
          alt=""
          draggable={false}
          className="absolute inset-0 w-full h-full object-cover ease-in-out"
          style={{
            opacity: fadePrev ? 1 : 0,
            transition: `opacity ${FADE_DURATION}ms ease-in-out`,
          }}
        />
      )}

      {/* ===== 毛玻璃蒙版层（全局基础不透明度） ===== */}
      <div
        className="absolute inset-0 backdrop-blur-xl"
        style={{ backgroundColor: `rgba(${MASK_COLOR},${opacity})` }}
      />

      {/* ===== 指针局部增强层（径向渐变，rAF 驱动） ===== */}
      <div ref={enhanceRef} className="absolute inset-0 pointer-events-none" />

      {/* ===== 底部小气泡调节器 ===== */}
      <div className="absolute bottom-4 right-4 sm:bottom-5 sm:right-5 z-20 flex flex-col items-end gap-2">
        {panelOpen && (
          <div
            className="bg-white/85 backdrop-blur-md rounded-2xl shadow-lg border border-white/40 p-4 w-64 sm:w-72"
            style={{ animation: "grayFadeSlideUp 0.25s ease-out" }}
          >
            {/* 不透明度调节 */}
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-slate-600">蒙版不透明度</span>
              <span className="text-xs font-semibold text-slate-800 tabular-nums">
                {Math.round(opacity * 100)}%
              </span>
            </div>
            <input
              type="range"
              min={MIN_OPACITY * 100}
              max={MAX_OPACITY * 100}
              step={1}
              value={Math.round(opacity * 100)}
              onChange={(e) => handleOpacityChange(parseInt(e.target.value, 10) / 100)}
              className="w-full h-1.5 appearance-none rounded-full bg-slate-200 accent-blue-600 cursor-pointer"
              aria-label="蒙版不透明度"
            />

            <div className="h-px bg-slate-200/70 my-3" />

            {/* 随机切换背景 */}
            <button
              onClick={handleRandom}
              disabled={cooldownLeft > 0 || images.length <= 1}
              className={`w-full flex items-center justify-center gap-2 py-2 rounded-xl text-sm font-medium transition-all
                ${
                  cooldownLeft > 0 || images.length <= 1
                    ? "bg-slate-100 text-slate-400 cursor-not-allowed"
                    : "bg-slate-800 text-white hover:bg-slate-700 active:scale-[0.98]"
                }`}
            >
              <Shuffle className="w-4 h-4" />
              {cooldownLeft > 0
                ? `切换背景（${cooldownLeft}s）`
                : images.length <= 1
                  ? "仅一张背景"
                  : "随机切换背景"}
            </button>
          </div>
        )}

        {/* 气泡按钮 */}
        <button
          onClick={() => setPanelOpen((o) => !o)}
          aria-label={panelOpen ? "收起调节器" : "展开调节器"}
          className={`group flex items-center justify-center rounded-full shadow-md transition-all duration-300
            ${
              panelOpen
                ? "w-10 h-10 bg-slate-800 text-white rotate-180"
                : "w-11 h-11 bg-white/70 backdrop-blur-md text-slate-600 border border-white/50 hover:bg-white/90 hover:shadow-lg hover:scale-105"
            }`}
        >
          {panelOpen ? (
            <X className="w-4 h-4" />
          ) : (
            <SlidersHorizontal className="w-4 h-4 transition-transform group-hover:rotate-12" />
          )}
        </button>
      </div>
    </div>
  );
}
