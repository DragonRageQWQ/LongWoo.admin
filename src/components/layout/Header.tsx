"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, LogOut, Loader2 } from "lucide-react";
import Button from "@/components/ui/Button";
import { logoutUser } from "@/actions/auth-actions";
import { useSession, clearSessionCache } from "@/components/providers/SessionProvider";

const navLinks = [
  { label: "首页", href: "/" },
  { label: "服务项目", href: "/services" },
  { label: "工作室介绍", href: "/about" },
];

function HeaderContent() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const pathname = usePathname();
  const { profile, loading } = useSession();

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
            <Link href="/order-step1.html">
              <Button variant="primary" size="sm">
                提交委托
              </Button>
            </Link>

            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
            ) : profile ? (
              <div className="flex items-center gap-2">
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
                  title="退出登录"
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
                  登录
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
                    提交委托
                  </Button>
                </Link>

                {profile ? (
                  <>
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
                      <span className="text-sm font-medium text-lw-black">
                        {profile.display_name}
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
                      {loggingOut ? "退出中..." : "退出登录"}
                    </button>
                  </>
                ) : (
                  <Link href="/login" onClick={() => setMobileOpen(false)}>
                    <Button variant="outline" size="sm" className="w-full">
                      登录
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
