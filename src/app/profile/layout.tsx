import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "个人中心 - LongWoo Studio",
  description: "管理您的个人信息、头像、密码等设置。",
  robots: { index: false, follow: false },
};

export default function ProfileLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
