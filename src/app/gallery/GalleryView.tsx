"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { createWork, updateWork, deleteWork } from "@/actions/works-actions";
import type { Work, WorkInput } from "@/types/database";

interface GalleryItem {
  id: string;
  code?: string;
  title: string;
  tag?: string;
  image_url?: string;
}

interface Draft {
  title: string;
  tag: string;
  description: string;
  work_type: string;
  delivery: string;
  craft: string;
  image_url: string;
}

const emptyDraft: Draft = {
  title: "",
  tag: "全装定制案例",
  description: "",
  work_type: "全装定制",
  delivery: "预计 4-6 周",
  craft: "立体剪裁 · 手工缝制",
  image_url: "",
};

/** 图片地址规范化：数据库中历史数据为相对路径（assets/...），统一转为根路径绝对地址 */
function absImageUrl(url?: string): string {
  if (!url) return "";
  if (/^https?:\/\//i.test(url) || url.startsWith("/")) return url;
  return `/${url}`;
}

/**
 * 龙坞图鉴页：独立页面展示工作室全部作品。
 * 图片性能优化：首屏 6 张 eager+fetchpriority，其余 loading=lazy；
 * aspect-ratio 占位防 CLS；decoding=async 异步解码。
 *
 * 管理员通过 ?galleryEdit=1 进入编辑模式，可直接在用户视图新增/编辑/删除作品
 * （与商店掉落模式编辑一致）；?galleryEdit=1&new=1 自动打开新增表单。
 */
export default function GalleryView() {
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  // 管理员编辑模式
  const [editMode, setEditMode] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingDraft, setEditingDraft] = useState<Draft>(emptyDraft);
  const [newDraft, setNewDraft] = useState<Draft | null>(null);
  const [uploading, setUploading] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [editMsg, setEditMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const msgTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showMsg = useCallback((type: "ok" | "err", text: string) => {
    if (msgTimerRef.current) clearTimeout(msgTimerRef.current);
    setEditMsg({ type, text });
    msgTimerRef.current = setTimeout(() => setEditMsg(null), 3000);
  }, []);

  useEffect(() => {
    return () => {
      if (msgTimerRef.current) clearTimeout(msgTimerRef.current);
    };
  }, []);

  const loadWorks = useCallback(async () => {
    try {
      const res = await fetch("/api/works", { cache: "no-store" });
      const data = await res.json();
      if (data.success && Array.isArray(data.items)) {
        setItems(data.items);
        setLoadError(false);
      } else {
        setLoadError(true);
      }
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadWorks();
  }, [loadWorks]);

  // 编辑模式鉴权：?galleryEdit=1 + 登录 + role=admin；?new=1 自动打开新增表单
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("galleryEdit") !== "1") {
      return;
    }
    (async () => {
      try {
        const res = await fetch("/api/session-check", { credentials: "include" });
        const session = await res.json();
        const ok = session.loggedIn && session.profile?.role === "admin";
        if (!ok) {
          window.alert("无权进入编辑模式");
          window.location.replace("/gallery");
          return;
        }
        setEditMode(true);
        if (params.get("new") === "1") {
          setNewDraft({ ...emptyDraft });
          setEditingId(null);
        }
      } catch {
        window.alert("无权进入编辑模式");
        window.location.replace("/gallery");
      }
    })();
  }, []);

  // ==================== 管理员编辑 ====================
  const uploadImage = async (file: File, apply: (url: string) => void) => {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/works/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (data.success && data.image_url) {
        apply(data.image_url);
      } else {
        showMsg("err", data.error || "图片上传失败");
      }
    } catch {
      showMsg("err", "图片上传失败，请稍后重试");
    } finally {
      setUploading(false);
    }
  };

  const openEdit = (item: GalleryItem & Partial<Work>) => {
    setEditingId(item.id);
    setEditingDraft({
      title: item.title,
      tag: item.tag || "",
      description: item.description || "",
      work_type: item.work_type || "全装定制",
      delivery: item.delivery || "预计 4-6 周",
      craft: item.craft || "立体剪裁 · 手工缝制",
      image_url: item.image_url || "",
    });
  };

  const saveDraft = async (draft: Draft, id?: string) => {
    if (!draft.title.trim()) {
      showMsg("err", "请填写作品名称");
      return;
    }
    if (!draft.tag.trim()) {
      showMsg("err", "请填写类型标签");
      return;
    }
    if (!draft.description.trim()) {
      showMsg("err", "请填写作品描述");
      return;
    }
    if (!draft.image_url.trim()) {
      showMsg("err", "请上传作品图片");
      return;
    }
    const input: WorkInput = {
      title: draft.title.trim(),
      tag: draft.tag.trim(),
      description: draft.description.trim(),
      work_type: draft.work_type.trim(),
      delivery: draft.delivery.trim(),
      craft: draft.craft.trim(),
      image_url: draft.image_url.trim(),
    };
    const key = id || "new";
    setSavingId(key);
    try {
      const result = id ? await updateWork(id, input) : await createWork(input);
      if (!result.success) {
        showMsg("err", result.error || "保存失败，请稍后重试");
        return;
      }
      showMsg("ok", id ? "作品已保存" : "作品已添加");
      setEditingId(null);
      setNewDraft(null);
      loadWorks();
    } catch {
      showMsg("err", "保存失败，请稍后重试");
    } finally {
      setSavingId(null);
    }
  };

  const removeWork = async (item: GalleryItem) => {
    if (!window.confirm(`确定删除作品「${item.title}」？删除后序号将自动重排。`)) return;
    setSavingId(item.id);
    try {
      const result = await deleteWork(item.id);
      if (!result.success) {
        showMsg("err", result.error || "删除失败，请稍后重试");
        return;
      }
      showMsg("ok", "作品已删除");
      setEditingId(null);
      loadWorks();
    } catch {
      showMsg("err", "删除失败，请稍后重试");
    } finally {
      setSavingId(null);
    }
  };

  const linkTo = (id: string) => (editMode ? `/gallery/${id}?galleryEdit=1` : `/gallery/${id}`);

  // ==================== 渲染 ====================
  const renderEditForm = (
    draft: Draft,
    onSave: () => void,
    key: string,
    original?: GalleryItem
  ) => {
    const label = (t: string) => <label className="gl-edit-label">{t}</label>;
    return (
      <div key={key} className="gl-card gl-card--edit">
        <div className="gl-edit-form">
          <div className="gl-edit-img-block">
            {draft.image_url ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className="gl-edit-img" src={absImageUrl(draft.image_url)} alt="preview" />
                <p className="gl-edit-tip">重新上传将替换当前图片</p>
              </>
            ) : (
              <div className="gl-edit-img-empty">尚未选择图片</div>
            )}
            <label className="gl-btn-ghost gl-edit-upload">
              {uploading ? "上传中…" : "上传图片"}
              <input
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                className="gl-edit-file"
                disabled={uploading}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) {
                    // 图片 url 由上传接口异步返回后写入草稿
                    uploadImage(f, (url) => {
                      if (editingId) setEditingDraft((d) => ({ ...d, image_url: url }));
                      else if (newDraft) setNewDraft((d) => (d ? { ...d, image_url: url } : d));
                    });
                  }
                  e.target.value = "";
                }}
              />
            </label>
          </div>

          {label("作品名称")}
          <input className="gl-edit-input" type="text" maxLength={50} value={draft.title}
            onChange={(e) => applyDraft((d) => ({ ...d, title: e.target.value }))} />

          {label("类型标签")}
          <input className="gl-edit-input" type="text" maxLength={30} value={draft.tag}
            onChange={(e) => applyDraft((d) => ({ ...d, tag: e.target.value }))} />

          {label("作品描述")}
          <textarea className="gl-edit-input" rows={3} maxLength={500} value={draft.description}
            onChange={(e) => applyDraft((d) => ({ ...d, description: e.target.value }))} />

          <div className="gl-edit-row">
            <div className="gl-edit-col">
              {label("定制类型")}
              <input className="gl-edit-input" type="text" maxLength={30} value={draft.work_type}
                onChange={(e) => applyDraft((d) => ({ ...d, work_type: e.target.value }))} />
            </div>
            <div className="gl-edit-col">
              {label("交付周期")}
              <input className="gl-edit-input" type="text" maxLength={30} value={draft.delivery}
                onChange={(e) => applyDraft((d) => ({ ...d, delivery: e.target.value }))} />
            </div>
          </div>

          {label("制作工艺")}
          <input className="gl-edit-input" type="text" maxLength={50} value={draft.craft}
            onChange={(e) => applyDraft((d) => ({ ...d, craft: e.target.value }))} />

          <div className="gl-edit-actions">
            <button type="button" className="gl-btn-solid gl-edit-btn" disabled={savingId === key} onClick={onSave}>
              {savingId === key ? "保存中…" : original ? "保存修改" : "+ 添加"}
            </button>
            {original && (
              <button type="button" className="gl-btn-ghost gl-edit-btn gl-edit-btn--danger"
                disabled={savingId === key} onClick={() => removeWork(original)}>
                删除
              </button>
            )}
            <button type="button" className="gl-btn-ghost gl-edit-btn"
              onClick={() => { setEditingId(null); setNewDraft(null); }}>
              取消
            </button>
          </div>
        </div>
      </div>
    );
  };

  const applyDraft = (fn: (d: Draft) => Draft) => {
    if (editingId) setEditingDraft(fn);
    else if (newDraft) setNewDraft((d) => (d ? fn(d) : d));
  };

  const renderCard = (w: GalleryItem & Partial<Work>, i: number) => {
    if (editMode && editingId === w.id) {
      return renderEditForm(editingDraft, () => saveDraft(editingDraft, w.id), w.id, w);
    }
    return (
      <a key={w.id} className="gl-card" href={linkTo(w.id)}>
        <div className="gl-img-wrap">
          {w.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              className="gl-img"
              src={absImageUrl(w.image_url)}
              alt={w.title}
              loading={i < 3 ? "eager" : "lazy"}
              fetchPriority={i < 3 ? "high" : undefined}
              decoding="async"
              width={600}
              height={600}
            />
          ) : (
            <div className="gl-img gl-img--empty" aria-hidden="true" />
          )}
          {w.code && <span className="gl-card-code">No.{w.code}</span>}
          {editMode && (
            <div className="gl-card-edit-actions">
              <button
                type="button"
                className="gl-btn-ghost gl-edit-btn"
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); openEdit(w); }}
              >
                编辑
              </button>
              <button
                type="button"
                className="gl-btn-ghost gl-edit-btn gl-edit-btn--danger"
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); removeWork(w); }}
              >
                删除
              </button>
            </div>
          )}
        </div>
        <div className="gl-card-body">
          <h3 className="gl-card-title">{w.title}</h3>
          {w.tag && <p className="gl-card-tag">{w.tag}</p>}
        </div>
      </a>
    );
  };

  return (
    <div className="gl-root">
      <header className="gl-top">
        <Link className="gl-back" href="/">← 龙坞工作室 LongWoo Studio</Link>
        {editMode && (
          <span className="gl-edit-hint">
            编辑模式
            <Link className="gl-btn-ghost gl-edit-hint-exit" href="/gallery">退出</Link>
          </span>
        )}
      </header>

      <main className="gl-main">
        <div className="gl-hero">
          <p className="gl-kicker">LONGWOO · GALLERY</p>
          <h1 className="gl-title">龙坞图鉴</h1>
          <p className="gl-sub">Gallery</p>
          <p className="gl-desc">
            LongWoo 龙坞工作室专注于高品质兽装定制与销售，从设计到交付，每一处细节都倾注热忱与专业。
            龙坞图鉴收录每一件作品的诞生记录——原创角色、定制案例与完成作品，翻阅属于我们的兽装世界。
          </p>
        </div>

        <div className="gl-section">
          <div className="gl-section-head">
            <span className="gl-section-kicker">WORKS</span>
            <h2 className="gl-section-title">全部作品</h2>
            {editMode && (
              <button type="button" className="gl-btn-solid gl-edit-add" onClick={() => { setNewDraft({ ...emptyDraft }); setEditingId(null); }}>
                + 新增作品
              </button>
            )}
          </div>

          {editMsg && (
            <div className={`gl-edit-msg ${editMsg.type === "ok" ? "gl-edit-msg--ok" : ""}`}>
              {editMsg.text}
            </div>
          )}

          {editMode && newDraft && (
            <div className="gl-grid gl-edit-new-wrap">
              {renderEditForm(newDraft, () => saveDraft(newDraft), "new")}
            </div>
          )}

          {loading ? (
            <div className="gl-empty">加载中…</div>
          ) : loadError ? (
            <div className="gl-empty">作品加载失败，请稍后重试</div>
          ) : items.length === 0 ? (
            <div className="gl-empty">暂无作品</div>
          ) : (
            <div className="gl-grid">
              {items.map((w, i) => renderCard(w, i))}
            </div>
          )}
        </div>
      </main>

      <footer className="gl-foot">
        <p>© 2026 LongWoo Studio. All rights reserved.</p>
      </footer>
    </div>
  );
}
