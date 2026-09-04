import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import PetTestPanel from "@/components/pet/PetTestPanel";
import { LanguageProvider } from "@/components/i18n/LanguageProvider";

/**
 * 灰度测试 · 桌宠 Demo
 *
 * 功能：全局悬浮桌宠演示页面，包含情绪控制、对话测试、设置等
 * 权限：仅管理员可访问
 */
export const metadata = {
  title: "桌宠灰度测试 | LongWoo",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function PetTestPage() {
  // 服务端鉴权
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    redirect("/login");
  }
  if (currentUser.role !== "admin") {
    redirect("/profile");
  }

  return (
    <LanguageProvider>
      <PetTestPanel />
    </LanguageProvider>
  );
}
