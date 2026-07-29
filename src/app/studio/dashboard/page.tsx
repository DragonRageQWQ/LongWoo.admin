"use client";

import { useState, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import {
  User,
  Package,
  Clock,
  Eye,
  CheckCircle,
  LogOut,
  Loader2,
  Inbox,
  X,
  CircleCheck,
  Search,
  ChevronLeft,
  ChevronRight,
  Settings,
  Ban,
} from "lucide-react";
import { logoutUser } from "@/actions/auth-actions";
import {
  getStudioOrders,
  getOrderStatusCounts,
} from "@/actions/order-actions";
import { formatDate } from "@/lib/utils";
import { StatusBadge } from "@/components/shared/StatusBadge";
import type { Order } from "@/types/database";

const StudioOrderDetailModal = dynamic(
  () => import("./_components/StudioOrderDetailModal"),
  { ssr: false }
);

type TabKey = "pending" | "estimated" | "accepted" | "processing" | "delivered" | "completed" | "rejected";

const tabs: { key: TabKey; label: string; icon: React.ElementType }[] = [
  { key: "pending", label: "待估价", icon: Clock },
  { key: "estimated", label: "已估价", icon: Package },
  { key: "accepted", label: "已接委托", icon: Eye },
  { key: "processing", label: "处理中", icon: Settings },
  { key: "delivered", label: "已交付", icon: CheckCircle },
  { key: "completed", label: "已完成", icon: CircleCheck },
  { key: "rejected", label: "已拒单", icon: Ban },
];

export default function StudioDashboardPage() {
  const [activeTab, setActiveTab] = useState<TabKey>("pending");
  const [loggingOut, setLoggingOut] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [counts, setCounts] = useState<Record<TabKey, number>>({
    pending: 0,
    estimated: 0,
    accepted: 0,
    processing: 0,
    delivered: 0,
    completed: 0,
    rejected: 0,
  });

  // 搜索与分页
  const [searchQuery, setSearchQuery] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const pageSize = 10;

  // 详情弹窗
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  // 竞态保护：每次 loadData 递增 requestId，仅最新请求的结果会被应用
  const requestIdRef = useRef(0);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await logoutUser();
    } catch (error) {
      console.error("退出登录失败:", error);
      setLoggingOut(false);
    }
  };

  // 加载数据
  const loadData = async () => {
    const currentRequestId = ++requestIdRef.current;
    setLoading(true);
    setError(null);

    try {
      const offset = (currentPage - 1) * pageSize;
      const [ordersResult, countsResult] = await Promise.all([
        getStudioOrders({ status: activeTab, search: searchQuery || undefined, offset, limit: pageSize }),
        getOrderStatusCounts(),
      ]);

      // 竞态保护：如果这不是最新请求，丢弃结果
      if (currentRequestId !== requestIdRef.current) return;

      if (!ordersResult.success) {
        setError(ordersResult.error || "加载委托单失败");
        setOrders([]);
      } else {
        setOrders(ordersResult.data || []);
        setTotalItems(ordersResult.total ?? 0);
      }

      if (countsResult.success && countsResult.counts) {
        setCounts({
          pending: countsResult.counts.pending,
          estimated: countsResult.counts.estimated,
          accepted: countsResult.counts.accepted,
          processing: countsResult.counts.processing,
          delivered: countsResult.counts.delivered,
          completed: countsResult.counts.completed,
          rejected: countsResult.counts.rejected,
        });
      }
    } catch (err) {
      if (currentRequestId !== requestIdRef.current) return;
      console.error("加载数据异常:", err);
      setError("加载时发生未知错误");
      setOrders([]);
    } finally {
      if (currentRequestId === requestIdRef.current) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, searchQuery, currentPage]);

  // 搜索提交
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearchQuery(searchInput.trim());
    setCurrentPage(1);
  };

  // 清除搜索
  const handleClearSearch = () => {
    setSearchInput("");
    setSearchQuery("");
    setCurrentPage(1);
  };

  // 切换 Tab 时重置分页和搜索
  const handleTabChange = (tab: TabKey) => {
    setActiveTab(tab);
    setCurrentPage(1);
    setSearchInput("");
    setSearchQuery("");
  };

  // 分页计算
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const startItem = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);

  // 查看详情
  const handleViewDetail = (orderId: string) => {
    setSelectedOrderId(orderId);
    setModalOpen(true);
  };

  // 关闭详情弹窗后刷新
  const handleModalClose = (needRefresh: boolean) => {
    setModalOpen(false);
    setSelectedOrderId(null);
    if (needRefresh) {
      loadData();
    }
  };

  return (
    <div className="w-full min-h-[calc(100vh-4rem)] bg-lw-gray">
      {/* 顶部信息栏 */}
      <div className="bg-white border-b border-gray-100 px-4 sm:px-6 lg:px-8 py-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-lw-accent text-white flex items-center justify-center">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-lw-black">工作室工作台</h1>
              <p className="text-sm text-gray-400">LongWoo 工作室</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-500">欢迎回来！</span>
            <button
              onClick={handleLogout}
              disabled={loggingOut}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loggingOut ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <LogOut className="w-4 h-4" />
              )}
              {loggingOut ? "退出中..." : "退出登录"}
            </button>
          </div>
        </div>
      </div>

      {/* Tab 切换 */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex flex-wrap gap-2 mb-6">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => handleTabChange(tab.key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                activeTab === tab.key
                  ? "bg-lw-accent text-white"
                  : "bg-white text-lw-black hover:bg-gray-100"
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
              <span className="text-xs opacity-75">({counts[tab.key]})</span>
            </button>
          ))}
        </div>

        {/* 搜索栏 */}
        <form onSubmit={handleSearch} className="mb-4 flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="搜索订单号、客户名或需求描述..."
              className="w-full pl-10 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-lw-accent focus:ring-1 focus:ring-lw-accent"
            />
            {searchInput && (
              <button
                type="button"
                onClick={handleClearSearch}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-gray-600 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <button
            type="submit"
            className="px-4 py-2 text-sm font-medium text-white bg-lw-accent rounded-lg hover:bg-blue-700 transition-colors cursor-pointer"
          >
            搜索
          </button>
        </form>

        {/* 错误提示 */}
        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-600">
            {error}
            <button
              onClick={loadData}
              className="ml-3 text-lw-accent hover:underline"
            >
              重试
            </button>
          </div>
        )}

        {/* 委托单列表 */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-6 h-6 text-lw-accent animate-spin" />
              <span className="ml-2 text-sm text-gray-400">加载中...</span>
            </div>
          ) : orders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400">
              <Inbox className="w-12 h-12 mb-3 text-gray-300" />
              <p className="text-sm">暂无委托单</p>
            </div>
          ) : (
            <>
              {/* 桌面端表格 */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        订单号
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        服务类型
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        客户
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        需求摘要
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        提交时间
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        操作
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {orders.map((order) => (
                      <tr
                        key={order.id}
                        className="hover:bg-gray-50 transition-colors"
                      >
                        <td className="px-4 py-3 text-sm font-medium text-lw-black whitespace-nowrap">
                          {order.order_no}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                          {order.service_types?.name || "未指定"}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                          {order.customer_name}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 max-w-xs">
                          <span
                            className="block truncate"
                            title={order.requirements}
                          >
                            {order.requirements.slice(0, 30)}
                            {order.requirements.length > 30 ? "..." : ""}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">
                          {formatDate(order.created_at)}
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          <button
                            onClick={() => handleViewDetail(order.id)}
                            className="inline-flex items-center gap-1 px-3 py-1 text-sm text-lw-accent hover:bg-blue-50 rounded-md transition-colors cursor-pointer"
                          >
                            <Eye className="w-4 h-4" />
                            查看详情
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* 移动端卡片列表 */}
              <div className="md:hidden divide-y divide-gray-50">
                {orders.map((order) => (
                  <div key={order.id} className="p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-lw-black">
                        {order.order_no}
                      </span>
                      <StatusBadge status={order.status} size="sm" />
                    </div>
                    <div className="flex items-center justify-between text-sm text-gray-600">
                      <span>{order.service_types?.name || "未指定"}</span>
                      <span>客户: {order.customer_name}</span>
                    </div>
                    <p className="text-sm text-gray-500 line-clamp-2">
                      {order.requirements.slice(0, 50)}
                      {order.requirements.length > 50 ? "..." : ""}
                    </p>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-400">
                        {formatDate(order.created_at)}
                      </span>
                      <button
                        onClick={() => handleViewDetail(order.id)}
                        className="inline-flex items-center gap-1 px-3 py-1 text-sm text-lw-accent hover:bg-blue-50 rounded-md transition-colors cursor-pointer"
                      >
                        <Eye className="w-4 h-4" />
                        查看详情
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* 分页控件 */}
        {!loading && orders.length > 0 && (
          <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-xs text-gray-500">
              共 {totalItems} 条，显示 {startItem}-{endItem}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" />
                上一页
              </button>
              <span className="text-sm text-gray-500 px-2">
                {currentPage} / {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                下一页
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 订单详情弹窗 */}
      {modalOpen && selectedOrderId && (
        <StudioOrderDetailModal
          orderId={selectedOrderId}
          onClose={handleModalClose}
        />
      )}
    </div>
  );
}
