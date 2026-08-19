import { Suspense } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import dynamic from "next/dynamic";
import AdminSidebar, { type AdminTab } from "./_components/AdminSidebar";
import StatsOverview from "./_components/StatsOverview";
import { getCurrentUser, ZERO_USER_UID } from "@/lib/auth";
import { translate, type Lang } from "@/lib/i18n/dict";

// 支持的有效标签页
const validTabs: AdminTab[] = ["all-orders", "overview", "users", "notifications", "feedback", "settings", "works", "drops"];

// ===== 管理面板按需加载（性能优化） =====
// 5 个客户端面板合计 2600+ 行，静态导入会全部打进 /admin/dashboard 首屏 JS。
// 改为 next/dynamic 按 tab 懒加载：仅激活的面板才下载对应 chunk，
// 首屏只加载当前 tab 所需代码（其余面板进入对应 tab 时才拉取）。
// 注：StatsOverview 为服务端组件（RSC），保持静态导入（轻量，无客户端 JS）。
const OrderList = dynamic(() => import("./_components/OrderList"), {
  loading: () => <PanelSkeleton />,
});
const UserManagement = dynamic(() => import("./_components/UserManagement"), {
  loading: () => <PanelSkeleton />,
});
const NotificationManagement = dynamic(() => import("./_components/NotificationManagement"), {
  loading: () => <PanelSkeleton />,
});
const FeedbackManagement = dynamic(() => import("./_components/FeedbackManagement"), {
  loading: () => <PanelSkeleton />,
});
const WorksManagement = dynamic(() => import("./_components/WorksManagement"), {
  loading: () => <PanelSkeleton />,
});
const DropItemsManagement = dynamic(() => import("./_components/DropItemsManagement"), {
  loading: () => <PanelSkeleton />,
});
const SettingsPanel = dynamic(() => import("./_components/SettingsPanel"), {
  loading: () => <PanelSkeleton />,
});

// 面板加载占位
function PanelSkeleton() {
  return (
    <div className="space-y-4" aria-hidden="true">
      <div className="h-8 w-48 bg-gray-100 rounded animate-pulse" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-28 bg-gray-100 rounded-lg animate-pulse" />
        ))}
      </div>
      <div className="h-64 bg-gray-100 rounded-lg animate-pulse" />
    </div>
  );
}

// 解析当前标签页
function resolveTab(tabParam: string | undefined): AdminTab {
  if (tabParam && validTabs.includes(tabParam as AdminTab)) {
    return tabParam as AdminTab;
  }
  return "overview";
}

// 主体内容区（根据 tab 渲染不同面板，面板已按需加载）
function DashboardContent({
  activeTab,
  isSuperAdmin,
  t,
}: {
  activeTab: AdminTab;
  isSuperAdmin: boolean;
  t: (key: string) => string;
}) {
  switch (activeTab) {
    case "all-orders":
      return (
        <OrderList
          title={t("admin.orders.title")}
          description={t("admin.orders.description")}
        />
      );
    case "overview":
      return <StatsOverview />;
    case "users":
      return <UserManagement />;
    case "notifications":
      return <NotificationManagement isSuperAdmin={isSuperAdmin} />;
    case "feedback":
      return <FeedbackManagement />;
    case "works":
      return <WorksManagement />;
    case "drops":
      return <DropItemsManagement />;
    case "settings":
      return <SettingsPanel isSuperAdmin={isSuperAdmin} />;
    default:
      return <StatsOverview />;
  }
}

export default async function AdminDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  // Next.js 16: searchParams 是异步的，需要 await
  const params = await searchParams;
  const activeTab = resolveTab(params.tab);

  // 安全加固（FIND-02）：管理后台统一二次鉴权（纵深防御）。
  // middleware 只是路由级防线，此处通过 getCurrentUser 真实网络验证 access token
  // 并校验 admin 角色，确保伪造 cookie 无法进入任何管理面板。
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    redirect("/login");
  }
  if (currentUser.role !== "admin") {
    redirect("/profile");
  }

  // 服务端读取语言 cookie（与根布局一致），用字典 translate 生成 t 函数。
  // 本文件为服务端组件（async + cookies 鉴权），无法使用客户端 hook useLanguage，
  // 故采用同字典的服务端等价实现，保证 SSR 与客户端首次渲染一致。
  const cookieStore = await cookies();
  const lang: Lang = cookieStore.get("lw_lang")?.value === "en" ? "en" : "zh";
  const t = (key: string) => translate(lang, key);

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* 左侧侧边栏 */}
      <AdminSidebar activeTab={activeTab} isSuperAdmin={currentUser.uid === ZERO_USER_UID} />

      {/* 右侧内容区 */}
      <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8 overflow-x-hidden lg:pl-10">
        <div className="lg:pt-0 pt-12">
          <Suspense
            fallback={
              <div className="flex items-center justify-center py-20">
                <div className="w-6 h-6 border-2 border-lw-accent border-t-transparent rounded-full animate-spin" />
                <span className="ml-2 text-sm text-gray-400">{t("admin.loading")}</span>
              </div>
            }
          >
            <DashboardContent activeTab={activeTab} isSuperAdmin={currentUser.uid === ZERO_USER_UID} t={t} />
          </Suspense>
        </div>
      </main>
    </div>
  );
}
