import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "查询订单 - LongWoo Studio",
  description: "通过订单号和手机号查询您的兽装定制订单进度。",
};

export default function OrderQueryLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
