"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Check,
  Copy,
  Download,
  FileJson,
  Loader2,
  LogOut,
  Shield,
  UserRound,
  X,
} from "lucide-react";
import { useSession, clearSessionCache } from "@/components/providers/SessionProvider";
import { logoutUser } from "@/actions/auth-actions";
import { useLanguage } from "@/components/i18n/LanguageProvider";
import type { SamplerSnapshot } from "@/components/gray-test/UnifiedSampler";
import "./sampler-dock.css";

const LANG_KEY = "lw_lang";
type PanelId = "none" | "export" | "account";

type ExportPhase =
  | { phase: "idle" }
  | { phase: "checking" }
  | { phase: "guest" }
  | { phase: "denied"; message: string }
  | { phase: "ready" };

/** 拼装可粘贴的纯文本选色清单 */
function buildExportText(s: SamplerSnapshot): string {
  const lines: string[] = [];
  const pad = (n: number) => String(n).padStart(2, "0");
  const d = new Date(s.exportedAt);
  const stamp = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  lines.push("LongWoo · 毛布取色方案");
  lines.push(`生成时间：${stamp}`);
  lines.push(
    `图片来源：${s.source.name ?? "未命名"}（${s.source.width ?? "-"} × ${s.source.height ?? "-"} px）`
  );
  const db = s.database;
  lines.push(
    `数据库：潘通 ${db.pantoneCount} 条 · 毛布 ${db.fabricCount} 色 / ${db.vendors.length} 家 · 已开启 ${db.vendorsOn.length} 家`
  );
  lines.push("");
  for (const p of s.points) {
    lines.push(
      `[${String(p.index).padStart(2, "0")}] ${p.hex.toUpperCase()}  rgb(${p.rgb.r}, ${p.rgb.g}, ${p.rgb.b})  @(${p.x}, ${p.y})`
    );
    const ptText = p.pantones
      .map((pt) => `${pt.code}${pt.name && pt.name !== pt.code ? " " + pt.name : ""} (Δ${pt.delta.toFixed(3)})`)
      .join(" / ");
    if (ptText) lines.push(`    Pantone：${ptText}`);
    const fbText = p.fabrics
      .map(
        (f) => `${f.name} · ${f.vendor} ${f.skuId} · ${(f.ph / 10).toFixed(1)}cm (Δ${f.delta.toFixed(3)})`
      )
      .join(" / ");
    if (fbText) lines.push(`    毛布参考：${fbText}`);
    lines.push("");
  }
  return lines.join("\n");
}

