"use client";

import { useState, useEffect } from "react";
import {
  Search,
  Eye,
  ChevronLeft,
  ChevronRight,
  Funnel,
  Loader,
  Inbox,
} from "lucide-react";
import { getOrders } from "@/actions/order-actions";
import { formatDate } from "@/lib/utils";
import type { Order } from "@/types/database";
import { StatusBadge } from "@/components/shared/StatusBadge";
import OrderDetailModal from "./OrderDetailModal";

// 分页大小
const PAGE_SIZE = 10;

// 状态筛选项
const statusOptions: Array<{ value: string; label: string }> = [
  { value: "", label: "全部状态" },
  { value: "pending", label: "待估价" },
  { value: "estimated", label: "已估价" },
  { value: "accepted", label: "已接单" },
  { value: "processing", label: "处理中" },
  { value: "delivered", label: "已交付" },
  { value: "completed", label: "已完成" },
  { value: "rejected", label: "已拒单" },
];

export default function OrderList({
  title = "委托管理",
  description = "管理所有委托单，进行估价、接单、进度更新等操作",
}: {
  title?: string;
  description?: string;
}) {
  // 搜索与筛选状态
  const [searchKeyword, setSearchKeyword] = useState("");
  const [appliedKeyword, setAppliedKeyword] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  // 数据状态
  const [orders, setOrders] = useState<Order[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 手动刷新触发器
  const [refreshKey, setRefreshKey] = useState(0);

  // 详情弹窗
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  // 触发刷新（用于弹窗关闭后手动刷新）
  const triggerRefresh = () => {
    setLoading(true);
    setRefreshKey((k) => k + 1);
  };

  // 数据获取：所有搜索/筛选均在服务端执行
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const result = await getOrders({
          status: statusFilter || undefined,
          search: appliedKeyword || undefined,
          startDate: startDate || undefined,
          endDate: endDate || undefined,
          offset: (currentPage - 1) * PAGE_SIZE,
          limit: PAGE_SIZE,
        });

        if (cancelled) return;

        if (!result.success) {
          setError(result.error || "获取委托列表失败");
          setOrders([]);
          setTotalCount(0);
          return;
        }

        setOrders(result.data || []);
        setTotalCount(result.total ?? result.count ?? 0);
        setError(null);
      } catch (err) {
        if (cancelled) return;
        console.error("加载委托列表异常:", err);
        setError("加载委托列表时发生未知错误");
        setOrders([]);
        setTotalCount(0);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [statusFilter, currentPage, appliedKeyword, startDate, endDate, refreshKey]);

  // 搜索按钮
  const handleSearch = () => {
    setLoading(true);
    setAppliedKeyword(searchKeyword);
    setCurrentPage(1);
  };

  // 回车搜索
  const handleSearchKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>
  ) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  // 状态筛选变化
  const handleStatusChange = (value: string) => {
    setLoading(true);
    setStatusFilter(value);
    setCurrentPage(1);
  };

  // 日期筛选变化 - 开始日期
  const handleStartDateChange = (value: string) => {
    setLoading(true);
    setStartDate(value);
    setCurrentPage(1);
  };

  // 日期筛选变化 - 结束日期
  const handleEndDateChange = (value: string) => {
    setLoading(true);
    setEndDate(value);
    setCurrentPage(1);
  };

  // 重置筛选
  const handleReset = () => {
    setLoading(true);
    setSearchKeyword("");
    setAppliedKeyword("");
    setStatusFilter("");
    setStartDate("");
    setEndDate("");
    setCurrentPage(1);
  };

  // 分页
  const handlePrevPage = () => {
    if (currentPage > 1) {
      setLoading(true);
      setCurrentPage(currentPage - 1);
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setLoading(true);
      setCurrentPage(currentPage + 1);
    }
  };

  // 查看详情
  const handleViewDetail = (orderId: string) => {
    setSelectedOrderId(orderId);
    setModalOpen(true);
  };

  // 详情弹窗关闭后刷新列表
  const handleModalClose = (needRefresh: boolean) => {
    setModalOpen(false);
    setSelectedOrderId(null);
    if (needRefresh) {
      triggerRefresh();
    }
  };

  // 截断文本
  const truncateText = (text: string, maxLength: number) => {
    if (!text) return "-";
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength) + "...";
  };

  // 生成分页页码
  const getPageNumbers = () => {
    const pages: number[] = [];
    const maxVisible = 5;
    const start = Math.max(1, currentPage - Math.floor(maxVisible / 2));
    const end = Math.min(totalPages, start + maxVisible - 1);
    const adjustedStart =
      end - start + 1 < maxVisible ? Math.max(1, end - maxVisible + 1) : start;
    for (let i = adjustedStart; i <= end; i++) {
      pages.push(i);
    }
    return pages;
  };

  return (
    <div className="space-y-5">
      {/* 标题 */}
      <div>
        <h1 className="text-xl font-bold text-lw-black">{title}</h1>
        <p className="text-sm text-gray-400 mt-1">
          {description}
        </p>
      </div>

      {/* 搜索与筛选区 */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-50 p-4 space-y-4">
        {/* 搜索栏 */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchKeyword}
              onChange={(e) => setSearchKeyword(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              placeholder="按订单号或客户名称搜索..."
              className="w-full pl-10 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-lw-accent focus:ring-1 focus:ring-lw-accent transition-colors"
            />
          </div>
          <button
            onClick={handleSearch}
            className="px-5 py-2 bg-lw-accent text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors cursor-pointer flex items-center gap-1.5"
          >
            <Search className="w-4 h-4" />
            搜索
          </button>
        </div>

        {/* 筛选区 */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Funnel className="w-4 h-4 text-gray-400" />
            <span className="text-sm text-gray-500">筛选:</span>
          </div>

          {/* 状态下拉 */}
          <select
            value={statusFilter}
            onChange={(e) => handleStatusChange(e.target.value)}
            className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-lw-accent focus:ring-1 focus:ring-lw-accent cursor-pointer bg-white"
          >
            {statusOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          {/* 日期范围 */}
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={startDate}
              onChange={(e) => handleStartDateChange(e.target.value)}
              className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-lw-accent focus:ring-1 focus:ring-lw-accent cursor-pointer"
            />
            <span className="text-sm text-gray-400">至</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => handleEndDateChange(e.target.value)}
              className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-lw-accent focus:ring-1 focus:ring-lw-accent cursor-pointer"
            />
          </div>

          {/* 重置按钮 */}
          {(appliedKeyword || statusFilter || startDate || endDate) && (
            <button
              onClick={handleReset}
              className="px-3 py-1.5 text-sm text-gray-500 hover:text-lw-accent transition-colors cursor-pointer"
            >
              重置
            </button>
          )}
        </div>
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-600">
          {error}
        </div>
      )}

      {/* 订单表格 */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-50 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader className="w-6 h-6 text-lw-accent animate-spin" />
            <span className="ml-2 text-sm text-gray-400">加载中...</span>
          </div>
        ) : orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <Inbox className="w-12 h-12 mb-3 text-gray-300" />
            <p className="text-sm">暂无委托数据</p>
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
                      客户姓名
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      联系方式
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      需求摘要
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      状态
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
                        {order.customer_name}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                        {order.customer_phone}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 max-w-xs">
                        <span className="block truncate" title={order.requirements}>
                          {truncateText(order.requirements, 30)}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <StatusBadge status={order.status} size="sm" />
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
                    <span>客户: {order.customer_name}</span>
                    <span>{order.customer_phone}</span>
                  </div>
                  <p className="text-sm text-gray-500 line-clamp-2">
                    {truncateText(order.requirements, 50)}
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

            {/* 分页控件 */}
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-50 bg-gray-50/50">
              <p className="text-sm text-gray-500">
                共 <span className="font-medium text-lw-black">{totalCount}</span> 条，
                第 {currentPage}/{totalPages} 页
              </p>
              <div className="flex items-center gap-1">
                <button
                  onClick={handlePrevPage}
                  disabled={currentPage <= 1}
                  className="p-1.5 text-gray-500 hover:text-lw-black hover:bg-gray-100 rounded-md transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                {getPageNumbers().map((page) => (
                  <button
                    key={page}
                    onClick={() => {
                      setLoading(true);
                      setCurrentPage(page);
                    }}
                    className={`px-3 py-1 text-sm rounded-md transition-colors cursor-pointer ${
                      currentPage === page
                        ? "bg-lw-accent text-white"
                        : "text-gray-600 hover:bg-gray-100"
                    }`}
                  >
                    {page}
                  </button>
                ))}
                <button
                  onClick={handleNextPage}
                  disabled={currentPage >= totalPages}
                  className="p-1.5 text-gray-500 hover:text-lw-black hover:bg-gray-100 rounded-md transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* 订单详情弹窗 */}
      {modalOpen && selectedOrderId && (
        <OrderDetailModal
          orderId={selectedOrderId}
          onClose={handleModalClose}
        />
      )}
    </div>
  );
}
