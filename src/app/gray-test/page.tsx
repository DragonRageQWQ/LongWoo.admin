import { redirect } from "next/navigation";
import Link from "next/link";
import { FlaskConical, ArrowRight, LayoutDashboard } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { grayTestEntries } from "@/lib/gray-test-config";

/**
 * 灰度测试 · 中间页（所有管理员可访问）
 *
 * 功能：列出全部灰度测试入口（test1 / test2 / ...），
 *       管理员在此页自行选择要跳转的测试页面。
 * 入口列表：由 src/lib/gray-test-config.ts 配置驱动，新增测试页仅需追加条目。
 *
 * 权限：服务端二次鉴权（纵深防御）——未登录跳转登录页，
 *      非管理员跳转个人中心。middleware 已做路由级保护。
 */
export const metadata = {
  title: "灰度测试 | LongWoo",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function GrayTestHubPage() {
  // 服务端二次鉴权：所有 admin 角色均可访问（放权）
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    redirect("/login");
  }
  if (currentUser.role !== "admin") {
    redirect("/profile");
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* 顶部装饰：与画布页一致的深色渐变氛围 */}
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 50% -20%, rgba(59,130,246,0.15), transparent), radial-gradient(ellipse 60% 40% at 80% 110%, rgba(139,92,246,0.12), transparent)",
        }}
        aria-hidden="true"
      />

      {/* 头部 */}
      <header className="relative z-10 border-b border-white/5">
        <div className="max-w-5xl mx-auto w-full px-6 py-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/15 border border-blue-400/20 flex items-center justify-center">
              <FlaskConical className="w-5 h-5 text-blue-300" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight">灰度测试 · 中间页</h1>
              <p className="text-xs text-slate-400 mt-0.5">
                选择要进入的测试页面，每个选项对应一个独立的测试入口
              </p>
            </div>
          </div>
          <Link
            href="/admin/dashboard"
            className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-100 transition-colors px-3 py-2 rounded-lg hover:bg-white/5"
          >
            <LayoutDashboard className="w-4 h-4" />
            <span className="hidden sm:inline">返回管理后台</span>
          </Link>
        </div>
      </header>

      {/* 测试入口卡片网格 */}
      <div className="relative z-10 flex-1 max-w-5xl mx-auto w-full px-6 py-8">
        {grayTestEntries.length === 0 ? (
          <div className="text-center py-24">
            <p className="text-slate-500 text-sm">暂无测试入口，请在 src/lib/gray-test-config.ts 中添加</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {grayTestEntries.map((entry) => (
              entry.href ? (
                <Link
                  key={entry.id}
                  href={entry.href}
                  className="group relative flex flex-col gap-3 rounded-2xl bg-white/[0.04] border border-white/10 p-5 backdrop-blur-sm transition-all duration-200 hover:bg-white/[0.08] hover:border-blue-400/30 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-blue-500/5"
                >
                  {/* 选项编号徽标 */}
                  <span className="inline-flex w-fit items-center rounded-full bg-blue-500/15 border border-blue-400/25 px-2.5 py-0.5 text-xs font-semibold text-blue-300">
                    {entry.label}
                  </span>

                  <div className="flex-1">
                    <h2 className="text-base font-semibold text-slate-100">{entry.title}</h2>
                    <p className="text-sm text-slate-400 mt-1.5 leading-relaxed">{entry.description}</p>
                  </div>

                  <span className="inline-flex items-center gap-1 text-sm font-medium text-blue-300">
                    进入测试
                    <ArrowRight className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-0.5" />
                  </span>
                </Link>
              ) : (
                <div
                  key={entry.id}
                  className="relative flex flex-col gap-3 rounded-2xl bg-white/[0.02] border border-white/5 p-5 opacity-80"
                  aria-disabled="true"
                >
                  {/* 选项编号徽标 */}
                  <span className="inline-flex w-fit items-center rounded-full bg-white/10 border border-white/10 px-2.5 py-0.5 text-xs font-semibold text-slate-300">
                    {entry.label}
                  </span>

                  <div className="flex-1">
                    <h2 className="text-base font-semibold text-slate-200">{entry.title}</h2>
                    <p className="text-sm text-slate-500 mt-1.5 leading-relaxed">{entry.description}</p>
                  </div>

                  <span className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500">
                    敬请期待
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400/80" />
                  </span>
                </div>
              )
            ))}
          </div>
        )}

        {/* 底部说明 */}
        <p className="text-xs text-slate-600 mt-8 leading-relaxed">
          新增测试入口：编辑 src/lib/gray-test-config.ts 中的 grayTestEntries 数组即可，无需改动页面代码。
        </p>
      </div>
    </main>
  );
}
