"use client";

import { useState } from "react";
import {
  Search,
  Loader2,
  Package,
  Calendar,
  User,
  Phone,
  Mail,
  MessageSquare,
  FileText,
  CircleCheck,
} from "lucide-react";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import Button from "@/components/ui/Button";
import { queryOrderByNo } from "@/actions/order-actions";
import { statusLabels, statusColors, formatDate } from "@/lib/utils";
import type { Order, OrderAttachment, OrderReply, OrderStatus } from "@/types/database";

type QueryResult = Order & {
  attachments?: OrderAttachment[];
  replies?: OrderReply[];
};

export default function OrderQueryPage() {
  const [orderNo, setOrderNo] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<QueryResult | null>(null);

  const handleQuery = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setResult(null);

    if (!orderNo.trim()) {
      setError("请输入委托单号");
      return;
    }
    if (!phone.trim()) {
      setError("请输入手机号");
      return;
    }
    if (!/^1[3-9]\d{9}$/.test(phone)) {
      setError("请输入有效的手机号");
      return;
    }

    setLoading(true);
    try {
      const res = await queryOrderByNo(orderNo.trim(), phone.trim());
      if (res.success && res.data) {
        setResult(res.data);
      } else {
        setError(res.error || "查询失败");
      }
    } catch {
      setError("查询时发生未知错误");
    } finally {
      setLoading(false);
    }
  };

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
    <div className="min-h-screen flex flex-col bg-lw-gray">
      <Header />

      <main className="flex-1 max-w-3xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* 页面标题 */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-lw-black">查询委托</h1>
          <p className="mt-2 text-sm text-gray-500">
            输入委托单号和手机号查询您的委托进度
          </p>
        </div>

        {/* 查询表单 */}
        <form
          onSubmit={handleQuery}
          className="bg-white rounded-2xl shadow-sm p-6 sm:p-8 mb-8"
        >
          <div className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-lw-black mb-1.5">
                委托单号
              </label>
              <div className="relative">
                <Package className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={orderNo}
                  onChange={(e) => setOrderNo(e.target.value)}
                  placeholder="如 LW20250101001"
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-lw-accent focus:border-transparent transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-lw-black mb-1.5">
                手机号
              </label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="tel"
                  maxLength={11}
                  value={phone}
                  onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
                  placeholder="请输入提交委托时填写的手机号"
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-lw-accent focus:border-transparent transition"
                />
              </div>
            </div>
          </div>

          {error && (
            <div className="mt-4 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
              {error}
            </div>
          )}

          <Button
            type="submit"
            variant="primary"
            className="w-full mt-6"
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                查询中...
              </>
            ) : (
              <>
                <Search className="w-4 h-4 mr-2" />
                查询委托
              </>
            )}
          </Button>
        </form>

        {/* 查询结果 */}
        {result && (
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            {/* 结果头部 */}
            <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-3">
                  <h3 className="text-lg font-bold text-lw-black">
                    {result.order_no}
                  </h3>
                  {renderStatusBadge(result.status)}
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  创建时间：{formatDate(result.created_at)}
                </p>
              </div>
            </div>

            {/* 详细信息 */}
            <div className="px-6 py-5 space-y-4">
              {/* 客户信息 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex items-center gap-2.5">
                  <User className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-gray-400">客户姓名</p>
                    <p className="text-sm text-lw-black">
                      {result.customer_name}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2.5">
                  <Phone className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-gray-400">联系电话</p>
                    <p className="text-sm text-lw-black">
                      {result.customer_phone}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2.5">
                  <Mail className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-gray-400">邮箱</p>
                    <p className="text-sm text-lw-black break-all">
                      {result.customer_email}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2.5">
                  <Calendar className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-gray-400">服务类型</p>
                    <p className="text-sm text-lw-black">
                      {result.service_types?.name || "未指定"}
                    </p>
                  </div>
                </div>
              </div>

              {/* 需求描述 */}
              <div className="pt-4 border-t border-gray-50">
                <div className="flex items-start gap-2.5">
                  <FileText className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-xs text-gray-400 mb-1">需求描述</p>
                    <p className="text-sm text-lw-black whitespace-pre-wrap">
                      {result.requirements}
                    </p>
                  </div>
                </div>
              </div>

              {/* 估价信息 */}
              {result.estimated_price !== null && (
                <div className="pt-4 border-t border-gray-50">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">估价金额</span>
                    <span className="text-lg font-bold text-lw-accent">
                      ¥{result.estimated_price}
                    </span>
                  </div>
                  {result.estimate_notes && (
                    <p className="text-xs text-gray-400 mt-2">
                      备注：{result.estimate_notes}
                    </p>
                  )}
                </div>
              )}

              {/* 交付链接 */}
              {result.delivery_url && (
                <div className="pt-4 border-t border-gray-50">
                  <div className="flex items-center gap-2.5">
                    <CircleCheck className="w-4 h-4 text-green-500 flex-shrink-0" />
                    <div>
                      <p className="text-xs text-gray-400">交付链接</p>
                      <a
                        href={result.delivery_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-lw-accent hover:underline break-all"
                      >
                        {result.delivery_url}
                      </a>
                    </div>
                  </div>
                </div>
              )}

              {/* 回复记录 */}
              {result.replies && result.replies.length > 0 && (
                <div className="pt-4 border-t border-gray-50">
                  <div className="flex items-center gap-2 mb-3">
                    <MessageSquare className="w-4 h-4 text-gray-400" />
                    <span className="text-xs font-medium text-gray-500">
                      回复记录（{result.replies.length}）
                    </span>
                  </div>
                  <div className="space-y-3">
                    {result.replies.map((reply) => (
                      <div
                        key={reply.id}
                        className="px-4 py-3 bg-gray-50 rounded-lg"
                      >
                        <p className="text-sm text-lw-black whitespace-pre-wrap">
                          {reply.content}
                        </p>
                        <p className="text-xs text-gray-400 mt-2">
                          {formatDate(reply.sent_at)}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
