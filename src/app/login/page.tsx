"use client";

import { useState, useEffect, useRef, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Loader2, ArrowLeft, KeyRound } from "lucide-react";
import {
  sendEmailOtp,
  signInWithQQ,
  isQQConfigured,
} from "@/actions/auth-actions";
import {
  checkEmailHasPassword,
} from "@/actions/profile-actions";
import PasswordResetModal from "@/components/auth/PasswordResetModal";
import LangSwitcher from "@/components/i18n/LangSwitcher";
import { useLanguage } from "@/components/i18n/LanguageProvider";
import "./login.css";

type LoginTab = "email" | "password" | "qq";

// ==================== QQ 图标 ====================
function QQIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M21.395 15.035a39.548 39.548 0 0 0-.803-2.264l-1.079-2.695c.001-.032.014-.562.014-.836C19.526 5.94 17.352 2 12 2S4.474 5.94 4.474 9.24c0 .274.013.804.014.836l-1.08 2.695a39.547 39.547 0 0 0-.802 2.264c-1.02 3.526-.69 4.98-.439 5.014.542.073 2.112-2.47 2.112-2.47 0 1.468.756 3.38 2.394 4.771-.612.188-1.363.479-1.845.835-.434.32-.379.646-.301.778.343.578 5.883.369 7.472.189 1.589.18 7.129.389 7.472-.189.078-.132.133-.458-.301-.778-.482-.356-1.233-.647-1.846-.836 1.638-1.39 2.394-3.302 2.394-4.77 0 0 1.57 2.542 2.112 2.47.251-.034.581-1.488-.439-5.014z" />
    </svg>
  );
}

