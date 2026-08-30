"use client";

import { useState, useRef, useEffect } from "react";
import dynamic from "next/dynamic";
import {
  Mail,
  LogOut,
  Package,
  Clock,
  CheckCircle,
  Loader2,
  ArrowRight,
  Settings,
  Home,
  Edit,
  Camera,
  Lock,
  X,
  Upload,
  Sparkles,
  KeyRound,
} from "lucide-react";
import Link from "next/link";
import { logoutUser } from "@/actions/auth-actions";
import {
  updateDisplayName,
  updateAvatar,
  updatePassword,
  getProfileBundle,
} from "@/actions/profile-actions";
import { useLanguage } from "@/components/i18n/LanguageProvider";
import { formatDate, statusLabels } from "@/lib/utils";
import type { Profile, Order } from "@/types/database";
import PasswordResetModal from "@/components/auth/PasswordResetModal";
import ProfileSkeleton from "./ProfileSkeleton";
import "./profile.css";

// 性能优化：建议与反馈按需加载（独立 chunk，非首屏 JS）
const FeedbackSection = dynamic(
  () => import("@/components/profile/FeedbackSection"),
  { loading: () => null }
);

export default function ProfileShell({
  initialProfile,
  initialOrders,
  initialError,
  isAdmin,
}: {
  initialProfile: Profile | null;
  initialOrders: Order[];
  initialError?: string | null;
  isAdmin: boolean;
}) {
  const { t } = useLanguage();
  // 数据由服务端预取提供，初始不再加载
  const [loading] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(initialProfile);
  const [loggingOut, setLoggingOut] = useState(false);
  const error = initialError ?? null;

  // 我的订单状态（初始数据来自服务端预取）
  const [orders, setOrders] = useState<Order[]>(initialOrders);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersError, setOrdersError] = useState<string | null>(
    initialError ?? null
  );

  // 性能优化（PERF-08）：服务端仅做轻鉴权时（initialProfile 为 null），
  // 由客户端在 mount 后并行获取用户资料与订单；期间展示共享骨架。
  const [dataLoading, setDataLoading] = useState(!initialProfile);
  const [isAdminState, setIsAdminState] = useState(isAdmin);

  useEffect(() => {
    if (initialProfile) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await getProfileBundle();
        if (cancelled) return;
        if (res.success) {
          setProfile(res.profile);
          setOrders(res.orders);
          setIsAdminState(res.isAdmin);
        } else {
          setOrdersError(res.error ?? "加载失败，请稍后重试");
        }
      } catch {
        if (!cancelled) setOrdersError("加载失败，请稍后重试");
      } finally {
        if (!cancelled) setDataLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialProfile]);

  // 昵称编辑状态
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [nameLoading, setNameLoading] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);

  // 头像上传状态
  const [avatarLoading, setAvatarLoading] = useState(false);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 密码管理状态
  const [editingPassword, setEditingPassword] = useState(false);
  const [oldPassword, setOldPassword] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  // 忘记密码弹窗状态
  const [resetOpen, setResetOpen] = useState(false);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await logoutUser();
    } catch {
      setLoggingOut(false);
    }
  };

  // ==================== 修改昵称 ====================
  const handleStartEditName = () => {
    setNameInput(profile?.display_name ?? "");
    setNameError(null);
    setEditingName(true);
  };

  const handleCancelEditName = () => {
    setEditingName(false);
    setNameError(null);
    setNameInput("");
  };

  const handleSaveName = async () => {
    const trimmed = nameInput.trim();
    if (!trimmed) {
      setNameError(t("profile.err.nameRequired"));
      return;
    }
    if (trimmed.length > 20) {
      setNameError(t("profile.err.nameTooLong"));
      return;
    }

    setNameLoading(true);
    setNameError(null);
    try {
      const result = await updateDisplayName(trimmed);
      if (result.success) {
        // 服务端已更新，本地乐观刷新 profile（服务端已 revalidatePath）
        setProfile((prev) =>
          prev ? { ...prev, display_name: trimmed } : prev
        );
        setEditingName(false);
        setNameInput("");
      } else {
        setNameError(result.error ?? t("profile.err.updateFailed"));
      }
    } catch (e) {
      console.error("[Profile] updateDisplayName exception:", e);
      setNameError(t("profile.err.operationUnknownRetry"));
    } finally {
      setNameLoading(false);
    }
  };

  // ==================== 修改头像 ====================
  const handleAvatarClick = () => {
    if (avatarLoading) return;
    fileInputRef.current?.click();
  };

  const handleAvatarChange = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    // 重置 input value 以便重复选择同一文件
    e.target.value = "";

    if (!file) return;

    setAvatarLoading(true);
    setAvatarError(null);
    try {
      const result = await updateAvatar(file);
      if (result.success && result.avatarUrl) {
        // 服务端已更新，本地乐观刷新 profile（服务端已 revalidatePath）
        setProfile((prev) => {
          if (!prev || !result.avatarUrl) return prev;
          return { ...prev, avatar_url: result.avatarUrl };
        });
      } else {
        setAvatarError(result.error ?? t("profile.err.avatarUploadFailed"));
      }
    } catch {
      setAvatarError(t("profile.err.operationUnknown"));
    } finally {
      setAvatarLoading(false);
    }
  };

  // ==================== 修改密码 ====================
  const handleStartEditPassword = () => {
    setOldPassword("");
    setPasswordInput("");
    setPasswordConfirm("");
    setPasswordError(null);
    setPasswordSuccess(null);
    setEditingPassword(true);
  };

  const handleCancelEditPassword = () => {
    setEditingPassword(false);
    setPasswordError(null);
    setPasswordSuccess(null);
    setOldPassword("");
    setPasswordInput("");
    setPasswordConfirm("");
  };

  const handleSavePassword = async () => {
    setPasswordError(null);
    setPasswordSuccess(null);

    // C4: 如果用户已有密码，必须输入当前密码
    if (profile?.has_password && !oldPassword) {
      setPasswordError(t("profile.err.passwordCurrentRequired"));
      return;
    }
    if (!passwordInput) {
      setPasswordError(t("profile.err.passwordNewRequired"));
      return;
    }
    if (passwordInput.length < 6) {
      setPasswordError(t("profile.err.passwordTooShort"));
      return;
    }
    if (passwordInput.length > 64) {
      setPasswordError(t("profile.err.passwordTooLong"));
      return;
    }
    // 密码复杂度：至少包含字母和数字
    if (!/[a-zA-Z]/.test(passwordInput) || !/\d/.test(passwordInput)) {
      setPasswordError(t("profile.err.passwordComplexity"));
      return;
    }
    if (passwordInput !== passwordConfirm) {
      setPasswordError(t("profile.err.passwordMismatch"));
      return;
    }

    setPasswordLoading(true);
    try {
      const result = await updatePassword(
        passwordInput,
        profile?.has_password ? oldPassword : undefined
      );
      if (result.success) {
        // 修改密码成功：Supabase 会撤销旧 session，需重新登录
        if (result.sessionInvalidated) {
          setPasswordSuccess(t("profile.err.passwordSetRelogin"));
          setTimeout(() => {
            window.location.href = "/login?changed=1";
          }, 1200);
        } else {
          setEditingPassword(false);
          setOldPassword("");
          setPasswordInput("");
          setPasswordConfirm("");
          setPasswordSuccess(t("profile.err.passwordSetSuccess"));
        }
      } else {
        setPasswordError(result.error ?? t("profile.err.passwordSetFailed"));
      }
    } catch {
      setPasswordError(t("profile.err.operationUnknown"));
    } finally {
      setPasswordLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <Loader2 className="w-6 h-6 animate-spin text-neutral-400" />
      </div>
    );
  }

  // 性能优化（PERF-08）：客户端取数期间展示共享骨架（与导航 loading 一致）
  if (dataLoading) {
    return <ProfileSkeleton />;
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="text-center">
          <p className="text-sm text-red-500 mb-4">{error}</p>
          <Link href="/login" className="text-sm text-neutral-500 hover:text-neutral-900 underline">
            {t("profile.backToLogin")}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="pf-root">
      {/* 顶部栏（墨色极简） */}
      <header className="pf-top">
        <div className="pf-top-inner">
          <a href="/" className="pf-brand">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/longwoo-logo.svg" alt="LongWoo 龙坞" />
            <b>龙坞</b>
            <span>LongWoo Studio</span>
          </a>
          <div className="pf-top-actions">
            <Link href="/" className="pf-top-link">
              <Home className="w-3.5 h-3.5" />
              {t("profile.backHome")}
            </Link>
            <button
              type="button"
              onClick={handleLogout}
              disabled={loggingOut}
              className="pf-top-link pf-top-link--danger"
            >
              <LogOut className="w-3.5 h-3.5" />
              {loggingOut ? t("header.loggingOut") : t("header.logout")}
            </button>
          </div>
        </div>
      </header>

      {/* 主体 */}
      <main className="pf-main">
        {/* 01 用户资料 */}
        <p className="pf-kicker pf-kicker--first">01 / PROFILE</p>
        <h1 className="pf-title">{t("nav.profile")}</h1>
        <p className="pf-sub">LongWoo Studio</p>

        <section className="pf-card pf-user">
          {/* 头像（可点击上传） */}
          <div className="pf-avatar-wrap">
            <button
              type="button"
              onClick={handleAvatarClick}
              disabled={avatarLoading}
              className="pf-avatar"
              title={t("profile.changeAvatarTip")}
            >
              {profile?.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={profile.avatar_url}
                  alt={t("profile.avatarAlt")}
                  className="w-full h-full object-cover rounded-full"
                  decoding="async"
                />
              ) : (
                <span>{profile?.display_name?.charAt(0) ?? "U"}</span>
              )}
            </button>
            <span className="pf-avatar-hint">
              {avatarLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Camera className="w-5 h-5" />
              )}
            </span>
            {/* 隐藏的文件选择器 */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/gif,image/webp"
              onChange={handleAvatarChange}
              className="hidden"
            />
          </div>

          <div className="pf-user-body">
            {/* 昵称 + 编辑 */}
            {editingName ? (
              <div className="pf-name-edit">
                <input
                  type="text"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSaveName();
                    if (e.key === "Escape") handleCancelEditName();
                  }}
                  maxLength={20}
                  autoFocus
                  disabled={nameLoading}
                  placeholder={t("profile.nicknamePlaceholder")}
                  className="pf-input"
                />
                <button
                  type="button"
                  onClick={handleSaveName}
                  disabled={nameLoading}
                  className="pf-btn"
                >
                  {nameLoading ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <CheckCircle className="w-3.5 h-3.5" />
                  )}
                  {t("profile.save")}
                </button>
                <button
                  type="button"
                  onClick={handleCancelEditName}
                  disabled={nameLoading}
                  className="pf-btn pf-btn--ghost"
                >
                  <X className="w-3.5 h-3.5" />
                  {t("profile.cancel")}
                </button>
              </div>
            ) : (
              <div className="pf-user-name-row">
                <h2 className="pf-user-name">
                  {profile?.display_name ?? t("profile.newUser")}
                </h2>
                <button
                  type="button"
                  onClick={handleStartEditName}
                  className="pf-edit-btn"
                  title={t("profile.editNickname")}
                >
                  <Edit className="w-3.5 h-3.5" />
                </button>
                <span
                  className={`pf-role-badge ${
                    isAdminState ? "pf-role-badge--admin" : "pf-role-badge--user"
                  }`}
                >
                  {isAdminState ? t("profile.admin") : t("profile.user")}
                </span>
              </div>
            )}

            {nameError && <p className="pf-err">{nameError}</p>}

            <div className="pf-user-meta">
              <Mail className="w-3.5 h-3.5 flex-shrink-0" />
              <span>{profile?.email}</span>
            </div>
            {profile?.phone && (
              <div className="pf-user-meta">
                <span>{profile.phone}</span>
              </div>
            )}
            {avatarError && (
              <p className="pf-err">
                <X className="w-3 h-3" />
                {avatarError}
              </p>
            )}
          </div>
        </section>

        {/* 02 快捷入口 */}
        <p className="pf-kicker">02 / SHORTCUTS</p>
        <div className="pf-grid">
          {isAdminState && (
            <Link href="/studio/dashboard" className="pf-link-card">
              <span className="pf-link-card-icon">
                <Package className="w-4 h-4" />
              </span>
              <b>{t("profile.dashboard")}</b>
              <p>{t("profile.manageOrdersDesc")}</p>
            </Link>
          )}
          {isAdminState && (
            <Link href="/admin/dashboard" className="pf-link-card">
              <span className="pf-link-card-icon">
                <Settings className="w-4 h-4" />
              </span>
              <b>{t("header.enterAdmin")}</b>
              <p>{t("profile.adminOverviewDesc")}</p>
            </Link>
          )}
          <Link href="/?tab=fursuit" className="pf-link-card">
            <span className="pf-link-card-icon">
              <Package className="w-4 h-4" />
            </span>
            <b>{t("profile.buyFursuit")}</b>
            <p>{t("profile.startCustomizeDesc")}</p>
          </Link>
          {/* 重定向：龙灵工坊 → Agent智能体（新首页 Agent 功能） */}
          <Link href="/?tab=agent" className="pf-link-card">
            <span className="pf-link-card-icon">
              <Sparkles className="w-4 h-4" />
            </span>
            <b>{t("profile.agentName")}</b>
            <p>{t("profile.lingWorkDesc")}</p>
          </Link>
          {/* AI 助手：功能暂未开启，入口已隐藏，仅保留在灰度测试界面（/gray-test） */}
          <Link href="/?tab=check" className="pf-link-card">
            <span className="pf-link-card-icon">
              <Clock className="w-4 h-4" />
            </span>
            <b>{t("profile.queryOrder")}</b>
            <p>{t("profile.viewOrderProgress")}</p>
          </Link>
        </div>

        {/* 03 我的订单 */}
        <p className="pf-kicker">03 / ORDERS</p>
        <div className="pf-section-head">
          <span className="pf-sub" style={{ margin: 0 }}>{t("profile.myOrders")}</span>
          <Link href="/?tab=check">
            {t("profile.viewMore")}
            <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        {ordersLoading ? (
          <div className="pf-empty">
            <Loader2 className="w-5 h-5 animate-spin inline-block text-neutral-300" />
          </div>
        ) : ordersError ? (
          <div className="pf-empty">
            <p className="text-sm text-red-500">{ordersError}</p>
            <Link href="/?tab=check">
              {t("profile.goToQueryOrder")}
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        ) : orders.length === 0 ? (
          <div className="pf-empty">
            <b>{t("profile.noOrders")}</b>
            <p className="text-xs text-neutral-400">{t("profile.noOrdersDesc")}</p>
            <Link href="/?tab=fursuit">
              {t("profile.goBuyFursuit")}
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        ) : (
          <div className="pf-order-list">
            {orders.map((order) => (
              <div key={order.id} className="pf-order">
                <div className="pf-order-main">
                  <div className="pf-order-no-row">
                    <span className="pf-order-no">{order.order_no}</span>
                    <span
                      className={`pf-status ${
                        {
                          pending: "bg-amber-50 text-amber-700",
                          estimated: "bg-blue-50 text-blue-700",
                          accepted: "bg-green-50 text-green-700",
                          rejected: "bg-red-50 text-red-700",
                          processing: "bg-purple-50 text-purple-700",
                          delivered: "bg-indigo-50 text-indigo-700",
                          completed: "bg-neutral-100 text-neutral-600",
                        }[order.status] || "bg-neutral-100 text-neutral-600"
                      }`}
                    >
                      {statusLabels[order.status] || order.status}
                    </span>
                  </div>
                  <p className="pf-order-meta">
                    {order.service_types?.name || t("profile.fursuitCustomization")} ·{" "}
                    {formatDate(order.created_at)}
                  </p>
                </div>
                <Link
                  href={`/?tab=check&no=${encodeURIComponent(order.order_no)}&email=${encodeURIComponent(order.customer_email || "")}`}
                  className="pf-order-link"
                >
                  {t("profile.viewDetails")}
                  <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            ))}
          </div>
        )}

        {/* 04 账号信息 */}
        <p className="pf-kicker">04 / ACCOUNT</p>
        <section className="pf-card">
          <div className="pf-rows">
            <div className="pf-row">
              <span className="pf-row-label">{t("profile.userUid")}</span>
              <span className="pf-row-value">
                {profile?.uid != null ? profile.uid : t("profile.notAssigned")}
              </span>
            </div>
            <div className="pf-row">
              <span className="pf-row-label">{t("profile.userId")}</span>
              <span className="pf-row-value">{profile?.id.slice(0, 8)}...</span>
            </div>
            <div className="pf-row">
              <span className="pf-row-label">{t("profile.registeredAt")}</span>
              <span className="pf-row-value" style={{ fontFamily: "inherit" }}>
                {profile?.created_at
                  ? new Date(profile.created_at).toLocaleDateString("zh-CN", {
                      year: "numeric",
                      month: "2-digit",
                      day: "2-digit",
                      timeZone: "Asia/Shanghai",
                    })
                  : t("profile.unknown")}
              </span>
            </div>
            <div className="pf-row">
              <span className="pf-row-label">{t("profile.accountStatus")}</span>
              <span className="pf-row-value pf-row-value--ok">
                <CheckCircle className="w-3.5 h-3.5" />
                {profile?.is_active ? t("profile.active") : t("profile.disabled")}
              </span>
            </div>
            <div className="pf-row">
              <span className="pf-row-label">{t("profile.accountRole")}</span>
              <span className="pf-row-value" style={{ fontFamily: "inherit" }}>
                {isAdminState ? t("profile.admin") : t("profile.user")}
              </span>
            </div>
          </div>
        </section>

        {/* 05 账号安全（密码管理） */}
        <p className="pf-kicker">05 / SECURITY</p>
        <section className="pf-card">
          <div className="pf-sec-row">
            <div className="pf-sec-left">
              <Lock className="w-4 h-4" />
              <span>
                {profile?.has_password
                  ? t("profile.loginPassword")
                  : t("profile.noPasswordYet")}
              </span>
              {profile?.has_password ? (
                <span className="pf-tag pf-tag--ok">{t("profile.passwordSet")}</span>
              ) : (
                <span className="pf-tag pf-tag--warn">{t("profile.passwordNotSet")}</span>
              )}
            </div>

            {!editingPassword && (
              <div className="pf-sec-actions">
                {profile?.has_password && (
                  <button
                    type="button"
                    onClick={() => setResetOpen(true)}
                    className="pf-text-btn"
                    title={t("profile.forgotPasswordTip")}
                  >
                    <KeyRound className="w-3.5 h-3.5" />
                    {t("login.forgot")}
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleStartEditPassword}
                  className="pf-text-btn pf-text-btn--accent"
                >
                  <Lock className="w-3.5 h-3.5" />
                  {profile?.has_password
                    ? t("profile.changePassword")
                    : t("profile.setPassword")}
                </button>
              </div>
            )}
          </div>

          {/* 成功提示 */}
          {passwordSuccess && !editingPassword && (
            <p className="pf-ok">
              <CheckCircle className="w-3.5 h-3.5" />
              {passwordSuccess}
            </p>
          )}

          {/* 内联密码表单 */}
          {editingPassword && (
            <div className="pf-form">
              {/* C4: 已有密码时需输入当前密码 */}
              {profile?.has_password && (
                <div className="pf-field">
                  <label>{t("profile.currentPassword")}</label>
                  <input
                    type="password"
                    value={oldPassword}
                    onChange={(e) => setOldPassword(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Escape") handleCancelEditPassword();
                    }}
                    maxLength={64}
                    autoFocus
                    disabled={passwordLoading}
                    placeholder={t("profile.currentPasswordPlaceholder")}
                    className="pf-input"
                  />
                </div>
              )}
              <div className="pf-field">
                <label>
                  {profile?.has_password
                    ? t("profile.newPassword")
                    : t("profile.setPassword")}
                </label>
                <input
                  type="password"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") handleCancelEditPassword();
                  }}
                  maxLength={64}
                  autoFocus={!profile?.has_password}
                  disabled={passwordLoading}
                  placeholder={t("profile.passwordMinHint")}
                  className="pf-input"
                />
              </div>
              <div className="pf-field">
                <label>{t("profile.confirmPassword")}</label>
                <input
                  type="password"
                  value={passwordConfirm}
                  onChange={(e) => setPasswordConfirm(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") handleCancelEditPassword();
                  }}
                  maxLength={64}
                  disabled={passwordLoading}
                  placeholder={t("profile.confirmPasswordPlaceholder")}
                  className="pf-input"
                />
              </div>

              {passwordError && (
                <p className="pf-err">
                  <X className="w-3 h-3" />
                  {passwordError}
                </p>
              )}

              <div className="pf-form-actions">
                <button
                  type="button"
                  onClick={handleSavePassword}
                  disabled={passwordLoading}
                  className="pf-btn"
                >
                  {passwordLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Upload className="w-4 h-4" />
                  )}
                  {passwordLoading ? t("profile.saving") : t("profile.savePassword")}
                </button>
                <button
                  type="button"
                  onClick={handleCancelEditPassword}
                  disabled={passwordLoading}
                  className="pf-btn pf-btn--ghost"
                >
                  <X className="w-4 h-4" />
                  {t("profile.cancel")}
                </button>
              </div>

              <p className="pf-hint">{t("profile.passwordHint")}</p>
            </div>
          )}
        </section>

        {/* 06 建议与反馈（按需加载） */}
        <p className="pf-kicker">06 / FEEDBACK</p>
        <FeedbackSection />
      </main>

      <footer className="pf-foot">
        <p>© 2026 LongWoo Studio. All rights reserved.</p>
      </footer>

      {/* 忘记密码弹窗（邮箱验证码重置，无需旧密码） */}
      <PasswordResetModal
        open={resetOpen}
        onClose={() => setResetOpen(false)}
        fixedEmail={profile?.email}
      />
    </div>
  );
}
