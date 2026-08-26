import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import GrayTest2App from "./GrayTest2App";

/**
 * 灰度测试 · test2（新首页交互原型）
 *
 * 侧边栏五选项卡单页应用：Agent智能体 / Fursuit委托兽装 / Web Shop /
 * Check查询 / About关于，左下角登录气泡集成站内信与语言切换。
 *
 * 权限：服务端二次鉴权（纵深防御）——未登录跳转登录页，
 * 非管理员跳转个人中心。middleware 已做路由级保护。
 * 本页面仅为灰度演示，不替换任何生产环境入口。
 */
export const metadata = {
  title: "灰度测试 · 新首页原型 | LongWoo",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function GrayTest2Page() {
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    redirect("/login");
  }
  if (currentUser.role !== "admin") {
    redirect("/profile");
  }

  return <GrayTest2App />;
}
