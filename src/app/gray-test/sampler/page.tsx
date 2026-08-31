import { redirect } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import FabricSampler from "@/components/gray-test/FabricSampler";

/**
 * 灰度测试 · 毛布取样器
 *
 * 上传图片后点击像素取色，客户端在毛布数据库（真实 fabric-data.json 或
 * 内置示例）中按 OKLab 色差自动匹配 Top N 毛布，结果卡片按需加载图片。
 * 权限：服务端二次鉴权（纵深防御）——未登录跳转登录页，
 *      非管理员跳转个人中心。middleware 已做路由级保护。
 */
export const metadata = {
  title: "毛布取样器 | LongWoo",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function FabricSamplerPage() {
  // 服务端二次鉴权：所有 admin 角色均可访问（放权）
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    redirect("/login");
  }
  if (currentUser.role !== "admin") {
    redirect("/profile");
  }

  return (
    <main className="w-screen h-screen overflow-hidden bg-slate-950 text-slate-100 flex flex-col relative">
      {/* 深色渐变氛围（与灰度测试其他页一致） */}
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 50% -20%, rgba(59,130,246,0.15), transparent), radial-gradient(ellipse 60% 40% at 80% 110%, rgba(139,92,246,0.12), transparent)",
        }}
        aria-hidden="true"
      />

      {/* 页头 */}
      <header className="relative z-10 border-b border-white/5">
        <div className="max-w-7xl mx-auto w-full px-5 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              href="/gray-test"
              className="inline-flex items-center gap-1 rounded-full bg-black/40 border border-white/15 text-slate-300 text-xs px-3 py-1.5 hover:bg-white/10 hover:text-white transition-colors flex-shrink-0"
              aria-label="返回灰度测试中间页"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              中间页
            </Link>
            <div className="min-w-0">
              <h1 className="text-base font-bold tracking-tight truncate">毛布取样器</h1>
              <p className="text-[10px] text-slate-500 mt-0.5 font-mono tracking-wider truncate">
                FABRIC COLOR SAMPLER · CLIENT-SIDE OKLAB MATCH
              </p>
            </div>
          </div>
          <span className="hidden sm:inline-flex items-center rounded-full bg-amber-400/10 border border-amber-400/20 px-2.5 py-1 text-[10px] font-medium text-amber-300 flex-shrink-0">
            灰度测试
          </span>
        </div>
      </header>

      {/* 主体 */}
      <div className="relative z-10 flex-1 min-h-0 max-w-7xl w-full mx-auto px-5 py-4">
        <FabricSampler />
      </div>
    </main>
  );
}
