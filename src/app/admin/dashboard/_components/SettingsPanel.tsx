"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Server,
  Database,
  Activity,
  ShieldCheck,
  Clock,
  Gauge,
  Mail,
  History,
  FileText,
  Loader2,
  CheckCircle2,
  XCircle,
  Pencil,
  Save,
  RotateCcw,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import {
  getSystemSettings,
  getOperationLogs,
  sendTestEmail,
  getTemplates,
  updateTemplate,
  resetTemplate,
  type SystemSettingsData,
  type OperationLogItem,
} from "@/actions/settings-actions";
import { formatDate } from "@/lib/utils";
import { useLanguage } from "@/components/i18n/LanguageProvider";

interface TemplateItem {
  key: string;
  label: string;
  title: string;
  content: string;
  email_subject: string;
  email_body: string;
  fromDb: boolean;
  updated_at: string | null;
}

const ACTION_LABEL_KEYS: Record<string, string> = {
  create_order: "admin.settings.action.createOrder",
  submit_estimate: "admin.settings.action.submitEstimate",
  accept_order: "admin.settings.action.acceptOrder",
  reject_order: "admin.settings.action.rejectOrder",
  update_status: "admin.settings.action.updateStatus",
  claim_order: "admin.settings.action.claimOrder",
  reply_site: "admin.settings.action.replySite",
  reply_email: "admin.settings.action.replyEmail",
  create_user: "admin.settings.action.createUser",
  update_user: "admin.settings.action.updateUser",
  deactivate_user: "admin.settings.action.deactivateUser",
  send_notification: "admin.settings.action.sendNotification",
};

