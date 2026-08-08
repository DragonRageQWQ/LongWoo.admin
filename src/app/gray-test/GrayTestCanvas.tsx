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
 *
 * 优化记录（v2）：
 * - prefers-reduced-motion 降级：禁用局部增强动画、缩短淡出
 * - rAF 循环按需启停：指针无交互且收敛后暂停，省电
 * - 背景图全量预加载，切换无黑屏
 * - 触摸目标 ≥44px，面板响应式宽度
 * - aria-expanded / autoFocus / Esc / 点击外部关闭
 * - 蒙版色读取 CSS 变量（令牌化），面板去叠层 blur
 */
import { useCallback, useEffect, useRef, useState, useSyncExternalStore, startTransition } from "react";
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
const FADE_DURATION_REDUCED = 250; // reduced-motion 时的淡出时长
const ENHANCE_RADIUS_PC = 340; // PC 端增强半径 px
const ENHANCE_RADIUS_MOBILE = 220; // 移动端增强半径 px
const INACTIVE_POSITION = -9999; // 指针不活跃时的占位坐标

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
  const [reducedMotion, setReducedMotion] = useState(false);
  // 客户端水合检测（SSR 返回 false，客户端返回 true）
  const isClient = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );

  const containerRef = useRef<HTMLDivElement>(null);
  const enhanceRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);
  const startLoopRef = useRef<() => void>(() => {});
  const pointerRef = useRef({ x: INACTIVE_POSITION, y: INACTIVE_POSITION, active: false });
  const smoothRef = useRef({ x: INACTIVE_POSITION, y: INACTIVE_POSITION, strength: 0 });
  const lastRandomTsRef = useRef(0);
  const cooldownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const opacityRef = useRef(DEFAULT_OPACITY);
  const reducedMotionRef = useRef(false);
  const isMobileRef = useRef(false);
  const lastStyleRef = useRef("");

  // 读取 CSS 变量蒙版色（令牌化），带默认回退
  const maskColorRef = useRef("15,23,42");
  const [maskColor, setMaskColor] = useState("15,23,42");

  // 初始化：设备检测 + 动效偏好 + 读取本地设置（一次性，非紧急更新）
  useEffect(() => {
    const mqCoarse = window.matchMedia("(pointer: coarse)");
    const mqReduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    isMobileRef.current = mqCoarse.matches;
    reducedMotionRef.current = mqReduced.matches;
    startTransition(() => {
      setIsMobile(mqCoarse.matches);
      setReducedMotion(mqReduced.matches);
    });

    // 令牌化蒙版色：尝试从 CSS 变量读取
    try {
      const styles = getComputedStyle(document.documentElement);
      const raw = styles.getPropertyValue("--gray-test-mask-color").trim();
      if (raw) {
        maskColorRef.current = raw;
        startTransition(() => setMaskColor(raw));
      }
    } catch { /* 忽略 */ }

    let saved = DEFAULT_OPACITY;
    try {
      const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (raw !== null) {
        const n = parseFloat(raw);
        if (!Number.isNaN(n)) saved = Math.min(MAX_OPACITY, Math.max(MIN_OPACITY, n));
      }
    } catch { /* 隐私模式忽略 */ }
    opacityRef.current = saved;
    startTransition(() => setOpacity(saved));

    // 监听动效偏好变化（系统设置切换时实时响应）
    const onReducedChange = (e: MediaQueryListEvent) => {
      reducedMotionRef.current = e.matches;
      setReducedMotion(e.matches);
    };
    mqReduced.addEventListener("change", onReducedChange);
    return () => mqReduced.removeEventListener("change", onReducedChange);
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
    startTransition(() => {
      setBgIndex(pick);
      setImgLoaded(false);
    });
    try {
      localStorage.setItem(LOCAL_STORAGE_LAST_INDEX, String(pick));
    } catch { /* 忽略 */ }
  }, [isClient, images, bgIndex]);

  // 全量预加载背景库（消除切换黑屏）
  useEffect(() => {
    if (images.length === 0) return;
    let cancelled = false;
    const preload = () => {
      if (cancelled) return;
      images.forEach((src) => {
        const img = new Image();
        img.src = src;
      });
    };
    // 延迟到首次渲染完成后预加载，不抢占首屏带宽
    const t = setTimeout(preload, 300);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [images]);

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
    setImgLoaded(true); // 已预加载，直接显示避免闪烁
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
  const fadeDuration = reducedMotion ? FADE_DURATION_REDUCED : FADE_DURATION;
  useEffect(() => {
    if (!transitioning) return;
    if (reducedMotionRef.current) {
      // 降级模式：无动画，直接完成切换
      setPrevIndex(null);
      setFadePrev(false);
      setTransitioning(false);
      return;
    }
    const raf = requestAnimationFrame(() => setFadePrev(false));
    const t = setTimeout(() => {
      setPrevIndex(null);
      setFadePrev(false);
      setTransitioning(false);
    }, fadeDuration);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(t);
    };
  }, [transitioning, bgIndex, fadeDuration]);

  // 不透明度持久化
  const handleOpacityChange = useCallback((v: number) => {
    const clamped = Math.min(MAX_OPACITY, Math.max(MIN_OPACITY, v));
    opacityRef.current = clamped;
    setOpacity(clamped);
    try {
      localStorage.setItem(LOCAL_STORAGE_KEY, String(clamped));
    } catch { /* 忽略 */ }
  }, []);

  // 指针位置追踪（唤醒动画循环）
  const updatePointer = useCallback((x: number, y: number) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    pointerRef.current = { x: x - rect.left, y: y - rect.top, active: true };
    // 唤醒 rAF 循环（若已暂停）
    startLoopRef.current();
  }, []);

  const clearPointer = useCallback(() => {
    pointerRef.current.active = false;
  }, []);

  // rAF 平滑动画循环（按需启停：无交互且收敛后暂停，指针移动时唤醒）
  useEffect(() => {
    if (reducedMotion) return; // 降级模式：完全禁用跟随动画

    let running = true;
    const loop = () => {
      if (!running) return;
      const s = smoothRef.current;
      const p = pointerRef.current;
      const targetX = p.active ? p.x : INACTIVE_POSITION;
      const targetY = p.active ? p.y : INACTIVE_POSITION;
      const targetStrength = p.active ? 1 : 0;

      // lerp 平滑插值
      s.x += (targetX - s.x) * 0.12;
      s.y += (targetY - s.y) * 0.12;
      s.strength += (targetStrength - s.strength) * 0.1;

      const el = enhanceRef.current;
      if (el) {
        const radius = isMobileRef.current ? ENHANCE_RADIUS_MOBILE : ENHANCE_RADIUS_PC;
        const base = Math.min(0.6, opacityRef.current);
        // 局部增强：基础不透明度 + 峰值增量，总峰值 ≈ 0.75（绝不接近 100%）
        const alpha = Math.min(0.8, base + ENHANCE_PEAK * s.strength);
        const css = `radial-gradient(circle ${radius}px at ${s.x.toFixed(1)}px ${s.y.toFixed(1)}px, rgba(${maskColorRef.current},${alpha.toFixed(3)}) 0%, rgba(${maskColorRef.current},${base.toFixed(3)}) 55%, rgba(${maskColorRef.current},${(base * 0.92).toFixed(3)}) 100%)`;
        // 仅在值变化超过阈值时更新样式，避免无意义重写
        if (css !== lastStyleRef.current) {
          el.style.background = css;
          lastStyleRef.current = css;
        }
      }

      // 按需暂停：指针不活跃且位置/强度已收敛到静止
      const idle =
        !p.active &&
        Math.abs(targetX - s.x) < 0.5 &&
        Math.abs(targetY - s.y) < 0.5 &&
        s.strength < 0.002;
      if (idle) {
        rafRef.current = null;
        // 收敛后清空增强层，释放绘制压力
        if (el) {
          el.style.background = "transparent";
          lastStyleRef.current = "";
        }
        return; // 不调度下一帧，循环暂停
      }

      rafRef.current = requestAnimationFrame(loop);
    };

    // 注册唤醒函数：指针移动时若已暂停则重启循环
    startLoopRef.current = () => {
      if (running && rafRef.current === null) {
        rafRef.current = requestAnimationFrame(loop);
      }
    };

    // 启动循环
    rafRef.current = requestAnimationFrame(loop);

    return () => {
      running = false;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [reducedMotion]);

  // 卸载清理
  useEffect(() => {
    return () => {
      if (cooldownTimerRef.current) clearInterval(cooldownTimerRef.current);
    };
  }, []);

  // 面板：Esc 关闭 + 点击外部关闭
  useEffect(() => {
    if (!panelOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPanelOpen(false);
    };
    const onClickOutside = (e: MouseEvent) => {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node)
      ) {
        setPanelOpen(false);
      }
    };
    // 延迟绑定点击，避免打开瞬间立即触发关闭
    const t = setTimeout(() => {
      document.addEventListener("keydown", onKeyDown);
      document.addEventListener("mousedown", onClickOutside);
    }, 0);
    return () => {
      clearTimeout(t);
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("mousedown", onClickOutside);
    };
  }, [panelOpen]);

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
        className={`absolute inset-0 w-full h-full object-cover ${
          reducedMotion ? "" : "transition-opacity duration-500"
        }`}
        style={{ opacity: imgLoaded ? 1 : 0 }}
      />
      {/* 上一张背景（上层，淡出中） */}
      {prevImg && (
        <img
          src={prevImg}
          alt=""
          draggable={false}
          className="absolute inset-0 w-full h-full object-cover"
          style={{
            opacity: fadePrev ? 1 : 0,
            transition: `opacity ${fadeDuration}ms ease-in-out`,
          }}
        />
      )}

      {/* ===== 毛玻璃蒙版层（全局基础不透明度） ===== */}
      <div
        className={`absolute inset-0 ${reducedMotion ? "" : "backdrop-blur-xl"}`}
        style={{ backgroundColor: `rgba(${maskColor},${opacity})` }}
      />

      {/* ===== 指针局部增强层（径向渐变，rAF 驱动） ===== */}
      <div ref={enhanceRef} className="absolute inset-0 pointer-events-none" />

      {/* ===== 底部小气泡调节器 ===== */}
      <div className="absolute bottom-4 right-4 sm:bottom-5 sm:right-5 z-20 flex flex-col items-end gap-2">
        {panelOpen && (
          <div
            ref={panelRef}
            role="dialog"
            aria-label="背景调节器"
            className="bg-white/95 rounded-2xl shadow-lg border border-white/40 p-4 w-[calc(100vw-2rem)] max-w-72"
            style={{ animation: "grayFadeSlideUp 0.25s ease-out" }}
          >
            {/* 不透明度调节 */}
            <div className="flex items-center justify-between mb-2">
              <label htmlFor="gray-test-opacity" className="text-xs font-medium text-slate-600">
                蒙版不透明度
              </label>
              <span className="text-xs font-semibold text-slate-800 tabular-nums">
                {Math.round(opacity * 100)}%
              </span>
            </div>
            <input
              id="gray-test-opacity"
              type="range"
              min={MIN_OPACITY * 100}
              max={MAX_OPACITY * 100}
              step={1}
              value={Math.round(opacity * 100)}
              onChange={(e) => handleOpacityChange(parseInt(e.target.value, 10) / 100)}
              className="w-full h-6 appearance-none rounded-full bg-slate-200 accent-blue-600 cursor-pointer"
              aria-label="蒙版不透明度"
              autoFocus
            />

            <div className="h-px bg-slate-200/70 my-3" />

            {/* 随机切换背景 */}
            <button
              onClick={handleRandom}
              disabled={cooldownLeft > 0 || images.length <= 1}
              className={`w-full min-h-[44px] flex items-center justify-center gap-2 rounded-xl text-sm font-medium transition-all
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
          aria-expanded={panelOpen}
          aria-controls="gray-test-panel"
          className={`group flex items-center justify-center rounded-full shadow-md transition-all duration-300
            ${
              panelOpen
                ? "w-11 h-11 bg-slate-800 text-white rotate-180"
                : "w-11 h-11 bg-white/85 text-slate-600 border border-white/50 hover:bg-white/95 hover:shadow-lg hover:scale-105"
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
