"use client";

import { useState, useRef } from "react";
import {
  User,
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
  Bot,
  Sparkles,
  KeyRound,
  Gift,
} from "lucide-react";
import Link from "next/link";
import { logoutUser } from "@/actions/auth-actions";
import {
  updateDisplayName,
  updateAvatar,
  updatePassword,
} from "@/actions/profile-actions";
import { listMyOrders, claimOrder } from "@/actions/order-actions";
import { useLanguage } from "@/components/i18n/LanguageProvider";
import { formatDate, statusLabels } from "@/lib/utils";
import type { Profile, Order } from "@/types/database";
import FeedbackSection from "@/components/profile/FeedbackSection";
import BottomNav from "@/components/layout/BottomNav";
import PasswordResetModal from "@/components/auth/PasswordResetModal";

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

  // 我的订单状态（初始数据来自服务端预取）
  const [orders, setOrders] = useState<Order[]>(initialOrders);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [ordersError, setOrdersError] = useState<string | null>(
    initialError ?? null
  );

  // 认领历史订单
  const [claimOpen, setClaimOpen] = useState(false);
  const [claimNo, setClaimNo] = useState("");
  const [claimPhone, setClaimPhone] = useState("");
  const [claimLoading, setClaimLoading] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);
  const [claimSuccess, setClaimSuccess] = useState<string | null>(null);

  const handleClaim = async () => {
    setClaimError(null);
    setClaimSuccess(null);
    if (!claimNo.trim() || !claimPhone.trim()) {
      setClaimError(t("profile.err.claimRequired"));
      return;
    }
    setClaimLoading(true);
    try {
      const result = await claimOrder(claimNo.trim(), claimPhone.trim());
      if (result.success) {
        setClaimSuccess(t("profile.err.claimSuccess"));
        setClaimNo("");
        setClaimPhone("");
        // 认领成功后刷新订单列表（用户主动操作，仍需客户端刷新）
        setOrdersLoading(true);
        const refreshed = await listMyOrders(20);
        if (refreshed.success) {
          setOrders(refreshed.data || []);
          setOrdersError(null);
        }
        setOrdersLoading(false);
      } else {
        setClaimError(result.error || t("profile.err.claimFailed"));
      }
    } catch {
      setClaimError(t("profile.err.claimUnknown"));
    } finally {
      setClaimLoading(false);
    }
  };

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
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="w-6 h-6 animate-spin text-lw-accent" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-sm text-red-500 mb-4">{error}</p>
          <Link href="/login" className="text-sm text-lw-accent hover:underline">
            {t("profile.backToLogin")}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 顶部导航 */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-lw-accent flex items-center justify-center">
              <User className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-base font-bold text-lw-black">
                {t("nav.profile")}
              </h1>
              <p className="text-xs text-gray-400">LongWoo Studio</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-lw-accent transition-colors"
            >
              <Home className="w-4 h-4" />
              <span className="hidden sm:inline">{t("profile.backHome")}</span>
            </Link>
            <button
              onClick={handleLogout}
              disabled={loggingOut}
              className="flex items-center gap-1.5 text-sm text-red-500 hover:text-red-600 transition-colors cursor-pointer disabled:opacity-50"
            >
              <LogOut className="w-4 h-4" />
              {loggingOut ? t("header.loggingOut") : t("header.logout")}
            </button>
          </div>
        </div>
      </header>

      {/* 主要内容 */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6 pb-[calc(64px+3rem)] space-y-6">
        {/* 用户信息卡片 */}
        <section className="bg-white rounded-2xl shadow-sm border border-gray-50 p-6">
          <div className="flex items-center gap-4">
            {/* 头像（可点击上传） */}
            <div className="relative flex-shrink-0">
              <button
                type="button"
                onClick={handleAvatarClick}
                disabled={avatarLoading}
                className="relative w-16 h-16 rounded-full bg-gradient-to-br from-lw-accent to-blue-600 flex items-center justify-center text-white text-xl font-bold overflow-hidden cursor-pointer disabled:opacity-60 group"
                title={t("profile.changeAvatarTip")}
              >
                {profile?.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={profile.avatar_url}
                    alt={t("profile.avatarAlt")}
                    className="w-full h-full rounded-full object-cover"
                  />
                ) : (
                  <span>{profile?.display_name?.charAt(0) ?? "U"}</span>
                )}
                {/* 半透明遮罩 + 相机图标 */}
                <span className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  {avatarLoading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Camera className="w-5 h-5" />
                  )}
                </span>
              </button>
              {/* 隐藏的文件选择器 */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                onChange={handleAvatarChange}
                className="hidden"
              />
            </div>

            {/* 信息 */}
            <div className="flex-1 min-w-0">
              {/* 昵称 + 编辑 */}
              {editingName ? (
                <div className="flex items-center gap-2 flex-wrap">
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
                    className="w-48 px-3 py-1.5 text-base font-bold text-lw-black bg-gray-50 rounded-lg border border-gray-200 focus:outline-none focus:border-lw-accent focus:ring-1 focus:ring-lw-accent transition-colors"
                  />
                  <button
                    type="button"
                    onClick={handleSaveName}
                    disabled={nameLoading}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-lw-accent rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 cursor-pointer"
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
                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                    {t("profile.cancel")}
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-lg font-bold text-lw-black">
                    {profile?.display_name ?? t("profile.newUser")}
                  </h2>
                  <button
                    type="button"
                    onClick={handleStartEditName}
                    className="flex items-center justify-center w-6 h-6 text-gray-400 hover:text-lw-accent hover:bg-blue-50 rounded-md transition-colors cursor-pointer"
                    title={t("profile.editNickname")}
                  >
                    <Edit className="w-3.5 h-3.5" />
                  </button>
                  <span
                    className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                      isAdmin
                        ? "bg-red-50 text-red-600"
                        : "bg-blue-50 text-blue-600"
                    }`}
                  >
                    {isAdmin ? t("profile.admin") : t("profile.user")}
                  </span>
                </div>
              )}

              {nameError && (
                <p className="text-xs text-red-500 mt-1">{nameError}</p>
              )}

              <div className="flex items-center gap-1 mt-1 text-sm text-gray-500">
                <Mail className="w-3.5 h-3.5" />
                <span className="truncate">{profile?.email}</span>
              </div>
              {profile?.phone && (
                <div className="flex items-center gap-1 mt-1 text-sm text-gray-500">
                  <span className="truncate">{profile.phone}</span>
                </div>
              )}
              {avatarError && (
                <p className="text-xs text-red-500 mt-1 flex items-center gap-1">
                  <X className="w-3 h-3" />
                  {avatarError}
                </p>
              )}
            </div>
          </div>
        </section>

        {/* 快捷入口 */}
        <section>
          <h3 className="text-sm font-medium text-gray-400 mb-3">
            {t("profile.quickLinks")}
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {/* 管理员才能看到工作台 */}
            {isAdmin && (
              <Link
                href="/studio/dashboard"
                className="bg-white rounded-xl shadow-sm border border-gray-50 p-4 hover:border-lw-accent hover:shadow-md transition-all group"
              >
                <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center mb-3">
                  <Package className="w-5 h-5 text-blue-600" />
                </div>
                <p className="text-sm font-medium text-lw-black">
                  {t("profile.dashboard")}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {t("profile.manageOrdersDesc")}
                </p>
                <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-lw-accent mt-2 transition-colors" />
              </Link>
            )}

            {/* 管理员才能看到管理后台 */}
            {isAdmin && (
              <Link
                href="/admin/dashboard"
                className="bg-white rounded-xl shadow-sm border border-gray-50 p-4 hover:border-lw-accent hover:shadow-md transition-all group"
              >
                <div className="w-10 h-10 rounded-lg bg-purple-50 flex items-center justify-center mb-3">
                  <Settings className="w-5 h-5 text-purple-600" />
                </div>
                <p className="text-sm font-medium text-lw-black">
                  {t("header.enterAdmin")}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {t("profile.adminOverviewDesc")}
                </p>
                <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-lw-accent mt-2 transition-colors" />
              </Link>
            )}

            {/* 购买自设兽装 - 接入首页同样的下单流程 */}
            <Link
              href="/order-step1.html"
              className="bg-white rounded-xl shadow-sm border border-gray-50 p-4 hover:border-lw-accent hover:shadow-md transition-all group"
            >
              <div className="w-10 h-10 rounded-lg bg-green-50 flex items-center justify-center mb-3">
                <Package className="w-5 h-5 text-green-600" />
              </div>
              <p className="text-sm font-medium text-lw-black">
                {t("profile.buyFursuit")}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                {t("profile.startCustomizeDesc")}
              </p>
              <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-lw-accent mt-2 transition-colors" />
            </Link>

            {/* 龙灵工坊 - AI 角色扮演对话 */}
            <Link
              href="/ai/characters"
              className="bg-white rounded-xl shadow-sm border border-gray-50 p-4 hover:border-lw-accent hover:shadow-md transition-all group"
            >
              <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center mb-3">
                <Sparkles className="w-5 h-5 text-indigo-600" />
              </div>
              <p className="text-sm font-medium text-lw-black">
                {t("nav.lingWork")}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                {t("profile.lingWorkDesc")}
              </p>
              <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-lw-accent mt-2 transition-colors" />
            </Link>

            {/* AI 助手 - 兽装咨询问答 */}
            <Link
              href="/ai-chat.html"
              className="bg-white rounded-xl shadow-sm border border-gray-50 p-4 hover:border-lw-accent hover:shadow-md transition-all group"
            >
              <div className="w-10 h-10 rounded-lg bg-cyan-50 flex items-center justify-center mb-3">
                <Bot className="w-5 h-5 text-cyan-600" />
              </div>
              <p className="text-sm font-medium text-lw-black">
                {t("profile.aiAssistant")}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                {t("profile.aiAssistantDesc")}
              </p>
              <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-lw-accent mt-2 transition-colors" />
            </Link>

            {/* 查询订单 */}
            <Link
              href="/order/query"
              className="bg-white rounded-xl shadow-sm border border-gray-50 p-4 hover:border-lw-accent hover:shadow-md transition-all group"
            >
              <div className="w-10 h-10 rounded-lg bg-orange-50 flex items-center justify-center mb-3">
                <Clock className="w-5 h-5 text-orange-600" />
              </div>
              <p className="text-sm font-medium text-lw-black">
                {t("profile.queryOrder")}
              </p>
              <p className="text-xs text-gray-400 mt-0.5">
                {t("profile.viewOrderProgress")}
              </p>
              <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-lw-accent mt-2 transition-colors" />
            </Link>
          </div>
        </section>

        {/* 我的订单 */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-gray-400">
              {t("profile.myOrders")}
            </h3>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setClaimOpen(true)}
                className="text-xs text-gray-500 hover:text-lw-accent flex items-center gap-0.5 transition-colors cursor-pointer"
              >
                <Gift className="w-3 h-3" />
                {t("profile.claimOrder")}
              </button>
              <Link
                href="/order/query"
                className="text-xs text-lw-accent hover:underline flex items-center gap-0.5"
              >
                {t("profile.viewMore")}
                <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
          </div>

          {ordersLoading ? (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-50 p-8 flex items-center justify-center">
              <Loader2 className="w-5 h-5 animate-spin text-gray-300" />
            </div>
          ) : ordersError ? (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-50 p-8 text-center">
              <p className="text-sm text-red-500 mb-3">{ordersError}</p>
              <Link
                href="/order/query"
                className="inline-flex items-center gap-1 text-sm text-lw-accent hover:underline"
              >
                {t("profile.goToQueryOrder")}
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          ) : orders.length === 0 ? (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-50 p-8 text-center">
              <div className="w-12 h-12 mx-auto rounded-full bg-gray-50 flex items-center justify-center mb-3">
                <Package className="w-6 h-6 text-gray-300" />
              </div>
              <p className="text-sm text-gray-500 mb-1">{t("profile.noOrders")}</p>
              <p className="text-xs text-gray-400 mb-4">
                {t("profile.noOrdersDesc")}
              </p>
              <Link
                href="/order-step1.html"
                className="inline-flex items-center gap-1 text-sm font-medium text-lw-accent hover:underline"
              >
                {t("profile.goBuyFursuit")}
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          ) : (
            <div className="space-y-2.5">
              {orders.map((order) => (
                <div
                  key={order.id}
                  className="bg-white rounded-2xl shadow-sm border border-gray-50 p-4 hover:border-lw-accent/40 hover:shadow-md transition-all"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-medium text-lw-black truncate">
                          {order.order_no}
                        </span>
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ${
                            {
                              pending: "bg-yellow-100 text-yellow-800",
                              estimated: "bg-blue-100 text-blue-800",
                              accepted: "bg-green-100 text-green-800",
                              rejected: "bg-red-100 text-red-800",
                              processing: "bg-purple-100 text-purple-800",
                              delivered: "bg-indigo-100 text-indigo-800",
                              completed: "bg-gray-100 text-gray-800",
                            }[order.status] || "bg-gray-100 text-gray-800"
                          }`}
                        >
                          {statusLabels[order.status] || order.status}
                        </span>
                      </div>
                      <p className="text-xs text-gray-400 mt-1 truncate">
                        {order.service_types?.name ||
                          t("profile.fursuitCustomization")}{" "}
                        ·{" "}
                        {formatDate(order.created_at)}
                      </p>
                    </div>
                    <Link
                      href={`/order/query?no=${encodeURIComponent(order.order_no)}&phone=${encodeURIComponent(order.customer_phone || '')}`}
                      className="text-xs text-gray-400 hover:text-lw-accent flex-shrink-0 flex items-center gap-0.5"
                    >
                      {t("profile.viewDetails")}
                      <ArrowRight className="w-3 h-3" />
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* 账号信息 */}
        <section className="bg-white rounded-2xl shadow-sm border border-gray-50 p-6">
          <h3 className="text-sm font-medium text-gray-400 mb-4">
            {t("profile.accountInfo")}
          </h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between py-2 border-b border-gray-50">
              <span className="text-sm text-gray-500">{t("profile.userUid")}</span>
              <span className="text-sm text-gray-700 font-mono">
                {profile?.uid != null ? profile.uid : t("profile.notAssigned")}
              </span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-gray-50">
              <span className="text-sm text-gray-500">{t("profile.userId")}</span>
              <span className="text-sm text-gray-700 font-mono">
                {profile?.id.slice(0, 8)}...
              </span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-gray-50">
              <span className="text-sm text-gray-500">{t("profile.registeredAt")}</span>
              <span className="text-sm text-gray-700">
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
            <div className="flex items-center justify-between py-2 border-b border-gray-50">
              <span className="text-sm text-gray-500">{t("profile.accountStatus")}</span>
              <span className="text-sm text-green-600 flex items-center gap-1">
                <CheckCircle className="w-3.5 h-3.5" />
                {profile?.is_active ? t("profile.active") : t("profile.disabled")}
              </span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-gray-500">{t("profile.accountRole")}</span>
              <span className="text-sm text-gray-700">
                {isAdmin ? t("profile.admin") : t("profile.user")}
              </span>
            </div>
          </div>
        </section>

        {/* 账号安全（密码管理） */}
        <section className="bg-white rounded-2xl shadow-sm border border-gray-50 p-6">
          <h3 className="text-sm font-medium text-gray-400 mb-4">
            {t("profile.accountSecurity")}
          </h3>

          <div className="flex items-center justify-between py-2">
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-gray-400" />
              <span className="text-sm text-gray-700">
                {profile?.has_password
                  ? t("profile.loginPassword")
                  : t("profile.noPasswordYet")}
              </span>
              {profile?.has_password ? (
                <span className="px-1.5 py-0.5 text-xs text-green-600 bg-green-50 rounded">
                  {t("profile.passwordSet")}
                </span>
              ) : (
                <span className="px-1.5 py-0.5 text-xs text-orange-600 bg-orange-50 rounded">
                  {t("profile.passwordNotSet")}
                </span>
              )}
            </div>

            {!editingPassword && (
              <div className="flex items-center gap-3">
                {profile?.has_password && (
                  <button
                    type="button"
                    onClick={() => setResetOpen(true)}
                    className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-lw-accent transition-colors cursor-pointer"
                    title={t("profile.forgotPasswordTip")}
                  >
                    <KeyRound className="w-3.5 h-3.5" />
                    {t("login.forgot")}
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleStartEditPassword}
                  className="flex items-center gap-1.5 text-sm text-lw-accent hover:text-blue-700 transition-colors cursor-pointer"
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
            <p className="mt-3 text-xs text-green-600 flex items-center gap-1">
              <CheckCircle className="w-3.5 h-3.5" />
              {passwordSuccess}
            </p>
          )}

          {/* 内联密码表单 */}
          {editingPassword && (
            <div className="mt-4 pt-4 border-t border-gray-50 space-y-3">
              {/* C4: 已有密码时需输入当前密码 */}
              {profile?.has_password && (
                <div>
                  <label className="block text-xs text-gray-500 mb-1">
                    {t("profile.currentPassword")}
                  </label>
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
                    className="w-full px-3 py-2 text-sm text-lw-black bg-gray-50 rounded-lg border border-gray-200 focus:outline-none focus:border-lw-accent focus:ring-1 focus:ring-lw-accent transition-colors disabled:opacity-60"
                  />
                </div>
              )}
              <div>
                <label className="block text-xs text-gray-500 mb-1">
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
                  className="w-full px-3 py-2 text-sm text-lw-black bg-gray-50 rounded-lg border border-gray-200 focus:outline-none focus:border-lw-accent focus:ring-1 focus:ring-lw-accent transition-colors disabled:opacity-60"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  {t("profile.confirmPassword")}
                </label>
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
                  className="w-full px-3 py-2 text-sm text-lw-black bg-gray-50 rounded-lg border border-gray-200 focus:outline-none focus:border-lw-accent focus:ring-1 focus:ring-lw-accent transition-colors disabled:opacity-60"
                />
              </div>

              {passwordError && (
                <p className="text-xs text-red-500 flex items-center gap-1">
                  <X className="w-3 h-3" />
                  {passwordError}
                </p>
              )}

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleSavePassword}
                  disabled={passwordLoading}
                  className="flex items-center gap-1 px-4 py-2 text-sm font-medium text-white bg-lw-accent rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {passwordLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Upload className="w-4 h-4" />
                  )}
                  {passwordLoading
                    ? t("profile.saving")
                    : t("profile.savePassword")}
                </button>
                <button
                  type="button"
                  onClick={handleCancelEditPassword}
                  disabled={passwordLoading}
                  className="flex items-center gap-1 px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                  {t("profile.cancel")}
                </button>
              </div>

              <p className="text-xs text-gray-400 pt-1">
                {t("profile.passwordHint")}
              </p>
            </div>
          )}
        </section>

        {/* 建议与反馈 */}
        <FeedbackSection />
      </main>

      {/* 底部固定导航栏（与首页一致） */}
      <BottomNav />

      {/* 忘记密码弹窗（邮箱验证码重置，无需旧密码） */}
      <PasswordResetModal
        open={resetOpen}
        onClose={() => setResetOpen(false)}
        fixedEmail={profile?.email}
      />

      {/* 认领历史订单弹窗 */}
      {claimOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => {
              setClaimOpen(false);
              setClaimError(null);
              setClaimSuccess(null);
            }}
          />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-lw-black flex items-center gap-2">
                <Gift className="w-4 h-4 text-lw-accent" />
                {t("profile.claimOrder")}
              </h3>
              <button
                onClick={() => {
                  setClaimOpen(false);
                  setClaimError(null);
                  setClaimSuccess(null);
                }}
                className="p-1 text-gray-400 hover:text-gray-600 rounded-md cursor-pointer"
                aria-label={t("profile.close")}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-gray-400 mb-4 leading-relaxed">
              {t("profile.claimDesc")}
            </p>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  {t("query.orderNoLabel")}
                </label>
                <input
                  value={claimNo}
                  onChange={(e) => setClaimNo(e.target.value)}
                  placeholder={t("profile.claimNoPlaceholder")}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-lw-accent/30 focus:border-lw-accent"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  {t("profile.claimPhoneLabel")}
                </label>
                <input
                  value={claimPhone}
                  onChange={(e) =>
                    setClaimPhone(e.target.value.replace(/\D/g, ""))
                  }
                  placeholder={t("profile.claimPhonePlaceholder")}
                  inputMode="numeric"
                  maxLength={11}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-lw-accent/30 focus:border-lw-accent"
                />
              </div>
              {claimError && (
                <p className="text-xs text-red-500">{claimError}</p>
              )}
              {claimSuccess && (
                <p className="text-xs text-green-600">{claimSuccess}</p>
              )}
              <button
                onClick={handleClaim}
                disabled={claimLoading}
                className="w-full py-2.5 text-sm font-semibold text-white bg-lw-accent rounded-lg hover:opacity-90 transition-opacity cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
              >
                {claimLoading && (
                  <Loader2 className="w-4 h-4 animate-spin" />
                )}
                {claimLoading ? t("profile.claiming") : t("profile.confirmClaim")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
