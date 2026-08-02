"use client";

import { useState, useEffect, useRef } from "react";
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
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { logoutUser, getSession } from "@/actions/auth-actions";
import {
  updateDisplayName,
  updateAvatar,
  updatePassword,
} from "@/actions/profile-actions";
import type { Profile } from "@/types/database";

export default function ProfilePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  useEffect(() => {
    let mounted = true;

    const loadProfile = async () => {
      try {
        const result = await getSession();
        if (!mounted) return;

        if (result.success && result.profile) {
          setProfile(result.profile);
        } else if (result.success && result.session) {
          setError("用户资料初始化失败，请退出后重新登录");
        } else {
          router.push("/login");
          return;
        }
      } catch {
        if (mounted) setError("加载用户信息失败");
      } finally {
        if (mounted) setLoading(false);
      }
    };

    loadProfile();
    return () => {
      mounted = false;
    };
  }, [router]);

  const refreshProfile = async () => {
    const refreshed = await getSession();
    if (!refreshed.success || !refreshed.profile) {
      throw new Error(refreshed.error ?? "刷新用户资料失败");
    }
    setProfile(refreshed.profile);
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
      setNameError("昵称不能为空");
      return;
    }
    if (trimmed.length > 20) {
      setNameError("昵称长度不能超过20个字符");
      return;
    }

    setNameLoading(true);
    setNameError(null);
    try {
      const result = await updateDisplayName(trimmed);
      if (result.success) {
        await refreshProfile();
        setEditingName(false);
        setNameInput("");
      } else {
        setNameError(result.error ?? "更新失败");
      }
    } catch (e) {
      console.error("[Profile] updateDisplayName exception:", e);
      setNameError("操作时发生未知错误，请稍后重试");
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
        await refreshProfile();
      } else {
        setAvatarError(result.error ?? "头像上传失败");
      }
    } catch {
      setAvatarError("操作时发生未知错误");
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
      setPasswordError("请输入当前密码");
      return;
    }
    if (!passwordInput) {
      setPasswordError("请输入新密码");
      return;
    }
    if (passwordInput.length < 6) {
      setPasswordError("密码长度至少6位");
      return;
    }
    if (passwordInput.length > 64) {
      setPasswordError("密码长度不能超过64位");
      return;
    }
    // 密码复杂度：至少包含字母和数字
    if (!/[a-zA-Z]/.test(passwordInput) || !/\d/.test(passwordInput)) {
      setPasswordError("密码必须包含字母和数字");
      return;
    }
    if (passwordInput !== passwordConfirm) {
      setPasswordError("两次输入的密码不一致");
      return;
    }

    setPasswordLoading(true);
    try {
      const result = await updatePassword(
        passwordInput,
        profile?.has_password ? oldPassword : undefined
      );
      if (result.success) {
        await refreshProfile();
        setEditingPassword(false);
        setOldPassword("");
        setPasswordInput("");
        setPasswordConfirm("");
        setPasswordSuccess("密码设置成功");
      } else {
        setPasswordError(result.error ?? "设置密码失败");
      }
    } catch {
      setPasswordError("操作时发生未知错误");
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
            返回登录
          </Link>
        </div>
      </div>
    );
  }

  const isAdmin = profile?.role === "admin";

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
              <h1 className="text-base font-bold text-lw-black">个人中心</h1>
              <p className="text-xs text-gray-400">LongWoo Studio</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-lw-accent transition-colors"
            >
              <Home className="w-4 h-4" />
              <span className="hidden sm:inline">返回首页</span>
            </Link>
            <button
              onClick={handleLogout}
              disabled={loggingOut}
              className="flex items-center gap-1.5 text-sm text-red-500 hover:text-red-600 transition-colors cursor-pointer disabled:opacity-50"
            >
              <LogOut className="w-4 h-4" />
              {loggingOut ? "退出中..." : "退出登录"}
            </button>
          </div>
        </div>
      </header>

      {/* 主要内容 */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-6 space-y-6">
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
                title="点击修改头像"
              >
                {profile?.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={profile.avatar_url}
                    alt="头像"
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
                    placeholder="输入新昵称"
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
                    保存
                  </button>
                  <button
                    type="button"
                    onClick={handleCancelEditName}
                    disabled={nameLoading}
                    className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                    取消
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-lg font-bold text-lw-black">
                    {profile?.display_name ?? "新用户"}
                  </h2>
                  <button
                    type="button"
                    onClick={handleStartEditName}
                    className="flex items-center justify-center w-6 h-6 text-gray-400 hover:text-lw-accent hover:bg-blue-50 rounded-md transition-colors cursor-pointer"
                    title="修改昵称"
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
                    {isAdmin ? "管理员" : "普通用户"}
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
          <h3 className="text-sm font-medium text-gray-400 mb-3">快捷入口</h3>
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
                <p className="text-sm font-medium text-lw-black">工作台</p>
                <p className="text-xs text-gray-400 mt-0.5">管理订单与委托</p>
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
                <p className="text-sm font-medium text-lw-black">管理后台</p>
                <p className="text-xs text-gray-400 mt-0.5">系统数据概览</p>
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
              <p className="text-sm font-medium text-lw-black">购买自设兽装</p>
              <p className="text-xs text-gray-400 mt-0.5">开始定制您的专属兽装</p>
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
              <p className="text-sm font-medium text-lw-black">查询订单</p>
              <p className="text-xs text-gray-400 mt-0.5">查看订单进度</p>
              <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-lw-accent mt-2 transition-colors" />
            </Link>
          </div>
        </section>

        {/* 账号信息 */}
        <section className="bg-white rounded-2xl shadow-sm border border-gray-50 p-6">
          <h3 className="text-sm font-medium text-gray-400 mb-4">账号信息</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between py-2 border-b border-gray-50">
              <span className="text-sm text-gray-500">用户UID</span>
              <span className="text-sm text-gray-700 font-mono">
                {profile?.uid != null ? profile.uid : "未分配"}
              </span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-gray-50">
              <span className="text-sm text-gray-500">用户ID</span>
              <span className="text-sm text-gray-700 font-mono">
                {profile?.id.slice(0, 8)}...
              </span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-gray-50">
              <span className="text-sm text-gray-500">注册时间</span>
              <span className="text-sm text-gray-700">
                {profile?.created_at
                  ? new Date(profile.created_at).toLocaleDateString("zh-CN")
                  : "未知"}
              </span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-gray-50">
              <span className="text-sm text-gray-500">账号状态</span>
              <span className="text-sm text-green-600 flex items-center gap-1">
                <CheckCircle className="w-3.5 h-3.5" />
                {profile?.is_active ? "正常" : "已禁用"}
              </span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-gray-500">账号角色</span>
              <span className="text-sm text-gray-700">
                {isAdmin ? "管理员" : "普通用户"}
              </span>
            </div>
          </div>
        </section>

        {/* 账号安全（密码管理） */}
        <section className="bg-white rounded-2xl shadow-sm border border-gray-50 p-6">
          <h3 className="text-sm font-medium text-gray-400 mb-4">账号安全</h3>

          <div className="flex items-center justify-between py-2">
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-gray-400" />
              <span className="text-sm text-gray-700">
                {profile?.has_password ? "登录密码" : "尚未设置密码"}
              </span>
              {profile?.has_password ? (
                <span className="px-1.5 py-0.5 text-xs text-green-600 bg-green-50 rounded">
                  已设置
                </span>
              ) : (
                <span className="px-1.5 py-0.5 text-xs text-orange-600 bg-orange-50 rounded">
                  未设置
                </span>
              )}
            </div>

            {!editingPassword && (
              <button
                type="button"
                onClick={handleStartEditPassword}
                className="flex items-center gap-1.5 text-sm text-lw-accent hover:text-blue-700 transition-colors cursor-pointer"
              >
                <Lock className="w-3.5 h-3.5" />
                {profile?.has_password ? "修改密码" : "设置密码"}
              </button>
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
                    当前密码
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
                    placeholder="请输入当前密码"
                    className="w-full px-3 py-2 text-sm text-lw-black bg-gray-50 rounded-lg border border-gray-200 focus:outline-none focus:border-lw-accent focus:ring-1 focus:ring-lw-accent transition-colors disabled:opacity-60"
                  />
                </div>
              )}
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  {profile?.has_password ? "新密码" : "设置密码"}
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
                  placeholder="至少6位密码"
                  className="w-full px-3 py-2 text-sm text-lw-black bg-gray-50 rounded-lg border border-gray-200 focus:outline-none focus:border-lw-accent focus:ring-1 focus:ring-lw-accent transition-colors disabled:opacity-60"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">
                  确认密码
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
                  placeholder="再次输入密码"
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
                  {passwordLoading ? "保存中..." : "保存密码"}
                </button>
                <button
                  type="button"
                  onClick={handleCancelEditPassword}
                  disabled={passwordLoading}
                  className="flex items-center gap-1 px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors disabled:opacity-50 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                  取消
                </button>
              </div>

              <p className="text-xs text-gray-400 pt-1">
                提示：密码长度 6-64 位。设置后可使用邮箱 + 密码直接登录。
              </p>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
