import { redirect } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import UnifiedSampler from "@/components/gray-test/UnifiedSampler";

/**
 * 灰度测试 · 图片与毛布合体取样器（纸墨极简风格）
 *
 * 上传图片后点击像素选点（最多 10 点），参数框直接显示每个选点的
 * sRGB / OKLab / 潘通参考色，并自动匹配毛布库（客户端 OKLab 色差，
 * 每点 Top 3 参考毛布预览），毛布图片按需加载。
 * 权限：服务端二次鉴权（纵深防御）——未登录跳转登录页，
 *      非管理员跳转个人中心。middleware 已做路由级保护。
 */
export const metadata = {
  title: "图片与毛布取样器 | LongWoo",
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
    <main className="w-screen h-screen overflow-hidden bg-white text-neutral-900 flex flex-col relative">
      {/* 微弱纸纹氛围层（与首页一致） */}
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 50% -20%, rgba(10,10,10,0.03), transparent), radial-gradient(ellipse 60% 40% at 80% 110%, rgba(10,10,10,0.02), transparent)",
        }}
        aria-hidden="true"
      />

      {/* 页头 */}
      <header className="relative z-10 border-b border-neutral-200 bg-white/80 backdrop-blur">
        <div className="max-w-7xl mx-auto w-full px-5 py-3.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Link
              href="/gray-test"
              className="inline-flex items-center gap-1 rounded-full bg-white border border-neutral-200 text-neutral-600 text-xs px-3.5 py-1.5 hover:bg-neutral-100 hover:text-neutral-900 transition-colors flex-shrink-0 shadow-sm"
              aria-label="返回灰度测试中间页"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              中间页
            </Link>
            <div className="min-w-0">
              <h1 className="text-base font-bold tracking-tight truncate">图片与毛布取样器</h1>
              <p className="text-[10px] text-neutral-400 mt-0.5 font-mono tracking-wider truncate">
                PIXEL &amp; FABRIC SAMPLER · sRGB / OKLAB / PANTONE / FABRIC MATCH
              </p>
            </div>
          </div>
          <span className="hidden sm:inline-flex items-center rounded-full bg-neutral-900 border border-neutral-900 px-2.5 py-1 text-[10px] font-medium text-white flex-shrink-0">
            灰度测试
          </span>
        </div>
      </header>

      {/* 主体 */}
      <div className="relative z-10 flex-1 min-h-0 max-w-7xl w-full mx-auto px-5 py-4">
        <UnifiedSampler />
      </div>
    </main>
  );
}
