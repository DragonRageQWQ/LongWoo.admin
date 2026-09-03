"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Globe } from "lucide-react";
import { LANG_META, type Lang } from "@/lib/i18n/dict";
import "./globe-lang-menu.css";

/**
 * 全站统一语言切换：地球 icon 按钮
 * - 鼠标移上去：气泡提示「语言切换」
 * - 点击：展开语言下拉列表（列表由 LANG_META 驱动，新增语言自动出现）
 * 视觉与首页右上角 dock 圆形气泡一致（纸墨极简），自包含样式，可在
 * 新首页 dock / 取色器 dock / 旧版 Header / 登录页等任意宿主使用。
 */
export default function GlobeLangMenu({
  value,
  onSelect,
  tip,
}: {
  /** 当前语言（zh / en，未来扩展） */
  value: Lang
  /** 选择语言后的回调（各宿主自行决定切换策略：整站跳转 / 局部刷新） */
  onSelect: (lang: Lang) => void
  /** hover 气泡提示文案（可按宿主语言提供） */
  tip?: string
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const pick = useCallback(
    (code: Lang) => {
      setOpen(false);
      onSelect(code);
    },
    [onSelect]
  );

  return (
    <div className="lm-root" ref={rootRef}>
      <button
        type="button"
        className="lm-btn"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={tip ?? "语言切换"}
        data-open={open}
      >
        <Globe strokeWidth={1.8} />
        <span className="lm-tip" role="tooltip">
          {tip ?? "语言切换"}
        </span>
      </button>

      {open && (
        <div className="lm-panel" role="listbox" aria-label="选择语言">
          {LANG_META.map((meta) => {
            const active = meta.code === value;
            return (
              <button
                key={meta.code}
                type="button"
                role="option"
                aria-selected={active}
                data-active={active}
                className="lm-item"
                onClick={() => pick(meta.code)}
              >
                <span className="lm-item-label">{meta.label}</span>
                {active && <Check className="lm-item-check" strokeWidth={2.2} />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
