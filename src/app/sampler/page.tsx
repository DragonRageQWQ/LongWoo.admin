import type { Metadata } from "next";
import { cookies } from "next/headers";
import UnifiedSampler from "@/components/gray-test/UnifiedSampler";
import SamplerHeader from "@/components/sampler/SamplerHeader";
import { parseLang, translate, type Lang } from "@/lib/i18n/dict";

/**
 * 图片与毛布取样器（正式版 · 生产环境公开入口）
 *
 * 由灰度测试 /gray-test/sampler 提级而来：上传图片后点击像素选点（最多 10 点），
 * 参数框直接显示每个选点的 sRGB / OKLab / 潘通参考色，并自动匹配毛布库
 * （客户端 OKLab 色差，每点 Top 3 参考毛布预览），毛布图片按需加载。
 * 匹配全部在客户端完成，服务器零计算；游客与登录用户均可直接使用。
 * 灰度页 /gray-test/sampler 保留，供管理后台继续验收新改动。
 */
export async function generateMetadata(): Promise<Metadata> {
  // 服务端读取语言 cookie（与根布局注入 LanguageProvider 的方式一致，避免 hydration mismatch）
  const lang: Lang = parseLang((await cookies()).get("lw_lang")?.value);
  return {
    title: translate(lang, "sampler.metaTitle"),
    description: translate(lang, "sampler.metaDesc"),
    robots: { index: false, follow: false },
  };
}

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

      {/* 页头（客户端组件：标题/语言即时切换；与 /profile 顶部一致的品牌角标） */}
      <SamplerHeader />

      {/* 主体：移动端随内容自然延伸（整页滚动），桌面端撑满高度内部滚动 */}
      <div className="relative z-10 lg:flex-1 lg:min-h-0 max-w-7xl w-full mx-auto px-5 py-4">
        <UnifiedSampler />
      </div>
    </main>
  );
}
