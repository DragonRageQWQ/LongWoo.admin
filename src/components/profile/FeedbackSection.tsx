"use client";

import { useState, useEffect, useCallback } from "react";
import {
  MessageSquare,
  CheckCircle,
  Loader2,
  X,
  Plus,
  Send,
  AlertCircle,
  Lightbulb,
  HelpCircle,
} from "lucide-react";
import {
  submitFeedback,
  listMyFeedback,
  getFeedbackUnreadCount,
  markFeedbackReplyRead,
} from "@/actions/feedback-actions";
import { formatDate } from "@/lib/utils";
import type { FeedbackCategory, FeedbackStatus, UserFeedback } from "@/types/database";

const CATEGORY_OPTIONS: { value: FeedbackCategory; label: string; icon: React.ElementType }[] = [
  { value: "bug", label: "问题反馈", icon: AlertCircle },
  { value: "suggestion", label: "建议", icon: Lightbulb },
  { value: "other", label: "其他", icon: HelpCircle },
];

const STATUS_META: Record<FeedbackStatus, { label: string; className: string }> = {
  pending: { label: "待处理", className: "text-orange-600 bg-orange-50" },
  replied: { label: "已回复", className: "text-blue-600 bg-blue-50" },
  adopted: { label: "已采纳", className: "text-green-600 bg-green-50" },
};

