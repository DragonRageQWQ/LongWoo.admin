"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Bell,
  Send,
  Loader2,
  CheckCircle,
  AlertCircle,
  Users,
  Shield,
  User,
  History,
  Pencil,
  Trash2,
  X,
} from "lucide-react";
import {
  sendNotification,
  listSentNotifications,
  updateSentNotification,
  deleteSentNotification,
} from "@/actions/notification-actions";
import type { NotificationTargetRole } from "@/lib/notification-utils";
import { formatDate } from "@/lib/utils";

// 目标群体选项
const targetOptions: Array<{
  value: NotificationTargetRole;
  label: string;
  description: string;
  icon: React.ElementType;
}> = [
  {
    value: "all",
    label: "全体用户",
    description: "所有已注册用户（含管理员）",
    icon: Users,
  },
  {
    value: "admin",
    label: "全体管理员",
    description: "所有管理员",
    icon: Shield,
  },
  {
    value: "user",
    label: "全体普通成员",
    description: "所有普通用户",
    icon: User,
  },
];

interface SentRecord {
  id: string;
  batch_id: string | null;
  title: string;
  target_role: NotificationTargetRole;
  recipient_count: number;
  created_at: string;
}

const targetLabels: Record<NotificationTargetRole, string> = {
  all: "全体用户",
  admin: "全体管理员",
  user: "全体普通成员",
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
  // 发送表单
  const [targetRole, setTargetRole] = useState<NotificationTargetRole>("all");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [sending, setSending] = useState(false);

  // 历史记录
  const [history, setHistory] = useState<SentRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);

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

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadHistory();
  }, [loadHistory]);

  // 打开编辑弹窗
  const openEdit = (record: SentRecord) => {
    if (!record.batch_id) {
      setToast({ type: "error", message: "该记录无批次信息，无法修改" });
      return;
    }
    setEditing(record);
    setEditTitle(record.title);
    setEditContent("");
  };

  // 保存修改（静默修改：仅改标题/内容，不影响已读状态）
  const handleSaveEdit = async () => {
    if (!editing?.batch_id || editSaving) return;
    if (!editTitle.trim()) {
      setToast({ type: "error", message: "请输入标题" });
      return;
    }
    if (!editContent.trim()) {
      setToast({ type: "error", message: "请输入内容" });
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
        setToast({ type: "success", message: "公告已静默修改" });
        setEditing(null);
        loadHistory();
      } else {
        setToast({ type: "error", message: result.error || "修改失败" });
      }
    } catch (err) {
      console.error("修改公告异常:", err);
      setToast({ type: "error", message: "修改时发生未知错误" });
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
        setToast({ type: "success", message: "公告已删除" });
        setDeleting(null);
        loadHistory();
      } else {
        setToast({ type: "error", message: result.error || "删除失败" });
      }
    } catch (err) {
      console.error("删除公告异常:", err);
      setToast({ type: "error", message: "删除时发生未知错误" });
    } finally {
      setDeleteSaving(false);
    }
  };

  // 发送
  const handleSend = async () => {
    if (sending) return;

    if (!title.trim()) {
      setToast({ type: "error", message: "请输入标题" });
      return;
    }
    if (!content.trim()) {
      setToast({ type: "error", message: "请输入内容" });
      return;
    }

    setSending(true);
    try {
      const result = await sendNotification({ targetRole, title, content });
      if (result.success) {
        setToast({
          type: "success",
          message: `已发送给${targetLabels[targetRole]}（${result.count ?? 0}人）`,
        });
        setTitle("");
        setContent("");
        loadHistory();
      } else {
        setToast({ type: "error", message: result.error || "发送失败" });
      }
    } catch (err) {
      console.error("发送通知异常:", err);
      setToast({ type: "error", message: "发送时发生未知错误" });
    } finally {
      setSending(false);
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
        <h1 className="text-xl font-bold text-lw-black">通知管理</h1>
        <p className="text-sm text-gray-400 mt-1">
          向全体用户、管理员或普通成员发送通知与站内信
        </p>
      </div>

      {/* 发送表单 */}
      <div className="bg-white rounded-2xl shadow-sm">
        <div className="p-4 sm:p-5 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-lw-accent" />
            <h2 className="text-sm font-semibold text-lw-black">发送通知</h2>
          </div>
        </div>

        <div className="p-4 sm:p-5 space-y-4">
          {/* 目标群体选择 */}
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-2">
              发送对象
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {targetOptions.map((opt) => {
                const Icon = opt.icon;
                const isActive = targetRole === opt.value;
                return (
                  <button
                    key={opt.value}
                    onClick={() => setTargetRole(opt.value)}
                    className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg border text-left transition-colors cursor-pointer ${
                      isActive
                        ? "border-lw-accent bg-blue-50"
                        : "border-gray-200 hover:bg-gray-50"
                    }`}
                  >
                    <Icon
                      className={`w-4 h-4 flex-shrink-0 ${
                        isActive ? "text-lw-accent" : "text-gray-400"
                      }`}
                    />
                    <div className="min-w-0">
                      <p
                        className={`text-sm font-medium ${
                          isActive ? "text-lw-accent" : "text-lw-black"
                        }`}
                      >
                        {opt.label}
                      </p>
                      <p className="text-xs text-gray-400 truncate">
                        {opt.description}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 标题 */}
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-2">
              标题（最多100字）
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={100}
              placeholder="如：系统维护通知"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-lw-accent focus:ring-1 focus:ring-lw-accent transition-colors"
            />
          </div>

          {/* 内容 */}
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-2">
              内容（最多2000字）
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              maxLength={2000}
              rows={5}
              placeholder="请输入通知内容..."
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
              {sending ? "发送中..." : "发送通知"}
            </button>
          </div>
        </div>
      </div>

      {/* 发送历史 */}
      <div className="bg-white rounded-2xl shadow-sm">
        <div className="p-4 sm:p-5 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-lw-accent" />
            <h2 className="text-sm font-semibold text-lw-black">发送历史</h2>
          </div>
        </div>

        {historyLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-5 h-5 text-lw-accent animate-spin" />
            <span className="ml-2 text-sm text-gray-400">加载中...</span>
          </div>
        ) : history.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-400">
            <Bell className="w-10 h-10 mb-2 text-gray-300" />
            <p className="text-sm">暂无发送记录</p>
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
                    {targetLabels[record.target_role]} · {record.recipient_count}人
                    · {formatDate(record.created_at)}
                  </p>
                </div>
                {isSuperAdmin && (
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => openEdit(record)}
                      title="修改公告（静默）"
                      className="p-1.5 text-gray-400 hover:text-lw-accent hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setDeleting(record)}
                      title="删除公告"
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

      {/* 编辑弹窗（超管静默修改） */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => !editSaving && setEditing(null)}
          />
          <div className="relative bg-white rounded-2xl shadow-xl max-w-md w-full mx-4 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-lw-black">修改公告</h3>
              <button
                onClick={() => !editSaving && setEditing(null)}
                className="p-1 text-gray-400 hover:text-gray-600 rounded-md cursor-pointer"
                aria-label="关闭"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-gray-400 mb-4">
              静默修改：仅更新标题与内容，用户已读状态保持不变，不产生新通知。
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1.5">
                  标题（最多100字）
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
                  内容（最多2000字）
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
                取消
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
                {editSaving ? "保存中..." : "保存修改"}
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
            <h3 className="text-base font-bold text-lw-black">删除公告</h3>
            <p className="text-sm text-gray-500 mt-2">
              确定删除「{deleting.title}」吗？该公告将从
              {deleting.recipient_count}位用户的铃铛中移除，且无法恢复。
            </p>
            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={() => setDeleting(null)}
                disabled={deleteSaving}
                className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer disabled:opacity-50"
              >
                取消
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
                {deleteSaving ? "删除中..." : "确认删除"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
