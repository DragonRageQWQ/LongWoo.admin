"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, LogOut, Shield, UserRound } from "lucide-react";
import BellIcon from "@/components/ui/BellIcon";
import { useSession, clearSessionCache } from "@/components/providers/SessionProvider";
import { logoutUser } from "@/actions/auth-actions";
import { formatDate } from "@/lib/utils";
import { COPY, type Gt2Lang } from "../copy";
import GlobeLangMenu from "@/components/i18n/GlobeLangMenu";

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
  // 站内信详情：点击列表项打开完整内容弹层（null=未打开）
  const [activeNotif, setActiveNotif] = useState<NotificationItem | null>(null);
  const [bellTick, setBellTick] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

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
      const target = e.target as Node;
      const insideDock = wrapRef.current?.contains(target);
      const insideModal = modalRef.current?.contains(target);
      if (!insideDock && !insideModal) {
        setPanel("none");
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      // 详情弹层打开时先关闭弹层，再关闭下拉
      if (activeNotif) {
        setActiveNotif(null);
        return;
      }
      setPanel("none");
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [panel, activeNotif]);

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

  // 点击站内信：标记已读并打开完整详情弹层（长内容不再截断）
  const handleOpenNotif = useCallback(
    (item: NotificationItem) => {
      if (!item.is_read) handleRead(item.id);
      setActiveNotif(item);
    },
    [handleRead]
  );

  const handleCloseNotifDetail = useCallback(() => setActiveNotif(null), []);

  // 详情弹层内跳转订单进度：关闭弹层与下拉后进入首页查询面板
  const handleGoOrder = useCallback(
    (item: NotificationItem) => {
      const orderNo = extractOrderNo(item.content);
      if (!orderNo) return;
      setActiveNotif(null);
      setPanel("none");
      window.location.assign(`/?tab=check&no=${encodeURIComponent(orderNo)}`);
    },
    []
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
      {/* 1. 语言切换：地球 icon（hover 提示 / 点击下拉列表） */}
      <GlobeLangMenu
        value={lang}
        onSelect={(next) => onLangChange(next as Gt2Lang)}
        tip={c.langTip}
      />

      {/* 2. 站内信铃铛圆：点击向上弹出通知面板 */}
      <div className="gt2-dock-pop">
        <button
          type="button"
          className="gt2-dock-circle"
          onClick={() => {
            setPanel((p) => (p === "notif" ? "none" : "notif"));
            setActiveNotif(null);
            setBellTick((t) => t + 1);
          }}
          aria-expanded={panel === "notif"}
          aria-label={c.notifLabel}
          title={c.notifLabel}
        >
          <BellIcon solid={unread > 0} tick={bellTick} />
          {profile && unread > 0 && (
            <span className="gt2-dock-badge">{unread > 99 ? "99+" : unread}</span>
          )}
        </button>

        {panel === "notif" && (
          <div className="gt2-dock-panel gt2-dock-panel--notif">
            <div className="gt2-dock-panel-head">
              <span>{c.notifLabel}</span>
              <span className="gt2-field-count">{items.length}</span>
              {items.length > 0 && (
                <button
                  type="button"
                  className="gt2-dock-readall"
                  onClick={handleReadAll}
                  disabled={unread === 0}
                  title={c.readAll}
                >
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
                {/* prefetch={false}：阻止 Link 视口自动 prefetch 与 useEffect 的
                    router.prefetch 重复请求（PERF-09），避免并发 RSC 请求拖慢导航 */}
                <Link className="gt2-dock-menu-item" href="/profile" prefetch={false}>
                  <UserRound />
                  {c.profileBtn}
                </Link>
                {isAdmin && (
                  <Link className="gt2-dock-menu-item" href="/admin/dashboard" prefetch={false}>
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

      {/* 站内信详情弹层：点击列表项查看完整内容（长站内信不再截断） */}
      {activeNotif &&
        createPortal(
          <div
            ref={modalRef}
            className="gt2-notif-modal"
            role="dialog"
            aria-modal="true"
            aria-label={c.notifLabel}
            onClick={handleCloseNotifDetail}
          >
            <div className="gt2-notif-modal-card" onClick={(e) => e.stopPropagation()}>
              <div className="gt2-notif-modal-head">
                <span className="gt2-notif-modal-label">{c.notifLabel}</span>
                <button
                  type="button"
                  className="gt2-notif-modal-close"
                  onClick={handleCloseNotifDetail}
                  aria-label={c.close}
                  title={c.close}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" width="15" height="15" aria-hidden="true">
                    <path d="M18 6 6 18" />
                    <path d="M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <h3 className="gt2-notif-modal-title">{activeNotif.title}</h3>
              <p className="gt2-notif-modal-time">{formatDate(activeNotif.created_at)}</p>
              <div className="gt2-notif-modal-body">{activeNotif.content}</div>
              {extractOrderNo(activeNotif.content) && (
                <div className="gt2-notif-modal-foot">
                  <button
                    type="button"
                    className="gt2-notif-modal-order"
                    onClick={() => handleGoOrder(activeNotif)}
                  >
                    {c.viewOrder}
                    <span aria-hidden="true">→</span>
                  </button>
                </div>
              )}
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
