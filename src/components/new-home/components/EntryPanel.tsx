"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Gt2EntryCopy } from "../copy";
import { JOIN_CHANNELS, type JoinChannel } from "../join-data";

/**
 * 入口面板：通用展示组件（商店/查询/关于等栏目共用）。
 * 作品图鉴位于独立页面 /gallery，由 CTA 按钮跳转进入。
 * About 面板配置 headAction 时，标题右侧出现「加入我们」按钮，
 * 点击从按钮处向上「挤出」社群渠道浮层（同屏体验，不遮挡整页；
 * 上方空间不足时自动改为向下展开）。渠道与链接见 join-data.ts；
 * 配置 qr 的渠道（如 QQ）点击后在浮层内展开二维码加群视图。
 */
export default function EntryPanel({ entry, mark }: { entry: Gt2EntryCopy; mark: string }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number; up: boolean } | null>(null);
  const [qrId, setQrId] = useState<JoinChannel["id"] | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);

  const qrChannel = JOIN_CHANNELS.find((c) => c.id === qrId && c.qr) ?? null;

  const close = () => {
    setOpen(false);
    setPos(null);
    setQrId(null);
  };

  const recomputePos = () => {
    const btn = btnRef.current;
    const pop = popRef.current;
    if (!btn || !pop) return;
    const b = btn.getBoundingClientRect();
    const pw = pop.offsetWidth;
    const ph = pop.offsetHeight;
    const gap = 14;
    const margin = 8;
    const up = b.top - gap - ph >= margin;
    const top = up ? b.top - gap - ph : Math.min(b.bottom + gap, window.innerHeight - margin - ph);
    const left = Math.min(Math.max(b.right - pw, margin), window.innerWidth - pw - margin);
    setPos({ top: Math.max(margin, top), left: Math.max(margin, left), up });
  };

  // 打开 / 二维码视图切换后：测量尺寸，从按钮上方（不足则下方）挤出定位
  useLayoutEffect(() => {
    if (open) recomputePos();
  }, [open, qrId]);

  // 打开期间：Esc 关闭 + 点击浮层/按钮以外区域关闭（不锁定滚动、不遮屏）
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (popRef.current?.contains(t) || btnRef.current?.contains(t)) return;
      close();
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onDown);
    };
  }, [open]);

  const handleChannel = (e: React.MouseEvent, c: JoinChannel) => {
    if (c.qr) {
      e.preventDefault();
      setQrId((cur) => (cur === c.id ? null : c.id)); // 再点收起二维码
      return;
    }
    if (c.href === "#") e.preventDefault(); // 占位链接：待替换真实渠道地址
  };

  return (
    <div className="gt2-panel-inner gt2-panel-inner--center">
      <span className="gt2-watermark" aria-hidden="true">{mark}</span>
      <div className="gt2-entry">
        <div className="gt2-stagger" style={{ "--i": 0 } as React.CSSProperties}>
          <p className="gt2-kicker">{entry.kicker}</p>
        </div>
        <div className="gt2-stagger gt2-entry-headrow" style={{ "--i": 1 } as React.CSSProperties}>
          <div>
            <h2 className="gt2-display">{entry.title}</h2>
            <p className="gt2-display-sub">{entry.titleEn}</p>
          </div>
          {entry.headAction && (
            <button
              ref={btnRef}
              type="button"
              className="gj-btn gj-type--c"
              onClick={() => (open ? close() : setOpen(true))}
              aria-haspopup="dialog"
              aria-expanded={open}
            >
              <span className="gj-line" aria-hidden="true" />
              <span className="gj-line" aria-hidden="true" />
              <span className="gj-text">{entry.headAction.label}</span>
              <span className="gj-drow1" aria-hidden="true" />
              <span className="gj-drow2" aria-hidden="true" />
            </button>
          )}
        </div>
        <p className="gt2-lead gt2-stagger" style={{ "--i": 2 } as React.CSSProperties}>
          {entry.desc}
        </p>
        <ul className="gt2-entry-list gt2-stagger" style={{ "--i": 3 } as React.CSSProperties}>
          {entry.features.map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>
        <div className="gt2-entry-cta gt2-stagger" style={{ "--i": 4 } as React.CSSProperties}>
          <a className="gt2-btn-solid" href={entry.href}>
            {entry.cta}
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 12h14" />
              <path d="M12 5l7 7-7 7" />
            </svg>
          </a>
          {entry.secondaryCta && entry.secondaryHref && (
            <a className="gt2-btn-ghost" href={entry.secondaryHref}>
              {entry.secondaryCta}
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M5 12h14" />
                <path d="M12 5l7 7-7 7" />
              </svg>
            </a>
          )}
        </div>
      </div>

      {entry.headAction && open && (
        <div
          ref={popRef}
          className={"gj-pop" + (pos ? (pos.up ? " gj-pop--up" : " gj-pop--down") : "")}
          style={
            pos
              ? { top: pos.top, left: pos.left, visibility: "visible" }
              : { top: -9999, left: 0, visibility: "hidden" }
          }
          role="dialog"
          aria-modal="false"
          aria-label={entry.headAction.label}
        >
          <div className="gj-channels">
            {JOIN_CHANNELS.map((c) => (
              <a
                key={c.id}
                className={"gj2-btn" + (qrId === c.id ? " gj2-btn--active" : "")}
                href={c.href}
                aria-label={c.label}
                title={c.label}
                target={c.qr ? undefined : "_blank"}
                rel={c.qr ? undefined : "noreferrer"}
                onClick={(e) => handleChannel(e, c)}
              >
                <span className="gj2-bg" style={{ background: c.bg }} aria-hidden="true" />
                <span className="gj2-svgc">
                  <svg viewBox="0 0 24 24" width="25" height="25" fill={c.iconFill} aria-hidden="true">
                    <path d={c.path} />
                  </svg>
                </span>
              </a>
            ))}
          </div>
          {qrChannel && (
            <div className="gj2-qr">
              <img
                src={qrChannel.qr!.img}
                alt={`${qrChannel.label} ${qrChannel.qr!.note}`}
                width="150"
                height="150"
              />
              <p className="gj2-qr-note">{qrChannel.label} · {qrChannel.qr!.note}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
