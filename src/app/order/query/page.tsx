"use client";

import { useState, useEffect, useCallback } from "react";
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
  Image as ImageIcon,
  X,
  Paperclip,
  CircleAlert,
} from "lucide-react";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import BottomNav from "@/components/layout/BottomNav";
import Button from "@/components/ui/Button";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { queryOrderByNo } from "@/actions/order-actions";
import { formatDate } from "@/lib/utils";
import { useLanguage } from "@/components/i18n/LanguageProvider";
import type { Order, OrderAttachment, OrderReply } from "@/types/database";

type QueryResult = Order & {
  attachments?: OrderAttachment[];
  replies?: OrderReply[];
};

// 从需求描述中提取【设定图】文件名（静态页下单时写入 requirements，
// 兼容附件上传失败仅剩文件名的历史订单）
function extractDesignRefName(requirements: string | null): string | null {
  if (!requirements) return null;
  const m = requirements.match(/【设定图】([^\n]+)/);
  if (!m) return null;
  const name = m[1].trim();
  return name && name !== "无" ? name : null;
}

export default function OrderQueryPage() {
  const { t } = useLanguage();
  const [orderNo, setOrderNo] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<QueryResult | null>(null);
  // 设定图放大查看
  const [enlargedImage, setEnlargedImage] = useState<string | null>(null);

  // 从需求描述解析【设定图】文件名
  const designRefName = result
    ? extractDesignRefName(result.requirements)
    : null;

  const handleQuery = useCallback(async (no: string, emailAddr: string) => {
    setError(null);
    setResult(null);

    if (!no.trim()) {
      setError(t("query.err.orderNoRequired"));
      return;
    }
    if (!emailAddr.trim()) {
      setError(t("query.err.emailRequired"));
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailAddr.trim())) {
      setError(t("query.err.emailInvalid"));
      return;
    }

    setLoading(true);
    try {
      const res = await queryOrderByNo(no.trim(), emailAddr.trim());
      if (res.success && res.data) {
        setResult(res.data);
      } else {
        setError(res.error || t("query.err.queryFailed"));
      }
    } catch {
      setError(t("query.err.queryUnknown"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  // 支持从个人中心"我的订单"/站内通知携带单号+邮箱跳转并自动查询
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const no = params.get("no") || "";
    const emailAddr = params.get("email") || "";
    if (no) {
      // 预填单号（无邮箱时等待用户输入；有邮箱则自动查询）
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setOrderNo(no);
    }
    if (no && emailAddr) {
      handleQuery(no, emailAddr);
    }
  }, [handleQuery]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleQuery(orderNo, email);
  };

  return (
    <div className="min-h-screen flex flex-col bg-lw-gray">
      <Header />

      <main className="flex-1 max-w-3xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-12 pb-[calc(64px+3rem)]">
        {/* 已废弃提示：订单查询已迁移至新版官网首页 Check 选项卡 */}
        <div className="mb-6 px-4 py-3 bg-amber-50 border border-amber-300 rounded-lg text-sm text-amber-800">
          <strong>此页面已废弃。</strong>{" "}
          订单查询已迁移至新版官网，请前往{" "}
          <a href="/?tab=check" className="underline font-medium hover:text-amber-900">
            新版订单查询
          </a>
          。
        </div>

        {/* 页面标题 */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-lw-black">{t("query.title")}</h1>
          <p className="mt-2 text-sm text-gray-500">
            {t("query.subtitle")}
          </p>
        </div>

        {/* 查询表单 */}
        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-2xl shadow-sm p-6 sm:p-8 mb-8"
        >
          <div className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-lw-black mb-1.5">
                {t("query.orderNoLabel")}
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
                {t("query.emailLabel")}
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t("query.emailPh")}
                  autoComplete="email"
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
                {t("query.loading")}
              </>
            ) : (
              <>
                <Search className="w-4 h-4 mr-2" />
                {t("query.btn")}
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
                  <StatusBadge status={result.status} />
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
                    <p className="text-xs text-gray-400">{t("query.customerName")}</p>
                    <p className="text-sm text-lw-black">
                      {result.customer_name}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2.5">
                  <Phone className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-gray-400">{t("query.phone")}</p>
                    <p className="text-sm text-lw-black">
                      {result.customer_phone || t("query.notSpecified")}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2.5">
                  <Mail className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-gray-400">{t("query.email")}</p>
                    <p className="text-sm text-lw-black break-all">
                      {result.customer_email}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2.5">
                  <Calendar className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-gray-400">{t("query.serviceType")}</p>
                    <p className="text-sm text-lw-black">
                      {result.service_types?.name || t("query.notSpecified")}
                    </p>
                  </div>
                </div>
              </div>

              {/* 需求描述 */}
              <div className="pt-4 border-t border-gray-50">
                <div className="flex items-start gap-2.5">
                  <FileText className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-xs text-gray-400 mb-1">{t("query.desc")}</p>
                    <p className="text-sm text-lw-black whitespace-pre-wrap">
                      {result.requirements}
                    </p>
                  </div>
                </div>
              </div>

              {/* 设定图（附件缩略图 + 点击放大；兼容仅剩文件名的历史订单） */}
              <div className="pt-4 border-t border-gray-50">
                <div className="flex items-start gap-2.5">
                  <ImageIcon className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <p className="text-xs text-gray-400">
                        {t("query.designImage")}
                      </p>
                      {designRefName && (
                        <span className="text-xs text-gray-300 truncate">
                          （{designRefName}）
                        </span>
                      )}
                      {result.attachments && result.attachments.length > 0 && (
                        <span className="text-xs text-gray-300">
                          ({result.attachments.length})
                        </span>
                      )}
                    </div>
                    {result.attachments && result.attachments.length > 0 ? (
                      <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                        {result.attachments.map((att) => {
                          const isImage =
                            att.file_type?.startsWith("image/") ||
                            /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(
                              att.file_name
                            );
                          return (
                            <div
                              key={att.id}
                              className={`group relative aspect-square bg-gray-50 rounded-lg border border-gray-200 overflow-hidden ${
                                isImage
                                  ? "cursor-pointer hover:border-lw-accent transition-colors"
                                  : ""
                              }`}
                              onClick={() =>
                                isImage && setEnlargedImage(att.file_path)
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
                              <div className="absolute inset-x-0 bottom-0 bg-black/60 text-white text-[10px] px-1 py-0.5 truncate opacity-0 group-hover:opacity-100 transition-opacity">
                                {att.file_name}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : designRefName ? (
                      <div className="text-sm text-amber-600 flex items-start gap-2">
                        <CircleAlert className="w-4 h-4 mt-0.5 flex-shrink-0" />
                        <span>{t("query.designImageMissing")}</span>
                      </div>
                    ) : (
                      <p className="text-sm text-gray-400">
                        {t("query.notSpecified")}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* 估价信息 */}
              {result.estimated_price !== null && (
                <div className="pt-4 border-t border-gray-50">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500">{t("query.estimateAmount")}</span>
                    <span className="text-lg font-bold text-lw-accent">
                      ¥{Number(result.estimated_price).toLocaleString('zh-CN')}
                    </span>
                  </div>
                  {result.estimate_notes && (
                    <p className="text-xs text-gray-400 mt-2">
                      {t("query.note")}{result.estimate_notes}
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
                      <p className="text-xs text-gray-400">{t("query.deliveryLink")}</p>
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
                      {t("query.replies")}（{result.replies.length}）
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

      {/* 底部固定导航栏（与首页一致） */}
      <BottomNav />

      {/* 设定图放大查看 */}
      {enlargedImage && (
        <div
          className="fixed inset-0 bg-black/80 z-[60] flex items-center justify-center p-4"
          onClick={() => setEnlargedImage(null)}
        >
          <button
            className="absolute top-4 right-4 p-2 text-white hover:bg-white/10 rounded-lg cursor-pointer"
            onClick={() => setEnlargedImage(null)}
            aria-label="关闭"
          >
            <X className="w-6 h-6" />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={enlargedImage}
            alt={t("query.designImage")}
            className="max-w-full max-h-full object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
