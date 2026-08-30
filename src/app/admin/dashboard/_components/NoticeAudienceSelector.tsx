"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Users,
  Shield,
  User,
  Tag,
  UserCheck,
  Search,
  Loader2,
  X,
} from "lucide-react";
import {
  USER_TAG_KEYS,
  USER_TAG_LABELS,
  type UserTagKey,
} from "@/lib/user-tags";
import type { NotificationTargetRole } from "@/lib/notification-utils";
import { listAllUsers } from "@/actions/admin-actions";
import { useLanguage } from "@/components/i18n/LanguageProvider";

/** 受众选择值（通知/邮件发送表单共用） */
export interface NoticeTargetValue {
  targetRole: NotificationTargetRole;
  tags: string[];
  userIds: string[];
}

export const DEFAULT_TARGET_VALUE: NoticeTargetValue = {
  targetRole: "all",
  tags: [],
  userIds: [],
};

// 目标群体选项（5 种）
const targetOptions: Array<{
  value: NotificationTargetRole;
  i18nKey: string;
  i18nDescKey: string;
  icon: React.ElementType;
}> = [
  { value: "all", i18nKey: "admin.notice.targetAll", i18nDescKey: "admin.notice.targetAllDesc", icon: Users },
  { value: "admin", i18nKey: "admin.notice.targetAdmin", i18nDescKey: "admin.notice.targetAdminDesc", icon: Shield },
  { value: "user", i18nKey: "admin.notice.targetUser", i18nDescKey: "admin.notice.targetUserDesc", icon: User },
  { value: "tag", i18nKey: "admin.notice.targetTag", i18nDescKey: "admin.notice.targetTagDesc", icon: Tag },
  { value: "users", i18nKey: "admin.notice.targetUsers", i18nDescKey: "admin.notice.targetUsersDesc", icon: UserCheck },
];

interface SearchUser {
  id: string;
  email: string;
  display_name: string;
  uid: number | null;
}

interface SelectedUserInfo {
  email: string;
  display_name: string;
}

/**
 * 通知/邮件发送受众选择器（受控组件）
 *
 * 支持 5 种目标：全体用户 / 仅限管理员 / 全部普通成员 /
 * 指定标签成员（标签多选）/ 指定成员（搜索多选）。
 */
