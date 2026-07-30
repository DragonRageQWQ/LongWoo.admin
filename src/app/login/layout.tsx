import type { Metadata } from "next";

// Vercel Hobby 计划默认超时 10 秒，认证流程含 5+ API 调用需要更长时间
export const maxDuration = 60;

export const metadata: Metadata = {
  title: "登录 - LongWoo Studio",
  description: "登录 LongWoo Studio，开始您的专属兽装定制之旅。",
  robots: { index: false, follow: true },
};

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}

