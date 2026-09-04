"use client";

import { useEffect, useRef, useState } from "react";
import { Bell } from "lucide-react";

/**
 * 站内信小铃铛（带摇铃填充动画，灵感来自 uiverse.io/catraco/brown-dodo-68）：
 * - solid=true 渲染实心（currentColor 填充），否则空心描边
 * - 状态翻转（无未读→有未读，如新消息到达）或父级点击铃铛（tick 自增）时，
 *   重放 keyframes-fill 摇铃动画
 * - 首屏挂载不播放动画（避免页面加载时无故抖动）
 * 尺寸由 className / 外层 CSS（如 .gt2-dock-circle svg）控制。
 */
export default function BellIcon({
  solid = false,
  tick = 0,
  className = "",
}: {
  solid?: boolean;
  tick?: number;
  className?: string;
}) {
  const [ready, setReady] = useState(false);
  const [anim, setAnim] = useState(false);
  const prevSolid = useRef<boolean | null>(null);
  const prevTick = useRef(0);

  // 首帧后再允许动画，杜绝首屏抖动
  useEffect(() => {
    setReady(true);
  }, []);

  // solid 翻转或 tick 变化 → 重放动画（跳过首次挂载的基线同步）
  useEffect(() => {
    if (!ready) return;
    if (prevSolid.current === null) {
      prevSolid.current = solid;
      prevTick.current = tick;
      return;
    }
    const flipped = prevSolid.current !== solid;
    const ticked = tick !== prevTick.current;
    prevSolid.current = solid;
    prevTick.current = tick;
    if (flipped || ticked) {
      // 先摘除动画 class，下一帧再加回，确保连续触发也能完整重放
      setAnim(false);
      requestAnimationFrame(() => requestAnimationFrame(() => setAnim(true)));
    }
  }, [ready, solid, tick]);

  return (
    <Bell
      className={`lw-bell ${anim ? "lw-bell-anim" : ""} ${className}`.trim()}
      aria-hidden="true"
      fill={solid ? "currentColor" : "none"}
      strokeWidth={solid ? 1.4 : 2}
      strokeLinecap="round"
      strokeLinejoin="round"
      onAnimationEnd={() => setAnim(false)}
    />
  );
}
