"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, Loader2, LogOut, Shield, UserRound } from "lucide-react";
import { useSession, clearSessionCache } from "@/components/providers/SessionProvider";
import { logoutUser } from "@/actions/auth-actions";
import { formatDate } from "@/lib/utils";
import { COPY, type Gt2Lang } from "../copy";

interface NotificationItem {
  id: string;
  title: string;
  content: string;
  is_read: boolean;
  created_at: string;
}

function extractOrderNo(content: string): string {
  const match = content.match(/订单号[：:]\s*(LW[A-Z0-9]+)/);
  return match ? match[1] : "";
}

type PanelId = "none" | "notif" | "account";

export default function UserBubble({
  lang,
  onLangChange,
}: {
  lang: Gt2Lang;
  onLangChange: (lang: Gt2Lang) => void;
}) {
  const c = COPY[lang].bubble;
  const { profile } = useSession();
  const router = useRouter();

  const [panel, setPanel] = useState<PanelId>("none");
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // 性能优化（PERF-09）：账户菜单展开时立即预取个人中心/管理后台的 RSC，
  // 用户点击"个人中心"时命中预载缓存，页面（含 loading 骨架）即时呈现，
  // 消除点击后的服务端往返等待（原约 1.3s）。
  const isAdmin = profile?.role === "admin";
  useEffect(() => {
    if (panel !== "account") return;
    router.prefetch("/profile");
    if (isAdmin) router.prefetch("/admin/dashboard");
  }, [panel, isAdmin, router]);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications?limit=20", { cache: "no-store" });
      if (res.status === 401) {
        setItems([]);
        setUnread(0);
        return;
      }
      const data = await res.json();
      if (data.success) {
        setItems(data.items || []);
        setUnread(data.unreadCount ?? 0);
        setLoadError(false);
      } else {
        setLoadError(true);
      }
    } catch {
      setLoadError(true);
    }
  }, []);

  useEffect(() => {
    if (panel === "notif" && profile) {
      setLoading(true);
      fetchNotifications().finally(() => setLoading(false));
    }
  }, [panel, profile, fetchNotifications]);

  useEffect(() => {
    if (panel === "none") return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setPanel("none");
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPanel("none");
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [panel]);

  const handleRead = useCallback(async (id: string) => {
    try {
      await fetch("/api/notifications/read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      setItems((prev) => prev.map((it) => (it.id === id ? { ...it, is_read: true } : it)));
      setUnread((prev) => Math.max(0, prev - 1));
    } catch {
      /* ignore */
    }
  }, []);

  const handleReadAll = useCallback(async () => {
    try {
      await fetch("/api/notifications/read-all", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      setItems((prev) => prev.map((it) => ({ ...it, is_read: true })));
      setUnread(0);
    } catch {
      /* ignore */
    }
  }, []);

  const handleOpenNotif = useCallback(
    (item: NotificationItem) => {
      if (!item.is_read) handleRead(item.id);
      const orderNo = extractOrderNo(item.content);
      if (orderNo) {
        setPanel("none");
        window.location.assign(`/order/query?no=${encodeURIComponent(orderNo)}`);
      }
    },
    [handleRead]
  );

  const handleLogout = useCallback(async () => {
    setLoggingOut(true);
    try {
      clearSessionCache();
      await logoutUser();
      window.location.reload();
    } catch {
      setLoggingOut(false);
    }
  }, []);

  const displayName = profile?.display_name || "";

  return (
    <div className="gt2-dock" ref={wrapRef}>
      {/* 1. 语言切换圆：中 / En 点击直接切换 */}
      <button
        type="button"
        className="gt2-dock-circle gt2-dock-lang"
        onClick={() => onLangChange(lang === "zh" ? "en" : "zh")}
        aria-label={c.langLabel}
        title={c.langLabel}
      >
        <span data-on={lang === "zh"}>中</span>
        <i aria-hidden="true">/</i>
        <span data-on={lang === "en"}>En</span>
      </button>

      {/* 2. 站内信铃铛圆：点击向上弹出通知面板 */}
      <div className="gt2-dock-pop">
        <button
          type="button"
          className="gt2-dock-circle"
          onClick={() => setPanel((p) => (p === "notif" ? "none" : "notif"))}
          aria-expanded={panel === "notif"}
          aria-label={c.notifLabel}
          title={c.notifLabel}
        >
          <Bell strokeWidth={1.8} />
          {profile && unread > 0 && (
            <span className="gt2-dock-badge">{unread > 99 ? "99+" : unread}</span>
          )}
        </button>

        {panel === "notif" && (
          <div className="gt2-dock-panel gt2-dock-panel--notif">
            <div className="gt2-dock-panel-head">
              <span>{c.notifLabel}</span>
              <span className="gt2-field-count">{items.length}</span>
              {unread > 0 && (
                <button type="button" className="gt2-dock-readall" onClick={handleReadAll}>
                  {c.readAll}
                </button>
              )}
            </div>

            {!profile ? (
              <div className="gt2-notif-empty">{c.notifLoginHint}</div>
            ) : loading ? (
              <div className="gt2-notif-empty">
                <Loader2 className="mx-auto h-4 w-4 animate-spin" />
              </div>
            ) : loadError ? (
              <div className="gt2-notif-empty">
                <button type="button" className="gt2-notif-retry" onClick={fetchNotifications}>
                  {c.retry}
                </button>
              </div>
            ) : items.length === 0 ? (
              <div className="gt2-notif-empty">{c.notifEmpty}</div>
            ) : (
              <div className="gt2-notif-list">
                {items.map((item) => {
                  const orderNo = extractOrderNo(item.content);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      className={`gt2-notif-item ${item.is_read ? "read" : ""}`}
                      onClick={() => handleOpenNotif(item)}
                    >
                      <div className="gt2-notif-item-head">
                        <span className="gt2-notif-dot" />
                        <span className="gt2-notif-title">{item.title}</span>
                        <span className="gt2-notif-time">{formatDate(item.created_at)}</span>
                      </div>
                      <div className="gt2-notif-content">{item.content}</div>
                      {orderNo && (
                        <span className="gt2-notif-order">
                          <code>{orderNo}</code>
                          {c.viewOrder} →
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 3. 登录胶囊：未登录双行文案，登录后头像+昵称+账户菜单 */}
      <div className="gt2-dock-pop gt2-dock-user">
        {profile ? (
          <>
            <button
              type="button"
              className="gt2-dock-pill"
              onClick={() => setPanel((p) => (p === "account" ? "none" : "account"))}
              aria-expanded={panel === "account"}
              aria-label={displayName}
            >
              <span className="gt2-dock-avatar">
                {profile.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={profile.avatar_url} alt={displayName} />
                ) : (
                  <span className="gt2-dock-initial">{displayName.charAt(0).toUpperCase()}</span>
                )}
              </span>
              <span className="gt2-dock-username">{displayName}</span>
            </button>

            {panel === "account" && (
              <div className="gt2-dock-panel gt2-dock-panel--account">
                <Link className="gt2-dock-menu-item" href="/profile">
                  <UserRound />
                  {c.profileBtn}
                </Link>
                {isAdmin && (
                  <Link className="gt2-dock-menu-item" href="/admin/dashboard">
                    <Shield />
                    {c.adminPanel}
                  </Link>
                )}
                <button
                  type="button"
                  className="gt2-dock-menu-item gt2-dock-menu-item--danger"
                  onClick={handleLogout}
                  disabled={loggingOut}
                >
                  {loggingOut ? <Loader2 className="animate-spin" /> : <LogOut />}
                  {loggingOut ? c.loggingOut : c.logout}
                </button>
              </div>
            )}
          </>
        ) : (
          <Link className="gt2-dock-pill gt2-dock-pill--signup" href="/login">
            <span className="gt2-dock-pill-icon">
              <UserRound />
            </span>
            <span className="gt2-dock-pill-text">
              <b>{c.signupEn}</b>
              <small>{c.signupZh}</small>
            </span>
          </Link>
        )}
      </div>
    </div>
  );
}
