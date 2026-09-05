import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "查询订单 - LongWoo Studio",
  description: "通过订单号和邮箱查询您的兽装定制订单进度。",
  alternates: { canonical: "/order/query" },
  // 已废弃页面：不再从搜索引擎收录，入口统一指向新版首页 Check 选项卡
  robots: { index: false, follow: false },
};

export default function OrderQueryLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
