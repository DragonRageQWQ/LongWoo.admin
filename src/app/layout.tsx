import type { Metadata } from "next";
import "./globals.css";
import { SessionProvider } from "@/components/providers/SessionProvider";

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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="h-full antialiased" suppressHydrationWarning>
      <body className="min-h-full">
        <SessionProvider>{children}</SessionProvider>
      </body>
    </html>
  );
}
