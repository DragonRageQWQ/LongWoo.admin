import { Suspense } from "react";
import AdminSidebar, { type AdminTab } from "./_components/AdminSidebar";
import StatsOverview from "./_components/StatsOverview";
import OrderList from "./_components/OrderList";

// 支持的有效标签页
const validTabs: AdminTab[] = ["all-orders", "overview", "orders", "users", "settings"];

// 解析当前标签页
function resolveTab(tabParam: string | undefined): AdminTab {
  if (tabParam && validTabs.includes(tabParam as AdminTab)) {
    return tabParam as AdminTab;
  }
  return "overview";
}

// 占位组件：未实现的功能
function PlaceholderPanel({ title }: { title: string }) {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-lw-black">{title}</h1>
        <p className="text-sm text-gray-400 mt-1">该功能正在开发中</p>
      </div>
      <div className="bg-white rounded-lg shadow-sm border border-gray-50 p-12 text-center">
        <p className="text-sm text-gray-400">功能开发中，敬请期待...</p>
      </div>
    </div>
  );
}

// 主体内容区（根据 tab 渲染不同面板）
function DashboardContent({ activeTab }: { activeTab: AdminTab }) {
  switch (activeTab) {
    case "all-orders":
      return (
        <OrderList
          title="全部订单"
          description="快速查看所有订单并进行操作"
        />
      );
    case "overview":
      return <StatsOverview />;
    case "orders":
      return <OrderList />;
    case "users":
      return <PlaceholderPanel title="用户管理" />;
    case "settings":
      return <PlaceholderPanel title="系统设置" />;
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

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* 左侧侧边栏 */}
      <AdminSidebar activeTab={activeTab} />

      {/* 右侧内容区 */}
      <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8 overflow-x-hidden lg:pl-10">
        <div className="lg:pt-0 pt-12">
          <Suspense
            fallback={
              <div className="flex items-center justify-center py-20">
                <div className="w-6 h-6 border-2 border-lw-accent border-t-transparent rounded-full animate-spin" />
                <span className="ml-2 text-sm text-gray-400">加载中...</span>
              </div>
            }
          >
            <DashboardContent activeTab={activeTab} />
          </Suspense>
        </div>
      </main>
    </div>
  );
}
