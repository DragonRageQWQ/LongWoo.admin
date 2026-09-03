"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useLanguage } from "@/components/i18n/LanguageProvider";
import { COPY, GT2_TABS, GT2_TAB_STORAGE_KEY, type Gt2TabId } from "./copy";
import AgentPanel from "./components/AgentPanel";
import FursuitPanel from "./components/FursuitPanel";
import EntryPanel from "./components/EntryPanel";
import CheckPanel from "./components/CheckPanel";
import ShopPanel from "./components/ShopPanel";
import UserBubble from "./components/UserBubble";
import "./home.css";

/** 挤压位移的距离衰减系数：紧邻全量、越远越轻（温和档） */
const NAV_FALLOFF = [0, 1, 0.6, 0.32, 0.15];

function NavLabel({ text }: { text: string }) {
  return (
    <>
      <span className="gt2-w gt2-w-r">{text}</span>
      <span className="gt2-w gt2-w-b" aria-hidden="true">{text}</span>
    </>
  );
}

export default function GrayTest2App() {
  const [active, setActive] = useState<Gt2TabId>("agent");
  const [drawerOpen, setDrawerOpen] = useState(false);

  // 语言源：全局 LanguageProvider（cookie/localStorage/?lang=），切换走整页跳转
  const { lang, setLang } = useLanguage();

  const activeIdx = GT2_TABS.findIndex((t) => t.id === active);
  const navRef = useRef<HTMLElement>(null);
  const slotRefs = useRef<(HTMLDivElement | null)[]>([]);
  const haloRef = useRef<HTMLDivElement | null>(null);
  const heightCache = useRef<{ active: number[]; idle: number[] } | null>(null);

  /**
   * 预测量：临时禁用过渡，量出每个菜单在激活/非激活两种字号下的目标高度。
   * 点击瞬间即可用目标尺寸算推力，无需等字号过渡完成（消除动效延迟）。
   */
  const measureHeights = useCallback(() => {
    const slots = slotRefs.current;
    const activeArr: number[] = [];
    const idleArr: number[] = [];
    slots.forEach((el) => {
      const btn = el?.firstElementChild as HTMLElement | null;
      if (!el || !btn) {
        activeArr.push(0);
        idleArr.push(0);
        return;
      }
      const prev = btn.getAttribute("data-active");
      btn.classList.add("gt2-measure");
      btn.setAttribute("data-active", "true");
      activeArr.push(el.offsetHeight);
      btn.setAttribute("data-active", "false");
      idleArr.push(el.offsetHeight);
      if (prev === null) btn.removeAttribute("data-active");
      else btn.setAttribute("data-active", prev);
      btn.classList.remove("gt2-measure");
    });
    heightCache.current = { active: activeArr, idle: idleArr };
  }, []);

  /**
   * 温和挤压动效：基础排布完全交给 flex（space-between），
   * JS 只在自然位置上叠加视觉层——邻居背离选中项轻推 + 微缩淡出。
   * JS 失效时布局仍然正确（纯自然流）。
   */
  const applyNavLayout = useCallback(() => {
    const nav = navRef.current;
    if (!nav) return;
    const H = nav.clientHeight;
    if (H <= 0) return;
    const slots = slotRefs.current;
    const N = slots.length;
    if (N === 0) return;

    const cache = heightCache.current;
    const heights = cache ? cache.idle : slots.map((el) => el?.offsetHeight ?? 0);
    const hBase = Math.min(...heights);
    const hSel = cache ? (cache.active[activeIdx] ?? hBase) : (slots[activeIdx]?.offsetHeight ?? hBase);
    const delta = Math.max(0, hSel - hBase);
    const maxPush = Math.max(14, Math.round(delta * 0.4));

    slots.forEach((el, j) => {
      if (!el) return;
      const d = Math.min(Math.abs(activeIdx - j), NAV_FALLOFF.length - 1);
      const f = NAV_FALLOFF[d];
      const top = el.offsetTop;

      let ty = 0;
      let scale = 1;
      let opacity = 1;
      if (j !== activeIdx) {
        // 背离选中项方向推开（上方上移、下方下移），并钳制在容器内
        let push = Math.sign(j - activeIdx) * maxPush * f;
        push = Math.max(-top, Math.min(push, H - heights[j] - top));
        ty = push;
        scale = 1 - 0.04 * f; // 轻微微缩
        opacity = 1 - 0.13 * f; // 轻微淡出
      }

      el.style.transform = `translate3d(0, ${ty.toFixed(1)}px, 0) scale(${scale.toFixed(3)})`;
      el.style.opacity = opacity.toFixed(3);
      el.style.zIndex = j === activeIdx ? "2" : "1";
    });

    // 聚光蒙版：定位到选中项的 flex 终态位置（按目标高度推导 space-between 终局），
    // 与字号/挤压动效同用 0.55s spring，滑动与生长完全同步
    const halo = haloRef.current;
    if (halo) {
      const heightsFinal = heights.map((h, j) => (j === activeIdx ? hSel : h));
      const sumH = heightsFinal.reduce((a, b) => a + b, 0);
      const gap = (H - sumH) / (N - 1);
      let acc = 0;
      let selTop = 0;
      for (let j = 0; j < N; j += 1) {
        if (j === activeIdx) selTop = acc;
        acc += heightsFinal[j] + gap;
      }
      const bleed = 30;
      halo.style.top = `${(selTop - bleed).toFixed(1)}px`;
      halo.style.height = `${(hSel + bleed * 2).toFixed(1)}px`;
    }
  }, [activeIdx]);

  // 选中变化时：立即用预测量的目标尺寸重算（推力与字号动画同步启动，无延迟）
  useLayoutEffect(() => {
    if (!heightCache.current) measureHeights();
    applyNavLayout();
  }, [applyNavLayout, measureHeights]);

  // 挂载 + 尺寸变化（响应式断点会改字号）：重测后重排
  useEffect(() => {
    measureHeights();
    applyNavLayout();
    const relayout = () => {
      measureHeights();
      applyNavLayout();
    };
    const ro = new ResizeObserver(relayout);
    if (navRef.current) ro.observe(navRef.current);
    window.addEventListener("resize", relayout);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", relayout);
    };
  }, [applyNavLayout, measureHeights]);

  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(GT2_TAB_STORAGE_KEY);
      if (saved && GT2_TABS.some((t) => t.id === saved)) {
        setActive(saved as Gt2TabId);
      }
    } catch {
      /* ignore */
    }
  }, []);

  // URL 参数支持：?tab=check&no=&email=（委托提交成功页“去查询进度”站内跳转）
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const tab = params.get("tab");
    if (tab && GT2_TABS.some((t) => t.id === tab)) {
      setActive(tab as Gt2TabId);
      try {
        sessionStorage.setItem(GT2_TAB_STORAGE_KEY, tab);
      } catch {
        /* ignore */
      }
    }
  }, []);

  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDrawerOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [drawerOpen]);

  const select = useCallback((id: Gt2TabId) => {
    setActive(id);
    setDrawerOpen(false);
    try {
      sessionStorage.setItem(GT2_TAB_STORAGE_KEY, id);
    } catch {
      /* ignore */
    }
  }, []);

  const copy = COPY[lang];

  const isActive = useCallback((id: Gt2TabId) => active === id, [active]);

  /**
   * 导航主词：en 模式下沿用 zh 词作副标签（保持原英中双语文案）；其它语言用该语言主词，
   * 英文微标签固定由 GT2_TABS.en 提供（品牌双语文案风格）。
   */
  const navWord = useCallback(
    (id: Gt2TabId) => {
      if (lang === "en") return GT2_TABS.find((t) => t.id === id)?.zh ?? "";
      return copy.tabs[id];
    },
    [lang, copy]
  );

  return (
    <div className="gt2-root">
      <button
        type="button"
        className="gt2-hamburger"
        onClick={() => setDrawerOpen(true)}
        aria-label="菜单"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <path d="M3 6h18" />
          <path d="M3 12h18" />
          <path d="M3 18h12" />
        </svg>
      </button>

      <div className="gt2-overlay" data-open={drawerOpen} onClick={() => setDrawerOpen(false)} />

      <aside className="gt2-sidebar" data-open={drawerOpen}>
        <button
          type="button"
          className="gt2-drawer-close"
          onClick={() => setDrawerOpen(false)}
          aria-label="关闭菜单"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M18 6 6 18" />
            <path d="M6 6l12 12" />
          </svg>
        </button>

        <div className="gt2-brand gt2-rise" style={{ "--i": 0 } as React.CSSProperties}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="gt2-brand-logo" src="/longwoo-logo.svg" alt="LongWoo 龙坞" />
          <div>
            <span className="gt2-brand-name">龙坞</span>
            <span className="gt2-brand-sub">LongWoo Studio</span>
          </div>
        </div>

        <nav className="gt2-nav" aria-label="主导航" ref={navRef}>
          <div className="gt2-nav-halo" ref={haloRef} aria-hidden="true" />
          {GT2_TABS.map((tab, i) => (
            <div
              key={tab.id}
              className="gt2-nav-slot"
              ref={(el) => {
                slotRefs.current[i] = el;
              }}
            >
              <button
                type="button"
                className="gt2-nav-item gt2-rise"
                style={{ "--i": i + 1 } as React.CSSProperties}
                data-active={active === tab.id}
                onClick={() => select(tab.id)}
                aria-current={active === tab.id ? "page" : undefined}
              >
                <span className="gt2-nav-en">
                  <NavLabel text={tab.en} />
                </span>
                <span className="gt2-nav-zh">
                  <NavLabel text={navWord(tab.id)} />
                </span>
              </button>
            </div>
          ))}
        </nav>
      </aside>

      <main className="gt2-main">
        {/* SEO：页面级唯一 H1（视觉隐藏，避免多面板标题抢占 H1 语义） */}
        <h1 className="sr-only">龙坞工作室 LongWoo - 角色创意与定制</h1>
        <div className="gt2-top-actions">
          <UserBubble lang={lang} onLangChange={setLang} />
        </div>

        <div className="gt2-panels">
          <section className="gt2-panel" data-active={active === "agent"} inert={!isActive("agent")}>
            <AgentPanel lang={lang} />
          </section>
          <section className="gt2-panel" data-active={active === "fursuit"} inert={!isActive("fursuit")}>
            <FursuitPanel lang={lang} />
          </section>
          <section className="gt2-panel" data-active={active === "shop"} inert={!isActive("shop")}>
            <ShopPanel lang={lang} />
          </section>
          <section className="gt2-panel" data-active={active === "check"} inert={!isActive("check")}>
            <CheckPanel lang={lang} />
          </section>
          <section className="gt2-panel" data-active={active === "about"} inert={!isActive("about")}>
            <EntryPanel entry={copy.entries.about} mark="05" />
          </section>
        </div>
      </main>
    </div>
  );
}
