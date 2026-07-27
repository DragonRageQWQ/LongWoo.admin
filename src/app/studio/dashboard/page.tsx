"use client";

import { useState, useEffect } from "react";
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
  CircleDollarSign,
  CircleCheck,
  CircleX,
  ArrowRight,
  Send,
  MessageSquare,
  Phone,
  Mail,
  Calendar,
  FileText,
  Paperclip,
  CircleAlert,
} from "lucide-react";
import { logoutUser } from "@/actions/auth-actions";
import {
  getStudioOrders,
  getOrderStatusCounts,
  getOrderById,
  submitEstimate,
  acceptOrder,
  rejectOrder,
  updateOrderStatus,
  replySite,
} from "@/actions/order-actions";
import { statusLabels, statusColors, formatDate } from "@/lib/utils";
import type { Order, OrderStatus, OrderAttachment, OrderReply, OperationLog } from "@/types/database";

type TabKey = "pending" | "estimated" | "accepted" | "delivered";

type OrderDetail = Order & {
  attachments?: OrderAttachment[];
  replies?: OrderReply[];
  logs?: OperationLog[];
};

const tabs: { key: TabKey; label: string; icon: React.ElementType }[] = [
  { key: "pending", label: "待估价", icon: Clock },
  { key: "estimated", label: "已估价", icon: Package },
  { key: "accepted", label: "已接委托", icon: Eye },
  { key: "delivered", label: "已交付", icon: CheckCircle },
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
    delivered: 0,
  });

  // 详情弹窗
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

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
    setLoading(true);
    setError(null);

    try {
      const [ordersResult, countsResult] = await Promise.all([
        getStudioOrders({ status: activeTab, limit: 50 }),
        getOrderStatusCounts(),
      ]);

      if (!ordersResult.success) {
        setError(ordersResult.error || "加载委托单失败");
        setOrders([]);
      } else {
        setOrders(ordersResult.data || []);
      }

      if (countsResult.success && countsResult.counts) {
        setCounts({
          pending: countsResult.counts.pending,
          estimated: countsResult.counts.estimated,
          accepted: countsResult.counts.accepted,
          delivered: countsResult.counts.delivered,
        });
      }
    } catch (err) {
      console.error("加载数据异常:", err);
      setError("加载时发生未知错误");
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

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

  // 渲染状态徽章
  const renderStatusBadge = (status: OrderStatus) => {
    const label = statusLabels[status] || status;
    const colorClass = statusColors[status] || "bg-gray-100 text-gray-800";
    return (
      <span
        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${colorClass}`}
      >
        {label}
      </span>
    );
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
              onClick={() => setActiveTab(tab.key)}
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
                      {renderStatusBadge(order.status)}
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

// ==================== 工作室订单详情弹窗 ====================

interface StudioOrderDetailModalProps {
  orderId: string;
  onClose: (needRefresh: boolean) => void;
}

function StudioOrderDetailModal({
  orderId,
  onClose,
}: StudioOrderDetailModalProps) {
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 估价表单
  const [estimatePrice, setEstimatePrice] = useState("");
  const [estimateNotes, setEstimateNotes] = useState("");
  const [submittingEstimate, setSubmittingEstimate] = useState(false);

  // 拒单
  const [rejectReason, setRejectReason] = useState("");
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [submittingReject, setSubmittingReject] = useState(false);

  // 接单
  const [submittingAccept, setSubmittingAccept] = useState(false);

  // 更新进度
  const [deliveryUrl, setDeliveryUrl] = useState("");
  const [submittingProgress, setSubmittingProgress] = useState(false);

  // 回复
  const [replyContent, setReplyContent] = useState("");
  const [submittingReply, setSubmittingReply] = useState(false);

  // 操作反馈
  const [actionMessage, setActionMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const [dataChanged, setDataChanged] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  // 数据获取
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const result = await getOrderById(orderId);
        if (cancelled) return;

        if (!result.success || !result.data) {
          setError(result.error || "获取订单详情失败");
          setOrder(null);
          return;
        }

        setOrder(result.data);
        setError(null);
      } catch (err) {
        if (cancelled) return;
        console.error("加载订单详情异常:", err);
        setError("加载订单详情时发生未知错误");
        setOrder(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [orderId, refreshKey]);

  // ESC 关闭弹窗
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose(dataChanged);
    };
    document.addEventListener("keydown", handleEsc);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleEsc);
      document.body.style.overflow = "";
    };
  }, [onClose, dataChanged]);

  const showActionMessage = (type: "success" | "error", text: string) => {
    setActionMessage({ type, text });
    setTimeout(() => setActionMessage(null), 3000);
  };

  const handleClose = () => onClose(dataChanged);

  const refreshDetail = () => {
    setLoading(true);
    setRefreshKey((k) => k + 1);
  };

  // 估价提交
  const handleSubmitEstimate = async () => {
    const price = parseFloat(estimatePrice);
    if (isNaN(price) || price <= 0) {
      showActionMessage("error", "请输入有效的价格");
      return;
    }
    setSubmittingEstimate(true);
    try {
      const result = await submitEstimate(orderId, price, estimateNotes);
      if (!result.success) {
        showActionMessage("error", result.error || "提交估价失败");
        return;
      }
      showActionMessage("success", "估价提交成功");
      setDataChanged(true);
      setEstimatePrice("");
      setEstimateNotes("");
      refreshDetail();
    } catch (err) {
      console.error("提交估价异常:", err);
      showActionMessage("error", "提交估价时发生未知错误");
    } finally {
      setSubmittingEstimate(false);
    }
  };

  // 接单
  const handleAcceptOrder = async () => {
    setSubmittingAccept(true);
    try {
      const result = await acceptOrder(orderId);
      if (!result.success) {
        showActionMessage("error", result.error || "接单失败");
        return;
      }
      showActionMessage("success", "接单成功");
      setDataChanged(true);
      refreshDetail();
    } catch (err) {
      console.error("接单异常:", err);
      showActionMessage("error", "接单时发生未知错误");
    } finally {
      setSubmittingAccept(false);
    }
  };

  // 拒单
  const handleRejectOrder = async () => {
    if (!rejectReason.trim()) {
      showActionMessage("error", "请输入拒单原因");
      return;
    }
    setSubmittingReject(true);
    try {
      const result = await rejectOrder(orderId, rejectReason.trim());
      if (!result.success) {
        showActionMessage("error", result.error || "拒单失败");
        return;
      }
      showActionMessage("success", "已拒单");
      setDataChanged(true);
      setRejectReason("");
      setShowRejectInput(false);
      refreshDetail();
    } catch (err) {
      console.error("拒单异常:", err);
      showActionMessage("error", "拒单时发生未知错误");
    } finally {
      setSubmittingReject(false);
    }
  };

  // 更新进度
  const handleUpdateProgress = async (
    newStatus: "processing" | "delivered" | "completed"
  ) => {
    setSubmittingProgress(true);
    try {
      const result = await updateOrderStatus(
        orderId,
        newStatus,
        deliveryUrl.trim() || undefined
      );
      if (!result.success) {
        showActionMessage("error", result.error || "更新进度失败");
        return;
      }
      showActionMessage("success", "状态已更新");
      setDataChanged(true);
      setDeliveryUrl("");
      refreshDetail();
    } catch (err) {
      console.error("更新进度异常:", err);
      showActionMessage("error", "更新进度时发生未知错误");
    } finally {
      setSubmittingProgress(false);
    }
  };

  // 发送回复
  const handleSendReply = async () => {
    if (!replyContent.trim()) {
      showActionMessage("error", "请输入回复内容");
      return;
    }
    setSubmittingReply(true);
    try {
      const result = await replySite(orderId, replyContent.trim());
      if (!result.success) {
        showActionMessage("error", result.error || "发送回复失败");
        return;
      }
      showActionMessage("success", "回复已发送");
      setDataChanged(true);
      setReplyContent("");
      refreshDetail();
    } catch (err) {
      console.error("发送回复异常:", err);
      showActionMessage("error", "发送回复时发生未知错误");
    } finally {
      setSubmittingReply(false);
    }
  };

  // 渲染状态徽章
  const renderStatusBadge = (status: OrderStatus) => {
    const label = statusLabels[status] || status;
    const colorClass = statusColors[status] || "bg-gray-100 text-gray-800";
    return (
      <span
        className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${colorClass}`}
      >
        {label}
      </span>
    );
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-start sm:items-center justify-center p-0 sm:p-4 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div className="bg-white w-full sm:max-w-5xl sm:rounded-xl shadow-xl min-h-screen sm:min-h-0 sm:max-h-[90vh] flex flex-col my-0 sm:my-8">
        {/* 弹窗头部 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white sm:rounded-t-xl z-10">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-bold text-lw-black">委托单详情</h2>
            {order && (
              <span className="text-sm text-gray-400">{order.order_no}</span>
            )}
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 text-gray-400 hover:text-lw-black hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 操作反馈提示 */}
        {actionMessage && (
          <div
            className={`mx-6 mt-4 p-3 rounded-lg text-sm flex items-center gap-2 ${
              actionMessage.type === "success"
                ? "bg-green-50 text-green-700 border border-green-200"
                : "bg-red-50 text-red-700 border border-red-200"
            }`}
          >
            {actionMessage.type === "success" ? (
              <CircleCheck className="w-4 h-4 flex-shrink-0" />
            ) : (
              <CircleAlert className="w-4 h-4 flex-shrink-0" />
            )}
            {actionMessage.text}
          </div>
        )}

        {/* 弹窗内容 */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-6 h-6 text-lw-accent animate-spin" />
              <span className="ml-2 text-sm text-gray-400">加载中...</span>
            </div>
          ) : error ? (
            <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center text-red-600 text-sm">
              {error}
            </div>
          ) : !order ? (
            <div className="text-center py-20 text-gray-400 text-sm">
              未找到委托单信息
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
              {/* 左侧：订单信息 */}
              <div className="lg:col-span-3 space-y-5">
                {/* 基本信息 */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-lw-black mb-3 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-lw-accent" />
                    基本信息
                  </h3>
                  <div className="grid grid-cols-2 gap-x-4">
                    <div className="flex items-start gap-2.5 py-2">
                      <FileText className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-gray-400 mb-0.5">订单号</p>
                        <p className="text-sm text-lw-black break-words">
                          {order.order_no}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2.5 py-2">
                      <Calendar className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-gray-400 mb-0.5">状态</p>
                        {renderStatusBadge(order.status)}
                      </div>
                    </div>
                    <div className="flex items-start gap-2.5 py-2">
                      <Calendar className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-gray-400 mb-0.5">提交时间</p>
                        <p className="text-sm text-lw-black">
                          {formatDate(order.created_at)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2.5 py-2">
                      <FileText className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-gray-400 mb-0.5">服务类型</p>
                        <p className="text-sm text-lw-black">
                          {order.service_types?.name || "未指定"}
                        </p>
                      </div>
                    </div>
                    {order.estimated_price !== null && (
                      <div className="flex items-start gap-2.5 py-2">
                        <CircleDollarSign className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-gray-400 mb-0.5">估价金额</p>
                          <p className="text-sm text-lw-black">
                            ¥{order.estimated_price}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* 客户信息 */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-lw-black mb-3 flex items-center gap-2">
                    <User className="w-4 h-4 text-lw-accent" />
                    客户信息
                  </h3>
                  <div className="grid grid-cols-2 gap-x-4">
                    <div className="flex items-start gap-2.5 py-2">
                      <User className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-gray-400 mb-0.5">姓名</p>
                        <p className="text-sm text-lw-black">
                          {order.customer_name}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2.5 py-2">
                      <Phone className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-gray-400 mb-0.5">手机号</p>
                        <p className="text-sm text-lw-black">
                          {order.customer_phone}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2.5 py-2">
                      <Mail className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-gray-400 mb-0.5">邮箱</p>
                        <p className="text-sm text-lw-black break-all">
                          {order.customer_email}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 需求描述 */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-lw-black mb-3 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-lw-accent" />
                    需求描述
                  </h3>
                  <div className="text-sm text-gray-700 whitespace-pre-wrap break-words leading-relaxed">
                    {order.requirements || "无"}
                  </div>
                  {order.estimate_notes && (
                    <div className="mt-3 pt-3 border-t border-gray-200">
                      <p className="text-xs text-gray-400 mb-1">估价备注</p>
                      <p className="text-sm text-gray-700 whitespace-pre-wrap break-words">
                        {order.estimate_notes}
                      </p>
                    </div>
                  )}
                  {order.reject_reason && (
                    <div className="mt-3 pt-3 border-t border-gray-200">
                      <p className="text-xs text-red-400 mb-1">拒单原因</p>
                      <p className="text-sm text-red-600 whitespace-pre-wrap break-words">
                        {order.reject_reason}
                      </p>
                    </div>
                  )}
                </div>

                {/* 附件列表 */}
                {order.attachments && order.attachments.length > 0 && (
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h3 className="text-sm font-semibold text-lw-black mb-3 flex items-center gap-2">
                      <Paperclip className="w-4 h-4 text-lw-accent" />
                      设计图附件
                      <span className="text-xs text-gray-400 font-normal">
                        ({order.attachments.length})
                      </span>
                    </h3>
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                      {order.attachments.map((att) => {
                        const isImage =
                          att.file_type?.startsWith("image/") ||
                          /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(
                            att.file_name
                          );
                        return (
                          <div
                            key={att.id}
                            className="aspect-square bg-white rounded-lg border border-gray-200 overflow-hidden"
                          >
                            {isImage ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={att.file_path}
                                alt={att.file_name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex flex-col items-center justify-center p-2">
                                <Paperclip className="w-8 h-8 text-gray-300 mb-1" />
                                <span className="text-xs text-gray-500 text-center truncate w-full">
                                  {att.file_name}
                                </span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* 右侧：操作区 */}
              <div className="lg:col-span-2 space-y-5">
                {/* 估价表单 */}
                {order.status === "pending" && (
                  <div className="bg-white border border-gray-200 rounded-lg p-4">
                    <h3 className="text-sm font-semibold text-lw-black mb-3 flex items-center gap-2">
                      <CircleDollarSign className="w-4 h-4 text-yellow-600" />
                      提交估价
                    </h3>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">
                          估价金额 (¥) <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={estimatePrice}
                          onChange={(e) => setEstimatePrice(e.target.value)}
                          placeholder="请输入估价金额"
                          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-lw-accent focus:ring-1 focus:ring-lw-accent"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">
                          估价备注
                        </label>
                        <textarea
                          value={estimateNotes}
                          onChange={(e) => setEstimateNotes(e.target.value)}
                          placeholder="补充说明..."
                          rows={3}
                          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-lw-accent focus:ring-1 focus:ring-lw-accent resize-none"
                        />
                      </div>
                      <button
                        onClick={handleSubmitEstimate}
                        disabled={submittingEstimate}
                        className="w-full px-4 py-2 bg-lw-accent text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
                      >
                        {submittingEstimate ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            提交中...
                          </>
                        ) : (
                          "提交估价"
                        )}
                      </button>
                    </div>
                  </div>
                )}

                {/* 接单按钮 */}
                {order.status === "estimated" && (
                  <div className="bg-white border border-gray-200 rounded-lg p-4">
                    <h3 className="text-sm font-semibold text-lw-black mb-3 flex items-center gap-2">
                      <CircleCheck className="w-4 h-4 text-green-600" />
                      接单操作
                    </h3>
                    <p className="text-sm text-gray-500 mb-3">
                      该委托已估价，可接单开始处理
                    </p>
                    <button
                      onClick={handleAcceptOrder}
                      disabled={submittingAccept}
                      className="w-full px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
                    >
                      {submittingAccept ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          接单中...
                        </>
                      ) : (
                        <>
                          <CircleCheck className="w-4 h-4" />
                          确认接单
                        </>
                      )}
                    </button>
                  </div>
                )}

                {/* 拒单操作 */}
                {(order.status === "pending" ||
                  order.status === "estimated") && (
                  <div className="bg-white border border-gray-200 rounded-lg p-4">
                    <h3 className="text-sm font-semibold text-lw-black mb-3 flex items-center gap-2">
                      <CircleX className="w-4 h-4 text-red-600" />
                      拒单操作
                    </h3>
                    {!showRejectInput ? (
                      <button
                        onClick={() => setShowRejectInput(true)}
                        className="w-full px-4 py-2 border border-red-300 text-red-600 text-sm font-medium rounded-lg hover:bg-red-50 transition-colors cursor-pointer"
                      >
                        拒绝该委托
                      </button>
                    ) : (
                      <div className="space-y-3">
                        <div>
                          <label className="block text-xs text-gray-500 mb-1">
                            拒单原因 <span className="text-red-500">*</span>
                          </label>
                          <textarea
                            value={rejectReason}
                            onChange={(e) => setRejectReason(e.target.value)}
                            placeholder="请输入拒单原因..."
                            rows={3}
                            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-red-400 focus:ring-1 focus:ring-red-400 resize-none"
                          />
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={handleRejectOrder}
                            disabled={submittingReject}
                            className="flex-1 px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {submittingReject ? "拒单中..." : "确认拒单"}
                          </button>
                          <button
                            onClick={() => {
                              setShowRejectInput(false);
                              setRejectReason("");
                            }}
                            className="px-4 py-2 text-sm text-gray-500 hover:text-lw-black transition-colors cursor-pointer"
                          >
                            取消
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* 更新进度 */}
                {(order.status === "accepted" ||
                  order.status === "processing") && (
                  <div className="bg-white border border-gray-200 rounded-lg p-4">
                    <h3 className="text-sm font-semibold text-lw-black mb-3 flex items-center gap-2">
                      <ArrowRight className="w-4 h-4 text-purple-600" />
                      更新进度
                    </h3>
                    <div className="space-y-3">
                      <div className="text-xs text-gray-500">
                        当前状态: {statusLabels[order.status]}
                      </div>
                      {order.status === "accepted" && (
                        <button
                          onClick={() => handleUpdateProgress("processing")}
                          disabled={submittingProgress}
                          className="w-full px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
                        >
                          {submittingProgress && (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          )}
                          开始处理
                        </button>
                      )}
                      {order.status === "processing" && (
                        <>
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">
                              交付链接 (可选)
                            </label>
                            <input
                              type="url"
                              value={deliveryUrl}
                              onChange={(e) => setDeliveryUrl(e.target.value)}
                              placeholder="https://..."
                              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-lw-accent focus:ring-1 focus:ring-lw-accent"
                            />
                          </div>
                          <button
                            onClick={() => handleUpdateProgress("delivered")}
                            disabled={submittingProgress}
                            className="w-full px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
                          >
                            {submittingProgress && (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            )}
                            标记为已交付
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                )}

                {/* 完成订单 */}
                {order.status === "delivered" && (
                  <div className="bg-white border border-gray-200 rounded-lg p-4">
                    <h3 className="text-sm font-semibold text-lw-black mb-3 flex items-center gap-2">
                      <CircleCheck className="w-4 h-4 text-gray-600" />
                      完成订单
                    </h3>
                    <p className="text-sm text-gray-500 mb-3">
                      该委托已交付，可标记为已完成
                    </p>
                    <button
                      onClick={() => handleUpdateProgress("completed")}
                      disabled={submittingProgress}
                      className="w-full px-4 py-2 bg-gray-700 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
                    >
                      {submittingProgress && (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      )}
                      标记为已完成
                    </button>
                  </div>
                )}

                {/* 留言回复区 */}
                <div className="bg-white border border-gray-200 rounded-lg p-4">
                  <h3 className="text-sm font-semibold text-lw-black mb-3 flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-lw-accent" />
                    留言回复
                  </h3>

                  {order.replies && order.replies.length > 0 ? (
                    <div className="space-y-2 mb-3 max-h-48 overflow-y-auto">
                      {order.replies.map((reply) => (
                        <div
                          key={reply.id}
                          className="bg-gray-50 rounded-lg p-2.5"
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-medium text-lw-black">
                              {reply.profiles?.display_name || "系统用户"}
                            </span>
                            <span className="text-[10px] text-gray-400">
                              {formatDate(reply.sent_at)}
                            </span>
                          </div>
                          <p className="text-xs text-gray-600 whitespace-pre-wrap break-words">
                            {reply.content}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-400 text-center py-3 mb-3">
                      暂无回复
                    </p>
                  )}

                  <div className="space-y-2">
                    <textarea
                      value={replyContent}
                      onChange={(e) => setReplyContent(e.target.value)}
                      placeholder="输入回复内容..."
                      rows={3}
                      className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-lw-accent focus:ring-1 focus:ring-lw-accent resize-none"
                    />
                    <button
                      onClick={handleSendReply}
                      disabled={submittingReply}
                      className="w-full px-4 py-2 bg-lw-accent text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
                    >
                      {submittingReply ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          发送中...
                        </>
                      ) : (
                        <>
                          <Send className="w-4 h-4" />
                          发送回复
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
