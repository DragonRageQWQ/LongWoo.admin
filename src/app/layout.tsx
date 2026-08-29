import type { Metadata } from "next";
import { cookies } from "next/headers";
import "./globals.css";
import { SessionProvider } from "@/components/providers/SessionProvider";
import { LanguageProvider } from "@/components/i18n/LanguageProvider";
import type { Lang } from "@/lib/i18n/dict";
import ImageProtection from "@/components/ImageProtection";

/**
 * 函数区域优化（2026-08-27）：Vercel Functions 默认区域 iad1（美国弗吉尼亚）
 * 对中国大陆用户延迟过高。切换至 hkg1（香港）：用户侧延迟从 ~200ms 降至 ~50ms，
 * 且香港到悉尼数据库（ap-southeast-2）比弗吉尼亚更近，函数→DB 延迟同步改善。
 * 覆盖所有 App Router 页面路由；API 路由由 vercel.json functions 配置兜底。
 */
export const preferredRegion = ["hkg1"];

export const metadata: Metadata = {
  // SEO：绝对 URL 基准，供 canonical / OpenGraph / Twitter 卡片解析相对路径
  metadataBase: new URL("https://www.longwoo.studio"),
  title: "LongWoo Studio - 专业兽装定制工作室",
  description: "LongWoo工作室提供专业兽装定制服务，致力于为客户打造高品质的定制兽装作品。",
  icons: {
    icon: "/longwoo-logo.svg",
  },
  openGraph: {
    title: "LongWoo Studio - 专业兽装定制工作室",
    description: "专业兽装定制与销售，从设计到交付，每一处细节都倾注我们的热忱与专业。",
    type: "website",
    locale: "zh_CN",
    siteName: "LongWoo Studio",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // 服务端读取语言 cookie，注入 Provider 保证 SSR 与客户端首次渲染一致（避免 hydration mismatch）
  const cookieStore = await cookies();
  const lang: Lang = cookieStore.get("lw_lang")?.value === "en" ? "en" : "zh";

  return (
    <html lang={lang === "en" ? "en" : "zh-CN"} className="h-full antialiased" suppressHydrationWarning>
      <body className="min-h-full">
        <link rel="preconnect" href="https://cdn-font.hyperos.mi.com" />
        <link rel="preconnect" href="https://cdn-file.hyperos.mi.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://cdn-font.hyperos.mi.com/font/css?family=MiSans_VF:VF:Chinese_Simplify,Latin&display=swap"
          precedence="default"
        />
        <ImageProtection />
        <LanguageProvider initialLang={lang}>
          <SessionProvider>{children}</SessionProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