export default function SettingsPanel({
  isSuperAdmin,
}: {
  isSuperAdmin: boolean;
}) {
  const { t } = useLanguage();
  const [info, setInfo] = useState<SystemSettingsData | null>(null);
  const [logs, setLogs] = useState<OperationLogItem[]>([]);
  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  // 邮件测试
  const [testEmail, setTestEmail] = useState("");
  const [mailSending, setMailSending] = useState(false);

  // 模板编辑
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<TemplateItem | null>(null);
  const [saving, setSaving] = useState(false);

  // 日志折叠
  const [logsExpanded, setLogsExpanded] = useState(false);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [infoRes, logRes, tplRes] = await Promise.all([
        getSystemSettings(),
        getOperationLogs(50),
        getTemplates(),
      ]);
      if (infoRes.success && infoRes.data) setInfo(infoRes.data);
      else setError(infoRes.error || t("admin.settings.err.loadInfoFailed"));
      if (logRes.success && logRes.data) setLogs(logRes.data);
      if (tplRes.success && tplRes.data) setTemplates(tplRes.data);
    } catch {
      setError(t("admin.settings.err.loadSettingsFailed"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadAll();
  }, [loadAll]);

  const handleSendTest = async () => {
    setMsg(null);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(testEmail.trim())) {
      setMsg({ type: "err", text: t("admin.settings.err.invalidEmail") });
      return;
    }
    setMailSending(true);
    try {
      const res = await sendTestEmail(testEmail.trim());
      setMsg(
        res.success
          ? { type: "ok", text: t("admin.settings.err.testSent") }
          : { type: "err", text: res.error || t("admin.settings.err.sendFailed") }
      );
    } catch {
      setMsg({ type: "err", text: t("admin.settings.err.testSendUnknown") });
    } finally {
      setMailSending(false);
    }
  };

  const handleSaveTemplate = async () => {
    if (!editingKey || !editForm) return;
    setSaving(true);
    setMsg(null);
    try {
      const res = await updateTemplate(editingKey, {
        title: editForm.title,
        content: editForm.content,
        email_subject: editForm.email_subject,
        email_body: editForm.email_body,
      });
      setMsg(
        res.success
          ? { type: "ok", text: t("admin.settings.err.templateSaved") }
          : { type: "err", text: res.error || t("admin.settings.err.saveFailed") }
      );
      if (res.success) {
        setEditingKey(null);
        setEditForm(null);
        const tplRes = await getTemplates();
        if (tplRes.success && tplRes.data) setTemplates(tplRes.data);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleResetTemplate = async (key: string) => {
    setMsg(null);
    try {
      const res = await resetTemplate(key);
      setMsg(
        res.success
          ? { type: "ok", text: t("admin.settings.err.templateReset") }
          : { type: "err", text: res.error || t("admin.settings.err.resetFailed") }
      );
      if (res.success) {
        const tplRes = await getTemplates();
        if (tplRes.success && tplRes.data) setTemplates(tplRes.data);
      }
    } catch {
      setMsg({ type: "err", text: t("admin.settings.err.resetFailed") });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-lw-accent" />
      </div>
    );
  }

  if (error && !info) {
    return (
      <div className="bg-white rounded-lg border border-gray-50 p-12 text-center">
        <p className="text-sm text-red-500">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-bold text-lw-black">{t("admin.settings.title")}</h1>
          <p className="text-sm text-gray-400 mt-1">
            {t("admin.settings.subtitle")}
            {isSuperAdmin ? t("admin.settings.superAdminTag") : t("admin.settings.readOnlyTag")}
          </p>
        </div>
        <button
          onClick={loadAll}
          className="px-3 py-2 text-sm font-medium text-lw-accent border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors cursor-pointer"
        >
          {t("admin.settings.refresh")}
        </button>
      </div>

      {msg && (
        <div
          className={`px-4 py-3 rounded-lg text-sm ${
            msg.type === "ok"
              ? "bg-green-50 text-green-700 border border-green-100"
              : "bg-red-50 text-red-600 border border-red-100"
          }`}
        >
          {msg.text}
        </div>
      )}

      {info && (
        <>
          {/* 环境与部署信息 */}
          <section className="bg-white rounded-lg shadow-sm border border-gray-50 p-5">
            <h2 className="text-sm font-semibold text-lw-black mb-4 flex items-center gap-2">
              <Server className="w-4 h-4 text-lw-accent" />
              {t("admin.settings.env")}
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <InfoCard label={t("admin.settings.envRuntime")} value={info.environment.nodeEnv === "production" ? t("admin.settings.envProduction") : info.environment.nodeEnv} highlight={info.environment.nodeEnv === "production"} />
              <InfoCard label={t("admin.settings.envSiteUrl")} value={info.environment.siteUrl} />
              <InfoCard label={t("admin.settings.envVersion")} value={info.environment.appVersion} />
              <InfoCard label={t("admin.settings.envBuild")} value={info.environment.buildNumber} />
              <InfoCard label={t("admin.settings.envZeroUid")} value={String(info.environment.zeroUserUid)} />
              <InfoCard label={t("admin.settings.envZeroConfig")} value={info.security.zeroUserUidConfigured ? t("admin.settings.configured") : t("admin.settings.defaultValue")} />
            </div>
          </section>

          {/* 数据库与订单统计 */}
          <section className="bg-white rounded-lg shadow-sm border border-gray-50 p-5">
            <h2 className="text-sm font-semibold text-lw-black mb-4 flex items-center gap-2">
              <Database className="w-4 h-4 text-lw-accent" />
              {t("admin.settings.db")}
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {info.database.map((d) => (
                <div key={d.table} className="rounded-lg bg-gray-50 p-3">
                  <p className="text-xs text-gray-500">{d.label}</p>
                  <p className="text-lg font-bold text-lw-black mt-1">
                    {d.count == null ? "—" : d.count.toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          </section>

          {/* 外部服务健康状态 */}
          <section className="bg-white rounded-lg shadow-sm border border-gray-50 p-5">
            <h2 className="text-sm font-semibold text-lw-black mb-4 flex items-center gap-2">
              <Activity className="w-4 h-4 text-lw-accent" />
              {t("admin.settings.services")}
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <ServiceCard name={t("admin.settings.svcSupabase")} ok={info.services.supabase} t={t} />
              <ServiceCard name={t("admin.settings.svcResend")} ok={info.services.resend} t={t} />
              <ServiceCard name={t("admin.settings.svcDeepseek")} ok={info.services.deepseek} t={t} />
            </div>
            <p className="text-xs text-gray-400 mt-3">
              {t("admin.settings.fromEmail")}{info.services.fromEmail} ｜ {t("admin.settings.contactEmail")}{info.services.contactEmail}
            </p>
          </section>

          {/* 安全与密钥配置状态 */}
          <section className="bg-white rounded-lg shadow-sm border border-gray-50 p-5">
            <h2 className="text-sm font-semibold text-lw-black mb-4 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-lw-accent" />
              {t("admin.settings.security")}
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <ConfigCard name={t("admin.settings.cfgCsrf")} ok={info.security.csrfEnabled} desc={t("admin.settings.cfgCsrfDesc")} />
              <ConfigCard name={t("admin.settings.cfgJwt")} ok={info.security.jwtSecret} desc={t("admin.settings.cfgJwtDesc")} />
              <ConfigCard name={t("admin.settings.cfgUpload")} ok={info.security.uploadTokenSecret} desc={t("admin.settings.cfgUploadDesc")} />
              <ConfigCard name={t("admin.settings.cfgCron")} ok={info.security.cronSecret} desc={t("admin.settings.cfgCronDesc")} />
            </div>
          </section>

          {/* 定时任务状态 */}
          <section className="bg-white rounded-lg shadow-sm border border-gray-50 p-5">
            <h2 className="text-sm font-semibold text-lw-black mb-4 flex items-center gap-2">
              <Clock className="w-4 h-4 text-lw-accent" />
              {t("admin.settings.cron")}
            </h2>
            <ul className="space-y-1.5 mb-3">
              {info.cron.scheduled.map((s) => (
                <li key={s} className="text-xs text-gray-600 flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                  {s}
                </li>
              ))}
            </ul>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <InfoCard label={t("admin.settings.cronRateRows")} value={info.cron.rateLimitsRows == null ? "—" : String(info.cron.rateLimitsRows)} />
              <InfoCard label={t("admin.settings.cronOtpRows")} value={info.cron.otpRows == null ? "—" : String(info.cron.otpRows)} />
              <InfoCard label={t("admin.settings.cronLogDays")} value={`${info.cron.logRetentionDays} ${t("admin.settings.daysUnit")}`} />
            </div>
          </section>

          {/* 速率限制参数 */}
          <section className="bg-white rounded-lg shadow-sm border border-gray-50 p-5">
            <h2 className="text-sm font-semibold text-lw-black mb-4 flex items-center gap-2">
              <Gauge className="w-4 h-4 text-lw-accent" />
              {t("admin.settings.rateLimits")}
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-400 border-b border-gray-100">
                    <th className="py-2 pr-4 font-medium">{t("admin.settings.param")}</th>
                    <th className="py-2 font-medium">{t("admin.settings.currentValue")}</th>
                  </tr>
                </thead>
                <tbody>
                  {info.rateLimits.map((r) => (
                    <tr key={r.key} className="border-b border-gray-50 last:border-0">
                      <td className="py-2 pr-4 text-gray-600">{r.label}</td>
                      <td className="py-2 font-mono text-xs text-gray-500">{r.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      {/* 邮件发送测试（超管） */}
      <section className="bg-white rounded-lg shadow-sm border border-gray-50 p-5">
        <h2 className="text-sm font-semibold text-lw-black mb-4 flex items-center gap-2">
          <Mail className="w-4 h-4 text-lw-accent" />
          {t("admin.settings.mailTest")}{!isSuperAdmin && t("admin.settings.mailTestTag")}
        </h2>
        <div className="flex gap-2">
          <input
            value={testEmail}
            onChange={(e) => setTestEmail(e.target.value)}
            placeholder={t("admin.settings.mailPh")}
            disabled={!isSuperAdmin}
            className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-lw-accent disabled:bg-gray-50 disabled:text-gray-400"
          />
          <button
            onClick={handleSendTest}
            disabled={!isSuperAdmin || mailSending}
            className="px-4 py-2 text-sm font-medium text-white bg-lw-accent rounded-lg hover:bg-blue-700 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
          >
            {mailSending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {t("admin.settings.mailSend")}
          </button>
        </div>
      </section>

      {/* 操作日志时间线（第11项） */}
      <section className="bg-white rounded-lg shadow-sm border border-gray-50 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-lw-black flex items-center gap-2">
            <History className="w-4 h-4 text-lw-accent" />
            {t("admin.settings.logTimeline")}{logsExpanded ? logs.length : 8}{t("admin.settings.logItems")}
          </h2>
          <button
            onClick={() => setLogsExpanded(!logsExpanded)}
            className="text-xs text-lw-accent flex items-center gap-0.5 cursor-pointer"
          >
            {logsExpanded ? (
              <>
                {t("admin.settings.collapse")} <ChevronUp className="w-3 h-3" />
              </>
            ) : (
              <>
                {t("admin.settings.expandAll")} <ChevronDown className="w-3 h-3" />
              </>
            )}
          </button>
        </div>
        {logs.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">{t("admin.settings.noLogs")}</p>
        ) : (
          <div className="relative pl-5 space-y-4">
            {/* 时间线竖线 */}
            <div className="absolute left-[7px] top-1 bottom-1 w-px bg-gray-100" />
            {logs.slice(0, logsExpanded ? logs.length : 8).map((log) => (
              <div key={log.id} className="relative">
                <span className="absolute -left-5 top-1.5 w-2.5 h-2.5 rounded-full bg-lw-accent border-2 border-white shadow" />
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-lw-black">
                    {ACTION_LABEL_KEYS[log.action] ? t(ACTION_LABEL_KEYS[log.action]) : log.action}
                  </span>
                  {log.order_no && (
                    <span className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 text-[10px] font-mono">
                      {log.order_no}
                    </span>
                  )}
                  <span className="text-xs text-gray-400">
                    {log.operator ? `${log.operator} · ` : ""}
                    {formatDate(log.created_at)}
                  </span>
                </div>
                {log.details && (
                  <p className="text-xs text-gray-500 mt-0.5">
                    {JSON.stringify(log.details).slice(0, 120)}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 通知/邮件模板管理 */}
      <section className="bg-white rounded-lg shadow-sm border border-gray-50 p-5">
        <h2 className="text-sm font-semibold text-lw-black mb-1 flex items-center gap-2">
          <FileText className="w-4 h-4 text-lw-accent" />
          {t("admin.settings.templates")}
        </h2>
        <p className="text-xs text-gray-400 mb-4">
          {t("admin.settings.tplDesc")} {isSuperAdmin ? t("admin.settings.tplEditable") : t("admin.settings.tplReadOnly")}
          {t("admin.settings.tplPlaceholders")}{"{orderNo}"} {"{price}"} {"{status}"} {"{reason}"} {"{reply}"} {"{deliveryUrl}"}
        </p>
        <div className="space-y-3">
          {templates.map((tpl) => (
            <div key={tpl.key} className="rounded-lg border border-gray-100 p-4">
              {editingKey === tpl.key && editForm ? (
                <div className="space-y-2.5">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                    <Field label={t("admin.settings.fieldTitle")}>
                      <input
                        value={editForm.title}
                        onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                        className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-lw-accent"
                      />
                    </Field>
                    <Field label={t("admin.settings.fieldSubject")}>
                      <input
                        value={editForm.email_subject}
                        onChange={(e) => setEditForm({ ...editForm, email_subject: e.target.value })}
                        className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-lw-accent"
                      />
                    </Field>
                  </div>
                  <Field label={t("admin.settings.fieldContent")}>
                    <textarea
                      value={editForm.content}
                      onChange={(e) => setEditForm({ ...editForm, content: e.target.value })}
                      rows={2}
                      className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-lw-accent resize-none"
                    />
                  </Field>
                  <Field label={t("admin.settings.fieldBody")}>
                    <textarea
                      value={editForm.email_body}
                      onChange={(e) => setEditForm({ ...editForm, email_body: e.target.value })}
                      rows={4}
                      className="w-full px-3 py-1.5 text-sm font-mono text-xs border border-gray-200 rounded-lg focus:outline-none focus:border-lw-accent"
                    />
                  </Field>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleSaveTemplate}
                      disabled={saving}
                      className="px-4 py-1.5 text-sm font-medium text-white bg-lw-accent rounded-lg hover:bg-blue-700 transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                    >
                      {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                      {t("admin.settings.save")}
                    </button>
                    <button
                      onClick={() => {
                        setEditingKey(null);
                        setEditForm(null);
                      }}
                      className="px-4 py-1.5 text-sm font-medium text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
                    >
                      {t("admin.settings.cancel")}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-lw-black">{tpl.label}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-500 font-mono">{tpl.key}</span>
                      {tpl.fromDb ? (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-600">{t("admin.settings.custom")}</span>
                      ) : (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-50 text-gray-400">{t("admin.settings.builtin")}</span>
                      )}
                    </div>
                    <p className="text-xs text-gray-600 mt-1">{t("admin.settings.tplNotif")}{tpl.title} ｜ {tpl.content.slice(0, 40)}...</p>
                    <p className="text-xs text-gray-400 mt-0.5">{t("admin.settings.tplMail")}{tpl.email_subject}</p>
                  </div>
                  {isSuperAdmin && (
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {tpl.fromDb && (
                        <button
                          onClick={() => handleResetTemplate(tpl.key)}
                          className="px-2.5 py-1.5 text-xs text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors cursor-pointer flex items-center gap-1"
                        >
                          <RotateCcw className="w-3 h-3" />
                          {t("admin.settings.reset")}
                        </button>
                      )}
                      <button
                        onClick={() => {
                          setEditingKey(tpl.key);
                          setEditForm({ ...tpl });
                        }}
                        className="px-2.5 py-1.5 text-xs text-lw-accent border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors cursor-pointer flex items-center gap-1"
                      >
                        <Pencil className="w-3 h-3" />
                        {t("admin.settings.edit")}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function InfoCard({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="rounded-lg bg-gray-50 p-3">
      <p className="text-xs text-gray-500">{label}</p>
      <p
        className={`text-sm font-semibold mt-1 break-all ${
          highlight ? "text-green-600" : "text-lw-black"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function ServiceCard({ name, ok, t }: { name: string; ok: boolean; t: (key: string) => string }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-gray-100 p-3">
      <span className="text-sm text-gray-600">{name}</span>
      {ok ? (
        <span className="inline-flex items-center gap-1 text-xs text-green-600">
          <CheckCircle2 className="w-3.5 h-3.5" />
          {t("admin.settings.ok")}
        </span>
      ) : (
        <span className="inline-flex items-center gap-1 text-xs text-red-500">
          <XCircle className="w-3.5 h-3.5" />
          {t("admin.settings.notConfigured")}
        </span>
      )}
    </div>
  );
}

function ConfigCard({ name, ok, desc }: { name: string; ok: boolean; desc: string }) {
  return (
    <div className="rounded-lg border border-gray-100 p-3">
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-600">{name}</span>
        {ok ? (
          <CheckCircle2 className="w-4 h-4 text-green-500" />
        ) : (
          <XCircle className="w-4 h-4 text-red-400" />
        )}
      </div>
      <p className="text-[11px] text-gray-400 mt-1">{desc}</p>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1">
        {label}
      </label>
      {children}
    </div>
  );
}
