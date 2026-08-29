"use client";

import { useCallback, useEffect, useState } from "react";
import { queryOrderByNo } from "@/actions/order-actions";
import { formatDate } from "@/lib/utils";
import type { Order, OrderAttachment, OrderReply } from "@/types/database";
import { COPY, type Gt2Lang } from "../copy";

type QueryResult = Order & {
  attachments?: OrderAttachment[];
  replies?: OrderReply[];
};

// 从需求描述中提取【设定图】文件名（静态页下单时写入 requirements，
// 兼容附件上传失败仅剩文件名的历史订单）
function extractDesignRefName(requirements: string | null): string | null {
  if (!requirements) return null;
  const m = requirements.match(/【设定图】([^\n]+)/);
  if (!m) return null;
  const name = m[1].trim();
  return name && name !== "无" ? name : null;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function CheckPanel({ lang }: { lang: Gt2Lang }) {
  const c = COPY[lang].checkPanel;
  const entry = COPY[lang].entries.check;
  const [orderNo, setOrderNo] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // 必填字段错误提示（key: orderNo / email）
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [result, setResult] = useState<QueryResult | null>(null);
  // 设定图放大查看
  const [enlargedImage, setEnlargedImage] = useState<string | null>(null);

  const designRefName = result ? extractDesignRefName(result.requirements) : null;

  const clearFieldError = useCallback((k: string) => {
    setFieldErrors((p) => {
      if (!p[k]) return p;
      const n = { ...p };
      delete n[k];
      return n;
    });
  }, []);

  const handleQuery = useCallback(
    async (no: string, emailAddr: string) => {
      const errs: Record<string, string> = {};
      if (!no.trim()) errs.orderNo = c.errOrderNoRequired;
      if (!emailAddr.trim()) errs.email = c.errEmailRequired;
      else if (!EMAIL_RE.test(emailAddr.trim())) errs.email = c.errEmailInvalid;
      setFieldErrors(errs);
      if (Object.keys(errs).length > 0) return;

      setError(null);
      setResult(null);
      setLoading(true);
      try {
        const res = await queryOrderByNo(no.trim(), emailAddr.trim());
        if (res.success && res.data) {
          setResult(res.data);
        } else {
          setError(res.error || c.errQueryFailed);
        }
      } catch {
        setError(c.errQueryUnknown);
      } finally {
        setLoading(false);
      }
    },
    [c]
  );

  // URL 参数：?no=&email= 预填并自动查询（从委托提交成功页跳转而来）
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const no = params.get("no") || "";
    const emailAddr = params.get("email") || "";
    if (no) setOrderNo(no);
    if (emailAddr) setEmail(emailAddr);
    if (no && emailAddr) handleQuery(no, emailAddr);
  }, [handleQuery]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    handleQuery(orderNo, email);
  };

  const statusKey = result?.status || "";
  const statusLabel = c.status[statusKey] || statusKey || c.notSpecified;

  return (
    <div className="gt2-panel-inner">
      <span className="gt2-watermark" aria-hidden="true">04</span>
      <div className="gt2-stagger" style={{ "--i": 0 } as React.CSSProperties}>
        <p className="gt2-kicker">{entry.kicker}</p>
      </div>
      <div className="gt2-stagger" style={{ "--i": 1 } as React.CSSProperties}>
        <h2 className="gt2-display">{entry.title}</h2>
        <p className="gt2-display-sub">{entry.titleEn}</p>
      </div>
      <p className="gt2-lead gt2-stagger" style={{ "--i": 2 } as React.CSSProperties}>
        {entry.desc}
      </p>

      {/* 查询表单 */}
      <form
        className="gt2-check-card gt2-stagger"
        style={{ "--i": 3 } as React.CSSProperties}
        onSubmit={submit}
        noValidate
      >
        <div className="gt2-fs-grid">
          <div
            className="gt2-fs-field gt2-fs-field--full"
            data-error={!!fieldErrors.orderNo || undefined}
            data-valid={!fieldErrors.orderNo && orderNo.trim() ? true : undefined}
          >
            <label>
              {c.orderNoLabel} <em>*</em>
            </label>
            <input
              type="text"
              value={orderNo}
              onChange={(e) => {
                setOrderNo(e.target.value);
                clearFieldError("orderNo");
              }}
              placeholder={c.orderNoPh}
              maxLength={50}
              autoComplete="off"
            />
            {fieldErrors.orderNo && <p className="gt2-fs-field-err">{fieldErrors.orderNo}</p>}
          </div>
          <div
            className="gt2-fs-field gt2-fs-field--full"
            data-error={!!fieldErrors.email || undefined}
            data-valid={!fieldErrors.email && EMAIL_RE.test(email.trim()) ? true : undefined}
          >
            <label>
              {c.emailLabel} <em>*</em>
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                clearFieldError("email");
              }}
              placeholder={c.emailPh}
              autoComplete="email"
            />
            {fieldErrors.email && <p className="gt2-fs-field-err">{fieldErrors.email}</p>}
          </div>
        </div>

        {error && <div className="gt2-check-error">{error}</div>}

        <button type="submit" className="gt2-btn-solid gt2-check-submit" disabled={loading}>
          {loading ? c.loading : c.btn}
        </button>
      </form>

      {/* 查询结果 */}
      {result && (
        <div className="gt2-check-card gt2-check-result">
          {/* 结果头部：单号 + 状态 */}
          <div className="gt2-check-result-head">
            <div>
              <div className="gt2-check-order-no">{result.order_no}</div>
              <div className="gt2-check-order-meta">
                {c.createdAt}：{formatDate(result.created_at)}
              </div>
            </div>
            <span className="gt2-check-status" data-status={statusKey}>
              {statusLabel}
            </span>
          </div>

          {/* 客户信息 */}
          <div className="gt2-check-info-grid">
            <div className="gt2-check-info-item">
              <span className="gt2-check-info-label">{c.customerName}</span>
              <span className="gt2-check-info-value">
                {result.customer_name || c.notSpecified}
              </span>
            </div>
            <div className="gt2-check-info-item">
              <span className="gt2-check-info-label">{c.phone}</span>
              <span className="gt2-check-info-value">
                {result.customer_phone || c.notSpecified}
              </span>
            </div>
            <div className="gt2-check-info-item">
              <span className="gt2-check-info-label">{c.email}</span>
              <span className="gt2-check-info-value gt2-check-break">
                {result.customer_email || c.notSpecified}
              </span>
            </div>
            <div className="gt2-check-info-item">
              <span className="gt2-check-info-label">{c.serviceType}</span>
              <span className="gt2-check-info-value">
                {result.service_types?.name || c.notSpecified}
              </span>
            </div>
          </div>

          {/* 需求描述 */}
          {result.requirements && (
            <div className="gt2-check-section">
              <div className="gt2-check-section-title">{c.desc}</div>
              <p className="gt2-check-desc">{result.requirements}</p>
            </div>
          )}

          {/* 设定图 */}
          <div className="gt2-check-section">
            <div className="gt2-check-section-title">
              {c.designImage}
              {designRefName && <span className="gt2-check-file-name">（{designRefName}）</span>}
              {result.attachments && result.attachments.length > 0 && (
                <span className="gt2-check-file-name">({result.attachments.length})</span>
              )}
            </div>
            {result.attachments && result.attachments.length > 0 ? (
              <div className="gt2-check-img-grid">
                {result.attachments.map((att) => {
                  const isImage =
                    att.file_type?.startsWith("image/") ||
                    /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(att.file_name);
                  return (
                    <button
                      key={att.id}
                      type="button"
                      className="gt2-check-img-cell"
                      disabled={!isImage}
                      onClick={() => isImage && setEnlargedImage(att.file_path)}
                      aria-label={att.file_name}
                    >
                      {isImage ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={att.file_path} alt={att.file_name} />
                      ) : (
                        <span className="gt2-check-img-file">{att.file_name}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            ) : designRefName ? (
              <p className="gt2-check-warn">{c.designImageMissing}</p>
            ) : (
              <p className="gt2-check-muted">{c.notSpecified}</p>
            )}
          </div>

          {/* 估价信息 */}
          {result.estimated_price !== null && (
            <div className="gt2-check-section">
              <div className="gt2-check-price-row">
                <span className="gt2-check-section-title">{c.estimateAmount}</span>
                <b className="gt2-check-price">
                  ¥{Number(result.estimated_price).toLocaleString("zh-CN")}
                </b>
              </div>
              {result.estimate_notes && (
                <p className="gt2-check-muted">
                  {c.note}
                  {result.estimate_notes}
                </p>
              )}
            </div>
          )}

          {/* 交付链接 */}
          {result.delivery_url && (
            <div className="gt2-check-section">
              <div className="gt2-check-section-title">{c.deliveryLink}</div>
              <a
                className="gt2-check-link"
                href={result.delivery_url}
                target="_blank"
                rel="noopener noreferrer"
              >
                {result.delivery_url}
              </a>
            </div>
          )}

          {/* 回复记录 */}
          {result.replies && result.replies.length > 0 && (
            <div className="gt2-check-section">
              <div className="gt2-check-section-title">
                {c.replies}（{result.replies.length}）
              </div>
              <div className="gt2-check-replies">
                {result.replies.map((reply) => (
                  <div key={reply.id} className="gt2-check-reply">
                    <p className="gt2-check-reply-text">{reply.content}</p>
                    <span className="gt2-check-reply-time">{formatDate(reply.sent_at)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 设定图放大查看 */}
      {enlargedImage && (
        <div className="gt2-check-overlay" onClick={() => setEnlargedImage(null)}>
          <button
            type="button"
            className="gt2-check-overlay-close"
            onClick={() => setEnlargedImage(null)}
            aria-label="close"
          >
            ×
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={enlargedImage}
            alt={c.designImage}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
