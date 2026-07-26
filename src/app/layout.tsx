import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LongWoo Studio - 专业兽装定制工作室",
  description: "LongWoo工作室提供专业兽装定制服务，致力于为客户打造高品质的定制兽装作品。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" className="h-full antialiased">
      <body className="min-h-full">
        {children}
      </body>
    </html>
  );
}
