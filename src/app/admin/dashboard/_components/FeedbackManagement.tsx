"use client";

import { useState, useEffect, useCallback } from "react";
import {
  MessageSquare,
  Loader2,
  CheckCircle,
  AlertCircle,
  Lightbulb,
  HelpCircle,
  Reply,
  X,
  ChevronLeft,
  ChevronRight,
  Search,
} from "lucide-react";
import {
  listAllFeedback,
  replyFeedback,
  type FeedbackListFilter,
} from "@/actions/feedback-actions";
import { formatDate } from "@/lib/utils";
import type { FeedbackCategory, FeedbackStatus, UserFeedback } from "@/types/database";

const PAGE_SIZE = 10;

const CATEGORY_META: Record<FeedbackCategory, { label: string; icon: React.ElementType; className: string }> = {
  bug: { label: "问题反馈", icon: AlertCircle, className: "text-red-600 bg-red-50" },
  suggestion: { label: "建议", icon: Lightbulb, className: "text-amber-600 bg-amber-50" },
  other: { label: "其他", icon: HelpCircle, className: "text-gray-600 bg-gray-100" },
};

const STATUS_META: Record<FeedbackStatus, { label: string; className: string }> = {
  pending: { label: "待处理", className: "text-orange-600 bg-orange-50" },
  replied: { label: "已回复", className: "text-blue-600 bg-blue-50" },
  adopted: { label: "已采纳", className: "text-green-600 bg-green-50" },
};

const STATUS_FILTERS: { value: FeedbackListFilter; label: string }[] = [
  { value: "all", label: "全部" },
  { value: "pending", label: "待处理" },
  { value: "replied", label: "已回复" },
  { value: "adopted", label: "已采纳" },
];

interface ToastState {
  type: "success" | "error";
  message: string;
}

