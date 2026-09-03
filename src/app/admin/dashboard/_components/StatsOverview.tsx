import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/auth";
import { notFound, redirect } from "next/navigation";
import { unstable_cache } from "next/cache";
import { cookies } from "next/headers";
import { translate, parseLang, type Lang } from "@/lib/i18n/dict";
import {
  ClipboardPlus,
  Clock,
  PackageCheck,
  CircleCheck,
  TrendingUp,
} from "lucide-react";

// 获取本地日期字符串 (YYYY-MM-DD)
function getLocalDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// 格式化日期为短显示
function formatShortDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${month}-${day}`;
}

// 计算最近7天日期数组
function getLast7Days(): Date[] {
  const days: Date[] = [];
  const today = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    days.push(d);
  }
  return days;
}

interface StatCard {
  label: string;
  i18nKey: string;
  value: number;
  // 图标用 key 而非组件引用：fetchStats 结果经 unstable_cache 序列化缓存，
  // 组件引用会被序列化为空对象导致渲染失败（Element type is invalid）。
  iconKey: StatIconKey;
  iconBg: string;
  iconColor: string;
}

type StatIconKey = "clipboard" | "clock" | "package" | "circle";

// 图标 key → 组件映射（模块级，UI 与数据分离）
const STAT_ICONS: Record<StatIconKey, React.ElementType> = {
  clipboard: ClipboardPlus,
  clock: Clock,
  package: PackageCheck,
  circle: CircleCheck,
};

interface TrendItem {
  date: string;
  label: string;
  count: number;
}

async function fetchStats() {
  // 今日起止时间
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(todayStart);
  todayEnd.setDate(todayEnd.getDate() + 1);

  const todayStartISO = todayStart.toISOString();
  const todayEndISO = todayEnd.toISOString();

  // 最近7天趋势参数
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(now.getDate() - 6);
  sevenDaysAgo.setHours(0, 0, 0, 0);
  const sevenDaysAgoISO = sevenDaysAgo.toISOString();

  // 全部统计查询使用 admin 客户端（service_role）：
  // 不依赖会话 cookie（unstable_cache 缓存上下文无法访问 cookies()，修复缓存后数据加载失败），
  // 且本组件已通过 getCurrentUser 完成管理员鉴权。
  const admin = createAdminClient();
  const [statusCountsResult, todayResult, recentOrdersResult] =
    await Promise.all([
      admin.rpc("get_order_status_counts"),
      admin
        .from("orders")
        .select("id", { count: "exact", head: true })
        .gte("created_at", todayStartISO)
        .lt("created_at", todayEndISO),
      admin
        .from("orders")
        .select("created_at")
        .gte("created_at", sevenDaysAgoISO)
        .order("created_at", { ascending: true }),
    ]);

  // 解析 RPC 返回的状态计数，构建状态 → 数量映射
  const statusCounts = new Map<string, number>();
  if (statusCountsResult.data) {
    statusCountsResult.data.forEach(
      (row: { status: string; count: number }) => {
        statusCounts.set(row.status, row.count);
      }
    );
  }

  const recentOrders = recentOrdersResult.data;

  // 按日期分组统计
  const last7Days = getLast7Days();
  const trendMap = new Map<string, number>();
  last7Days.forEach((d) => {
    trendMap.set(getLocalDateString(d), 0);
  });

  if (recentOrders && recentOrders.length > 0) {
    recentOrders.forEach((order) => {
      const orderDate = new Date(order.created_at);
      const dateKey = getLocalDateString(orderDate);
      if (trendMap.has(dateKey)) {
        trendMap.set(dateKey, (trendMap.get(dateKey) || 0) + 1);
      }
    });
  }

  const trend: TrendItem[] = last7Days.map((d) => ({
    date: getLocalDateString(d),
    label: formatShortDate(d),
    count: trendMap.get(getLocalDateString(d)) || 0,
  }));

  const stats: StatCard[] = [
    {
      label: "今日新增委托",
      i18nKey: "admin.stats.todayNew",
      value: todayResult.count ?? 0,
      iconKey: "clipboard",
      iconBg: "bg-blue-50",
      iconColor: "text-blue-600",
    },
    {
      label: "待估价委托",
      i18nKey: "admin.stats.pending",
      value: statusCounts.get("pending") ?? 0,
      iconKey: "clock",
      iconBg: "bg-yellow-50",
      iconColor: "text-yellow-600",
    },
    {
      label: "已接单委托",
      i18nKey: "admin.stats.accepted",
      value: statusCounts.get("accepted") ?? 0,
      iconKey: "package",
      iconBg: "bg-green-50",
      iconColor: "text-green-600",
    },
    {
      label: "已完成委托",
      i18nKey: "admin.stats.completed",
      value: statusCounts.get("completed") ?? 0,
      iconKey: "circle",
      iconBg: "bg-gray-100",
      iconColor: "text-gray-600",
    },
  ];

  return { stats, trend };
}

// 性能优化（PERF-06）：统计为低频变化数据，缓存 30 秒，
// 避免每次进入管理后台（默认 overview tab）都实时执行 3 次数据库查询；
// 缓存过期后重新执行 fetchStats 时会基于最新时间重新计算"今日"边界。
const cachedFetchStats = unstable_cache(
  async () => fetchStats(),
  ["admin-stats-overview"],
  { revalidate: 30 }
);

export default async function StatsOverview() {
  // 安全加固（FIND-02）：本组件使用 service_role 客户端直查全平台订单统计，
  // 必须在组件内部二次鉴权，不能只依赖 middleware（middleware 只是路由级防线）。
  // 通过 getCurrentUser 真实网络验证 access token + 校验 admin 角色。
  // 服务端组件 i18n：cookies 读取语言 + translate()（与根布局一致，避免 hydration mismatch）
  const cookieStore = await cookies();
  const lang: Lang = parseLang(cookieStore.get("lw_lang")?.value);
  const t = (key: string) => translate(lang, key);

  const currentUser = await getCurrentUser();
  if (!currentUser) {
    redirect("/login");
  }
  if (currentUser.role !== "admin") {
    notFound();
  }

  let stats: StatCard[] = [];
  let trend: TrendItem[] = [];
  let loadError: string | null = null;

  try {
    const result = await cachedFetchStats();
    stats = result.stats;
    trend = result.trend;
  } catch (error) {
    console.error("加载统计数据失败:", error);
    loadError = "数据加载失败，请稍后刷新重试";
  }

  // 计算趋势最大值用于柱状条比例
  const maxCount = Math.max(...trend.map((t) => t.count), 1);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-lw-black">{t("admin.stats.title")}</h1>
        <p className="text-sm text-gray-400 mt-1">
          {t("admin.stats.subtitle")}
        </p>
      </div>

      {loadError ? (
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center text-red-600 text-sm">
          {loadError}
        </div>
      ) : (
        <>
          {/* 统计卡片 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {stats.map((stat) => {
              const Icon = STAT_ICONS[stat.iconKey];
              return (
                <div
                  key={stat.i18nKey}
                  className="bg-white rounded-lg shadow-sm p-5 border border-gray-50"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm text-gray-400 mb-2">
                        {t(stat.i18nKey)}
                      </p>
                      <p className="text-3xl font-bold text-lw-black">
                        {stat.value}
                      </p>
                    </div>
                    <div
                      className={`w-10 h-10 rounded-lg flex items-center justify-center ${stat.iconBg}`}
                    >
                      <Icon className={`w-5 h-5 ${stat.iconColor}`} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* 最近7天委托趋势 */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-50 p-6">
            <div className="flex items-center gap-2 mb-5">
              <TrendingUp className="w-5 h-5 text-lw-accent" />
              <h2 className="text-base font-semibold text-lw-black">
                {t("admin.stats.trendTitle")}
              </h2>
            </div>

            {trend.every((t2) => t2.count === 0) ? (
              <p className="text-sm text-gray-400 text-center py-8">
                {t("admin.stats.noTrend")}
              </p>
            ) : (
              <div className="space-y-3">
                {trend.map((item) => (
                  <div key={item.date} className="flex items-center gap-4">
                    <span className="text-sm text-gray-500 w-16 flex-shrink-0">
                      {item.label}
                    </span>
                    <div className="flex-1 flex items-center gap-3">
                      <div className="flex-1 bg-gray-100 rounded-full h-6 overflow-hidden">
                        <div
                          className="bg-lw-accent h-full rounded-full transition-all duration-500 flex items-center justify-end pr-2"
                          style={{
                            width: `${(item.count / maxCount) * 100}%`,
                            minWidth: item.count > 0 ? "2rem" : "0",
                          }}
                        >
                          {item.count > 0 && (
                            <span className="text-[10px] font-medium text-white">
                              {item.count}
                            </span>
                          )}
                        </div>
                      </div>
                      <span className="text-sm font-medium text-lw-black w-8 text-right">
                        {item.count}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
