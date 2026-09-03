import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import UnifiedSampler from "@/components/gray-test/UnifiedSampler";

/**
 * 图片与毛布取样器（正式版 · 生产环境公开入口）
 *
 * 由灰度测试 /gray-test/sampler 提级而来：上传图片后点击像素选点（最多 10 点），
 * 参数框直接显示每个选点的 sRGB / OKLab / 潘通参考色，并自动匹配毛布库
 * （客户端 OKLab 色差，每点 Top 3 参考毛布预览），毛布图片按需加载。
 * 匹配全部在客户端完成，服务器零计算；游客与登录用户均可直接使用。
 * 灰度页 /gray-test/sampler 保留，供管理后台继续验收新改动。
 */
export const metadata: Metadata = {
  title: "毛布取色器 | LongWoo Studio",
  description: "上传设定图进行像素取色，自动匹配潘通参考色与毛布色库，快速预览毛布搭配效果。",
  robots: { index: false, follow: false },
};

export default function SamplerPage() {
  return (
    <main className="w-screen h-screen overflow-y-auto lg:overflow-hidden bg-white text-neutral-900 flex flex-col relative">
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
              href="/"
              className="inline-flex items-center gap-1 rounded-full bg-white border border-neutral-200 text-neutral-600 text-xs px-3.5 py-1.5 hover:bg-neutral-100 hover:text-neutral-900 transition-colors flex-shrink-0 shadow-sm"
              aria-label="返回首页"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              首页
            </Link>
            <div className="min-w-0">
              <h1 className="text-base font-bold tracking-tight truncate">图片与毛布取样器</h1>
              <p className="text-[10px] text-neutral-400 mt-0.5 font-mono tracking-wider truncate">
                PIXEL &amp; FABRIC SAMPLER · sRGB / OKLAB / PANTONE / FABRIC MATCH
              </p>
            </div>
          </div>
          <span className="hidden sm:inline-flex items-center rounded-full bg-neutral-900 border border-neutral-900 px-2.5 py-1 text-[10px] font-medium text-white flex-shrink-0">
            正式版
          </span>
        </div>
      </header>

      {/* 主体：移动端随内容自然延伸（整页滚动），桌面端撑满高度内部滚动 */}
      <div className="relative z-10 lg:flex-1 lg:min-h-0 max-w-7xl w-full mx-auto px-5 py-4">
        <UnifiedSampler />
      </div>
    </main>
  );
}
