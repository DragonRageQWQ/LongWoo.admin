import { redirect } from "next/navigation";
import { getCurrentUser, ZERO_USER_UID } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import GrayTestCanvas from "./GrayTestCanvas";
/**
 * 灰度测试页（仅超级管理员 uid=10001 可访问）
 *
 * 用途：灰度测试入口页面。
 * 权限：服务端二次鉴权（纵深防御）——未登录跳转登录页，
 *      非超级管理员跳转个人中心。middleware 已做路由级保护。
 *
 * 背景库：动态读取 works 表所有启用作品的 image_url。
 *        管理后台新增/删除/替换作品时，本页背景库自动同步，无需额外维护。
 */
export const metadata = {
  title: "灰度测试 | LongWoo",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function GrayTestPage() {
  // 服务端二次鉴权：必须是 uid=10001 的超级管理员
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    redirect("/login");
  }
  if (currentUser.uid !== ZERO_USER_UID) {
    redirect("/profile");
  }

  // 背景库 = works 表启用作品的图片（管理后台增删作品自动同步）
  let images: string[] = [];
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("works")
      .select("image_url")
      .eq("is_active", true)
      .order("sort_order", { ascending: true });

    if (!error && data) {
      images = data
        .map((w) => {
          const raw = w.image_url;
          if (typeof raw !== "string" || raw.length === 0) return null;
          // 相对路径（public/assets/...）规范化为根路径，避免基于页面路径解析错误
          if (raw.startsWith("assets/")) return `/${raw}`;
          return raw;
        })
        .filter((url): url is string => url !== null);
    }
  } catch (err) {
    console.error("[灰度测试] 加载背景库失败:", err);
  }

  return (
    <main className="w-screen h-screen overflow-hidden bg-gray-950 flex items-center justify-center">
      {/* PC 端 16:9 画布居中；移动端全屏 */}
      <div className="w-full h-full">
        <GrayTestCanvas images={images} />
      </div>
    </main>
  );
}
