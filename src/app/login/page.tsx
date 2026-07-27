"use client";

import { useState, useEffect, useRef, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Loader2, Mail, ArrowLeft, Sparkles } from "lucide-react";
import {
  ensureProfileAfterLogin,
  signInWithQQ,
} from "@/actions/auth-actions";
import { createClient } from "@/lib/supabase/client";

type LoginTab = "email" | "qq";

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
  const router = useRouter();
  const searchParams = useSearchParams();

  const [activeTab, setActiveTab] = useState<LoginTab>("email");

  // 邮箱登录状态
  const [email, setEmail] = useState("");
  const [emailCode, setEmailCode] = useState("");
  const [emailSending, setEmailSending] = useState(false);
  const [emailVerifying, setEmailVerifying] = useState(false);
  const [emailCountdown, setEmailCountdown] = useState(0);

  // OAuth 状态
  const [oauthLoading, setOauthLoading] = useState(false);

  // 错误与提示
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  // 邮箱倒计时定时器
  const emailTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 读取 URL 错误参数
  useEffect(() => {
    const errParam = searchParams.get("error");
    if (errParam === "oauth_failed") {
      setError("第三方登录失败，请重试或选择其他登录方式");
    }
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

  // 组件卸载时清理定时器
  useEffect(() => {
    return () => {
      if (emailTimerRef.current) {
        clearInterval(emailTimerRef.current);
      }
    };
  }, []);

  // 切换 Tab 时清空状态
  const handleTabChange = (tab: LoginTab) => {
    setActiveTab(tab);
    setError(null);
    setInfo(null);
  };

  // 跳转逻辑
  const redirectByRole = (role?: string) => {
    if (role === "admin") {
      router.push("/admin/dashboard");
    } else {
      router.push("/studio/dashboard");
    }
    router.refresh();
  };

  // ==================== 发送邮箱验证码 ====================
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
      const supabase = createClient();
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: true,
        },
      });

      if (otpError) {
        setError(otpError.message);
      } else {
        setInfo("验证码已发送，请查收邮箱");
        startEmailCountdown();
      }
    } catch {
      setError("发送验证码时发生未知错误");
    } finally {
      setEmailSending(false);
    }
  };

  // ==================== 验证邮箱验证码 ====================
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
      const supabase = createClient();

      // 先尝试 signup 类型（新用户注册）
      let { data: verifyData, error: verifyError } =
        await supabase.auth.verifyOtp({
          email,
          token: emailCode,
          type: "signup",
        });

      // signup 失败，尝试 magiclink 类型（已有用户登录）
      if (verifyError) {
        const retryResult = await supabase.auth.verifyOtp({
          email,
          token: emailCode,
          type: "magiclink",
        });
        verifyData = retryResult.data;
        verifyError = retryResult.error;
      }

      if (verifyError) {
        setError(verifyError.message);
        return;
      }

      // 验证成功，调用 Server Action 确保 profile 存在（自动注册、默认普通用户）
      const result = await ensureProfileAfterLogin();
      if (result.success) {
        redirectByRole(result.role);
      } else {
        // profile 创建失败，但仍已登录，跳转到工作台
        redirectByRole("studio");
      }
    } catch {
      setError("登录时发生未知错误");
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

  // ==================== Tab 配置 ====================
  const tabs: { key: LoginTab; label: string }[] = [
    { key: "email", label: "邮箱验证码" },
    { key: "qq", label: "QQ登录" },
  ];

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-lw-gray py-8 px-4">
      <div className="w-full max-w-4xl bg-white rounded-3xl shadow-xl overflow-hidden grid md:grid-cols-2">
        {/* ============ 左侧品牌区 ============ */}
        <div className="relative hidden md:flex flex-col justify-between p-10 bg-gradient-to-br from-lw-black via-gray-900 to-lw-accent text-white overflow-hidden">
          {/* 背景装饰 */}
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-10 right-10 w-40 h-40 rounded-full bg-white blur-3xl" />
            <div className="absolute bottom-20 left-10 w-32 h-32 rounded-full bg-lw-accent blur-2xl" />
          </div>

          {/* Logo 区 */}
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

          {/* 标语区 */}
          <div className="relative z-10 space-y-4">
            <h2 className="text-3xl font-bold leading-tight">
              专业兽装定制
              <br />
              匠心铸造每一件作品
            </h2>
            <p className="text-white/70 text-sm leading-relaxed">
              专注于高品质定制服务，从设计到交付，每一处细节都倾注我们的热忱与专业。
            </p>
            <div className="flex items-center gap-6 pt-4">
              <div>
                <div className="text-2xl font-bold">500+</div>
                <div className="text-xs text-white/60">完成作品</div>
              </div>
              <div className="w-px h-10 bg-white/20" />
              <div>
                <div className="text-2xl font-bold">98%</div>
                <div className="text-xs text-white/60">客户满意</div>
              </div>
              <div className="w-px h-10 bg-white/20" />
              <div>
                <div className="text-2xl font-bold">5年+</div>
                <div className="text-xs text-white/60">行业经验</div>
              </div>
            </div>
          </div>

          {/* 底部 */}
          <div className="relative z-10 text-xs text-white/50">
            © {new Date().getFullYear()} LongWoo Studio. All rights reserved.
          </div>
        </div>

        {/* ============ 右侧登录表单区 ============ */}
        <div className="flex flex-col p-6 sm:p-10">
          {/* 移动端 Logo */}
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

          {/* 标题 */}
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-lw-black">欢迎回来</h1>
            <p className="text-sm text-gray-500 mt-1">
              请选择登录方式进入您的工作台
            </p>
          </div>

          {/* Tab 切换 */}
          <div className="flex border-b border-gray-200 mb-6">
            {tabs.map((tab) => (
              <button
                key={tab.key}
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

          {/* 错误信息 */}
          {error && (
            <div className="mb-4 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
              {error}
            </div>
          )}

          {/* 提示信息 */}
          {info && !error && (
            <div className="mb-4 px-4 py-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-600">
              {info}
            </div>
          )}

          {/* 表单内容 */}
          <div className="flex-1">
            {/* ====== 邮箱验证码登录 ====== */}
            {activeTab === "email" && (
              <form onSubmit={handleVerifyEmailOtp} className="space-y-5">
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

            {/* ====== QQ 登录 ====== */}
            {activeTab === "qq" && (
              <div className="space-y-6">
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

          {/* 底部返回首页 */}
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
