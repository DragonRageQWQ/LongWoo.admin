import type { Metadata } from "next";
import { cookies } from "next/headers";
import "./globals.css";
import { SessionProvider } from "@/components/providers/SessionProvider";
import { LanguageProvider } from "@/components/i18n/LanguageProvider";
import type { Lang } from "@/lib/i18n/dict";
import ImageProtection from "@/components/ImageProtection";

export const metadata: Metadata = {
  title: "LongWoo Studio - 专业兽装定制工作室",
  description: "LongWoo工作室提供专业兽装定制服务，致力于为客户打造高品质的定制兽装作品。",
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
        <ImageProtection />
        <LanguageProvider initialLang={lang}>
          <SessionProvider>{children}</SessionProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
