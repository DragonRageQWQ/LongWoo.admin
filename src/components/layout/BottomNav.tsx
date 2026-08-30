"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLanguage } from "@/components/i18n/LanguageProvider";

/**
 * 移动端底部固定导航栏（与静态页 public/index.html 的 .bottom-nav 视觉一致）
 *
 * 五个导航项：购买兽装 / 龙灵工坊 / 购买掉落 / 进度&售后 / 个人中心
 * 激活态通过 usePathname 自动判断（与静态页 common.js 的 endsWith 逻辑等价），
 * 所有子路由也会高亮对应父项。
 *
 * 使用说明：挂载到需要底边栏的页面，并给内容区加 padding-bottom
 * （推荐 calc(64px + 1.5rem)）避免被固定栏遮挡。
 */

/** 导航图标（stroke 颜色由激活态控制，故不写死） */
const NAV_ICONS = {
  bag: (
    <>
      <path d="M6 2L3 6V20C3 20.5523 3.44772 21 4 21H20C20.5523 21 21 20.5523 21 20V6L18 2H6Z" />
      <path d="M3 6H21" />
      <path d="M16 10C16 12.2091 14.2091 14 12 14C9.79086 14 8 12.2091 8 10" />
    </>
  ),
  chat: (
    <>
      <path d="M12 2C6.48 2 2 6.48 2 12C2 13.6 2.35 15.12 3 16.48L2.5 21.5L7.52 21C8.88 21.65 10.4 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2Z" />
      <path d="M8 9H8.01" />
      <path d="M12 9H12.01" />
      <path d="M16 9H16.01" />
      <path d="M8 13C9.2 14.5 10.6 15.2 12 15.2C13.4 15.2 14.8 14.5 16 13" />
    </>
  ),
  drop: (
    <>
      <path d="M12 2L12 16" />
      <path d="M12 16L7 11" />
      <path d="M12 16L17 11" />
      <path d="M4 19H20" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7V12L15 15" />
    </>
  ),
  user: (
    <>
      <path d="M20 21V19C20 17.9391 19.5786 16.9217 18.8284 16.1716C18.0783 15.4214 17.0609 15 16 15H8C6.93913 15 5.92172 15.4214 5.17157 16.1716C4.42143 16.9217 4 17.9391 4 19V21" />
      <circle cx="12" cy="7" r="4" />
    </>
  ),
} as const;

const NAV_ITEMS = [
  // 静态 HTML 页用 <a>（跨体系整页跳转，避免 Next RSC 预取 404）；Next 路由用 <Link>
  { key: "buy", label: "购买兽装", i18nKey: "nav.buyFursuit", href: "/order-step1.html", icon: NAV_ICONS.bag, external: true },
  { key: "ai", label: "龙灵工坊", i18nKey: "nav.lingWork", href: "/ai/characters", icon: NAV_ICONS.chat, external: false },
  { key: "drop", label: "购买掉落", i18nKey: "nav.buyDrop", href: "/preorder-step1.html", icon: NAV_ICONS.drop, external: true },
  { key: "order", label: "进度&售后", i18nKey: "nav.progress", href: "/?tab=check", icon: NAV_ICONS.clock, external: false },
  { key: "profile", label: "个人中心", i18nKey: "nav.profile", href: "/profile", icon: NAV_ICONS.user, external: false },
] as const;

export default function BottomNav() {
  const pathname = usePathname();
  const { t } = useLanguage();

  const isActive = (href: string): boolean => {
    // 子路由页（如 /ai/characters/xxx）归属父项：前缀匹配；
    // 静态 HTML 页（/order-step1.html 等）用后缀匹配
    if (href.endsWith(".html")) return pathname.endsWith(href);
    return pathname.startsWith(href);
  };

  return (
    <nav
      className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] h-16 bg-white/95 backdrop-blur-xl border-t border-gray-100 z-[100] flex items-center justify-around px-2 box-border"
      aria-label="底部导航"
    >
      {NAV_ITEMS.map((item) => {
        const active = isActive(item.href);
        const classes = `flex flex-col items-center justify-center gap-0.5 no-underline cursor-pointer p-2 min-w-[60px] ${
          active ? "active" : ""
        }`;
        const content = (
          <>
            <span className="w-[22px] h-[22px]">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={`w-full h-full ${
                  active ? "stroke-[#2563EB]" : "stroke-[rgba(16,16,16,0.5)]"
                }`}
              >
                {item.icon}
              </svg>
            </span>
            <span
              className={`text-xs whitespace-nowrap leading-[1.2] ${
                active
                  ? "text-lw-accent font-semibold"
                  : "text-[rgba(16,16,16,0.5)]"
              }`}
            >
              {t(item.i18nKey)}
            </span>
          </>
        );
        // 静态 HTML 目标用普通 <a>（避免 Next.js RSC prefetch 对静态页发起 404 请求）；
        // Next 路由目标用 <Link> 享受 SPA 客户端导航
        return item.external ? (
          <a key={item.key} href={item.href} className={classes}>
            {content}
          </a>
        ) : (
          <Link key={item.key} href={item.href} className={classes}>
            {content}
          </Link>
        );
      })}
    </nav>
  );
}
