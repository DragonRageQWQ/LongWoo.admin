"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Bell, Loader2, CheckCheck, X } from "lucide-react";
import { formatDate } from "@/lib/utils";

interface NotificationItem {
  id: string;
  title: string;
  content: string;
  is_read: boolean;
  created_at: string;
}

interface NotificationsResponse {
  success: boolean;
  items?: NotificationItem[];
  unreadCount?: number;
}

// 轮询间隔（毫秒）：Vercel serverless 无实时推送，采用定时刷新
const POLL_INTERVAL_MS = 60 * 1000;

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<NotificationItem | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 拉取通知
  const fetchNotifications = useCallback(async () => {
    try {
      const response = await fetch("/api/notifications?limit=20", {
        cache: "no-store",
      });
      if (!response.ok) {
        // 401：未登录，静默处理
        if (response.status === 401) {
          setItems([]);
          setUnreadCount(0);
          return;
        }
        setError("加载失败");
        return;
      }
      const result: NotificationsResponse = await response.json();
      if (result.success) {
        setItems(result.items || []);
        setUnreadCount(result.unreadCount ?? 0);
        setError(null);
      }
    } catch (err) {
      console.error("[NotificationBell] 加载异常:", err);
      setError("加载失败");
    }
  }, []);

  // 打开面板时加载 + 启动轮询
  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLoading(true);
      fetchNotifications().finally(() => setLoading(false));
    }
  }, [open, fetchNotifications]);

  // 定时轮询（全局挂载即启动，轻量请求）
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchNotifications();
    pollTimerRef.current = setInterval(fetchNotifications, POLL_INTERVAL_MS);
    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, [fetchNotifications]);

  // 点击外部关闭
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // 标记单条已读
  const handleRead = async (id: string) => {
    try {
      await fetch("/api/notifications/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      setItems((prev) =>
        prev.map((item) =>
          item.id === id ? { ...item, is_read: true } : item
        )
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (err) {
      console.error("[NotificationBell] 标记已读异常:", err);
    }
  };

  // 点击通知：打开详情弹窗（查看完整内容）并标记已读
  const handleOpenDetail = (item: NotificationItem) => {
    setDetail(item);
    if (!item.is_read) {
      handleRead(item.id);
    }
  };

  // 全部已读
  const handleReadAll = async () => {
    try {
      await fetch("/api/notifications/read-all", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      setItems((prev) => prev.map((item) => ({ ...item, is_read: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error("[NotificationBell] 全部已读异常:", err);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      {/* 铃铛按钮 */}
      <button
        onClick={() => setOpen(!open)}
        aria-label="通知"
        className="relative p-1.5 text-gray-400 hover:text-lw-accent hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
      >
        <Bell className="w-4.5 h-4.5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-medium flex items-center justify-center">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* 下拉面板：自适应视口，不超出屏幕可交互区域 */}
      {open && (
        <div className="fixed sm:absolute right-2 sm:right-0 top-14 sm:top-full sm:mt-2 w-[calc(100vw-2rem)] max-w-[20rem] sm:w-96 bg-white rounded-2xl shadow-xl border border-gray-100 z-50 overflow-hidden">
          {/* 头部 */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-lw-black">通知</h3>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <button
                  onClick={handleReadAll}
                  className="inline-flex items-center gap-1 px-2 py-1 text-xs text-lw-accent hover:bg-blue-50 rounded-md transition-colors cursor-pointer"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  全部已读
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="p-1 text-gray-400 hover:text-gray-600 rounded-md cursor-pointer"
                aria-label="关闭"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* 内容区 */}
          <div className="max-h-96 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="w-5 h-5 text-lw-accent animate-spin" />
              </div>
            ) : error ? (
              <div className="py-10 text-center">
                <p className="text-sm text-gray-400">{error}</p>
                <button
                  onClick={fetchNotifications}
                  className="mt-2 text-xs text-lw-accent hover:underline cursor-pointer"
                >
                  重试
                </button>
              </div>
            ) : items.length === 0 ? (
              <div className="py-10 text-center">
                <Bell className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                <p className="text-sm text-gray-400">暂无通知</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-50">
                {items.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => handleOpenDetail(item)}
                    className={`w-full text-left px-4 py-3 transition-colors cursor-pointer ${
                      item.is_read ? "bg-white" : "bg-blue-50/40"
                    } hover:bg-gray-50`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium text-lw-black flex-1">
                        {item.title}
                        {!item.is_read && (
                          <span className="inline-block w-1.5 h-1.5 rounded-full bg-red-500 ml-1.5 align-middle" />
                        )}
                      </p>
                      <span className="text-xs text-gray-400 flex-shrink-0">
                        {formatDate(item.created_at)}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1 line-clamp-2 whitespace-pre-wrap">
                      {item.content}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 公告详情弹窗（查看完整内容） */}
      {detail && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setDetail(null)}
          />
          <div className="relative bg-white rounded-2xl shadow-xl max-w-md w-full mx-4 max-h-[80vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 flex-shrink-0">
              <h3 className="text-base font-bold text-lw-black flex-1 pr-2">
                {detail.title}
              </h3>
              <button
                onClick={() => setDetail(null)}
                className="p-1 text-gray-400 hover:text-gray-600 rounded-md cursor-pointer"
                aria-label="关闭"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="px-5 py-4 flex-1 overflow-y-auto">
              <p className="text-xs text-gray-400 mb-3">
                {formatDate(detail.created_at)}
              </p>
              <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap break-words">
                {detail.content}
              </p>
            </div>
            <div className="px-5 py-3 border-t border-gray-100 flex justify-end flex-shrink-0">
              <button
                onClick={() => setDetail(null)}
                className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