export default function FeedbackSection() {
  // 列表与红标
  const [items, setItems] = useState<UserFeedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);

  // 提交表单
  const [showForm, setShowForm] = useState(false);
  const [category, setCategory] = useState<FeedbackCategory>("suggestion");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  // 展开查看回复的条目 id
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [listResult, unreadResult] = await Promise.all([
        listMyFeedback(20),
        getFeedbackUnreadCount(),
      ]);
      if (listResult.success) {
        setItems((listResult.data || []) as UserFeedback[]);
      } else {
        setError(listResult.error || "加载反馈失败");
      }
      if (unreadResult.success) {
        setUnreadCount(unreadResult.unreadCount ?? 0);
      }
    } catch {
      setError("加载反馈时发生未知错误");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadData();
  }, [loadData]);

  const handleSubmit = async () => {
    setFormError(null);
    setFormSuccess(null);

    if (!title.trim()) {
      setFormError("请输入标题");
      return;
    }
    if (!content.trim()) {
      setFormError("请输入反馈内容");
      return;
    }

    setSubmitting(true);
    try {
      const result = await submitFeedback({ category, title, content });
      if (result.success) {
        setFormSuccess("反馈已提交，感谢您的建议！");
        setTitle("");
        setContent("");
        setShowForm(false);
        await loadData();
      } else {
        setFormError(result.error || "提交失败");
      }
    } catch {
      setFormError("提交时发生未知错误");
    } finally {
      setSubmitting(false);
    }
  };

  // 展开查看回复；若有未读回复则标记已读并更新红标
  const handleExpand = async (item: UserFeedback) => {
    const next = expandedId === item.id ? null : item.id;
    setExpandedId(next);
    if (next && (item.status === "replied" || item.status === "adopted") && !item.reply_read) {
      try {
        const result = await markFeedbackReplyRead(item.id);
        if (result.success) {
          setUnreadCount((prev) => Math.max(0, prev - 1));
          setItems((prev) =>
            prev.map((it) => (it.id === item.id ? { ...it, reply_read: true } : it))
          );
        }
      } catch {
        // 标记失败不阻塞查看
      }
    }
  };

  return (
    <section className="bg-white rounded-2xl shadow-sm border border-gray-50 p-6">
      {/* 栏目标题 + 红标 */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-gray-400" />
          <h3 className="text-sm font-medium text-gray-400">建议与反馈</h3>
          {unreadCount > 0 && (
            <span className="relative flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[11px] font-bold text-white bg-red-500 rounded-full">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </div>
        {!showForm && (
          <button
            type="button"
            onClick={() => {
              setShowForm(true);
              setFormSuccess(null);
              setFormError(null);
            }}
            className="flex items-center gap-1 text-sm text-lw-accent hover:text-blue-700 transition-colors cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            提交反馈
          </button>
        )}
      </div>

      {/* 未读数提示 */}
      {unreadCount > 0 && (
        <p className="mb-4 text-xs text-red-500 flex items-center gap-1">
          <CheckCircle className="w-3.5 h-3.5" />
          您有 {unreadCount} 条反馈收到管理员回复/采纳，点击查看后红标自动消失
        </p>
      )}

      {/* 提交表单 */}
      {showForm && (
        <div className="mb-5 p-4 bg-gray-50 rounded-xl border border-gray-100 space-y-3">
          <div>
            <label className="block text-xs text-gray-500 mb-1">反馈类别</label>
            <div className="flex flex-wrap gap-2">
              {CATEGORY_OPTIONS.map((opt) => {
                const Icon = opt.icon;
                const active = category === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setCategory(opt.value)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border transition-colors cursor-pointer ${
                      active
                        ? "border-lw-accent bg-lw-accent text-white"
                        : "border-gray-200 bg-white text-gray-600 hover:border-lw-accent"
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">标题</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={60}
              placeholder="一句话概括您的问题或建议"
              className="w-full px-3 py-2 text-sm text-lw-black bg-white rounded-lg border border-gray-200 focus:outline-none focus:border-lw-accent focus:ring-1 focus:ring-lw-accent transition-colors disabled:opacity-60"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">详细内容</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              maxLength={2000}
              rows={4}
              placeholder="请详细描述您遇到的问题或建议，便于我们跟进处理"
              className="w-full px-3 py-2 text-sm text-lw-black bg-white rounded-lg border border-gray-200 focus:outline-none focus:border-lw-accent focus:ring-1 focus:ring-lw-accent transition-colors disabled:opacity-60 resize-none"
            />
          </div>

          {formError && (
            <p className="text-xs text-red-500 flex items-center gap-1">
              <X className="w-3 h-3" />
              {formError}
            </p>
          )}
          {formSuccess && (
            <p className="text-xs text-green-600 flex items-center gap-1">
              <CheckCircle className="w-3.5 h-3.5" />
              {formSuccess}
            </p>
          )}

          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className="flex items-center gap-1 px-4 py-2 text-sm font-medium text-white bg-lw-accent rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 cursor-pointer"
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              {submitting ? "提交中..." : "提交反馈"}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                setFormError(null);
              }}
              disabled={submitting}
              className="flex items-center gap-1 px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 cursor-pointer"
            >
              <X className="w-4 h-4" />
              取消
            </button>
          </div>
        </div>
      )}

      {/* 反馈列表 */}
      {loading ? (
        <div className="flex items-center justify-center py-8 text-gray-400">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="ml-2 text-sm">加载中...</span>
        </div>
      ) : error ? (
        <div className="py-6 text-center">
          <p className="text-sm text-red-500">{error}</p>
          <button
            type="button"
            onClick={loadData}
            className="mt-2 text-xs text-lw-accent hover:text-blue-700 cursor-pointer"
          >
            点击重试
          </button>
        </div>
      ) : items.length === 0 ? (
        <div className="py-8 text-center">
          <MessageSquare className="w-8 h-8 text-gray-200 mx-auto" />
          <p className="mt-2 text-sm text-gray-400">
            暂无反馈记录，欢迎提交您的问题或建议
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {items.map((item) => {
            const statusMeta = STATUS_META[item.status];
            const categoryMeta = CATEGORY_OPTIONS.find((c) => c.value === item.category);
            const hasUnreadReply =
              (item.status === "replied" || item.status === "adopted") && !item.reply_read;
            const expanded = expandedId === item.id;
            return (
              <div
                key={item.id}
                className={`border rounded-xl transition-colors ${
                  hasUnreadReply ? "border-red-200 bg-red-50/40" : "border-gray-100"
                }`}
              >
                <button
                  type="button"
                  onClick={() => handleExpand(item)}
                  className="w-full text-left px-4 py-3 cursor-pointer"
                >
                  <div className="flex items-center gap-2">
                    {categoryMeta && <categoryMeta.icon className="w-3.5 h-3.5 text-gray-400" />}
                    <span className="text-sm font-medium text-gray-700 flex-1 truncate">
                      {item.title}
                    </span>
                    {hasUnreadReply && (
                      <span className="w-2 h-2 bg-red-500 rounded-full flex-shrink-0" title="有新回复" />
                    )}
                    <span className={`px-1.5 py-0.5 text-xs rounded flex-shrink-0 ${statusMeta.className}`}>
                      {statusMeta.label}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center justify-between">
                    <span className="text-xs text-gray-400">
                      {formatDate(item.created_at)}
                    </span>
                    {expanded && (
                      <span className="text-[11px] text-lw-accent">收起</span>
                    )}
                  </div>
                </button>

                {expanded && (
                  <div className="px-4 pb-4 space-y-3">
                    <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">
                      {item.content}
                    </p>
                    {item.reply ? (
                      <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
                        <p className="text-xs font-medium text-gray-500 mb-1">
                          {item.status === "adopted" ? "管理员回复（已采纳）" : "管理员回复"}
                          {item.replied_at ? ` · ${formatDate(item.replied_at)}` : ""}
                        </p>
                        <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                          {item.reply}
                        </p>
                      </div>
                    ) : (
                      <p className="text-xs text-gray-400">
                        管理员正在处理中，请耐心等待回复
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
