"use client";

import { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ClipboardList,
  Users,
  Settings,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { logoutUser } from "@/actions/auth-actions";

export type AdminTab = "overview" | "orders" | "users" | "settings";

interface NavItem {
  key: AdminTab;
  label: string;
  icon: React.ElementType;
  disabled?: boolean;
}

const navItems: NavItem[] = [
  { key: "overview", label: "数据概览", icon: LayoutDashboard },
  { key: "orders", label: "委托管理", icon: ClipboardList },
  { key: "users", label: "用户管理", icon: Users, disabled: true },
  { key: "settings", label: "系统设置", icon: Settings, disabled: true },
];

interface AdminSidebarProps {
  activeTab: AdminTab;
}

export default function AdminSidebar({ activeTab }: AdminSidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const handleNavigate = (tab: AdminTab) => {
    setMobileOpen(false);
    if (tab === "overview") {
      router.push(`${pathname}`);
    } else {
      router.push(`${pathname}?tab=${tab}`);
    }
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
      {/* 顶部标题 */}
      <div className="px-6 py-6 border-b border-gray-100">
        <h1 className="text-base font-bold text-lw-black tracking-tight">
          LongWoo 管理后台
        </h1>
        <p className="text-xs text-gray-400 mt-1">管理员控制台</p>
      </div>

      {/* 导航项 */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = activeTab === item.key;
          const Icon = item.icon;
          return (
            <button
              key={item.key}
              onClick={() => !item.disabled && handleNavigate(item.key)}
              disabled={item.disabled}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                isActive
                  ? "bg-lw-accent text-white"
                  : "text-gray-600 hover:bg-gray-100"
              } ${item.disabled ? "opacity-40 cursor-not-allowed hover:bg-transparent" : ""}`}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              <span className="flex-1 text-left">{item.label}</span>
              {item.disabled && (
                <span className="text-[10px] text-gray-400">占位</span>
              )}
            </button>
          );
        })}
      </nav>

      {/* 底部退出登录 */}
      <div className="px-3 py-4 border-t border-gray-100">
        <button
          onClick={handleLogout}
          disabled={loggingOut}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <LogOut className="w-4 h-4 flex-shrink-0" />
          <span>{loggingOut ? "正在退出..." : "退出登录"}</span>
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* 移动端汉堡按钮 */}
      <button
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-white rounded-lg shadow-md border border-gray-100"
        onClick={() => setMobileOpen(!mobileOpen)}
        aria-label="切换侧边栏"
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
