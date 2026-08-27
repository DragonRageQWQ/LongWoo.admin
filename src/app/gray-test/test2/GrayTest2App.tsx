"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { COPY, GT2_TABS, GT2_TAB_STORAGE_KEY, type Gt2Lang, type Gt2TabId } from "./copy";
import AgentPanel from "./components/AgentPanel";
import FursuitPanel from "./components/FursuitPanel";
import EntryPanel from "./components/EntryPanel";
import UserBubble from "./components/UserBubble";
import "./test2.css";

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
  const [lang, setLang] = useState<Gt2Lang>("zh");
  const [drawerOpen, setDrawerOpen] = useState(false);

  const activeIdx = GT2_TABS.findIndex((t) => t.id === active);
  const navRef = useRef<HTMLElement>(null);
  const slotRefs = useRef<(HTMLDivElement | null)[]>([]);

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

    const heights = slots.map((el) => el?.offsetHeight ?? 0);
    const hBase = Math.min(...heights);
    const hSel = heights[activeIdx] ?? hBase;
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
  }, [activeIdx]);

  // 选中变化时：DOM 应用新字号后立即重算（过渡前拿到目标值）
  useLayoutEffect(() => {
    applyNavLayout();
  }, [applyNavLayout]);

  // 初始挂载 + 窗口/容器尺寸变化 + 字体过渡结束后校准
  useEffect(() => {
    applyNavLayout();
    const timer = window.setTimeout(applyNavLayout, 680);
    const ro = new ResizeObserver(() => applyNavLayout());
    if (navRef.current) ro.observe(navRef.current);
    window.addEventListener("resize", applyNavLayout);
    return () => {
      window.clearTimeout(timer);
      ro.disconnect();
      window.removeEventListener("resize", applyNavLayout);
    };
  }, [applyNavLayout]);

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
                  <NavLabel text={tab.zh} />
                </span>
              </button>
            </div>
          ))}
        </nav>
      </aside>

      <main className="gt2-main">
        <div className="gt2-top-actions">
          <a className="gt2-back-hub" href="/gray-test">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M19 12H5" />
              <path d="M12 19l-7-7 7-7" />
            </svg>
            GRAY TEST
          </a>
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
            <EntryPanel entry={copy.entries.shop} mark="03" />
          </section>
          <section className="gt2-panel" data-active={active === "check"} inert={!isActive("check")}>
            <EntryPanel entry={copy.entries.check} mark="04" />
          </section>
          <section className="gt2-panel" data-active={active === "about"} inert={!isActive("about")}>
            <EntryPanel entry={copy.entries.about} mark="05" />
          </section>
        </div>
      </main>
    </div>
  );
}
