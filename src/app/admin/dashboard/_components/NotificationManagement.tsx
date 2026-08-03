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
} from "lucide-react";
import {
  sendNotification,
  listSentNotifications,
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

export default function NotificationManagement() {
  // 发送表单
  const [targetRole, setTargetRole] = useState<NotificationTargetRole>("all");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [sending, setSending] = useState(false);

  // 历史记录
  const [history, setHistory] = useState<SentRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);

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
                <div className="min-w-0">
                  <p className="text-sm font-medium text-lw-black truncate">
                    {record.title}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {targetLabels[record.target_role]} · {record.recipient_count}人
                    · {formatDate(record.created_at)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
