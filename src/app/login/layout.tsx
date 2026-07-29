import type { Metadata } from "next";

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
