"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  X,
  Loader2,
  CircleDollarSign,
  CircleCheck,
  CircleX,
  ArrowRight,
  Send,
  MessageSquare,
  History,
  Phone,
  Mail,
  User,
  Calendar,
  FileText,
  Paperclip,
  CircleAlert,
} from "lucide-react";
import {
  getOrderById,
  submitEstimate,
  acceptOrder,
  rejectOrder,
  updateOrderStatus,
  replySite,
} from "@/actions/order-actions";
import { statusLabels, formatDate } from "@/lib/utils";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { InfoRow } from "@/components/shared/InfoRow";
import type {
  Order,
  OrderAttachment,
  OrderReply,
  OperationLog,
} from "@/types/database";

type OrderDetail = Order & {
  attachments?: OrderAttachment[];
  replies?: OrderReply[];
  logs?: OperationLog[];
};

interface OrderDetailModalProps {
  orderId: string;
  onClose: (needRefresh: boolean) => void;
  /** "admin" 显示操作日志和图片放大；"studio" 精简模式 */
  variant?: "admin" | "studio";
}

// 操作日志动作映射
const actionLabels: Record<string, string> = {
  create_order: "创建委托单",
  submit_estimate: "提交估价",
  accept_order: "接单",
  reject_order: "拒单",
  update_status: "更新状态",
};

// 格式化操作日志详情
function formatLogDetails(
  action: string,
  details: Record<string, unknown>
): string {
  if (!details) return "";
  try {
    switch (action) {
      case "submit_estimate":
        return `估价金额: ¥${details.estimated_price ?? "-"}`;
      case "reject_order":
        return `原因: ${details.reason ?? "-"}`;
      case "update_status":
        return `新状态: ${
          statusLabels[(details.new_status as string) ?? ""] ??
          details.new_status
        }`;
      case "create_order":
        return `客户: ${details.customer_name ?? "-"}`;
      default:
        return JSON.stringify(details);
    }
  } catch {
    return "";
  }
}