export default function NoticeAudienceSelector({
  value,
  onChange,
  disabled = false,
}: {
  value: NoticeTargetValue;
  onChange: (v: NoticeTargetValue) => void;
  disabled?: boolean;
}) {
  const { t } = useLanguage();
  const [keyword, setKeyword] = useState("");
  const [results, setResults] = useState<SearchUser[]>([]);
  const [searching, setSearching] = useState(false);
  // 已选成员信息缓存（id → 昵称/邮箱），供标签展示
  const [selectedInfo, setSelectedInfo] = useState<Record<string, SelectedUserInfo>>({});

  const setTargetRole = (targetRole: NotificationTargetRole) =>
    onChange({ ...value, targetRole });

  const toggleTag = (tag: string) => {
    const tags = value.tags.includes(tag)
      ? value.tags.filter((x) => x !== tag)
      : [...value.tags, tag];
    onChange({ ...value, tags });
  };

  const doSearch = useCallback(async (kw: string) => {
    if (!kw.trim()) {
      setResults([]);
      return;
    }
    setSearching(true);
    try {
      const res = await listAllUsers({ search: kw.trim(), limit: 8 });
      if (res.success) {
        const users = (res.data || []) as SearchUser[];
        setResults(users);
        // 回填已选成员信息
        setSelectedInfo((prev) => {
          const next = { ...prev };
          for (const u of users) {
            next[u.id] = { email: u.email, display_name: u.display_name };
          }
          return next;
        });
      } else {
        setResults([]);
      }
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  }, []);

  // 成员搜索防抖（300ms）
  useEffect(() => {
    if (value.targetRole !== "users") return;
    const timer = setTimeout(() => doSearch(keyword), 300);
    return () => clearTimeout(timer);
  }, [keyword, value.targetRole, doSearch]);

  const addUser = (u: SearchUser) => {
    if (value.userIds.includes(u.id)) return;
    setSelectedInfo((prev) => ({
      ...prev,
      [u.id]: { email: u.email, display_name: u.display_name },
    }));
    onChange({ ...value, userIds: [...value.userIds, u.id] });
  };

  const removeUser = (id: string) => {
    onChange({ ...value, userIds: value.userIds.filter((x) => x !== id) });
  };

  return (
    <div className="space-y-3">
      {/* 目标群体选项 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {targetOptions.map((opt) => {
          const Icon = opt.icon;
          const isActive = value.targetRole === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              disabled={disabled}
              onClick={() => setTargetRole(opt.value)}
              className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg border text-left transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                isActive
                  ? "border-lw-accent bg-blue-50"
                  : "border-gray-200 hover:bg-gray-50"
              }`}
            >
              <Icon
                className={`w-4 h-4 flex-shrink-0 ${
                  isActive ? "text-lw-accent" : "text-gray-400"
                }`}
              />
              <div className="min-w-0">
                <p
                  className={`text-sm font-medium ${
                    isActive ? "text-lw-accent" : "text-lw-black"
                  }`}
                >
                  {t(opt.i18nKey)}
                </p>
                <p className="text-xs text-gray-400 truncate">
                  {t(opt.i18nDescKey)}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {/* 指定标签成员：标签多选 */}
      {value.targetRole === "tag" && (
        <div className="rounded-lg border border-gray-200 p-3">
          <p className="text-xs font-medium text-gray-500 mb-2">
            {t("admin.notice.tagPick")}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {USER_TAG_KEYS.map((tag) => {
              const active = value.tags.includes(tag);
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleTag(tag)}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors cursor-pointer ${
                    active
                      ? "border-lw-accent bg-blue-50 text-lw-accent"
                      : "border-gray-200 text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  {USER_TAG_LABELS[tag as UserTagKey]}
                </button>
              );
            })}
          </div>
          {value.tags.length > 0 && (
            <p className="text-xs text-gray-400 mt-2">
              {t("admin.notice.memberSelected")}{" "}
              {value.tags
                .map((tag) => USER_TAG_LABELS[tag as UserTagKey] ?? tag)
                .join("、")}
            </p>
          )}
        </div>
      )}

      {/* 指定成员：搜索多选 */}
      {value.targetRole === "users" && (
        <div className="rounded-lg border border-gray-200 p-3 space-y-2">
          <div className="relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              placeholder={t("admin.notice.memberSearchPh")}
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-lw-accent focus:ring-1 focus:ring-lw-accent transition-colors"
            />
            {searching && (
              <Loader2 className="w-4 h-4 animate-spin text-lw-accent absolute right-3 top-1/2 -translate-y-1/2" />
            )}
          </div>

          {/* 搜索结果 */}
          {keyword.trim() && !searching && results.length === 0 && (
            <p className="text-xs text-gray-400 py-1">
              {t("admin.notice.memberNoResult")}
            </p>
          )}
          {results.length > 0 && (
            <ul className="max-h-40 overflow-y-auto divide-y divide-gray-50 rounded-lg border border-gray-100">
              {results.map((u) => {
                const picked = value.userIds.includes(u.id);
                return (
                  <li key={u.id}>
                    <button
                      type="button"
                      disabled={picked}
                      onClick={() => addUser(u)}
                      className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-left transition-colors ${
                        picked
                          ? "bg-blue-50/50 cursor-default"
                          : "hover:bg-gray-50 cursor-pointer"
                      }`}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm text-lw-black truncate">
                          {u.display_name || u.email}
                        </span>
                        <span className="block text-xs text-gray-400 truncate">
                          {u.email}
                        </span>
                      </span>
                      {picked && (
                        <span className="text-xs text-lw-accent flex-shrink-0">
                          {t("admin.notice.memberSelected")}
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          {/* 已选成员 */}
          {value.userIds.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {value.userIds.map((id) => {
                const info = selectedInfo[id];
                return (
                  <span
                    key={id}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 text-lw-accent text-xs font-medium border border-blue-100"
                  >
                    {info ? info.display_name || info.email : id.slice(0, 8)}
                    <button
                      type="button"
                      onClick={() => removeUser(id)}
                      className="text-lw-accent/70 hover:text-lw-accent cursor-pointer"
                      aria-label={t("admin.notice.remove")}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
