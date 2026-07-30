"use client";

import { useState, useEffect, useRef, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Loader2, Mail, ArrowLeft, Sparkles, Lock } from "lucide-react";
import {
  sendEmailOtp,
  signInWithQQ,
  isQQConfigured,
} from "@/actions/auth-actions";
import {
  loginWithPassword,
  checkEmailHasPassword,
} from "@/actions/profile-actions";

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

  // 邮箱倒计时定时器
  const emailTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 读取 URL 错误参数 & 检查 QQ 登录是否已配置
  useEffect(() => {
    const errParam = searchParams.get("error");
    if (errParam === "oauth_failed") {
      setError("第三方登录失败，请重试或选择其他登录方式");
    } else if (errParam === "qq_not_configured") {
      setError("QQ登录尚未配置，请在环境变量中填写 QQ_CLIENT_ID 和 QQ_CLIENT_SECRET");
    }

    // Session 过期提示
    const expired = searchParams.get("expired");
    if (expired === "1") {
      setInfo("登录状态已过期，请重新登录");
    }

    isQQConfigured().then(setQqAvailable).catch(() => setQqAvailable(false));
  }, [searchParams]);

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
      setError("请输入邮箱地址");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("请输入有效的邮箱地址");
      return;
    }

    setEmailSending(true);
    try {
      const result = await sendEmailOtp(email);

      if (!result.success) {
        setError(result.error ?? "发送验证码失败");
        return;
      }

      setInfo("验证码已发送，请查收邮箱");
      startEmailCountdown();
    } catch {
      setError("发送验证码时发生未知错误");
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
      setError("请输入邮箱和验证码");
      return;
    }
    if (emailCode.length !== 6) {
      setError("请输入6位验证码");
      return;
    }

    setEmailVerifying(true);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, code: emailCode }),
      });

      const result = await response.json();
      console.log("[Login] API 返回:", result, "HTTP状态:", response.status);

      if (!response.ok || !result.success) {
        setError(result.error ?? "验证失败");
        return;
      }

      redirectByRole(result.role);
    } catch (err) {
      console.error("[Login] 客户端异常:", err);
      setError("登录时发生未知错误，请稍后重试");
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
        setError(result.error ?? "QQ 登录失败");
        setOauthLoading(false);
      }
    } catch {
      setError("QQ 登录时发生未知错误");
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
        setInfo("该邮箱无法使用密码登录，请使用邮箱验证码登录");
      }
    } catch {
      // 检查失败时不阻断流程，交给登录接口校验
    } finally {
      setPasswordChecking(false);
    }
  };

  // ==================== 密码登录 ====================
  // 调用 loginWithPassword Server Action，成功后按角色跳转
  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);

    if (!passwordEmail) {
      setError("请输入邮箱地址");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(passwordEmail)) {
      setError("请输入有效的邮箱地址");
      return;
    }
    if (!password) {
      setError("请输入密码");
      return;
    }

    setPasswordLoading(true);
    try {
      const result = await loginWithPassword(passwordEmail, password);
      console.log("[Login] 密码登录 Server Action 返回:", result);

      if (!result || !result.success) {
        setError(result?.error ?? "登录失败，请检查邮箱和密码");
        return;
      }

      redirectByRole(result.role);
    } catch (err) {
      console.error("[Login] 密码登录客户端异常:", err);
      setError("登录时发生未知错误");
    } finally {
      setPasswordLoading(false);
    }
  };

  const tabs: { key: LoginTab; label: string }[] = qqAvailable
    ? [
        { key: "email", label: "邮箱验证码" },
        { key: "password", label: "密码登录" },
        { key: "qq", label: "QQ登录" },
      ]
    : [
        { key: "email", label: "邮箱验证码" },
        { key: "password", label: "密码登录" },
      ];

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-lw-gray py-8 px-4">
      <div className="w-full max-w-4xl bg-white rounded-3xl shadow-xl overflow-hidden grid md:grid-cols-2">
        {/* ============ 左侧品牌区 ============ */}
        <div className="relative hidden md:flex flex-col justify-between p-10 bg-gradient-to-br from-lw-black via-gray-900 to-lw-accent text-white overflow-hidden">
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-10 right-10 w-40 h-40 rounded-full bg-white blur-3xl" />
            <div className="absolute bottom-20 left-10 w-32 h-32 rounded-full bg-lw-accent blur-2xl" />
          </div>

          <div className="relative z-10">
            <Link href="/" className="inline-flex items-center gap-2">
              <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-sm flex items-center justify-center border border-white/20">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <span className="text-2xl font-bold tracking-tight">
                LongWoo Studio
              </span>
            </Link>
          </div>

          <div className="relative z-10 space-y-4">
            <h2 className="text-3xl font-bold leading-tight">
              专业兽装定制
              <br />
              匠心铸造每一件作品
            </h2>
            <p className="text-white/70 text-sm leading-relaxed">
              专注于高品质定制服务，从设计到交付，每一处细节都倾注我们的热忱与专业。
            </p>
          </div>

          <div className="relative z-10 text-xs text-white/50">
            © {new Date().getFullYear()} LongWoo Studio. All rights reserved.
          </div>
        </div>

        {/* ============ 右侧登录表单区 ============ */}
        <div className="flex flex-col p-6 sm:p-10">
          <div className="md:hidden mb-6 text-center">
            <Link href="/" className="inline-flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-lw-accent flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold tracking-tight text-lw-black">
                LongWoo Studio
              </span>
            </Link>
          </div>

          <div className="mb-6">
            <h1 className="text-2xl font-bold text-lw-black">欢迎回来</h1>
            <p className="text-sm text-gray-500 mt-1">
              请选择登录方式进入您的工作台
            </p>
          </div>

          <div className="flex border-b border-gray-200 mb-6" role="tablist">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                role="tab"
                id={`tab-${tab.key}`}
                aria-selected={activeTab === tab.key}
                aria-controls={`tabpanel-${tab.key}`}
                onClick={() => handleTabChange(tab.key)}
                className={`flex-1 pb-3 text-sm font-medium transition-colors relative cursor-pointer ${
                  activeTab === tab.key
                    ? "text-lw-accent"
                    : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {tab.label}
                {activeTab === tab.key && (
                  <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-lw-accent rounded-full" />
                )}
              </button>
            ))}
          </div>

          {error && (
            <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
              {error}
            </div>
          )}

          {info && !error && (
            <div className="mb-4 px-4 py-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-600">
              {info}
            </div>
          )}

          <div className="flex-1">
            {activeTab === "email" && (
              <form
                onSubmit={handleVerifyEmailOtp}
                role="tabpanel"
                id="tabpanel-email"
                aria-labelledby="tab-email"
                className="space-y-5"
              >
                <div>
                  <label
                    htmlFor="email-input"
                    className="block text-sm font-medium text-lw-black mb-1.5"
                  >
                    邮箱地址
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      id="email-input"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="请输入邮箱"
                      autoComplete="email"
                      className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-lw-accent focus:border-transparent transition"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="email-code"
                    className="block text-sm font-medium text-lw-black mb-1.5"
                  >
                    验证码
                  </label>
                  <div className="flex gap-3">
                    <input
                      id="email-code"
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      value={emailCode}
                      onChange={(e) =>
                        setEmailCode(e.target.value.replace(/\D/g, ""))
                      }
                      placeholder="请输入6位验证码"
                      className="flex-1 px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-lw-accent focus:border-transparent transition tracking-widest"
                    />
                    <button
                      type="button"
                      onClick={handleSendEmailOtp}
                      disabled={
                        emailSending ||
                        emailCountdown > 0 ||
                        !email
                      }
                      className="px-4 py-2.5 text-sm font-medium text-lw-accent border border-lw-accent rounded-lg hover:bg-blue-50 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap min-w-[110px]"
                    >
                      {emailSending ? (
                        <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                      ) : emailCountdown > 0 ? (
                        `${emailCountdown}s 后重发`
                      ) : (
                        "发送验证码"
                      )}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={emailVerifying}
                  className="w-full py-3 bg-lw-accent text-white rounded-lg font-medium hover:bg-blue-700 active:bg-blue-800 transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {emailVerifying && <Loader2 className="w-4 h-4 animate-spin" />}
                  {emailVerifying ? "登录中..." : "登录"}
                </button>
              </form>
            )}

            {activeTab === "password" && (
              <form
                onSubmit={handlePasswordLogin}
                role="tabpanel"
                id="tabpanel-password"
                aria-labelledby="tab-password"
                className="space-y-5"
              >
                <div>
                  <label
                    htmlFor="password-email-input"
                    className="block text-sm font-medium text-lw-black mb-1.5"
                  >
                    邮箱地址
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      id="password-email-input"
                      type="email"
                      value={passwordEmail}
                      onChange={(e) => setPasswordEmail(e.target.value)}
                      onBlur={handlePasswordEmailBlur}
                      placeholder="请输入邮箱"
                      autoComplete="email"
                      className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-lw-accent focus:border-transparent transition"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="password-input"
                    className="block text-sm font-medium text-lw-black mb-1.5"
                  >
                    密码
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      id="password-input"
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="请输入密码"
                      autoComplete="current-password"
                      className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-lw-accent focus:border-transparent transition"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={passwordLoading || passwordChecking}
                  className="w-full py-3 bg-lw-accent text-white rounded-lg font-medium hover:bg-blue-700 active:bg-blue-800 transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {(passwordLoading || passwordChecking) && (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  )}
                  {passwordLoading
                    ? "登录中..."
                    : passwordChecking
                    ? "检查中..."
                    : "登录"}
                </button>
              </form>
            )}

            {activeTab === "qq" && (
              <div
                role="tabpanel"
                id="tabpanel-qq"
                aria-labelledby="tab-qq"
                className="space-y-6"
              >
                <div className="text-center py-6">
                  <div className="w-16 h-16 mx-auto rounded-2xl bg-[#12B7F5]/10 flex items-center justify-center mb-4">
                    <QQIcon className="w-8 h-8 text-[#12B7F5]" />
                  </div>
                  <h3 className="text-lg font-medium text-lw-black mb-1">
                    QQ 账号登录
                  </h3>
                  <p className="text-sm text-gray-500">
                    点击下方按钮使用 QQ 账号快捷登录
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleQQLogin}
                  disabled={oauthLoading}
                  className="w-full py-3 bg-[#12B7F5] text-white rounded-lg font-medium hover:bg-[#0ea5e0] active:bg-[#0c95d0] transition-colors cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {oauthLoading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <QQIcon className="w-5 h-5" />
                  )}
                  {oauthLoading ? "正在跳转..." : "使用 QQ 登录"}
                </button>

                <p className="text-center text-xs text-gray-400">
                  首次使用 QQ 登录将自动注册账号
                </p>
              </div>
            )}
          </div>

          <div className="mt-8 pt-6 border-t border-gray-100">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-lw-accent transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              返回首页
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

// ==================== 默认导出（Suspense 包裹） ====================
export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-lw-gray">
          <Loader2 className="w-6 h-6 animate-spin text-lw-accent" />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