// ==================== 主组件 ====================
function LoginForm() {
  const searchParams = useSearchParams();
  const { t } = useLanguage();

  const [activeTab, setActiveTab] = useState<LoginTab>("email");

  // 邮箱登录状态
  const [email, setEmail] = useState("");
  const [emailCode, setEmailCode] = useState("");
  const [emailSending, setEmailSending] = useState(false);
  const [emailVerifying, setEmailVerifying] = useState(false);
  const [emailCountdown, setEmailCountdown] = useState(0);

  // 密码登录状态
  const [passwordEmail, setPasswordEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordChecking, setPasswordChecking] = useState(false);

  // OAuth 状态
  const [oauthLoading, setOauthLoading] = useState(false);
  const [qqAvailable, setQqAvailable] = useState(false);

  // 错误与提示
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  // 忘记密码弹窗
  const [resetOpen, setResetOpen] = useState(false);

  // 密码重置成功回跳提示（/login?reset=1）
  useEffect(() => {
    if (searchParams.get("reset") === "1") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setInfo(t("login.err.passwordResetSuccess"));
    }
  }, [searchParams, t]);

  // 邮箱倒计时定时器
  const emailTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 读取 URL 错误参数 & 检查 QQ 登录是否已配置
  useEffect(() => {
    const errParam = searchParams.get("error");
    if (errParam === "oauth_failed") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setError(t("login.err.oauthFailed"));
    } else if (errParam === "qq_not_configured") {
      // 安全加固（FIND-09）：不向未认证访客暴露内部环境变量名
      setError(t("login.err.oauthUnavailable"));
    }

    // Session 过期提示
    const expired = searchParams.get("expired");
    if (expired === "1") {
      setInfo(t("login.err.sessionExpired"));
    }

    // 密码修改成功提示
    const changed = searchParams.get("changed");
    if (changed === "1") {
      setInfo(t("login.err.passwordChanged"));
    }

    isQQConfigured().then(setQqAvailable).catch(() => setQqAvailable(false));
  }, [searchParams, t]);

  // 邮箱倒计时
  const startEmailCountdown = useCallback(() => {
    setEmailCountdown(60);

    if (emailTimerRef.current) {
      clearInterval(emailTimerRef.current);
    }

    emailTimerRef.current = setInterval(() => {
      setEmailCountdown((prev: number) => {
        if (prev <= 1) {
          if (emailTimerRef.current) {
            clearInterval(emailTimerRef.current);
            emailTimerRef.current = null;
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  useEffect(() => {
    return () => {
      if (emailTimerRef.current) {
        clearInterval(emailTimerRef.current);
      }
    };
  }, []);

  const handleTabChange = (tab: LoginTab) => {
    setActiveTab(tab);
    setError(null);
    setInfo(null);
  };

  const redirectByRole = (role?: string) => {
    // 使用 window.location.href 强制整页刷新
    // router.push() 是客户端软导航，可能在浏览器处理 Set-Cookie 之前发起 RSC 请求
    // 导致中间件读不到 session cookie → 重定向回 /login → 用户看到登录页不动
    // window.location.href 是整页跳转，浏览器会先处理 Server Action 响应中的 Set-Cookie
    const target = role === "admin" ? "/admin/dashboard" : "/profile";
    window.location.href = target;
  };

  // ==================== 发送邮箱验证码 ====================
  // 调用 Server Action，由服务端生成验证码并发送邮件
  const handleSendEmailOtp = async () => {
    setError(null);
    setInfo(null);

    if (!email) {
      setError(t("login.err.emailRequired"));
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError(t("login.err.emailInvalid"));
      return;
    }

    setEmailSending(true);
    try {
      const result = await sendEmailOtp(email);

      if (!result.success) {
        setError(result.error ?? t("login.err.sendOtpFailed"));
        return;
      }

      setInfo(t("login.err.otpSent"));
      startEmailCountdown();
    } catch {
      setError(t("login.err.sendOtpUnknown"));
    } finally {
      setEmailSending(false);
    }
  };

  // ==================== 验证邮箱验证码 ====================
  // 通过 API Route Handler 完成：验证码校验 + 建立会话 + 创建 profile
  // 使用 fetch 而非 Server Action，避免 Vercel 上 Server Action 被中止（ERR_ABORTED）
  // API Route 通过标准 HTTP 响应设置 Set-Cookie，更可靠
  const handleVerifyEmailOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);

    if (!email || !emailCode) {
      setError(t("login.err.emailAndCodeRequired"));
      return;
    }
    if (emailCode.length !== 6) {
      setError(t("login.err.code6Digits"));
      return;
    }

    setEmailVerifying(true);
    try {
      const response = await fetch("/api/authentication/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code: emailCode }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        setError(result.error ?? t("login.err.verifyFailed"));
        return;
      }

      redirectByRole(result.role);
    } catch (err) {
      console.error("[Login] 客户端异常:", err);
      setError(t("login.err.loginUnknownRetry"));
    } finally {
      setEmailVerifying(false);
    }
  };

  // ==================== QQ 登录 ====================
  const handleQQLogin = async () => {
    setError(null);
    setInfo(null);
    setOauthLoading(true);

    try {
      const result = await signInWithQQ();
      if (result.success && result.url) {
        window.location.href = result.url;
      } else {
        setError(result.error ?? t("login.err.qqLoginFailed"));
        setOauthLoading(false);
      }
    } catch {
      setError(t("login.err.qqLoginUnknown"));
      setOauthLoading(false);
    }
  };

  // ==================== 密码登录：邮箱失焦检查是否已设置密码 ====================
  // 当用户在密码登录 Tab 输入邮箱后，调用 checkEmailHasPassword 判断该邮箱是否可使用密码登录
  // - 统一返回 canUsePassword，避免泄露"邮箱是否存在"或"是否已设置密码"等敏感信息
  const handlePasswordEmailBlur = async () => {
    if (!passwordEmail) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(passwordEmail)) return;

    setPasswordChecking(true);
    try {
      const result = await checkEmailHasPassword(passwordEmail);
      if (!result.canUsePassword) {
        setInfo(t("login.err.emailNoPassword"));
      }
    } catch {
      // 检查失败时不阻断流程，交给登录接口校验
    } finally {
      setPasswordChecking(false);
    }
  };

  // ==================== 密码登录 ====================
  // 密码登录与验证码登录统一走 Route Handler，确保 Set-Cookie 可靠持久化。
  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);

    if (!passwordEmail) {
      setError(t("login.err.emailRequired"));
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(passwordEmail)) {
      setError(t("login.err.emailInvalid"));
      return;
    }
    if (!password) {
      setError(t("login.err.passwordRequired"));
      return;
    }

    setPasswordLoading(true);
    try {
      const response = await fetch("/api/authentication/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: passwordEmail, password }),
      });
      const result = await response.json();

      if (!response.ok || !result?.success) {
        setError(result?.error ?? t("login.err.loginFailed"));
        return;
      }

      redirectByRole(result.role);
    } catch (err) {
      console.error("[Login] 密码登录客户端异常:", err);
      setError(t("login.err.loginUnknown"));
    } finally {
      setPasswordLoading(false);
    }
  };

  const tabs: { key: LoginTab; label: string }[] = qqAvailable
    ? [
        { key: "email", label: t("login.tab.email") },
        { key: "password", label: t("login.tab.password") },
        { key: "qq", label: t("login.tab.qq") },
      ]
    : [
        { key: "email", label: t("login.tab.email") },
        { key: "password", label: t("login.tab.password") },
      ];

  return (
    <div className="lf-root">
      {/* 顶部栏（墨色极简） */}
      <header className="lf-top">
        <div className="lf-top-inner">
          <Link href="/" className="lf-brand">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/longwoo-logo.svg" alt="LongWoo 龙坞" />
            <b>龙坞</b>
            <span>LongWoo Studio</span>
          </Link>
          <LangSwitcher />
        </div>
      </header>

      {/* 主体 */}
      <main className="lf-main">
        <div className="lf-card">
          <div>
            <p className="lf-kicker">LONGWOO · ACCESS</p>
            <h1 className="lf-title">{t("login.title")}</h1>
            <p className="lf-sub">{t("login.subtitle")}</p>
          </div>

          {/* 登录方式 Tab（保留 id/role 结构） */}
          <div className="lf-tabs" role="tablist">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                role="tab"
                id={`tab-${tab.key}`}
                aria-selected={activeTab === tab.key}
                aria-controls={`tabpanel-${tab.key}`}
                onClick={() => handleTabChange(tab.key)}
                className={`lf-tab ${activeTab === tab.key ? "lf-tab--active" : ""}`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {error && <div className="lf-msg lf-msg--err">{error}</div>}

          {info && !error && <div className="lf-msg lf-msg--ok">{info}</div>}

          {activeTab === "email" && (
            <form
              onSubmit={handleVerifyEmailOtp}
              role="tabpanel"
              id="tabpanel-email"
              aria-labelledby="tab-email"
              className="lf-form"
            >
              <div className="lf-field">
                <label htmlFor="email-input">邮箱地址</label>
                <div className="lf-input-wrap">
                  <input
                    id="email-input"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={t("login.email.placeholder")}
                    autoComplete="email"
                    className="lf-input"
                  />
                </div>
              </div>

              <div className="lf-field">
                <label htmlFor="email-code">{t("login.code.label")}</label>
                <div className="lf-input-row">
                  <input
                    id="email-code"
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={emailCode}
                    onChange={(e) =>
                      setEmailCode(e.target.value.replace(/\D/g, ""))
                    }
                    placeholder={t("login.code.placeholder")}
                    className="lf-input lf-input--code"
                  />
                  <button
                    type="button"
                    onClick={handleSendEmailOtp}
                    disabled={
                      emailSending ||
                      emailCountdown > 0 ||
                      !email
                    }
                    className="lf-btn lf-btn--outline"
                  >
                    {emailSending ? (
                      <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                    ) : emailCountdown > 0 ? (
                      `${emailCountdown}s 后重发`
                    ) : (
                      t("login.btn.email")
                    )}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={emailVerifying}
                className="lf-btn"
              >
                {emailVerifying && <Loader2 className="w-4 h-4 animate-spin" />}
                {emailVerifying ? t("login.btn.login") + "..." : t("login.btn.login")}
              </button>
            </form>
          )}

          {activeTab === "password" && (
            <form
              onSubmit={handlePasswordLogin}
              role="tabpanel"
              id="tabpanel-password"
              aria-labelledby="tab-password"
              className="lf-form"
            >
              <div className="lf-field">
                <label htmlFor="password-email-input">
                  {t("login.email.label")}
                </label>
                <div className="lf-input-wrap">
                  <input
                    id="password-email-input"
                    type="email"
                    value={passwordEmail}
                    onChange={(e) => setPasswordEmail(e.target.value)}
                    onBlur={handlePasswordEmailBlur}
                    placeholder={t("login.email.placeholder")}
                    autoComplete="email"
                    className="lf-input"
                  />
                </div>
              </div>

              <div className="lf-field">
                <div className="lf-field-head">
                  <label htmlFor="password-input">
                    {t("login.password.label")}
                  </label>
                  <button
                    type="button"
                    onClick={() => setResetOpen(true)}
                    className="lf-forgot"
                  >
                    <KeyRound className="w-3 h-3" />
                    {t("login.forgot")}
                  </button>
                </div>
                <div className="lf-input-wrap">
                  <input
                    id="password-input"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={t("login.password.placeholder")}
                    autoComplete="current-password"
                    className="lf-input"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={passwordLoading || passwordChecking}
                className="lf-btn"
              >
                {(passwordLoading || passwordChecking) && (
                  <Loader2 className="w-4 h-4 animate-spin" />
                )}
                {passwordLoading
                  ? t("login.btn.login") + "..."
                  : passwordChecking
                  ? t("login.btn.login") + "..."
                  : t("login.btn.login")}
              </button>
            </form>
          )}

          {activeTab === "qq" && (
            <div
              role="tabpanel"
              id="tabpanel-qq"
              aria-labelledby="tab-qq"
              className="lf-qq"
            >
              <div className="lf-qq-icon">
                <QQIcon className="w-6 h-6" />
              </div>
              <h3 className="lf-qq-title">{t("login.tab.qq")} 登录</h3>
              <p className="lf-qq-desc">点击下方按钮使用 QQ 账号快捷登录</p>

              <button
                type="button"
                onClick={handleQQLogin}
                disabled={oauthLoading}
                className="lf-btn lf-btn--qq"
              >
                {oauthLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <QQIcon className="w-5 h-5" />
                )}
                {oauthLoading ? "正在跳转..." : t("login.btn.qq")}
              </button>

              <p className="lf-qq-note">首次使用 QQ 登录将自动注册账号</p>
            </div>
          )}

          <Link href="/" className="lf-back">
            <ArrowLeft className="w-4 h-4" />
            返回首页
          </Link>
        </div>
      </main>

      <footer className="lf-foot">
        <p>© {new Date().getFullYear()} LongWoo Studio. All rights reserved.</p>
      </footer>

      {/* 忘记密码弹窗（邮箱验证码重置，无需旧密码） */}
      <PasswordResetModal
        open={resetOpen}
        onClose={() => setResetOpen(false)}
      />
    </div>
  );
}

// ==================== 默认导出（Suspense 包裹） ====================
export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-white">
          <Loader2 className="w-6 h-6 animate-spin text-neutral-400" />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
