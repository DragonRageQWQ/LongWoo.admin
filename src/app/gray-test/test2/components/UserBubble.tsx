"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell, ChevronDown, Loader2, LogOut, Shield } from "lucide-react";
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

export default function UserBubble({
  lang,
  onLangChange,
}: {
  lang: Gt2Lang;
  onLangChange: (lang: Gt2Lang) => void;
}) {
  const c = COPY[lang].bubble;
  const { profile } = useSession();

  const [open, setOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

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
    if (open && profile) {
      setLoading(true);
      fetchNotifications().finally(() => setLoading(false));
    }
  }, [open, profile, fetchNotifications]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

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
        setOpen(false);
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
    <div className="gt2-bubble" ref={wrapRef}>
      {open && (
        <div className="gt2-bubble-panel">
          {/* 语言切换 */}
          <div className="gt2-bubble-sec">
            <div className="gt2-lang-seg" role="group" aria-label={c.langLabel}>
              <button type="button" data-on={lang === "zh"} onClick={() => onLangChange("zh")}>
                中文
              </button>
              <button type="button" data-on={lang === "en"} onClick={() => onLangChange("en")}>
                EN
              </button>
            </div>
          </div>

          {/* 站内信 */}
          <div className="gt2-bubble-sec">
            <button
              type="button"
              className="gt2-bubble-row"
              data-open={notifOpen}
              onClick={() => setNotifOpen((v) => !v)}
            >
              <Bell />
              {c.notifLabel}
              {profile && unread > 0 && <span className="gt2-bubble-badge">{unread > 99 ? "99+" : unread}</span>}
              <ChevronDown className="gt2-bubble-chevron" />
            </button>

            <div className="gt2-notif-wrap" data-open={notifOpen}>
              <div className="gt2-notif-clip">
                {!profile ? (
                  <div className="gt2-notif-empty">{c.notifLoginHint}</div>
                ) : loading ? (
                  <div className="gt2-notif-empty">
                    <Loader2 className="mx-auto h-4 w-4 animate-spin" />
                  </div>
                ) : loadError ? (
                  <div className="gt2-notif-empty">
                    <button type="button" className="gt2-mini-btn" onClick={fetchNotifications}>
                      {c.retry}
                    </button>
                  </div>
                ) : items.length === 0 ? (
                  <div className="gt2-notif-empty">{c.notifEmpty}</div>
                ) : (
                  <>
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
                    <div className="gt2-notif-foot">
                      <span className="gt2-field-count" style={{ marginLeft: 0 }}>
                        {items.length}
                      </span>
                      {unread > 0 && (
                        <button type="button" onClick={handleReadAll}>
                          {c.readAll}
                        </button>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* 账户 */}
          <div className="gt2-bubble-sec">
            {profile ? (
              <>
                <div className="gt2-account-user">
                  <div className="gt2-account-avatar">
                    {profile.avatar_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={profile.avatar_url} alt={displayName} />
                    ) : (
                      <span>{displayName.charAt(0).toUpperCase()}</span>
                    )}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div className="gt2-account-name">{displayName}</div>
                    <div className="gt2-account-meta">
                      {profile.role === "admin" ? "ADMIN" : "MEMBER"}
                    </div>
                  </div>
                </div>
                <div className="gt2-account-actions">
                  {profile.role === "admin" && (
                    <Link className="gt2-mini-btn" href="/admin/dashboard">
                      <Shield className="h-3.5 w-3.5" />
                      {c.adminPanel}
                    </Link>
                  )}
                  <button
                    type="button"
                    className="gt2-mini-btn gt2-mini-btn--danger"
                    onClick={handleLogout}
                    disabled={loggingOut}
                  >
                    {loggingOut ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LogOut className="h-3.5 w-3.5" />}
                    {loggingOut ? c.loggingOut : c.logout}
                  </button>
                </div>
              </>
            ) : (
              <div className="gt2-account-actions">
                <Link className="gt2-mini-btn gt2-mini-btn--dark" href="/login">
                  {c.loginBtn}
                </Link>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 圆形气泡按钮 */}
      <button
        type="button"
        className="gt2-bubble-btn"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={profile ? displayName : c.signupEn}
      >
        {profile ? (
          <>
            {profile.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={profile.avatar_url} alt={displayName} />
            ) : (
              <span className="gt2-bubble-initial">{displayName.charAt(0).toUpperCase()}</span>
            )}
            <span className="gt2-bubble-name">{displayName}</span>
          </>
        ) : (
          <>
            <span className="gt2-bubble-btn-en">{c.signupEn}</span>
            <span className="gt2-bubble-btn-zh">{c.signupZh}</span>
          </>
        )}
      </button>
    </div>
  );
}