export default function FeedbackManagement() {
  // 列表状态
  const [items, setItems] = useState<UserFeedback[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [statusFilter, setStatusFilter] = useState<FeedbackListFilter>("all");
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 回复弹窗
  const [replying, setReplying] = useState<UserFeedback | null>(null);
  const [replyText, setReplyText] = useState("");
  const [replyStatus, setReplyStatus] = useState<"replied" | "adopted">("replied");
  const [replySaving, setReplySaving] = useState(false);
  const [replyError, setReplyError] = useState<string | null>(null);

  // 详情展开
  const [detailId, setDetailId] = useState<string | null>(null);

  // Toast
  const [toast, setToast] = useState<ToastState | null>(null);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(timer);
  }, [toast]);

  const loadList = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await listAllFeedback({
        offset,
        limit: PAGE_SIZE,
        status: statusFilter,
        search: search,
      });
      if (result.success) {
        setItems((result.data || []) as UserFeedback[]);
        setTotal(result.total ?? 0);
      } else {
        setError(result.error || "加载反馈列表失败");
      }
    } catch {
      setError("加载反馈列表时发生未知错误");
    } finally {
      setLoading(false);
    }
  }, [offset, statusFilter, search]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadList();
  }, [loadList]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;

  const handleSearch = () => {
    setOffset(0);
    setSearch(searchInput.trim());
  };

  const handleOpenReply = (item: UserFeedback) => {
    setReplying(item);
    setReplyText(item.reply || "");
    setReplyStatus(item.status === "adopted" ? "adopted" : "replied");
    setReplyError(null);
  };

  const handleSaveReply = async () => {
    if (!replying) return;
    setReplyError(null);
    if (!replyText.trim()) {
      setReplyError("请输入回复内容");
      return;
    }
    setReplySaving(true);
    try {
      const result = await replyFeedback({
        feedbackId: replying.id,
        reply: replyText,
        status: replyStatus,
      });
      if (result.success) {
        setToast({ type: "success", message: replyStatus === "adopted" ? "已采纳并回复" : "回复成功" });
        setReplying(null);
        await loadList();
      } else {
        setReplyError(result.error || "回复失败");
      }
    } catch {
      setReplyError("回复时发生未知错误");
    } finally {
      setReplySaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-lw-black">反馈管理</h1>
        <p className="text-sm text-gray-400 mt-1">查看用户提交的问题反馈与建议，进行回复或采纳</p>
      </div>

      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-2.5 rounded-lg shadow-lg text-sm font-medium ${
            toast.type === "success" ? "bg-green-600 text-white" : "bg-red-600 text-white"
          }`}
        >
          {toast.message}
        </div>
      )}

      {/* 筛选与搜索 */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex rounded-lg border border-gray-200 bg-white overflow-hidden">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => {
                setStatusFilter(f.value);
                setOffset(0);
              }}
              className={`px-3.5 py-2 text-sm transition-colors cursor-pointer ${
                statusFilter === f.value
                  ? "bg-lw-accent text-white font-medium"
                  : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              {f.label}
              {f.value === "pending" && total > 0 && statusFilter === "pending" && (
                <span className="ml-1 text-xs opacity-90">({total})</span>
              )}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 flex-1 min-w-[200px]">
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSearch();
            }}
            placeholder="搜索标题或内容"
            className="flex-1 px-3 py-2 text-sm bg-white rounded-lg border border-gray-200 focus:outline-none focus:border-lw-accent focus:ring-1 focus:ring-lw-accent transition-colors"
          />
          <button
            type="button"
            onClick={handleSearch}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-lw-accent rounded-lg hover:bg-blue-700 transition-colors cursor-pointer"
          >
            <Search className="w-4 h-4" />
            搜索
          </button>
        </div>
      </div>

      {/* 列表 */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-50">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-gray-400">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="ml-2 text-sm">加载中...</span>
          </div>
        ) : error ? (
          <div className="py-16 text-center">
            <p className="text-sm text-red-500">{error}</p>
            <button
              type="button"
              onClick={loadList}
              className="mt-2 text-xs text-lw-accent hover:text-blue-700 cursor-pointer"
            >
              点击重试
            </button>
          </div>
        ) : items.length === 0 ? (
          <div className="py-16 text-center">
            <MessageSquare className="w-10 h-10 text-gray-200 mx-auto" />
            <p className="mt-3 text-sm text-gray-400">暂无反馈记录</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {items.map((item) => {
              const cat = CATEGORY_META[item.category];
              const CatIcon = cat.icon;
              const statusMeta = STATUS_META[item.status];
              const expanded = detailId === item.id;
              const author = item.profiles;
              return (
                <div key={item.id} className="px-5 py-4">
                  <div className="flex items-start gap-3">
                    <div className={`flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center ${cat.className}`}>
                      <CatIcon className="w-4.5 h-4.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium text-gray-800 truncate">{item.title}</span>
                        <span className={`px-1.5 py-0.5 text-xs rounded ${statusMeta.className}`}>
                          {statusMeta.label}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center gap-3 flex-wrap text-xs text-gray-400">
                        <span>
                          {author?.display_name || "用户"}
                          {author?.uid ? ` (UID ${author.uid})` : ""}
                        </span>
                        <span>{formatDate(item.created_at)}</span>
                        {item.replied_at && <span>回复于 {formatDate(item.replied_at)}</span>}
                      </div>
                      {expanded && (
                        <div className="mt-3 space-y-3">
                          <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">
                            {item.content}
                          </p>
                          {item.reply ? (
                            <div className="p-3 bg-gray-50 rounded-lg border border-gray-100">
                              <p className="text-xs font-medium text-gray-500 mb-1">管理员回复</p>
                              <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                                {item.reply}
                              </p>
                            </div>
                          ) : (
                            <p className="text-xs text-gray-400">尚未回复</p>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="flex-shrink-0 flex flex-col sm:flex-row gap-1.5">
                      <button
                        type="button"
                        onClick={() => setDetailId(expanded ? null : item.id)}
                        className="px-2.5 py-1.5 text-xs text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors cursor-pointer"
                      >
                        {expanded ? "收起" : "详情"}
                      </button>
                      {item.status === "pending" && (
                        <button
                          type="button"
                          onClick={() => handleOpenReply(item)}
                          className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-white bg-lw-accent rounded-lg hover:bg-blue-700 transition-colors cursor-pointer"
                        >
                          <Reply className="w-3 h-3" />
                          回复
                        </button>
                      )}
                      {(item.status === "replied" || item.status === "adopted") && (
                        <button
                          type="button"
                          onClick={() => handleOpenReply(item)}
                          className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors cursor-pointer"
                        >
                          <Reply className="w-3 h-3" />
                          编辑
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* 分页 */}
        {!loading && !error && total > 0 && (
          <div className="flex items-center justify-between px-5 py-3 border-t border-gray-50">
            <span className="text-xs text-gray-400">
              共 {total} 条 · 第 {currentPage}/{totalPages} 页
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setOffset((prev) => Math.max(0, prev - PAGE_SIZE))}
                disabled={currentPage <= 1}
                className="p-1.5 text-gray-500 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                aria-label="上一页"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setOffset((prev) => prev + PAGE_SIZE)}
                disabled={currentPage >= totalPages}
                className="p-1.5 text-gray-500 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                aria-label="下一页"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 回复/编辑弹窗 */}
      {replying && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={() => !replySaving && setReplying(null)}>
          <div
            className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-bold text-lw-black">
                {replying.status === "pending" ? "回复反馈" : "编辑回复"}
              </h2>
              <button
                type="button"
                onClick={() => !replySaving && setReplying(null)}
                className="text-gray-400 hover:text-gray-600 cursor-pointer"
                aria-label="关闭"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mb-4 p-3 bg-gray-50 rounded-lg">
              <p className="text-sm font-medium text-gray-700">{replying.title}</p>
              <p className="mt-1 text-xs text-gray-500 line-clamp-3">{replying.content}</p>
            </div>

            <div className="mb-4">
              <label className="block text-xs text-gray-500 mb-1.5">处理结果</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setReplyStatus("replied")}
                  className={`flex-1 px-3 py-2 text-sm rounded-lg border transition-colors cursor-pointer ${
                    replyStatus === "replied"
                      ? "border-lw-accent bg-lw-accent text-white"
                      : "border-gray-200 text-gray-600 hover:border-lw-accent"
                  }`}
                >
                  已回复
                </button>
                <button
                  type="button"
                  onClick={() => setReplyStatus("adopted")}
                  className={`flex-1 px-3 py-2 text-sm rounded-lg border transition-colors cursor-pointer ${
                    replyStatus === "adopted"
                      ? "border-lw-accent bg-lw-accent text-white"
                      : "border-gray-200 text-gray-600 hover:border-lw-accent"
                  }`}
                >
                  已采纳
                </button>
              </div>
              <p className="mt-1.5 text-xs text-gray-400">
                {replyStatus === "adopted"
                  ? "标记为已采纳并回复，用户端显示已采纳状态"
                  : "回复用户，用户端显示已回复状态"}
              </p>
            </div>

            <div className="mb-4">
              <label className="block text-xs text-gray-500 mb-1.5">回复内容</label>
              <textarea
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                rows={5}
                maxLength={2000}
                placeholder="请输入回复内容"
                className="w-full px-3 py-2 text-sm text-lw-black bg-gray-50 rounded-lg border border-gray-200 focus:outline-none focus:border-lw-accent focus:ring-1 focus:ring-lw-accent transition-colors resize-none"
              />
            </div>

            {replyError && (
              <p className="mb-3 text-xs text-red-500 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" />
                {replyError}
              </p>
            )}

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => !replySaving && setReplying(null)}
                disabled={replySaving}
                className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 cursor-pointer"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleSaveReply}
                disabled={replySaving}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-lw-accent rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 cursor-pointer"
              >
                {replySaving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle className="w-4 h-4" />
                )}
                {replySaving ? "保存中..." : "保存回复"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