export default function OrderDetailModal({
  orderId,
  onClose,
  variant = "admin",
}: OrderDetailModalProps) {
  const showLogs = variant === "admin";
  const showImageEnlarge = variant === "admin";

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

  // 图片放大
  const [enlargedImage, setEnlargedImage] = useState<string | null>(null);

  // 操作反馈
  const [actionMessage, setActionMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // setTimeout 引用，组件卸载时清理，防止内存泄漏
  const actionMessageTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 数据是否已变更
  const [dataChanged, setDataChanged] = useState(false);

  // 刷新触发器
  const [refreshKey, setRefreshKey] = useState(0);

  // 清理定时器
  const clearActionMessageTimer = useCallback(() => {
    if (actionMessageTimerRef.current) {
      clearTimeout(actionMessageTimerRef.current);
      actionMessageTimerRef.current = null;
    }
  }, []);

  // 显示操作反馈（带自动清理）
  const showActionMessage = useCallback(
    (type: "success" | "error", text: string) => {
      clearActionMessageTimer();
      setActionMessage({ type, text });
      actionMessageTimerRef.current = setTimeout(() => {
        setActionMessage(null);
        actionMessageTimerRef.current = null;
      }, 3000);
    },
    [clearActionMessageTimer]
  );

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

  // ESC 关闭弹窗 & 锁定滚动
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape" && (!showImageEnlarge || !enlargedImage)) {
        onClose(dataChanged);
      }
    };
    document.addEventListener("keydown", handleEsc);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleEsc);
      document.body.style.overflow = "";
    };
  }, [enlargedImage, onClose, dataChanged, showImageEnlarge]);

  // 组件卸载时清理定时器，防止内存泄漏
  useEffect(() => {
    return () => {
      clearActionMessageTimer();
    };
  }, [clearActionMessageTimer]);

  const handleClose = () => {
    onClose(dataChanged);
  };

  const refreshDetail = () => {
    setLoading(true);
    setRefreshKey((k) => k + 1);
  };

  // ==================== 估价提交 ====================
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

  // ==================== 接单 ====================
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

  // ==================== 拒单 ====================
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

  // ==================== 更新进度 ====================
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

  // ==================== 发送回复 ====================
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

  return (
    <>
      {/* 遮罩层 */}
      <div
        className="fixed inset-0 bg-black/50 z-50 flex items-start sm:items-center justify-center p-0 sm:p-4 overflow-y-auto"
        onClick={(e) => {
          if (e.target === e.currentTarget) handleClose();
        }}
      >
        {/* 弹窗主体 */}
        <div
          className="bg-white w-full sm:max-w-5xl sm:rounded-xl shadow-xl min-h-screen sm:min-h-0 sm:max-h-[90vh] flex flex-col my-0 sm:my-8"
          role="dialog"
          aria-modal="true"
          aria-labelledby="order-detail-modal-title"
        >
          {/* 弹窗头部 */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white sm:rounded-t-xl z-10">
            <div className="flex items-center gap-3">
              <h2
                id="order-detail-modal-title"
                className="text-lg font-bold text-lw-black"
              >
                委托单详情
              </h2>
              {order && (
                <span className="text-sm text-gray-400">
                  {order.order_no}
                </span>
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
                {/* ============ 左侧：订单信息 ============ */}
                <div className="lg:col-span-3 space-y-5">
                  {/* 基本信息 */}
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h3 className="text-sm font-semibold text-lw-black mb-3 flex items-center gap-2">
                      <FileText className="w-4 h-4 text-lw-accent" />
                      基本信息
                    </h3>
                    <div className="grid grid-cols-2 gap-x-4">
                      <InfoRow icon={FileText} label="订单号" value={order.order_no} />
                      <div className="flex items-start gap-2.5 py-2">
                        <Calendar className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-gray-400 mb-0.5">状态</p>
                          <StatusBadge status={order.status} />
                        </div>
                      </div>
                      <InfoRow
                        icon={Calendar}
                        label="提交时间"
                        value={formatDate(order.created_at)}
                      />
                      <InfoRow
                        icon={FileText}
                        label="服务类型"
                        value={order.service_types?.name || "未指定"}
                      />
                      {order.estimated_price !== null && (
                        <InfoRow
                          icon={CircleDollarSign}
                          label="估价金额"
                          value={`¥${order.estimated_price}`}
                        />
                      )}
                      {order.delivery_url && (
                        <InfoRow
                          icon={ArrowRight}
                          label="交付链接"
                          value={order.delivery_url}
                        />
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
                      <InfoRow
                        icon={User}
                        label="姓名"
                        value={order.customer_name}
                      />
                      <InfoRow
                        icon={Phone}
                        label="手机号"
                        value={order.customer_phone}
                      />
                      <InfoRow
                        icon={Mail}
                        label="邮箱"
                        value={order.customer_email}
                      />
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
                              className={`group relative aspect-square bg-white rounded-lg border border-gray-200 overflow-hidden ${
                                showImageEnlarge && isImage
                                  ? "cursor-pointer hover:border-lw-accent transition-colors"
                                  : ""
                              }`}
                              onClick={() =>
                                showImageEnlarge &&
                                isImage &&
                                setEnlargedImage(att.file_path)
                              }
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
                              {showImageEnlarge && (
                                <div className="absolute inset-x-0 bottom-0 bg-black/60 text-white text-[10px] px-1 py-0.5 truncate opacity-0 group-hover:opacity-100 transition-opacity">
                                  {att.file_name}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* 操作日志（仅 admin 模式显示） */}
                  {showLogs && order.logs && order.logs.length > 0 && (
                    <div className="bg-gray-50 rounded-lg p-4">
                      <h3 className="text-sm font-semibold text-lw-black mb-3 flex items-center gap-2">
                        <History className="w-4 h-4 text-lw-accent" />
                        操作日志
                      </h3>
                      <div className="space-y-2">
                        {order.logs.map((log, index) => (
                          <div
                            key={log.id}
                            className="flex items-start gap-2.5 text-sm"
                          >
                            <div className="flex flex-col items-center flex-shrink-0">
                              <div className="w-2 h-2 rounded-full bg-lw-accent mt-1.5" />
                              {index < order.logs!.length - 1 && (
                                <div className="w-px h-6 bg-gray-200 mt-1" />
                              )}
                            </div>
                            <div className="flex-1 pb-1">
                              <span className="text-lw-black font-medium">
                                {actionLabels[log.action] || log.action}
                              </span>
                              <span className="text-gray-400 ml-2 text-xs">
                                {formatDate(log.created_at)}
                              </span>
                              {log.details && (
                                <p className="text-xs text-gray-500 mt-0.5">
                                  {formatLogDetails(log.action, log.details)}
                                </p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* ============ 右侧：操作区 ============ */}
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
                              onChange={(e) =>
                                setRejectReason(e.target.value)
                              }
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
                                onChange={(e) =>
                                  setDeliveryUrl(e.target.value)
                                }
                                placeholder="https://..."
                                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-lw-accent focus:ring-1 focus:ring-lw-accent"
                              />
                            </div>
                            <button
                              onClick={() =>
                                handleUpdateProgress("delivered")
                              }
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

                    {/* 历史回复列表 */}
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
                                {reply.reply_type === "email"
                                  ? "邮件"
                                  : reply.reply_type === "sms"
                                  ? "短信"
                                  : "站内"}
                                · {formatDate(reply.sent_at)}
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

                    {/* 新回复输入 */}
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

      {/* 图片放大查看（仅 admin 模式） */}
      {showImageEnlarge && enlargedImage && (
        <div
          className="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center p-4"
          onClick={() => setEnlargedImage(null)}
        >
          <button
            className="absolute top-4 right-4 p-2 text-white hover:bg-white/10 rounded-lg cursor-pointer"
            onClick={() => setEnlargedImage(null)}
          >
            <X className="w-6 h-6" />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={enlargedImage}
            alt="附件大图"
            className="max-w-full max-h-full object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}
