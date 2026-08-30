"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Bell,
  Send,
  Mail,
  Loader2,
  CheckCircle,
  AlertCircle,
  History,
  Pencil,
  Trash2,
  X,
  Package,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import {
  sendNotification,
  sendEmailBroadcast,
  listSentNotifications,
  listEmailSendHistory,
  listOrderNotifications,
  updateSentNotification,
  deleteSentNotification,
} from "@/actions/notification-actions";
import NoticeAudienceSelector, {
  DEFAULT_TARGET_VALUE,
  type NoticeTargetValue,
} from "./NoticeAudienceSelector";
import type { NotificationTargetRole } from "@/lib/notification-utils";
import type { EmailHistoryRow } from "@/lib/notification-utils";
import { USER_TAG_LABELS, type UserTagKey } from "@/lib/user-tags";
import { formatDate } from "@/lib/utils";
import { useLanguage } from "@/components/i18n/LanguageProvider";

interface SentRecord {
  id: string;
  batch_id: string;
  title: string;
  content: string;
  target_role: NotificationTargetRole;
  target_tags: string[] | null;
  target_user_ids: string[] | null;
  recipient_count: number;
  created_at: string;
}

interface OrderNotifyRecord {
  batch_id: string;
  order_no: string;
  title: string;
  content: string;
  recipient_count: number;
  created_at: string;
}

// 目标群体标签的 i18n key（渲染处用 t() 转换，避免模块级常量引用 hook）
const TARGET_LABEL_KEYS: Record<NotificationTargetRole, string> = {
  all: "admin.notice.targetAll",
  admin: "admin.notice.targetAdmin",
  user: "admin.notice.targetUser",
  tag: "admin.notice.targetTag",
  users: "admin.notice.targetUsers",
};

interface ToastState {
  type: "success" | "error";
  message: string;
}

