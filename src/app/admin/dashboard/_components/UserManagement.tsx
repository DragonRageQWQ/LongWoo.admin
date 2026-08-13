"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Users,
  Search,
  X,
  Shield,
  ShieldCheck,
  ShieldOff,
  Loader2,
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  AlertCircle,
} from "lucide-react";
import {
  listAllUsers,
  grantAdminRole,
  revokeAdminRole,
} from "@/actions/admin-actions";
import { formatDate } from "@/lib/utils";
import type { UserRole } from "@/types/database";
import { useLanguage } from "@/components/i18n/LanguageProvider";

// 分页大小
const PAGE_SIZE = 10;

// 用户项类型（与 listAllUsers 返回的 data 结构一致）
interface UserItem {
  id: string;
  uid: number | null;
  email: string;
  role: UserRole;
  display_name: string;
  avatar_url: string | null;
  is_active: boolean;
  created_at: string;
}

// 角色筛选类型
type RoleFilterValue = "all" | "user" | "admin";

// 角色筛选选项
const roleFilterOptions: Array<{ value: RoleFilterValue; label: string; i18nKey: string }> = [
  { value: "all", label: "全部", i18nKey: "admin.user.filterAll" },
  { value: "user", label: "普通用户", i18nKey: "admin.user.filterUser" },
  { value: "admin", label: "管理员", i18nKey: "admin.user.filterAdmin" },
];

// Toast 提示状态
interface ToastState {
  type: "success" | "error";
  message: string;
}

// 确认弹窗状态
interface ConfirmState {
  open: boolean;
  user: UserItem | null;
  action: "grant" | "revoke" | null;
}

