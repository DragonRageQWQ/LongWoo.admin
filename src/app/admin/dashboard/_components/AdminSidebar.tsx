"use client";

import { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Settings,
  LogOut,
  Menu,
  X,
  Inbox,
  Home,
  Briefcase,
  Bell,
  Image as ImageIcon,
  FlaskConical,
  MessageSquare,
  ShoppingBag,
} from "lucide-react";
import { logoutUser } from "@/actions/auth-actions";
import { useLanguage } from "@/components/i18n/LanguageProvider";

export type AdminTab = "all-orders" | "overview" | "users" | "notifications" | "feedback" | "settings" | "works" | "drops";

// 站点版本号（仅管理员后台可见，便于确认部署版本）
const APP_VERSION = "v2.0.0(830)";
const BUILD_NUMBER = "830";

interface NavItem {
  key: AdminTab | "gray-test";
  label: string;
  i18nKey: string;
  icon: React.ElementType;
  disabled?: boolean;
  superAdminOnly?: boolean;
  href?: string;
}

const navItems: NavItem[] = [
  { key: "all-orders", label: "全部订单", i18nKey: "admin.sidebar.nav.allOrders", icon: Inbox },
  { key: "overview", label: "数据概览", i18nKey: "admin.sidebar.nav.overview", icon: LayoutDashboard },
  { key: "users", label: "用户管理", i18nKey: "admin.sidebar.nav.users", icon: Users },
  { key: "notifications", label: "通知管理", i18nKey: "admin.sidebar.nav.notifications", icon: Bell },
  { key: "feedback", label: "反馈管理", i18nKey: "admin.sidebar.nav.feedback", icon: MessageSquare },
  { key: "works", label: "作品管理", i18nKey: "admin.sidebar.nav.works", icon: ImageIcon, superAdminOnly: true },
  { key: "drops", label: "掉落管理", i18nKey: "admin.sidebar.nav.drops", icon: ShoppingBag },
  { key: "gray-test", label: "灰度测试", i18nKey: "admin.sidebar.nav.grayTest", icon: FlaskConical, href: "/gray-test" },
  { key: "settings", label: "系统设置", i18nKey: "admin.sidebar.nav.settings", icon: Settings },
];

interface AdminSidebarProps {
  activeTab: AdminTab;
  isSuperAdmin?: boolean;
}

export default function AdminSidebar({ activeTab, isSuperAdmin = false }: AdminSidebarProps) {
  const { t } = useLanguage();
  const router = useRouter();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const handleNavigate = (item: NavItem) => {
    setMobileOpen(false);
    if (item.disabled) return;
    if (item.href) {
      router.push(item.href);
    } else if (item.key === "overview") {
      router.push(`${pathname}`);
    } else {
      router.push(`${pathname}?tab=${item.key}`);
    }
  };

  const handleGoHome = () => {
    setMobileOpen(false);
    router.push("/");
  };

  const handleGoStudio = () => {
    setMobileOpen(false);
    router.push("/studio/dashboard");
  };

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await logoutUser();
    } catch (error) {
      console.error("退出登录失败:", error);
      setLoggingOut(false);
    }
  };

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* 顶部标题（墨色品牌区，对齐新首页侧边栏） */}
      <div className="px-6 py-6 border-b border-gray-100 flex items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/longwoo-logo.svg" alt="LongWoo 龙坞" className="w-9 h-9 object-contain" />
        <div>
          <h1 className="text-base font-bold text-lw-black tracking-tight">
            {t("admin.sidebar.brand")}
          </h1>
          <p className="text-xs text-gray-400 mt-0.5">{t("admin.sidebar.subtitle")}</p>
        </div>
      </div>

      {/* 导航项 */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems
          .filter((item) => !item.superAdminOnly || isSuperAdmin)
          .map((item) => {
          const isActive = activeTab === item.key;
          const Icon = item.icon;
          return (
            <button
              key={item.key}
              onClick={() => handleNavigate(item)}
              disabled={item.disabled}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                isActive
                  ? "bg-lw-accent text-white"
                  : "text-gray-600 hover:bg-gray-100"
              } ${item.disabled ? "opacity-40 cursor-not-allowed hover:bg-transparent" : ""}`}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              <span className="flex-1 text-left">{t(item.i18nKey)}</span>
              {item.disabled && (
                <span className="text-[10px] text-gray-400">{t("admin.sidebar.placeholder")}</span>
              )}
            </button>
          );
        })}
      </nav>

      {/* 底部导航与退出 */}
      <div className="px-3 py-4 border-t border-gray-100 space-y-1">
        <button
          onClick={handleGoHome}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors cursor-pointer"
        >
          <Home className="w-4 h-4 flex-shrink-0" />
          <span>回到首页</span>
        </button>
        <button
          onClick={handleGoStudio}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors cursor-pointer"
        >
          <Briefcase className="w-4 h-4 flex-shrink-0" />
          <span>{t("admin.sidebar.studio")}</span>
        </button>
        <div className="pt-1 border-t border-gray-100">
          <button
            onClick={handleLogout}
            disabled={loggingOut}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <LogOut className="w-4 h-4 flex-shrink-0" />
            <span>{loggingOut ? t("admin.sidebar.loggingOut") : t("admin.sidebar.logout")}</span>
          </button>
        </div>
        {/* 部署版本号（仅管理员可见） */}
        <p className="text-[10px] text-gray-300 text-center pt-3 select-none">
          Web Test Version: {APP_VERSION} - build:{BUILD_NUMBER}
        </p>
      </div>
    </div>
  );

  return (
    <>
      {/* 移动端汉堡按钮 */}
      <button
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-white rounded-lg shadow-md border border-gray-100"
        onClick={() => setMobileOpen(!mobileOpen)}
        aria-label={t("admin.sidebar.toggle")}
      >
        {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>

      {/* 移动端遮罩 */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/40 z-40"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* 桌面端侧边栏 */}
      <aside className="hidden lg:block w-60 bg-white border-r border-gray-100 flex-shrink-0 h-screen sticky top-0">
        {sidebarContent}
      </aside>

      {/* 移动端侧边栏 */}
      <aside
        className={`lg:hidden fixed top-0 left-0 h-full w-60 bg-white border-r border-gray-100 z-50 transition-transform duration-300 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {sidebarContent}
      </aside>
    </>
  );
}
