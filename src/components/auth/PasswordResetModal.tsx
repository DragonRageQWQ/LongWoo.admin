"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Mail, Lock, Loader2, X, CheckCircle, KeyRound } from "lucide-react";
import { sendPasswordResetOtp, resetPasswordWithOtp } from "@/actions/auth-actions";

/**
 * 忘记密码弹窗：通过邮箱一次性验证码重置密码（无需旧密码）
 *
 * 支持两种场景：
 * - fixedEmail 传入（个人中心，已登录）：邮箱固定为当前账号邮箱，仅需输入验证码+新密码
 * - fixedEmail 为空（登录页，未登录）：需输入邮箱 → 发送验证码 → 输入验证码+新密码
 */
export default function PasswordResetModal({
  open,
  onClose,
  fixedEmail,
}: {
  open: boolean;
  onClose: () => void;
  fixedEmail?: string;
}) {
  const [email, setEmail] = useState(fixedEmail ?? "");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [sending, setSending] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const emailInputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const successTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 重置成功后跳转登录页（带成功提示参数）
  const goToLogin = useCallback(() => {
    if (successTimerRef.current) clearTimeout(successTimerRef.current);
    window.location.href = "/login?reset=1";
  }, []);

  // 成功状态自动跳转（1.5 秒后），避免已登录场景被 signOut 打断看不到提示
  useEffect(() => {
    if (success) {
      successTimerRef.current = setTimeout(goToLogin, 1500);
    }
    return () => {
      if (successTimerRef.current) clearTimeout(successTimerRef.current);
    };
  }, [success, goToLogin]);

  // 打开弹窗时重置状态
  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setEmail(fixedEmail ?? "");
      setCode("");
      setNewPassword("");
      setPasswordConfirm("");
      setError(null);
      setInfo(null);
      setSuccess(false);
      setCountdown(0);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      setTimeout(() => {
        if (fixedEmail) {
          document.querySelector<HTMLInputElement>('[data-pwreset-code]')?.focus();
        } else {
          emailInputRef.current?.focus();
        }
      }, 50);
    }
  }, [open, fixedEmail]);

  // 关闭时清理倒计时
  useEffect(() => {
    if (!open && timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, [open]);

  // 发送验证码倒计时（60s）
  const startCountdown = useCallback(() => {
    setCountdown(60);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          timerRef.current = null;
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  // ESC 关闭
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  // 发送验证码
  const handleSend = async () => {
    setError(null);
    setInfo(null);

    if (!fixedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("请输入有效的邮箱地址");
      return;
    }

    setSending(true);
    try {
      const result = await sendPasswordResetOtp(fixedEmail ?? email);
      if (!result.success) {
        setError(result.error ?? "发送验证码失败");
        return;
      }
      setInfo("验证码已发送，请查收邮箱（10分钟内有效）");
      startCountdown();
    } catch {
      setError("发送验证码时发生未知错误");
    } finally {
      setSending(false);
    }
  };

  // 提交重置
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);

    const targetEmail = fixedEmail ?? email;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(targetEmail)) {
      setError("请输入有效的邮箱地址");
      return;
    }
    if (!code || code.length !== 6) {
      setError("请输入6位验证码");
      return;
    }
    if (!newPassword) {
      setError("请输入新密码");
      return;
    }
    if (newPassword.length < 6) {
      setError("密码长度至少6位");
      return;
    }
    if (newPassword.length > 64) {
      setError("密码长度不能超过64位");
      return;
    }
    if (!/[a-zA-Z]/.test(newPassword) || !/\d/.test(newPassword)) {
      setError("密码必须包含字母和数字");
      return;
    }
    if (newPassword !== passwordConfirm) {
      setError("两次输入的密码不一致");
      return;
    }

    setSubmitting(true);
    try {
      const result = await resetPasswordWithOtp(targetEmail, code, newPassword);
      if (!result.success) {
        setError(result.error ?? "重置密码失败");
        return;
      }
      setSuccess(true);
    } catch {
      setError("重置密码时发生未知错误");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="忘记密码"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden">
        {/* 头部 */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <KeyRound className="w-5 h-5 text-lw-accent" />
            <h3 className="text-base font-semibold text-lw-black">忘记密码</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="关闭"
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {success ? (
          /* 成功状态 */
          <div className="px-6 py-10 text-center">
            <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
            <p className="text-sm font-medium text-lw-black mb-2">密码重置成功</p>
            <p className="text-xs text-gray-400 mb-6">
              请使用新密码重新登录
            </p>
            <button
              type="button"
              onClick={goToLogin}
              className="w-full py-2.5 bg-lw-accent text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors cursor-pointer"
            >
              去登录
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
            <p className="text-xs text-gray-400">
              通过邮箱一次性验证码重置密码，无需旧密码。
            </p>

            {/* 邮箱（仅未登录场景显示输入框） */}
            {fixedEmail ? (
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  账号邮箱
                </label>
                <div className="flex items-center gap-2 px-3 py-2.5 bg-gray-50 rounded-lg border border-gray-200">
                  <Mail className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <span className="text-sm text-lw-black truncate">{fixedEmail}</span>
                </div>
              </div>
            ) : (
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  注册邮箱
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input
                    ref={emailInputRef}
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="请输入注册邮箱"
                    autoComplete="email"
                    className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-lw-accent focus:border-transparent transition"
                  />
                </div>
              </div>
            )}

            {/* 发送验证码 */}
            <div>
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-gray-500 mb-1">
                    邮箱验证码
                  </label>
                  <input
                    data-pwreset-code
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={code}
                    onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                    placeholder="6位验证码"
                    autoComplete="one-time-code"
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm tracking-widest focus:outline-none focus:ring-2 focus:ring-lw-accent focus:border-transparent transition"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleSend}
                  disabled={sending || countdown > 0}
                  className="flex-shrink-0 px-4 py-2.5 text-sm text-lw-accent border border-lw-accent/30 rounded-lg hover:bg-lw-accent/5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  {sending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : countdown > 0 ? (
                    `${countdown}s`
                  ) : (
                    "发送验证码"
                  )}
                </button>
              </div>
              {info && <p className="mt-1.5 text-xs text-green-600">{info}</p>}
            </div>

            {/* 新密码 */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                新密码
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="至少6位，包含字母和数字"
                  autoComplete="new-password"
                  maxLength={64}
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-lw-accent focus:border-transparent transition"
                />
              </div>
            </div>

            {/* 确认密码 */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                确认新密码
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="password"
                  value={passwordConfirm}
                  onChange={(e) => setPasswordConfirm(e.target.value)}
                  placeholder="再次输入新密码"
                  autoComplete="new-password"
                  maxLength={64}
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-lw-accent focus:border-transparent transition"
                />
              </div>
            </div>

            {error && (
              <p className="text-xs text-red-500">{error}</p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 bg-lw-accent text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              {submitting ? "重置中..." : "重置密码"}
            </button>

            <p className="text-xs text-gray-400 text-center">
              提示：验证码 10 分钟内有效，重置后需重新登录
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
