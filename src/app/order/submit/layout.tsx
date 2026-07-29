import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "提交委托 - LongWoo Studio",
  description: "提交您的兽装定制委托，开始专属定制流程。",
  robots: { index: false, follow: true },
};

export default function OrderSubmitLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
