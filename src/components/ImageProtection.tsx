"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * 图片版权保护（Next.js 页面全局生效）
 *
 * 禁止用户保存网页内图片：
 * - 图片右键菜单（防止"图片另存为"）
 * - 图片拖拽（防止拖到桌面/文件夹保存）
 * - Ctrl+S / Ctrl+Shift+S（保存页面会连带保存图片资源）
 *
 * 排除管理后台（/admin）与登录页（/login）：管理员操作不受影响
 */
export default function ImageProtection() {
  const pathname = usePathname();

  useEffect(() => {
    // 管理后台与登录页不拦截
    if (pathname.startsWith("/admin") || pathname.startsWith("/login")) {
      return;
    }

    const isImageTarget = (target: EventTarget | null): boolean => {
      if (!target || !(target instanceof HTMLElement)) return false;
      if (target.tagName === "IMG") return true;
      return !!target.querySelector("img");
    };

    const onContextMenu = (e: MouseEvent) => {
      if (isImageTarget(e.target)) {
        e.preventDefault();
      }
    };

    const onDragStart = (e: DragEvent) => {
      if (isImageTarget(e.target)) {
        e.preventDefault();
      }
    };

    const onDrop = (e: DragEvent) => {
      if (e.target instanceof HTMLElement && e.target.closest("img")) {
        e.preventDefault();
      }
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === "s" || e.key === "S")) {
        e.preventDefault();
        e.stopPropagation();
      }
    };

    document.addEventListener("contextmenu", onContextMenu, true);
    document.addEventListener("dragstart", onDragStart, true);
    document.addEventListener("drop", onDrop, true);
    document.addEventListener("keydown", onKeyDown, true);

    return () => {
      document.removeEventListener("contextmenu", onContextMenu, true);
      document.removeEventListener("dragstart", onDragStart, true);
      document.removeEventListener("drop", onDrop, true);
      document.removeEventListener("keydown", onKeyDown, true);
    };
  }, [pathname]);

  return null;
}
