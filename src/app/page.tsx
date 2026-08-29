import type { Metadata } from "next";
import GrayTest2App from "@/components/new-home/GrayTest2App";

/**
 * 官网首页（v2.0.0）
 *
 * 新首页正式上线：Agent智能体 / Fursuit委托兽装 / Web Shop / Check查询 /
 * About关于 五选项卡单页应用，右上角气泡集成登录、站内信与语言切换。
 *
 * 权限：公开访问（游客/用户/管理员均可直接浏览）；委托下单与查询面向
 * 全站用户开放，管理功能（商店编辑）由组件内 session-check 纵深防御。
 */
export const metadata: Metadata = {
  title: "LongWoo Studio - 专业兽装定制工作室",
  description:
    "LongWoo 龙坞工作室提供高品质兽装定制（全装/半装/局部）、预设兽装掉落购买与售后查询服务，从设计到交付，每一处细节都倾注热忱与专业。",
  robots: { index: true, follow: true },
  openGraph: {
    title: "LongWoo Studio - 专业兽装定制工作室",
    description:
      "LongWoo 龙坞工作室：高品质兽装定制与销售，从设计到交付，每一处细节都倾注我们的热忱与专业。",
    type: "website",
    locale: "zh_CN",
    siteName: "LongWoo Studio",
  },
};

export const dynamic = "force-dynamic";

export default function HomePage() {
  return <GrayTest2App />;
}
