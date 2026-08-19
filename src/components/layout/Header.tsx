"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import dynamic from "next/dynamic";
import { Menu, X, LogOut, Loader2, Bell } from "lucide-react";
import Button from "@/components/ui/Button";
import { logoutUser } from "@/actions/auth-actions";
import { useSession, clearSessionCache } from "@/components/providers/SessionProvider";
import { useLanguage } from "@/components/i18n/LanguageProvider";
import LangSwitcher from "@/components/i18n/LangSwitcher";

// 性能优化（PERF-02）：通知铃铛（弹窗 + 列表）按需加载，
// 不进入首屏 JS（用户点击铃铛时才拉取对应 chunk）。
const NotificationBell = dynamic(() => import("@/components/layout/NotificationBell"), {
  ssr: false,
  loading: () => (
    <div className="relative p-1.5 text-gray-400" aria-hidden="true">
      <Bell className="w-4.5 h-4.5" />
    </div>
  ),
});

const navLinks = [
  { label: "首页", i18nKey: "nav.home", href: "/" },
  { label: "服务项目", i18nKey: "nav.services", href: "/services" },
  { label: "工作室介绍", i18nKey: "nav.about", href: "/about" },
];

function HeaderContent() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const pathname = usePathname();
  const { profile, loading } = useSession();
  const { t } = useLanguage();

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      clearSessionCache();
      await logoutUser();
    } catch (error) {
      console.error("退出登录失败:", error);
      setLoggingOut(false);
    }
  };

  // 根据角色跳转到对应面板
  const getDashboardHref = () => {
    return profile?.role === "admin" ? "/admin/dashboard" : "/profile";
  };

  return (
    <header className="sticky top-0 z-50 w-full bg-white border-b border-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="text-xl font-bold tracking-tight text-lw-black">
            LongWoo
          </Link>

          {/* 桌面导航 */}
          <nav className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`text-sm font-medium transition-colors ${
                  pathname === link.href
                    ? "text-lw-accent"
                    : "text-lw-black hover:text-lw-accent"
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* 桌面端右侧操作区 */}
          <div className="hidden md:flex items-center gap-3">
            {/* 语言切换（未上线：LangSwitcher 默认不渲染，上线时改 enabled） */}
            <LangSwitcher />
            <Link href="/order-step1.html">
              <Button variant="primary" size="sm">
                {t("header.submitOrder")}
              </Button>
            </Link>

            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
            ) : profile ? (
              <div className="flex items-center gap-2">
                {/* 通知铃铛（头像左侧） */}
                <NotificationBell />
                <Link
                  href={getDashboardHref()}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <div className="w-7 h-7 rounded-full bg-lw-accent text-white flex items-center justify-center text-xs font-medium">
                    {profile.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={profile.avatar_url}
                        alt={profile.display_name}
                        className="w-full h-full rounded-full object-cover"
                      />
                    ) : (
                      <span>{profile.display_name.charAt(0).toUpperCase()}</span>
                    )}
                  </div>
                  <span className="text-sm font-medium text-lw-black max-w-[80px] truncate">
                    {profile.display_name}
                  </span>
                </Link>
                <button
                  onClick={handleLogout}
                  disabled={loggingOut}
                  title={t("header.logout")}
                  className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                >
                  {loggingOut ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <LogOut className="w-4 h-4" />
                  )}
                </button>
              </div>
            ) : (
              <Link href="/login">
                <Button variant="outline" size="sm">
                  {t("header.signIn")}
                </Button>
              </Link>
            )}
          </div>

          {/* 移动端汉堡菜单按钮 */}
          <button
            className="md:hidden p-2 text-lw-black"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="切换菜单"
          >
            {mobileOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {/* 移动端菜单 */}
        {mobileOpen && (
          <div className="md:hidden border-t border-gray-100 py-4">
            <nav className="flex flex-col gap-4">
              {/* 语言切换（移动端：菜单第一项；未上线默认不渲染） */}
              <div className="px-2 py-1">
                <LangSwitcher />
              </div>
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`text-sm font-medium transition-colors px-2 py-1 ${
                    pathname === link.href
                      ? "text-lw-accent"
                      : "text-lw-black hover:text-lw-accent"
                  }`}
                  onClick={() => setMobileOpen(false)}
                >
                  {link.label}
                </Link>
              ))}
              <div className="flex flex-col gap-3 mt-2 px-2">
                <Link href="/order-step1.html" onClick={() => setMobileOpen(false)}>
                  <Button variant="primary" size="sm" className="w-full">
                    {t("header.submitOrder")}
                  </Button>
                </Link>

                {profile ? (
                  <>
                    <div className="flex items-center gap-2 px-2">
                      <NotificationBell />
                      <span className="text-sm font-medium text-lw-black">
                        {profile.display_name}
                      </span>
                    </div>
                    <Link
                      href={getDashboardHref()}
                      onClick={() => setMobileOpen(false)}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-50"
                    >
                      <div className="w-7 h-7 rounded-full bg-lw-accent text-white flex items-center justify-center text-xs font-medium">
                        {profile.avatar_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={profile.avatar_url}
                            alt={profile.display_name}
                            className="w-full h-full rounded-full object-cover"
                          />
                        ) : (
                          <span>
                            {profile.display_name.charAt(0).toUpperCase()}
                          </span>
                        )}
                      </div>
                      <span className="text-sm font-medium text-lw-accent">
                        {t("header.enter")}{t(profile.role === "admin" ? "header.enterAdmin" : "header.enterProfile")}
                      </span>
                    </Link>
                    <button
                      onClick={() => {
                        setMobileOpen(false);
                        handleLogout();
                      }}
                      disabled={loggingOut}
                      className="flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors cursor-pointer disabled:opacity-50"
                    >
                      {loggingOut ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <LogOut className="w-4 h-4" />
                      )}
                      {loggingOut ? t("header.loggingOut") : t("header.logout")}
                    </button>
                  </>
                ) : (
                  <Link href="/login" onClick={() => setMobileOpen(false)}>
                    <Button variant="outline" size="sm" className="w-full">
                      {t("header.signIn")}
                    </Button>
                  </Link>
                )}
              </div>
            </nav>
          </div>
        )}
      </div>
    </header>
  );
}

export default function Header() {
  return <HeaderContent />;
}
