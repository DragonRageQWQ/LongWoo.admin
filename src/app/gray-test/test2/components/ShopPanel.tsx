"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  createDropItem,
  updateDropItem,
  deleteDropItem,
} from "@/actions/drop-actions";
import type { DropItem, DropItemInput, DropItemStatus } from "@/types/database";
import { COPY, type Gt2Lang } from "../copy";

type ShopView = "entries" | "drops" | "checkout" | "done";

const STATUSES: DropItemStatus[] = ["on_sale", "preparing", "adopted"];

const BODY_FIELD_KEYS = ["height", "weight", "chest", "waist", "hip", "shoe"] as const;
type BodyKey = (typeof BODY_FIELD_KEYS)[number];

interface DropDraft {
  title: string;
  price: string;
  status: DropItemStatus;
  includes: string;
  copyright: string;
  delivery: string;
  description: string;
  image_url: string;
  focus_x: number;
  focus_y: number;
}

const emptyDraft: DropDraft = {
  title: "",
  price: "",
  status: "preparing",
  includes: "",
  copyright: "",
  delivery: "",
  description: "",
  image_url: "",
  focus_x: 50,
  focus_y: 50,
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ShopPanel({ lang }: { lang: Gt2Lang }) {
  const c = COPY[lang].shopPanel;
  const entry = COPY[lang].entries.shop;
  const [view, setView] = useState<ShopView>("entries");

  // 掉落数据（公开接口拉取，含全部状态）
  const [items, setItems] = useState<DropItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // 管理员编辑模式
  const [editMode, setEditMode] = useState(false);
  const [editChecked, setEditChecked] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingDraft, setEditingDraft] = useState<DropDraft>(emptyDraft);
  const [newDraft, setNewDraft] = useState<DropDraft | null>(null);
  const [uploading, setUploading] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [editMsg, setEditMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  // 购买流程
  const [selected, setSelected] = useState<DropItem | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [body, setBody] = useState<Record<string, string>>({});
  const [social, setSocial] = useState("");
  const [agreed, setAgreed] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [orderNo, setOrderNo] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // 图片放大
  const [lightbox, setLightbox] = useState<string | null>(null);

  const editMsgTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showEditMsg = useCallback((type: "ok" | "err", text: string) => {
    if (editMsgTimerRef.current) clearTimeout(editMsgTimerRef.current);
    setEditMsg({ type, text });
    editMsgTimerRef.current = setTimeout(() => setEditMsg(null), 3000);
  }, []);

  useEffect(() => {
    return () => {
      if (editMsgTimerRef.current) clearTimeout(editMsgTimerRef.current);
    };
  }, []);

  // 加载掉落列表
  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/drop-items", { cache: "no-store" });
      const data = await res.json();
      if (data.success && Array.isArray(data.items)) {
        setItems(data.items);
        setLoadError(null);
      } else {
        setLoadError(data.error || c.empty);
      }
    } catch {
      setLoadError(c.empty);
    } finally {
      setLoading(false);
    }
  }, [c.empty]);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  // 编辑模式鉴权：?shopEdit=1 + 登录 + role=admin
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("shopEdit") !== "1") return;
    (async () => {
      try {
        const res = await fetch("/api/session-check", { credentials: "include" });
        const session = await res.json();
        const ok = session.loggedIn && session.profile?.role === "admin";
        if (!ok) {
          window.alert(c.noPermission);
          window.location.replace("/gray-test/test2?tab=shop");
          return;
        }
        setEditMode(true);
      } catch {
        window.alert(c.noPermission);
        window.location.replace("/gray-test/test2?tab=shop");
      } finally {
        setEditChecked(true);
      }
    })();
  }, [c.noPermission]);

  // 进入掉落视图时若处于编辑模式且数据已加载，无需重复处理
  useEffect(() => {
    if (view === "drops" && !loading && items.length === 0 && !loadError && editChecked) {
      // 空列表正常展示空状态
    }
  }, [view, loading, items, loadError, editChecked]);

  // ==================== 购买流程 ====================
  const startCheckout = (item: DropItem) => {
    if (item.status !== "on_sale") return;
    setSelected(item);
    setFieldErrors({});
    setAgreed(false);
    setView("checkout");
  };

  const clearFieldError = (k: string) =>
    setFieldErrors((p) => {
      if (!p[k]) return p;
      const n = { ...p };
      delete n[k];
      return n;
    });

  const submitCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = c.errName;
    if (!email.trim()) errs.email = c.errEmail;
    else if (!EMAIL_RE.test(email.trim())) errs.email = c.errEmail;
    setFieldErrors(errs);
    if (Object.keys(errs).length > 0) return;
    if (!agreed) {
      setFieldErrors((p) => ({ ...p, agree: c.errAgree }));
      return;
    }

    const lines: string[] = [];
    lines.push("【下单来源】预设兽装（掉落）购买流程（新首页商店内嵌下单）");
    lines.push("【掉落产品】" + selected.title);
    lines.push(`【价格明细】产品价格 RMB ${Number(selected.price).toLocaleString("en-US")}`);
    const bodyLines: string[] = [];
    BODY_FIELD_KEYS.forEach((k) => {
      const v = (body[k] || "").trim();
      if (v) {
        const label =
          k === "height" ? "身高" :
          k === "weight" ? "体重" :
          k === "chest" ? "胸围" :
          k === "waist" ? "腰围" :
          k === "hip" ? "臀围" : "鞋码";
        const unit = k === "weight" ? "KG" : k === "shoe" ? "" : "CM";
        bodyLines.push(label + v + unit);
      }
    });
    if (bodyLines.length) lines.push("【身体数据】" + bodyLines.join("，"));
    if (social.trim()) lines.push("【社交账号】" + social.trim());

    setSubmitting(true);
    try {
      const res = await fetch("/api/order/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: name.trim(),
          customerEmail: email.trim(),
          requirements: lines.join("\n"),
        }),
      });
      const result = await res.json();
      if (!result.success || !result.orderNo) {
        setFieldErrors((p) => ({ ...p, submit: result.error || "提交失败，请稍后重试" }));
        setSubmitting(false);
        return;
      }
      try {
        sessionStorage.setItem("longwoo_order_no", result.orderNo);
      } catch {
        /* ignore */
      }
      setOrderNo(result.orderNo);
      setView("done");
    } catch {
      setFieldErrors((p) => ({ ...p, submit: "网络错误，请稍后重试" }));
    } finally {
      setSubmitting(false);
    }
  };

  // ==================== 管理员编辑 ====================
  const uploadImage = async (file: File, apply: (url: string) => void) => {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/drop-items/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (data.success && data.image_url) {
        apply(data.image_url);
      } else {
        showEditMsg("err", data.error || c.editUpload);
      }
    } catch {
      showEditMsg("err", c.editUpload);
    } finally {
      setUploading(false);
    }
  };

  const openEdit = (item: DropItem) => {
    setEditingId(item.id);
    setEditingDraft({
      title: item.title,
      price: String(item.price),
      status: item.status,
      includes: item.includes || "",
      copyright: item.copyright || "",
      delivery: item.delivery || "",
      description: item.description || "",
      image_url: item.image_url,
      focus_x: typeof item.focus_x === "number" ? item.focus_x : 50,
      focus_y: typeof item.focus_y === "number" ? item.focus_y : 50,
    });
  };

  const startNewDraft = () => {
    setNewDraft({ ...emptyDraft });
    setEditingId(null);
  };

  const saveDraft = async (draft: DropDraft, id?: string) => {
    if (!draft.title.trim()) {
      showEditMsg("err", c.editTitleRequired);
      return;
    }
    if (!draft.image_url) {
      showEditMsg("err", c.editImageRequired);
      return;
    }
    const price = Number(draft.price);
    if (!Number.isFinite(price) || price < 0) {
      showEditMsg("err", c.editPriceInvalid);
      return;
    }
    const input: DropItemInput = {
      title: draft.title.trim(),
      description: draft.description.trim(),
      image_url: draft.image_url,
      price,
      status: draft.status,
      copyright: draft.copyright.trim(),
      delivery: draft.delivery.trim(),
      includes: draft.includes.trim(),
      focus_x: draft.focus_x,
      focus_y: draft.focus_y,
    };
    const key = id || "new";
    setSavingId(key);
    try {
      const result = id ? await updateDropItem(id, input) : await createDropItem(input);
      if (!result.success) {
        showEditMsg("err", result.error || c.editSave);
        return;
      }
      showEditMsg("ok", c.editSaveSuccess);
      setEditingId(null);
      setNewDraft(null);
      loadItems();
    } catch {
      showEditMsg("err", c.editSave);
    } finally {
      setSavingId(null);
    }
  };

  const removeDrop = async (item: DropItem) => {
    if (!window.confirm(c.editConfirmDelete)) return;
    setSavingId(item.id);
    try {
      const result = await deleteDropItem(item.id);
      if (!result.success) {
        showEditMsg("err", result.error || c.editDelete);
        return;
      }
      showEditMsg("ok", c.editDeleteSuccess);
      setEditingId(null);
      loadItems();
    } catch {
      showEditMsg("err", c.editDelete);
    } finally {
      setSavingId(null);
    }
  };

  const setFocusPercent = (
    e: React.MouseEvent<HTMLDivElement>
  ) => {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    applyDraft((d) => ({
      ...d,
      focus_x: Math.max(0, Math.min(100, x)),
      focus_y: Math.max(0, Math.min(100, y)),
    }));
  };

  // ==================== 渲染：入口视图 ====================
  const renderEntries = () => (
    <div className="gt2-panel-inner gt2-panel-inner--center">
      <span className="gt2-watermark" aria-hidden="true">03</span>
      <div className="gt2-stagger" style={{ "--i": 0 } as React.CSSProperties}>
        <p className="gt2-kicker">{entry.kicker}</p>
      </div>
      <div className="gt2-stagger" style={{ "--i": 1 } as React.CSSProperties}>
        <h1 className="gt2-display">{entry.title}</h1>
        <p className="gt2-display-sub">{entry.titleEn}</p>
      </div>
      <p className="gt2-lead gt2-stagger" style={{ "--i": 2 } as React.CSSProperties}>
        {entry.desc}
      </p>

      <div className="gt2-shop-entries gt2-stagger" style={{ "--i": 3 } as React.CSSProperties}>
        <button type="button" className="gt2-shop-entry" onClick={() => setView("drops")}>
          <span className="gt2-shop-entry-num">{c.dropsEntryKicker}</span>
          <div className="gt2-shop-entry-main">
            <h2 className="gt2-shop-entry-title">{c.dropsEntryTitle}</h2>
            <p className="gt2-shop-entry-desc">{c.dropsEntryDesc}</p>
          </div>
          <span className="gt2-shop-entry-cta">{c.dropsEntryCta} →</span>
        </button>

        <div className="gt2-shop-entry gt2-shop-entry--disabled" aria-disabled="true">
          <span className="gt2-shop-entry-num">{c.peripheryEntryKicker}</span>
          <div className="gt2-shop-entry-main">
            <h2 className="gt2-shop-entry-title">{c.peripheryEntryTitle}</h2>
            <p className="gt2-shop-entry-desc">{c.peripheryEntryDesc}</p>
          </div>
          <span className="gt2-shop-entry-cta">{c.peripheryEntryCta}</span>
        </div>
      </div>
    </div>
  );

  // ==================== 渲染：掉落列表 ====================
  const renderDrops = () => (
    <div className="gt2-panel-inner">
      <span className="gt2-watermark" aria-hidden="true">03</span>
      <div className="gt2-stagger" style={{ "--i": 0 } as React.CSSProperties}>
        <p className="gt2-kicker">{c.dropsKicker}</p>
      </div>
      <div className="gt2-stagger" style={{ "--i": 1 } as React.CSSProperties}>
        <h1 className="gt2-display">{c.dropsHeading}</h1>
        <p className="gt2-display-sub">{c.dropsSub}</p>
      </div>

      {/* 编辑模式横幅 */}
      {editMode && (
        <div className="gt2-shop-edit-banner gt2-stagger" style={{ "--i": 2 } as React.CSSProperties}>
          <span className="gt2-shop-edit-banner-text">{c.editBanner}</span>
          <span className="gt2-shop-edit-banner-actions">
            <button type="button" className="gt2-btn-solid gt2-shop-edit-btn" onClick={startNewDraft}>
              {c.editAdd}
            </button>
            <a className="gt2-btn-ghost gt2-shop-edit-btn" href="/gray-test/test2?tab=shop">
              {c.editExit}
            </a>
          </span>
        </div>
      )}

      {editMsg && (
        <div className={`gt2-shop-edit-msg gt2-stagger ${editMsg.type === "ok" ? "gt2-shop-edit-msg--ok" : ""}`} style={{ "--i": 2 } as React.CSSProperties}>
          {editMsg.text}
        </div>
      )}

      {/* 返回商店 */}
      <button type="button" className="gt2-shop-back gt2-stagger" style={{ "--i": 2 } as React.CSSProperties} onClick={() => setView("entries")}>
        ← {c.backEntries}
      </button>

      {/* 新增草稿卡片 */}
      {editMode && newDraft && (
        <div className="gt2-shop-grid gt2-stagger" style={{ "--i": 3 } as React.CSSProperties}>
          {renderEditCard(newDraft, () => saveDraft(newDraft), "new")}
        </div>
      )}

      {loading ? (
        <div className="gt2-shop-state gt2-stagger" style={{ "--i": 3 } as React.CSSProperties}>
          <span className="gt2-shop-spinner" />
          <p>{c.loading}</p>
        </div>
      ) : items.length === 0 ? (
        <div className="gt2-shop-state gt2-stagger" style={{ "--i": 3 } as React.CSSProperties}>
          <p>{loadError || c.empty}</p>
        </div>
      ) : (
        <div className="gt2-shop-grid gt2-stagger" style={{ "--i": 3 } as React.CSSProperties}>
          {items.map((item) =>
            editMode && editingId === item.id
              ? renderEditCard(editingDraft, () => saveDraft(editingDraft, item.id), item.id, item)
              : renderViewCard(item)
          )}
        </div>
      )}
    </div>
  );

  // 普通卡片
  const renderViewCard = (item: DropItem) => {
    const fx = typeof item.focus_x === "number" ? item.focus_x : 50;
    const fy = typeof item.focus_y === "number" ? item.focus_y : 50;
    return (
      <div key={item.id} className="gt2-shop-card">
        <div className="gt2-shop-card-img-wrap">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className="gt2-shop-card-img"
            src={item.image_url}
            alt={item.title}
            loading="lazy"
            decoding="async"
            style={{ objectPosition: `${fx}% ${fy}%` }}
            onClick={() => setLightbox(item.image_url)}
            role="button"
            aria-label={c.viewImage}
            title={c.viewImage}
          />
          <span className={`gt2-shop-card-status gt2-shop-card-status--${item.status}`}>
            {item.status === "on_sale" ? c.statusOnSale : item.status === "preparing" ? c.statusPreparing : c.statusAdopted}
          </span>
        </div>
        <div className="gt2-shop-card-body">
          <h3 className="gt2-shop-card-title">{item.title}</h3>
          <div className="gt2-shop-card-price">RMB {Number(item.price).toLocaleString("zh-CN")}</div>
          {(item.includes || item.description) && (
            <p className="gt2-shop-card-line">{item.includes || item.description}</p>
          )}
          {item.copyright && <p className="gt2-shop-card-line gt2-shop-card-line--sub">{item.copyright}</p>}
          {item.delivery && <p className="gt2-shop-card-line gt2-shop-card-line--delivery">{item.delivery}</p>}
        </div>
        <div className="gt2-shop-card-foot">
          {item.status === "on_sale" ? (
            <button type="button" className="gt2-btn-solid gt2-shop-card-btn" onClick={() => startCheckout(item)}>
              {c.btnSelect}
            </button>
          ) : (
            <button type="button" className="gt2-btn-solid gt2-shop-card-btn gt2-shop-card-btn--disabled" disabled>
              {item.status === "adopted" ? c.btnAdopted : c.btnPreparing}
            </button>
          )}
          {editMode && (
            <div className="gt2-shop-card-edit-actions">
              <button type="button" className="gt2-btn-ghost gt2-shop-edit-btn" onClick={() => openEdit(item)}>
                {c.editLabel}
              </button>
              <button type="button" className="gt2-btn-ghost gt2-shop-edit-btn gt2-shop-edit-btn--danger" onClick={() => removeDrop(item)}>
                {c.editDelete}
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  // 编辑卡片（展开表单）
  const renderEditCard = (
    draft: DropDraft,
    onSave: () => void,
    key: string,
    original?: DropItem
  ) => {
    const label = (t: string) => (
      <label className="gt2-shop-edit-label">{t}</label>
    );
    return (
      <div key={key} className="gt2-shop-card gt2-shop-card--edit">
        <div className="gt2-shop-edit-form">
          <div className="gt2-shop-edit-img-block">
            {draft.image_url ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className="gt2-shop-edit-img" src={draft.image_url} alt="preview" style={{ objectPosition: `${draft.focus_x}% ${draft.focus_y}%` }} />
                <div
                  className="gt2-shop-edit-focus"
                  onClick={setFocusPercent}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={draft.image_url} alt="focus" draggable={false} />
                  <span className="gt2-shop-edit-marker" style={{ left: `${draft.focus_x}%`, top: `${draft.focus_y}%` }} />
                </div>
                <p className="gt2-shop-edit-tip">{c.focusTip}</p>
              </>
            ) : (
              <div className="gt2-shop-edit-img-empty">{c.editUploadHint}</div>
            )}
            <label className="gt2-btn-ghost gt2-shop-edit-upload">
              {uploading ? c.editUploading : c.editUpload}
              <input
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                className="gt2-shop-edit-file"
                disabled={uploading}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) uploadImage(f, (url) => {
                    if (editingId) setEditingDraft((d) => ({ ...d, image_url: url, focus_x: 50, focus_y: 50 }));
                    else if (newDraft) setNewDraft((d) => (d ? { ...d, image_url: url, focus_x: 50, focus_y: 50 } : d));
                  });
                  e.target.value = "";
                }}
              />
            </label>
          </div>

          {label(c.editTitle)}
          <input className="gt2-shop-edit-input" type="text" maxLength={50} value={draft.title}
            onChange={(e) => applyDraft((d) => ({ ...d, title: e.target.value }))} />

          <div className="gt2-shop-edit-row">
            <div className="gt2-shop-edit-col">
              {label(c.editPrice)}
              <input className="gt2-shop-edit-input" type="number" min={0} step={1} value={draft.price}
                onChange={(e) => applyDraft((d) => ({ ...d, price: e.target.value }))} />
            </div>
            <div className="gt2-shop-edit-col">
              {label(c.editStatus)}
              <select className="gt2-shop-edit-input" value={draft.status}
                onChange={(e) => applyDraft((d) => ({ ...d, status: e.target.value as DropItemStatus }))}>
                {STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s === "on_sale" ? c.statusOptionOnSale : s === "preparing" ? c.statusOptionPreparing : c.statusOptionAdopted}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {label(c.editIncludes)}
          <input className="gt2-shop-edit-input" type="text" maxLength={200} value={draft.includes}
            onChange={(e) => applyDraft((d) => ({ ...d, includes: e.target.value }))} />

          {label(c.editCopyright)}
          <input className="gt2-shop-edit-input" type="text" maxLength={100} value={draft.copyright}
            onChange={(e) => applyDraft((d) => ({ ...d, copyright: e.target.value }))} />

          {label(c.editDelivery)}
          <textarea className="gt2-shop-edit-input" rows={2} maxLength={300} value={draft.delivery}
            onChange={(e) => applyDraft((d) => ({ ...d, delivery: e.target.value }))} />

          {label(c.editDescription)}
          <textarea className="gt2-shop-edit-input" rows={2} maxLength={500} value={draft.description}
            onChange={(e) => applyDraft((d) => ({ ...d, description: e.target.value }))} />

          <div className="gt2-shop-edit-actions">
            <button type="button" className="gt2-btn-solid gt2-shop-edit-btn" disabled={savingId === key} onClick={onSave}>
              {savingId === key ? "…" : original ? c.editSave : c.editAdd.replace("+ ", "")}
            </button>
            {original && (
              <button type="button" className="gt2-btn-ghost gt2-shop-edit-btn gt2-shop-edit-btn--danger"
                disabled={savingId === key} onClick={() => removeDrop(original)}>
                {c.editDelete}
              </button>
            )}
            <button type="button" className="gt2-btn-ghost gt2-shop-edit-btn"
              onClick={() => { setEditingId(null); setNewDraft(null); }}>
              {c.editCancel}
            </button>
          </div>
        </div>
      </div>
    );
  };

  const applyDraft = (fn: (d: DropDraft) => DropDraft) => {
    if (editingId) setEditingDraft(fn);
    else if (newDraft) setNewDraft((d) => (d ? fn(d) : d));
  };

  // ==================== 渲染：购买确认 ====================
  const renderCheckout = () => {
    if (!selected) return null;
    const bodyFields = BODY_FIELD_KEYS.map((k) => ({
      key: k,
      label: k === "height" ? c.heightLabel : k === "weight" ? c.weightLabel : k === "chest" ? c.chestLabel : k === "waist" ? c.waistLabel : k === "hip" ? c.hipLabel : c.shoeLabel,
      unit: k === "height" || k === "chest" || k === "waist" || k === "hip" ? "cm" : k === "weight" ? "kg" : "",
    }));
    return (
      <div className="gt2-panel-inner">
        <span className="gt2-watermark" aria-hidden="true">03</span>
        <div className="gt2-stagger" style={{ "--i": 0 } as React.CSSProperties}>
          <p className="gt2-kicker">{c.checkoutKicker}</p>
        </div>
        <div className="gt2-stagger" style={{ "--i": 1 } as React.CSSProperties}>
          <h1 className="gt2-display">{c.checkoutTitle}</h1>
        </div>
        <button type="button" className="gt2-shop-back gt2-stagger" style={{ "--i": 2 } as React.CSSProperties} onClick={() => setView("drops")}>
          ← {c.backEntries}
        </button>

        <form className="gt2-check-card gt2-stagger" style={{ "--i": 3 } as React.CSSProperties} onSubmit={submitCheckout} noValidate>
          {/* 所选掉落摘要 */}
          <div className="gt2-shop-checkout-product">
            <div className="gt2-shop-checkout-img-wrap">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                className="gt2-shop-checkout-img"
                src={selected.image_url}
                alt={selected.title}
                style={{ objectPosition: `${typeof selected.focus_x === "number" ? selected.focus_x : 50}% ${typeof selected.focus_y === "number" ? selected.focus_y : 50}%` }}
              />
            </div>
            <div className="gt2-shop-checkout-product-main">
              <p className="gt2-shop-checkout-product-label">{c.productLabel}</p>
              <h2 className="gt2-shop-checkout-product-title">{selected.title}</h2>
              <p className="gt2-shop-checkout-product-price">RMB {Number(selected.price).toLocaleString("zh-CN")}</p>
              {selected.delivery && <p className="gt2-shop-card-line gt2-shop-card-line--delivery">{selected.delivery}</p>}
            </div>
          </div>

          {/* 联系信息 */}
          <div className="gt2-fs-grid">
            <div
              className="gt2-fs-field gt2-fs-field--wide"
              data-error={!!fieldErrors.name || undefined}
              data-valid={!fieldErrors.name && name.trim() ? true : undefined}
            >
              <label>{c.nameLabel} <em>*</em></label>
              <input type="text" value={name} maxLength={50} autoComplete="name" placeholder={c.namePh}
                onChange={(e) => { setName(e.target.value); clearFieldError("name"); }} />
              {fieldErrors.name && <p className="gt2-fs-field-err">{fieldErrors.name}</p>}
            </div>
            <div
              className="gt2-fs-field gt2-fs-field--full"
              data-error={!!fieldErrors.email || undefined}
              data-valid={!fieldErrors.email && EMAIL_RE.test(email.trim()) ? true : undefined}
            >
              <label>{c.emailLabel} <em>*</em></label>
              <input type="email" value={email} autoComplete="email" placeholder={c.emailPh}
                onChange={(e) => { setEmail(e.target.value); clearFieldError("email"); }} />
              {fieldErrors.email && <p className="gt2-fs-field-err">{fieldErrors.email}</p>}
            </div>
          </div>

          {/* 身体数据（选填） */}
          <div className="gt2-fs-sub-block">
            <div className="gt2-fs-sub-head">
              <b>{c.bodyTitle}</b>
              <span>{c.bodyHint}</span>
            </div>
            <div className="gt2-dim-grid">
              {bodyFields.map((f) => (
                <div key={f.key} className="gt2-dim-field">
                  <span className="gt2-dim-label">{f.label}</span>
                  <div className="gt2-dim-input">
                    <input
                      type="text"
                      inputMode="decimal"
                      value={body[f.key] || ""}
                      onChange={(e) => {
                        const v = e.target.value.replace(/[^\d.]/g, "");
                        setBody((p) => ({ ...p, [f.key]: v }));
                      }}
                      aria-label={f.label}
                    />
                    {f.unit && <span className="gt2-dim-unit">{f.unit}</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 社交账号 */}
          <div className="gt2-fs-field gt2-fs-field--full gt2-fs-social">
            <label>{c.socialLabel}</label>
            <textarea value={social} onChange={(e) => setSocial(e.target.value)} placeholder={c.socialPh} rows={2} maxLength={200} />
          </div>

          {/* 协议勾选 */}
          <button
            type="button"
            className={`gt2-shop-agree ${agreed ? "gt2-shop-agree--on" : ""}`}
            onClick={() => {
              setAgreed((v) => !v);
              clearFieldError("agree");
            }}
          >
            <span className="gt2-shop-agree-box">
              {agreed && <span className="gt2-shop-agree-check">✓</span>}
            </span>
            {c.agreeText}
          </button>
          {fieldErrors.agree && <p className="gt2-fs-field-err">{fieldErrors.agree}</p>}
          {fieldErrors.submit && <div className="gt2-check-error">{fieldErrors.submit}</div>}

          <button type="submit" className="gt2-btn-solid gt2-check-submit" disabled={submitting}>
            {submitting ? c.submitting : c.btnSubmit}
          </button>
        </form>
      </div>
    );
  };

  // ==================== 渲染：成功 ====================
  const renderDone = () => (
    <div className="gt2-panel-inner gt2-panel-inner--center">
      <div className="gt2-fs-done">
        <div className="gt2-fs-done-check">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <h2 className="gt2-fs-done-title">{c.doneTitle}</h2>
        <p className="gt2-fs-done-text">{c.doneText}</p>
        <div className="gt2-fs-done-code">
          {c.orderCodePrefix}
          <b>{orderNo ?? "——"}</b>
        </div>
        <div className="gt2-fs-done-actions">
          <button
            type="button"
            className="gt2-btn-ghost"
            onClick={async () => {
              if (!orderNo) return;
              try {
                if (navigator.clipboard?.writeText) {
                  await navigator.clipboard.writeText(orderNo);
                } else {
                  const ta = document.createElement("textarea");
                  ta.value = orderNo;
                  document.body.appendChild(ta);
                  ta.select();
                  document.execCommand("copy");
                  document.body.removeChild(ta);
                }
                setCopied(true);
                window.setTimeout(() => setCopied(false), 2000);
              } catch {
                /* ignore */
              }
            }}
          >
            {copied ? c.copied : c.copyBtn}
          </button>
          <a
            className="gt2-btn-solid gt2-fs-query"
            href={`/gray-test/test2?tab=check&no=${encodeURIComponent(orderNo ?? "")}&email=${encodeURIComponent(email.trim())}`}
          >
            {c.queryLink}
          </a>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {view === "entries" && renderEntries()}
      {view === "drops" && renderDrops()}
      {view === "checkout" && renderCheckout()}
      {view === "done" && renderDone()}

      {/* 图片放大 */}
      {lightbox && (
        <div className="gt2-check-overlay" onClick={() => setLightbox(null)}>
          <button type="button" className="gt2-check-overlay-close" onClick={() => setLightbox(null)} aria-label="close">
            ×
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={lightbox} alt="drop" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </>
  );
}