export default function NotificationManagement({
  isSuperAdmin = false,
}: {
  isSuperAdmin?: boolean;
}) {
  const { t } = useLanguage();

  // 发送通知表单
  const [noticeTarget, setNoticeTarget] = useState<NoticeTargetValue>(
    DEFAULT_TARGET_VALUE
  );
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [sending, setSending] = useState(false);

  // 发送邮件表单
  const [emailTarget, setEmailTarget] = useState<NoticeTargetValue>(
    DEFAULT_TARGET_VALUE
  );
  const [emailSubject, setEmailSubject] = useState("");
  const [emailContent, setEmailContent] = useState("");
  const [emailSending, setEmailSending] = useState(false);

  // 历史记录
  const [history, setHistory] = useState<SentRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  // 邮件发送历史
  const [emailHistory, setEmailHistory] = useState<EmailHistoryRow[]>([]);
  const [emailHistoryLoading, setEmailHistoryLoading] = useState(true);

  // 委托单通知历史（新窗口）
  const [orderHistory, setOrderHistory] = useState<OrderNotifyRecord[]>([]);
  const [orderHistoryLoading, setOrderHistoryLoading] = useState(true);
  const [orderHistoryExpanded, setOrderHistoryExpanded] = useState(false);

  // 编辑弹窗
  const [editing, setEditing] = useState<SentRecord | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  // 删除确认弹窗
  const [deleting, setDeleting] = useState<SentRecord | null>(null);
  const [deleteSaving, setDeleteSaving] = useState(false);

  // Toast
  const [toast, setToast] = useState<ToastState | null>(null);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(timer);
  }, [toast]);

  // 目标群体展示名（历史记录/发送结果）
  const renderTargetLabel = useCallback(
    (input: {
      target_role: NotificationTargetRole;
      target_tags: string[] | null;
      target_user_ids: string[] | null;
    }) => {
      if (input.target_role === "tag") {
        const names = (input.target_tags || [])
          .map((tag) => USER_TAG_LABELS[tag as UserTagKey] ?? tag)
          .join("、");
        return `${t("admin.notice.targetTag")}（${names}）`;
      }
      if (input.target_role === "users") {
        return `${t("admin.notice.targetUsers")}（${
          input.target_user_ids?.length ?? 0}人）`;
      }
      return t(TARGET_LABEL_KEYS[input.target_role]);
    },
    [t]
  );

  // 加载发送历史
  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const result = await listSentNotifications({ limit: 20 });
      if (result.success) {
        setHistory((result.data || []) as SentRecord[]);
      }
    } catch (err) {
      console.error("加载发送记录异常:", err);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  // 加载邮件发送历史
  const loadEmailHistory = useCallback(async () => {
    setEmailHistoryLoading(true);
    try {
      const result = await listEmailSendHistory({ limit: 20 });
      if (result.success) {
        setEmailHistory((result.data || []) as EmailHistoryRow[]);
      }
    } catch (err) {
      console.error("加载邮件发送记录异常:", err);
    } finally {
      setEmailHistoryLoading(false);
    }
  }, []);

  // 加载委托单通知历史（新窗口）
  const loadOrderHistory = useCallback(async () => {
    setOrderHistoryLoading(true);
    try {
      const result = await listOrderNotifications({ limit: 50 });
      if (result.success) {
        setOrderHistory((result.data || []) as OrderNotifyRecord[]);
      }
    } catch (err) {
      console.error("加载委托单通知记录异常:", err);
    } finally {
      setOrderHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadHistory();
    loadEmailHistory();
    loadOrderHistory();
  }, [loadHistory, loadEmailHistory, loadOrderHistory]);

  // 打开编辑弹窗
  const openEdit = (record: SentRecord) => {
    setEditing(record);
    setEditTitle(record.title);
    setEditContent(record.content);
  };

  // 保存修改（静默修改：仅改标题/内容，不影响已读状态）
  const handleSaveEdit = async () => {
    if (!editing?.batch_id || editSaving) return;
    if (!editTitle.trim()) {
      setToast({ type: "error", message: t("admin.notice.err.titleRequired") });
      return;
    }
    if (!editContent.trim()) {
      setToast({ type: "error", message: t("admin.notice.err.contentRequired") });
      return;
    }

    setEditSaving(true);
    try {
      const result = await updateSentNotification({
        batchId: editing.batch_id,
        title: editTitle,
        content: editContent,
      });
      if (result.success) {
        setToast({ type: "success", message: t("admin.notice.err.silentUpdated") });
        setEditing(null);
        loadHistory();
      } else {
        setToast({ type: "error", message: result.error || t("admin.notice.err.updateFailed") });
      }
    } catch (err) {
      console.error("修改公告异常:", err);
      setToast({ type: "error", message: t("admin.notice.err.updateUnknown") });
    } finally {
      setEditSaving(false);
    }
  };

  // 确认删除
  const handleConfirmDelete = async () => {
    if (!deleting?.batch_id || deleteSaving) return;

    setDeleteSaving(true);
    try {
      const result = await deleteSentNotification({ batchId: deleting.batch_id });
      if (result.success) {
        setToast({ type: "success", message: t("admin.notice.err.deleteSuccess") });
        setDeleting(null);
        loadHistory();
      } else {
        setToast({ type: "error", message: result.error || t("admin.notice.err.deleteFailed") });
      }
    } catch (err) {
      console.error("删除公告异常:", err);
      setToast({ type: "error", message: t("admin.notice.err.deleteUnknown") });
    } finally {
      setDeleteSaving(false);
    }
  };

  // 发送通知
  const handleSend = async () => {
    if (sending) return;

    if (!title.trim()) {
      setToast({ type: "error", message: t("admin.notice.err.titleRequired") });
      return;
    }
    if (!content.trim()) {
      setToast({ type: "error", message: t("admin.notice.err.contentRequired") });
      return;
    }
    if (noticeTarget.targetRole === "tag" && noticeTarget.tags.length === 0) {
      setToast({ type: "error", message: t("admin.notice.err.tagRequired") });
      return;
    }
    if (noticeTarget.targetRole === "users" && noticeTarget.userIds.length === 0) {
      setToast({ type: "error", message: t("admin.notice.err.usersRequired") });
      return;
    }

    setSending(true);
    try {
      const result = await sendNotification({
        targetRole: noticeTarget.targetRole,
        title,
        content,
        tags: noticeTarget.targetRole === "tag" ? noticeTarget.tags : undefined,
        userIds:
          noticeTarget.targetRole === "users" ? noticeTarget.userIds : undefined,
      });
      if (result.success) {
        setToast({
          type: "success",
          message: `已发送给${renderTargetLabel({
            target_role: noticeTarget.targetRole,
            target_tags: noticeTarget.tags,
            target_user_ids: noticeTarget.userIds,
          })}（${result.count ?? 0}人）`,
        });
        setTitle("");
        setContent("");
        loadHistory();
      } else {
        setToast({ type: "error", message: result.error || t("admin.notice.err.sendFailed") });
      }
    } catch (err) {
      console.error("发送通知异常:", err);
      setToast({ type: "error", message: t("admin.notice.err.sendUnknown") });
    } finally {
      setSending(false);
    }
  };

  // 发送邮件
  const handleSendEmail = async () => {
    if (emailSending) return;

    if (!emailSubject.trim()) {
      setToast({ type: "error", message: t("admin.notice.err.subjectRequired") });
      return;
    }
    if (!emailContent.trim()) {
      setToast({ type: "error", message: t("admin.notice.err.emailContentRequired") });
      return;
    }
    if (emailTarget.targetRole === "tag" && emailTarget.tags.length === 0) {
      setToast({ type: "error", message: t("admin.notice.err.tagRequired") });
      return;
    }
    if (emailTarget.targetRole === "users" && emailTarget.userIds.length === 0) {
      setToast({ type: "error", message: t("admin.notice.err.usersRequired") });
      return;
    }

    setEmailSending(true);
    try {
      const result = await sendEmailBroadcast({
        targetRole: emailTarget.targetRole,
        subject: emailSubject,
        content: emailContent,
        tags: emailTarget.targetRole === "tag" ? emailTarget.tags : undefined,
        userIds:
          emailTarget.targetRole === "users" ? emailTarget.userIds : undefined,
      });
      if (result.success) {
        setToast({
          type: "success",
          message: `${t("admin.notice.emailSuccess")}：${renderTargetLabel({
            target_role: emailTarget.targetRole,
            target_tags: emailTarget.tags,
            target_user_ids: emailTarget.userIds,
          })}（成功 ${result.successCount}/${result.count}）`,
        });
        setEmailSubject("");
        setEmailContent("");
        loadEmailHistory();
      } else {
        setToast({
          type: "error",
          message:
            result.error === "未配置 RESEND_API_KEY，邮件服务不可用"
              ? t("admin.notice.err.emailServiceUnavailable")
              : result.error || t("admin.notice.err.emailSendFailed"),
        });
      }
    } catch (err) {
      console.error("发送邮件异常:", err);
      setToast({ type: "error", message: t("admin.notice.err.emailSendUnknown") });
    } finally {
      setEmailSending(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Toast */}
      {toast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[60] w-full max-w-sm px-4">
          <div
            className={`flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg ${
              toast.type === "success"
                ? "bg-green-50 border border-green-200 text-green-700"
                : "bg-red-50 border border-red-200 text-red-700"
            }`}
          >
            {toast.type === "success" ? (
              <CheckCircle className="w-5 h-5 flex-shrink-0 text-green-500" />
            ) : (
              <AlertCircle className="w-5 h-5 flex-shrink-0 text-red-500" />
            )}
            <span className="text-sm font-medium flex-1">{toast.message}</span>
          </div>
        </div>
      )}

      {/* 标题 */}
      <div>
        <h1 className="text-xl font-bold text-lw-black">{t("admin.notice.title")}</h1>
        <p className="text-sm text-gray-400 mt-1">
          {t("admin.notice.subtitle")}
        </p>
      </div>

      {/* 发送通知表单 */}
      <div className="bg-white rounded-2xl shadow-sm">
        <div className="p-4 sm:p-5 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-lw-accent" />
            <h2 className="text-sm font-semibold text-lw-black">{t("admin.notice.send")}</h2>
          </div>
        </div>

        <div className="p-4 sm:p-5 space-y-4">
          {/* 目标群体选择 */}
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-2">
              {t("admin.notice.target")}
            </label>
            <NoticeAudienceSelector
              value={noticeTarget}
              onChange={setNoticeTarget}
              disabled={sending}
            />
          </div>

          {/* 标题 */}
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-2">
              {t("admin.notice.titleLabel")}
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={100}
              placeholder={t("admin.notice.titlePh")}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-lw-accent focus:ring-1 focus:ring-lw-accent transition-colors"
            />
          </div>

          {/* 内容 */}
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-2">
              {t("admin.notice.contentLabel")}
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              maxLength={2000}
              rows={5}
              placeholder={t("admin.notice.contentPh")}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-lw-accent focus:ring-1 focus:ring-lw-accent transition-colors resize-y"
            />
            <p className="text-xs text-gray-400 mt-1 text-right">
              {content.length}/2000
            </p>
          </div>

          {/* 发送按钮 */}
          <div className="flex justify-end">
            <button
              onClick={handleSend}
              disabled={sending}
              className="inline-flex items-center gap-1.5 px-5 py-2 bg-lw-accent text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {sending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              {sending ? t("admin.notice.sending") : t("admin.notice.send")}
            </button>
          </div>
        </div>
      </div>

      {/* 发送邮件表单 */}
      <div className="bg-white rounded-2xl shadow-sm">
        <div className="p-4 sm:p-5 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Mail className="w-5 h-5 text-lw-accent" />
            <h2 className="text-sm font-semibold text-lw-black">{t("admin.notice.emailSend")}</h2>
          </div>
        </div>

        <div className="p-4 sm:p-5 space-y-4">
          {/* 目标群体选择 */}
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-2">
              {t("admin.notice.target")}
            </label>
            <NoticeAudienceSelector
              value={emailTarget}
              onChange={setEmailTarget}
              disabled={emailSending}
            />
          </div>

          {/* 邮件主题 */}
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-2">
              {t("admin.notice.emailSubjectLabel")}
            </label>
            <input
              type="text"
              value={emailSubject}
              onChange={(e) => setEmailSubject(e.target.value)}
              maxLength={100}
              placeholder={t("admin.notice.emailSubjectPh")}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-lw-accent focus:ring-1 focus:ring-lw-accent transition-colors"
            />
          </div>

          {/* 邮件内容 */}
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-2">
              {t("admin.notice.emailContentLabel")}
            </label>
            <textarea
              value={emailContent}
              onChange={(e) => setEmailContent(e.target.value)}
              maxLength={2000}
              rows={5}
              placeholder={t("admin.notice.emailContentPh")}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-lw-accent focus:ring-1 focus:ring-lw-accent transition-colors resize-y"
            />
            <p className="text-xs text-gray-400 mt-1 text-right">
              {emailContent.length}/2000
            </p>
          </div>

          {/* 发送按钮 */}
          <div className="flex justify-end">
            <button
              onClick={handleSendEmail}
              disabled={emailSending}
              className="inline-flex items-center gap-1.5 px-5 py-2 bg-lw-accent text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {emailSending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Mail className="w-4 h-4" />
              )}
              {emailSending ? t("admin.notice.emailSending") : t("admin.notice.emailSend")}
            </button>
          </div>
        </div>
      </div>

      {/* 发送历史 */}
      <div className="bg-white rounded-2xl shadow-sm">
        <div className="p-4 sm:p-5 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-lw-accent" />
            <h2 className="text-sm font-semibold text-lw-black">{t("admin.notice.history")}</h2>
          </div>
        </div>

        {historyLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-5 h-5 text-lw-accent animate-spin" />
            <span className="ml-2 text-sm text-gray-400">{t("admin.notice.loading")}</span>
          </div>
        ) : history.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-400">
            <Bell className="w-10 h-10 mb-2 text-gray-300" />
            <p className="text-sm">{t("admin.notice.empty")}</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {history.map((record) => (
              <div
                key={record.id}
                className="px-4 sm:px-5 py-3.5 flex items-center justify-between gap-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-lw-black truncate">
                    {record.title}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {renderTargetLabel(record)} · {record.recipient_count}{t("admin.notice.people")}
                    · {formatDate(record.created_at)}
                  </p>
                </div>
                {isSuperAdmin && (
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => openEdit(record)}
                      title={t("admin.notice.editTip")}
                      className="p-1.5 text-gray-400 hover:text-lw-accent hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setDeleting(record)}
                      title={t("admin.notice.deleteTip")}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 邮件发送历史 */}
      <div className="bg-white rounded-2xl shadow-sm">
        <div className="p-4 sm:p-5 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Mail className="w-5 h-5 text-lw-accent" />
            <h2 className="text-sm font-semibold text-lw-black">{t("admin.notice.emailHistory")}</h2>
          </div>
        </div>

        {emailHistoryLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-5 h-5 text-lw-accent animate-spin" />
            <span className="ml-2 text-sm text-gray-400">{t("admin.notice.loading")}</span>
          </div>
        ) : emailHistory.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-400">
            <Mail className="w-10 h-10 mb-2 text-gray-300" />
            <p className="text-sm">{t("admin.notice.emailEmpty")}</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {emailHistory.map((record) => (
              <div
                key={record.id}
                className="px-4 sm:px-5 py-3.5 flex items-center justify-between gap-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-lw-black truncate">
                    {record.subject}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5 truncate">
                    {record.content}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {renderTargetLabel(record)} · {t("admin.notice.emailCount")}：{record.success_count}/{record.failed_count} · {formatDate(record.created_at)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 委托单通知历史（新窗口：估价/接单/拒单/回复/进度等） */}
      <div className="bg-white rounded-2xl shadow-sm">
        <div className="p-4 sm:p-5 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Package className="w-5 h-5 text-lw-accent" />
              <h2 className="text-sm font-semibold text-lw-black">
                {t("admin.notice.orderHistory")}
              </h2>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-lw-accent">
                {t("admin.notice.orderHistoryTag")}
              </span>
            </div>
            {orderHistory.length > 8 && (
              <button
                onClick={() => setOrderHistoryExpanded(!orderHistoryExpanded)}
                className="text-xs text-lw-accent flex items-center gap-0.5 cursor-pointer"
              >
                {orderHistoryExpanded ? (
                  <>
                    {t("admin.notice.collapse")} <ChevronUp className="w-3 h-3" />
                  </>
                ) : (
                  <>
                    {t("admin.notice.expandAll")}（{orderHistory.length}）{" "}
                    <ChevronDown className="w-3 h-3" />
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {orderHistoryLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-5 h-5 text-lw-accent animate-spin" />
            <span className="ml-2 text-sm text-gray-400">{t("admin.notice.loading")}</span>
          </div>
        ) : orderHistory.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-400">
            <Package className="w-10 h-10 mb-2 text-gray-300" />
            <p className="text-sm">{t("admin.notice.orderEmpty")}</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {orderHistory
              .slice(0, orderHistoryExpanded ? orderHistory.length : 8)
              .map((record) => (
                <div
                  key={record.batch_id}
                  className="px-4 sm:px-5 py-3.5 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 text-[10px] font-mono flex-shrink-0">
                        {record.order_no}
                      </span>
                      <p className="text-sm font-medium text-lw-black truncate">
                        {record.title}
                      </p>
                    </div>
                    <p className="text-xs text-gray-400 mt-1 truncate">
                      {record.content}
                    </p>
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <p className="text-xs text-gray-400">
                      {record.recipient_count}{t("admin.notice.people")}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {formatDate(record.created_at)}
                    </p>
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>

      {/* 编辑弹窗（超管静默修改） */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => !editSaving && setEditing(null)}
          />
          <div className="relative bg-white rounded-2xl shadow-xl max-w-md w-full mx-4 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-lw-black">{t("admin.notice.editModalTitle")}</h3>
              <button
                onClick={() => !editSaving && setEditing(null)}
                className="p-1 text-gray-400 hover:text-gray-600 rounded-md cursor-pointer"
                aria-label={t("admin.notice.close")}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-gray-400 mb-4">
              {t("admin.notice.silentHint")}
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1.5">
                  {t("admin.notice.titleLabel")}
                </label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  maxLength={100}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-lw-accent focus:ring-1 focus:ring-lw-accent transition-colors"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1.5">
                  {t("admin.notice.contentLabel")}
                </label>
                <textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  maxLength={2000}
                  rows={5}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-lw-accent focus:ring-1 focus:ring-lw-accent transition-colors resize-y"
                />
                <p className="text-xs text-gray-400 mt-1 text-right">
                  {editContent.length}/2000
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setEditing(null)}
                disabled={editSaving}
                className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer disabled:opacity-50"
              >
                {t("admin.notice.cancel")}
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={editSaving}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-lw-accent text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors cursor-pointer disabled:opacity-50"
              >
                {editSaving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle className="w-4 h-4" />
                )}
                {editSaving ? t("admin.notice.saving") : t("admin.notice.saveEdit")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 删除确认弹窗（超管） */}
      {deleting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => !deleteSaving && setDeleting(null)}
          />
          <div className="relative bg-white rounded-2xl shadow-xl max-w-md w-full mx-4 p-6">
            <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mb-4">
              <Trash2 className="w-6 h-6 text-red-500" />
            </div>
            <h3 className="text-base font-bold text-lw-black">{t("admin.notice.deleteTitle")}</h3>
            <p className="text-sm text-gray-500 mt-2">
              {t("admin.notice.deleteConfirmStart")}{deleting.title}{t("admin.notice.deleteConfirmMid")}
              {deleting.recipient_count}{t("admin.notice.deleteConfirmEnd")}
            </p>
            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setDeleting(null)}
                disabled={deleteSaving}
                className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer disabled:opacity-50"
              >
                {t("admin.notice.cancel")}
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={deleteSaving}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-red-500 text-white text-sm font-medium rounded-lg hover:bg-red-600 transition-colors cursor-pointer disabled:opacity-50"
              >
                {deleteSaving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
                {deleteSaving ? t("admin.notice.deleting") : t("admin.notice.confirmDelete")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