export default function SamplerDock() {
  const { profile } = useSession();
  const { lang: initialLang } = useLanguage();
  const [uiLang, setUiLang] = useState<"zh" | "en">(initialLang);
  const [panel, setPanel] = useState<PanelId>("none");
  const [exportState, setExportState] = useState<ExportPhase>({ phase: "idle" });
  const [loggingOut, setLoggingOut] = useState(false);
  const [copied, setCopied] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const isAdmin = profile?.role === "admin";

  // 点击外部 / Esc 收起
  useEffect(() => {
    if (panel === "none") return;
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setPanel("none");
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPanel("none");
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [panel]);

  /**
   * 语言切换（取色器内部保留现场，不做整页跳转）：
   * 与首页一致即时切换字形高亮；语言持久化到 cookie/localStorage，
   * 后续普通导航（个人中心等）按新语言渲染。
   */
  const handleLangToggle = useCallback(() => {
    const next: "zh" | "en" = uiLang === "zh" ? "en" : "zh";
    setUiLang(next);
    try {
      localStorage.setItem(LANG_KEY, next);
    } catch {
      /* ignore */
    }
    document.cookie = `${LANG_KEY}=${next}; path=/; max-age=31536000; SameSite=Lax`;
    document.documentElement.lang = next === "en" ? "en" : "zh-CN";
  }, [uiLang]);

  const openExport = useCallback(() => {
    setPanel((p) => (p === "export" ? "none" : "export"));
  }, []);

  // 打开导出面板时做服务端授权检查（登录 + 管理员 + testB 标签）
  useEffect(() => {
    if (panel !== "export") return;
    let alive = true;
    if (!profile) {
      setExportState({ phase: "guest" });
      return;
    }
    setExportState({ phase: "checking" });
    fetch("/api/sampler/export-check", { cache: "no-store" })
      .then(async (res) => {
        if (!alive) return;
        if (res.status === 401) {
          setExportState({ phase: "guest" });
          return;
        }
        if (res.status === 403) {
          const data = await res.json().catch(() => null);
          setExportState({
            phase: "denied",
            message:
              data?.error ?? "账号未获「测试B」导出授权标签，请联系超管开通后使用",
          });
          return;
        }
        setExportState({ phase: "ready" });
      })
      .catch(() => {
        if (alive) setExportState({ phase: "denied", message: "授权检查失败，请稍后重试" });
      });
    return () => {
      alive = false;
    };
  }, [panel, profile]);

  const getSnapshot = useCallback((): SamplerSnapshot | null => {
    if (typeof window === "undefined") return null;
    return window.__longwooSamplerSnapshot ?? null;
  }, []);

  const handleDownloadJson = useCallback(() => {
    const s = getSnapshot();
    if (!s || s.points.length === 0) return;
    const blob = new Blob([JSON.stringify(s, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, "0");
    a.href = url;
    a.download = `longwoo-sampler-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setDownloaded(true);
    window.setTimeout(() => setDownloaded(false), 2000);
  }, [getSnapshot]);

  const handleCopyText = useCallback(async () => {
    const s = getSnapshot();
    if (!s || s.points.length === 0) return;
    try {
      await navigator.clipboard.writeText(buildExportText(s));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* 剪贴板不可用时忽略 */
    }
  }, [getSnapshot]);

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
  const snapshot = panel === "export" ? getSnapshot() : null;
  const pointCount = snapshot?.points.length ?? 0;
  const hasPoints = (snapshot?.points.length ?? 0) > 0;
  const ready = exportState.phase === "ready";

  return (
    <div className="sd gt2-dock" ref={wrapRef}>
      {/* 1. 语言切换圆（与首页一致：中 / En） */}
      <button
        type="button"
        className="gt2-dock-circle gt2-dock-lang"
        onClick={handleLangToggle}
        aria-label="切换语言 / Switch language"
        title="切换语言"
      >
        <span data-on={uiLang === "zh"}>中</span>
        <i aria-hidden="true">/</i>
        <span data-on={uiLang === "en"}>En</span>
      </button>

      {/* 2. 数据导出圆（需登录 + 管理员 + 测试B 授权） */}
      <div className="gt2-dock-pop">
        <button
          type="button"
          className="gt2-dock-circle"
          onClick={openExport}
          aria-expanded={panel === "export"}
          aria-label="数据导出"
          title="数据导出"
        >
          <Download strokeWidth={1.8} />
        </button>

        {panel === "export" && (
          <div className="gt2-dock-panel gt2-dock-panel--export">
            <div className="gt2-dock-panel-head">
              <span>数据导出</span>
              {ready && <span className="gt2-field-count">{pointCount} 点</span>}
              <button
                type="button"
                onClick={() => setPanel("none")}
                aria-label="关闭"
                className="ml-auto -mr-1 p-1 text-neutral-400 hover:text-neutral-900 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="px-3 pb-3 pt-1">
              {exportState.phase === "checking" && (
                <div className="flex items-center justify-center gap-2 py-8 text-neutral-400">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-xs">授权检查中…</span>
                </div>
              )}

              {exportState.phase === "guest" && (
                <div className="py-5 text-center">
                  <p className="text-[13px] text-neutral-800 font-medium">导出取色数据需要登录</p>
                  <p className="text-[11px] text-neutral-400 mt-1">
                    登录后需为管理员并携带「测试B」授权标签方可导出到电脑
                  </p>
                  <Link
                    href="/login?next=/sampler"
                    onClick={() => setPanel("none")}
                    className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-neutral-900 text-white text-xs px-5 py-2.5 hover:opacity-85 transition-opacity"
                  >
                    去登录
                  </Link>
                </div>
              )}

              {exportState.phase === "denied" && (
                <div className="py-5 text-center">
                  <p className="text-[13px] text-neutral-800 font-medium">暂无导出权限</p>
                  <p className="text-[11px] text-neutral-400 mt-1.5 leading-relaxed">
                    {exportState.message}
                  </p>
                </div>
              )}

              {ready && (
                <>
                  {/* 来源与数据库摘要 */}
                  <div className="rounded-xl bg-neutral-50 border border-neutral-100 px-3 py-2.5 text-[11px] text-neutral-600 leading-relaxed">
                    <p className="truncate">
                      <span className="text-neutral-400">图片 · </span>
                      {snapshot?.source.name ?? "未命名"}
                      {snapshot?.source.width ? `（${snapshot.source.width} × ${snapshot.source.height} px）` : ""}
                    </p>
                    <p className="truncate">
                      <span className="text-neutral-400">数据库 · </span>
                      潘通 {snapshot?.database.pantoneCount ?? "-"} 条 · 毛布{" "}
                      {snapshot?.database.fabricCount ?? "-"} 色 /{" "}
                      {snapshot?.database.vendors.length ?? "-"} 家
                    </p>
                  </div>

                  {hasPoints ? (
                    <>
                      {/* 选点预览 */}
                      <div className="flex flex-wrap gap-1.5 mt-2.5">
                        {snapshot?.points.map((p) => (
                          <span
                            key={p.index}
                            title={`#${p.hex} (${p.x}, ${p.y})`}
                            className="w-5 h-5 rounded-md border border-neutral-200"
                            style={{ backgroundColor: p.hex }}
                          />
                        ))}
                      </div>
                      <div className="flex gap-2 mt-3">
                        <button
                          type="button"
                          onClick={handleDownloadJson}
                          className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-full bg-neutral-900 text-white text-xs px-4 py-2.5 hover:opacity-85 transition-opacity cursor-pointer"
                        >
                          {downloaded ? <Check className="w-3.5 h-3.5" /> : <FileJson className="w-3.5 h-3.5" />}
                          {downloaded ? "已下载" : "下载 JSON"}
                        </button>
                        <button
                          type="button"
                          onClick={handleCopyText}
                          className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-full border border-neutral-900 text-neutral-900 text-xs px-4 py-2.5 hover:bg-neutral-900 hover:text-white transition-colors cursor-pointer"
                        >
                          {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                          {copied ? "已复制" : "复制文本"}
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="py-5 text-center">
                      <p className="text-[12px] text-neutral-400">
                        尚未取色 —— 先上传图片并点击添加取色点，即可导出方案
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 3. 用户气泡（与首页一致：登录胶囊 / 头像 + 账户菜单） */}
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
              <span className="gt2-dock-username max-w-[72px]">{displayName}</span>
            </button>

            {panel === "account" && (
              <div className="gt2-dock-panel gt2-dock-panel--account">
                <Link className="gt2-dock-menu-item" href="/profile" prefetch={false}>
                  <UserRound />
                  个人中心
                </Link>
                {isAdmin && (
                  <Link className="gt2-dock-menu-item" href="/admin/dashboard" prefetch={false}>
                    <Shield />
                    管理后台
                  </Link>
                )}
                <button
                  type="button"
                  className="gt2-dock-menu-item gt2-dock-menu-item--danger"
                  onClick={handleLogout}
                  disabled={loggingOut}
                >
                  {loggingOut ? <Loader2 className="animate-spin" /> : <LogOut />}
                  {loggingOut ? "退出中…" : "退出登录"}
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
              <b>Sign up</b>
              <small>登录/注册</small>
            </span>
          </Link>
        )}
      </div>
    </div>
  );
}
