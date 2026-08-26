import { redirect } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import GrayTestCanvas from "../GrayTestCanvas";

/**
 * 灰度测试 · test1（交互式背景画布）
 *
 * 原 /gray-test 页面迁入中间页 test1 选项后位于本路由。
 * 权限：服务端二次鉴权（纵深防御）——未登录跳转登录页，
 *      非管理员跳转个人中心。middleware 已做路由级保护。
 *
 * 背景库：动态读取 works 表所有启用作品的 image_url。
 *        管理后台新增/删除/替换作品时，本页背景库自动同步，无需额外维护。
 */
export const metadata = {
  title: "灰度测试 | LongWoo",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function GrayTest1Page() {
  // 服务端二次鉴权：所有 admin 角色均可访问（放权）
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    redirect("/login");
  }
  if (currentUser.role !== "admin") {
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
    <main className="w-screen h-screen overflow-hidden bg-gray-950 flex items-center justify-center relative">
      {/* 返回中间页入口（悬浮，不遮挡画布交互） */}
      <Link
        href="/gray-test"
        className="absolute top-4 left-4 z-30 inline-flex items-center gap-1 rounded-full bg-black/40 border border-white/15 text-slate-200 text-xs px-3 py-1.5 backdrop-blur-md hover:bg-black/60 hover:text-white transition-colors"
        aria-label="返回灰度测试中间页"
      >
        <ChevronLeft className="w-3.5 h-3.5" />
        中间页
      </Link>

      {/* PC 端 16:9 画布居中；移动端全屏 */}
      <div className="w-full h-full">
        <GrayTestCanvas images={images} />
      </div>
    </main>
  );
}
