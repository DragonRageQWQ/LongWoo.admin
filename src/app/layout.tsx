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
  title: "LongWoo 龙坞 - 角色创意与定制工作室",
  description:
    "从兽装定制到 AI 智能体，LongWoo 龙坞以原创设计为核心，打造属于你的角色世界：定制兽装、预设掉落、智能体角色，未来不止于此。",
  icons: {
    icon: "/longwoo-logo.svg",
  },
  // 站点验证标记（验证成功后请勿删除）
  // - baidu-site-verification：百度搜索资源平台
  // - msvalidate.01：Bing Webmaster Tools
  other: {
    "baidu-site-verification": "codeva-Kmb0PZ996R",
    "msvalidate.01": "2A1B1E3C56923C2726C51FFD21114E69",
  },
  openGraph: {
    title: "LongWoo 龙坞 - 角色创意与定制工作室",
    description:
      "从兽装定制到 AI 智能体，LongWoo 龙坞以原创设计为核心，打造属于你的角色世界：定制兽装、预设掉落、智能体角色，未来不止于此。",
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