export default function UserManagement() {
  const { t } = useLanguage();
  // 当前用户权限（由 listAllUsers 一次请求下发，不再单独串行请求）
  const [isZeroUser, setIsZeroUser] = useState(false);
  // 零号用户 UID — 安全加固（FIND-09）：由服务端下发，不在前端硬编码
  const [zeroUserUid, setZeroUserUid] = useState<number | null>(null);

  // 搜索与筛选状态
  const [searchKeyword, setSearchKeyword] = useState("");
  const [appliedKeyword, setAppliedKeyword] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilterValue>("all");

  // 数据状态
  const [users, setUsers] = useState<UserItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 确认弹窗与操作
  const [confirmState, setConfirmState] = useState<ConfirmState>({
    open: false,
    user: null,
    action: null,
  });
  const [actionLoading, setActionLoading] = useState(false);

  // Toast 提示
  const [toast, setToast] = useState<ToastState | null>(null);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  // Toast 自动消失（3 秒）
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(timer);
  }, [toast]);

  // 获取用户列表（搜索、筛选、分页均在服务端执行）
  // 权限元数据（isZeroUser / zeroUserUid）由同一请求返回，
  // 与列表并行加载，消除"权限检查 → 拉列表"的串行瀑布。
  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await listAllUsers({
        search: appliedKeyword || undefined,
        roleFilter,
        offset: (currentPage - 1) * PAGE_SIZE,
        limit: PAGE_SIZE,
      });

      if (!result.success) {
        setError(result.error || t("admin.user.err.fetchListFailed"));
        setUsers([]);
        setTotalCount(0);
        return;
      }

      setUsers((result.data || []) as UserItem[]);
      setTotalCount(result.total ?? 0);
      if (result.meta) {
        setIsZeroUser(result.meta.isZeroUser);
        setZeroUserUid(result.meta.zeroUserUid);
      }
    } catch (err) {
      console.error("加载用户列表异常:", err);
      setError(t("admin.user.err.loadListUnknown"));
      setUsers([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  }, [appliedKeyword, roleFilter, currentPage, t]);

  // 挂载即拉取，并在搜索/筛选/分页变化时重新拉取
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchUsers();
  }, [fetchUsers]);

  // 搜索
  const handleSearch = () => {
    setAppliedKeyword(searchKeyword);
    setCurrentPage(1);
  };

  // 回车搜索
  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  // 清除搜索
  const handleClearSearch = () => {
    setSearchKeyword("");
    setAppliedKeyword("");
    setCurrentPage(1);
  };

  // 角色筛选切换
  const handleRoleFilterChange = (value: RoleFilterValue) => {
    setRoleFilter(value);
    setCurrentPage(1);
  };

  // 分页：上一页
  const handlePrevPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  // 分页：下一页
  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
    }
  };

  // 打开确认弹窗
  const openConfirm = (user: UserItem, action: "grant" | "revoke") => {
    setConfirmState({ open: true, user, action });
  };

  // 关闭确认弹窗
  const closeConfirm = () => {
    if (actionLoading) return;
    setConfirmState({ open: false, user: null, action: null });
  };

  // 确认执行授权/撤销
  const handleConfirmAction = async () => {
    const { user, action } = confirmState;
    if (!user || !action || user.uid === null) return;

    setActionLoading(true);
    try {
      const result =
        action === "grant"
          ? await grantAdminRole(user.uid)
          : await revokeAdminRole(user.uid);

      if (result.success) {
        setToast({
          type: "success",
          message:
            action === "grant"
              ? `已成功授予「${user.display_name || user.email}」管理员权限`
              : `已撤销「${user.display_name || user.email}」的管理员权限`,
        });
        setConfirmState({ open: false, user: null, action: null });
        // 刷新列表以反映角色变更
        fetchUsers();
      } else {
        setToast({
          type: "error",
          message: result.error || t("admin.user.err.operationFailed"),
        });
      }
    } catch (err) {
      console.error("角色操作异常:", err);
      setToast({
        type: "error",
        message: t("admin.user.err.operationUnknown"),
      });
    } finally {
      setActionLoading(false);
    }
  };

  // 渲染角色徽章
  const renderRoleBadge = (user: UserItem) => {
    // 零号用户：紫色「超级管理员」
    if (zeroUserUid !== null && user.uid === zeroUserUid) {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
          <ShieldCheck className="w-3 h-3" />
          {t("admin.user.superAdmin")}
        </span>
      );
    }
    // 管理员：红色「管理员」
    if (user.role === "admin") {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
          <Shield className="w-3 h-3" />
          {t("admin.user.admin")}
        </span>
      );
    }
    // 普通用户：蓝色「普通用户」
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
        {t("admin.user.user")}
      </span>
    );
  };

  // 渲染操作按钮（仅零号用户可见）
  const renderActions = (user: UserItem) => {
    if (!isZeroUser) {
      return <span className="text-xs text-gray-300">—</span>;
    }
    // 零号用户自身或 uid 为空：不可操作
    if (user.uid === zeroUserUid || user.uid === null) {
      return <span className="text-xs text-gray-300">—</span>;
    }
    // 管理员：撤销（红色描边）
    if (user.role === "admin") {
      return (
        <button
          onClick={() => openConfirm(user, "revoke")}
          className="inline-flex items-center gap-1 px-3 py-1 text-xs font-medium text-red-600 border border-red-300 rounded-md hover:bg-red-50 transition-colors cursor-pointer"
        >
          <ShieldOff className="w-3.5 h-3.5" />
          {t("admin.user.revoke")}
        </button>
      );
    }
    // 普通用户：授予（绿色描边）
    return (
      <button
        onClick={() => openConfirm(user, "grant")}
        className="inline-flex items-center gap-1 px-3 py-1 text-xs font-medium text-green-600 border border-green-300 rounded-md hover:bg-green-50 transition-colors cursor-pointer"
      >
        <ShieldCheck className="w-3.5 h-3.5" />
        {t("admin.user.grant")}
      </button>
    );
  };

  return (
    <div className="space-y-5">
      {/* 标题 */}
      <div>
        <h1 className="text-xl font-bold text-lw-black">用户管理</h1>
        <p className="text-sm text-gray-400 mt-1">
          查看平台所有用户，管理管理员权限
        </p>
      </div>

      {/* Toast 提示 */}
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
            <button
              onClick={() => setToast(null)}
              className="text-gray-400 hover:text-gray-600 flex-shrink-0"
              aria-label={t("admin.user.closeToast")}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* 主容器 */}
      <div className="bg-white rounded-2xl shadow-sm">
        {/* 搜索与筛选区 */}
        <div className="p-4 sm:p-5 border-b border-gray-100 space-y-4">
          {/* 搜索栏 */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                placeholder={t("admin.user.searchPh")}
                className="w-full pl-10 pr-10 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-lw-accent focus:ring-1 focus:ring-lw-accent transition-colors"
              />
              {searchKeyword && (
                <button
                  onClick={handleClearSearch}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  aria-label={t("admin.user.clearSearch")}
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            <button
              onClick={handleSearch}
              className="px-5 py-2 bg-lw-accent text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors cursor-pointer flex items-center gap-1.5"
            >
              <Search className="w-4 h-4" />
              {t("admin.user.search")}
            </button>
          </div>

          {/* 角色筛选 Tab */}
          <div className="flex items-center gap-2">
            {roleFilterOptions.map((opt) => (
              <button
                key={opt.value}
                onClick={() => handleRoleFilterChange(opt.value)}
                className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-colors cursor-pointer ${
                  roleFilter === opt.value
                    ? "bg-lw-accent text-white"
                    : "bg-white text-gray-600 hover:bg-gray-100"
                }`}
              >
                {t(opt.i18nKey)}
              </button>
            ))}
          </div>
        </div>

        {/* 内容区 */}
        {loading ? (
          // 加载状态
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 text-lw-accent animate-spin" />
            <span className="ml-2 text-sm text-gray-400">{t("admin.user.loading")}</span>
          </div>
        ) : error ? (
          // 错误状态（含重试）
          <div className="flex flex-col items-center justify-center py-20 space-y-3">
            <AlertCircle className="w-10 h-10 text-red-400" />
            <p className="text-sm text-gray-500">{error}</p>
            <button
              onClick={fetchUsers}
              className="px-4 py-2 text-sm text-lw-accent border border-lw-accent rounded-lg hover:bg-blue-50 transition-colors cursor-pointer"
            >
              {t("admin.user.retry")}
            </button>
          </div>
        ) : users.length === 0 ? (
          // 空状态
          <div className="flex flex-col items-center justify-center py-20 text-gray-400">
            <Users className="w-12 h-12 mb-3 text-gray-300" />
            <p className="text-sm">
              {appliedKeyword || roleFilter !== "all"
                ? t("admin.user.noMatch")
                : t("admin.user.empty")}
            </p>
          </div>
        ) : (
          <>
            {/* 桌面端表格 */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      UID
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t("admin.user.colAvatar")}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t("admin.user.colEmail")}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t("admin.user.colRole")}
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t("admin.user.colCreated")}
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      {t("admin.user.colAction")}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {users.map((user) => (
                    <tr
                      key={user.id}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">
                        {user.uid ?? "-"}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-2.5">
                          {user.avatar_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={user.avatar_url}
                              alt={user.display_name}
                              loading="lazy"
                              className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-lw-accent flex items-center justify-center text-white text-xs font-medium flex-shrink-0">
                              {user.display_name?.charAt(0)?.toUpperCase() ||
                                "U"}
                            </div>
                          )}
                          <span className="text-sm font-medium text-lw-black">
                            {user.display_name || t("admin.user.notSet")}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                        {user.email}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {renderRoleBadge(user)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">
                        {formatDate(user.created_at)}
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        {renderActions(user)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* 移动端卡片列表 */}
            <div className="md:hidden divide-y divide-gray-50">
              {users.map((user) => (
                <div key={user.id} className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5 min-w-0">
                      {user.avatar_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={user.avatar_url}
                          alt={user.display_name}
                          loading="lazy"
                          className="w-10 h-10 rounded-full object-cover flex-shrink-0"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-lw-accent flex items-center justify-center text-white text-sm font-medium flex-shrink-0">
                          {user.display_name?.charAt(0)?.toUpperCase() || "U"}
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-lw-black truncate">
                          {user.display_name || t("admin.user.notSet")}
                        </p>
                        <p className="text-xs text-gray-400">
                          UID: {user.uid ?? "-"}
                        </p>
                      </div>
                    </div>
                    {renderRoleBadge(user)}
                  </div>
                  <div className="text-sm text-gray-600 truncate">
                    {user.email}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-400">
                      {formatDate(user.created_at)}
                    </span>
                    {renderActions(user)}
                  </div>
                </div>
              ))}
            </div>

            {/* 分页控件 */}
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-gray-50/50">
              <p className="text-sm text-gray-500">
                {t("admin.user.total")}{" "}
                <span className="font-medium text-lw-black">{totalCount}</span>{" "}
                {t("admin.user.items")}，{t("admin.user.page")}{" "}
                {currentPage}/{totalPages} {t("admin.user.pageUnit")}
              </p>
              <div className="flex items-center gap-1">
                <button
                  onClick={handlePrevPage}
                  disabled={currentPage <= 1}
                  className="p-1.5 text-gray-500 hover:text-lw-black hover:bg-gray-100 rounded-md transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                  aria-label={t("admin.user.prev")}
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="px-3 py-1 text-sm text-gray-600">
                  {currentPage}
                </span>
                <button
                  onClick={handleNextPage}
                  disabled={currentPage >= totalPages}
                  className="p-1.5 text-gray-500 hover:text-lw-black hover:bg-gray-100 rounded-md transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                  aria-label={t("admin.user.next")}
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* 角色变更确认弹窗 */}
      {confirmState.open && confirmState.user && confirmState.action && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* 遮罩层 */}
          <div
            className="absolute inset-0 bg-black/50"
            onClick={closeConfirm}
          />
          {/* 弹窗主体 */}
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
            {/* 关闭按钮 */}
            <button
              onClick={closeConfirm}
              disabled={actionLoading}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 disabled:opacity-50"
              aria-label={t("admin.user.close")}
            >
              <X className="w-5 h-5" />
            </button>

            {/* 标题与图标 */}
            <div className="flex items-center gap-3">
              <div
                className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${
                  confirmState.action === "grant"
                    ? "bg-green-50"
                    : "bg-red-50"
                }`}
              >
                {confirmState.action === "grant" ? (
                  <ShieldCheck className="w-6 h-6 text-green-500" />
                ) : (
                  <ShieldOff className="w-6 h-6 text-red-500" />
                )}
              </div>
              <div>
                <h3 className="text-base font-semibold text-lw-black">
                  {confirmState.action === "grant"
                    ? t("admin.user.grantTitle")
                    : t("admin.user.revokeTitle")}
                </h3>
                <p className="text-sm text-gray-400 mt-0.5">{t("admin.user.confirmHint")}</p>
              </div>
            </div>

            {/* 目标用户信息 */}
            <div className="bg-gray-50 rounded-lg p-3 space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500 flex-shrink-0">{t("admin.user.userLabel")}</span>
                <span className="text-sm font-medium text-lw-black truncate">
                  {confirmState.user.display_name || t("admin.user.notSet")}
                </span>
                <span className="text-xs text-gray-400 flex-shrink-0">
                  (UID: {confirmState.user.uid})
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-gray-500 flex-shrink-0">{t("admin.user.emailLabel")}</span>
                <span className="text-sm text-gray-600 truncate">
                  {confirmState.user.email}
                </span>
              </div>
            </div>

            {/* 操作说明 */}
            <p className="text-sm text-gray-500 leading-relaxed">
              {confirmState.action === "grant"
                ? t("admin.user.grantDesc")
                : t("admin.user.revokeDesc")}
            </p>

            {/* 操作按钮 */}
            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={closeConfirm}
                disabled={actionLoading}
                className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer disabled:opacity-50"
              >
                {t("admin.user.cancel")}
              </button>
              <button
                onClick={handleConfirmAction}
                disabled={actionLoading}
                className={`inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors cursor-pointer disabled:opacity-50 ${
                  confirmState.action === "grant"
                    ? "bg-green-600 hover:bg-green-700"
                    : "bg-red-600 hover:bg-red-700"
                }`}
              >
                {actionLoading && (
                  <Loader2 className="w-4 h-4 animate-spin" />
                )}
                {confirmState.action === "grant" ? t("admin.user.confirmGrant") : t("admin.user.confirmRevoke")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
