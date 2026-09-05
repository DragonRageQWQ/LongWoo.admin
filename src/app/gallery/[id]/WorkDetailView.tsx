"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { updateWork, deleteWork } from "@/actions/works-actions";
import type { Work, WorkInput } from "@/types/database";
import WorkFlipCard, { type FlipWork } from "../WorkFlipCard";

/** 更多作品条目（列表页展示所需字段） */
export interface WorkCard extends FlipWork {
  id: string;
  code?: string;
  title: string;
  tag?: string;
  image_url?: string;
}

interface WorkDetailProps {
  work: Work;
  others: WorkCard[];
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

const toDraft = (w: Work): Draft => ({
  title: w.title,
  tag: w.tag,
  description: w.description,
  work_type: w.work_type,
  delivery: w.delivery,
  craft: w.craft,
  image_url: w.image_url,
});

/** 图片地址规范化：数据库中历史数据为相对路径（assets/...），统一转为根路径绝对地址 */
function absImageUrl(url?: string): string {
  if (!url) return "";
  if (/^https?:\/\//i.test(url) || url.startsWith("/")) return url;
  return `/${url}`;
}

/**
 * 龙坞图鉴 - 作品详情视图
 * 纸墨极简 UI（与新主页/图鉴一致）。管理员通过 ?galleryEdit=1 进入编辑模式，
 * 直接在用户视图编辑/删除当前作品（与掉落模式编辑一致）。
 */
export default function WorkDetailView({ work: initial, others }: WorkDetailProps) {
  const router = useRouter();
  const [work, setWork] = useState<Work>(initial);

  // 管理员编辑模式（?galleryEdit=1 触发，session-check 鉴权）
  const [editMode, setEditMode] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Draft>(toDraft(initial));
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editMsg, setEditMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  // 图片放大
  const [lightbox, setLightbox] = useState<string | null>(null);

  const msgTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 卡牌检视：5×5 热区 → 三轴倾斜（角度映射同参考 css：行向 20/10/0/-10/-20°，列向 -10~+10° 每格 5°）
  const cardBoxRef = useRef<HTMLDivElement | null>(null);

  const tiltFromZone = useCallback((zone: HTMLElement) => {
    const box = cardBoxRef.current;
    const face = box?.querySelector<HTMLElement>(".gd-card-face");
    if (!box || !face) return;
    const idx = Number(zone.dataset.zone ?? NaN);
    if (!Number.isFinite(idx) || idx < 0 || idx > 24) return;
    const row = Math.floor(idx / 5);
    const col = idx % 5;
    face.style.transform = `rotateX(${20 - row * 10}deg) rotateY(${(col - 2) * 5}deg)`;
    face.style.transitionDuration = "125ms"; // 切入快速，离开时恢复 700ms 缓出
    box.classList.add("gd-tilting");
  }, []);

  const resetCardTilt = useCallback(() => {
    const box = cardBoxRef.current;
    const face = box?.querySelector<HTMLElement>(".gd-card-face");
    if (!box || !face) return;
    face.style.transform = "";
    face.style.transitionDuration = "";
    box.classList.remove("gd-tilting");
  }, []);

  // 保留原功能：点击卡牌查看原画质大图
  const openLightbox = useCallback(() => {
    const url = absImageUrl(work.image_url);
    if (url) setLightbox(url);
  }, [work.image_url]);

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

  // 编辑模式鉴权：?galleryEdit=1 + 登录 + role=admin
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
      } catch {
        window.alert("无权进入编辑模式");
        window.location.replace("/gallery");
      }
    })();
  }, []);

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

  const saveEdit = async () => {
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
    setSaving(true);
    try {
      const result = await updateWork(work.id, input);
      if (!result.success || !result.data) {
        showMsg("err", result.error || "保存失败，请稍后重试");
        return;
      }
      setWork(result.data as Work);
      setEditing(false);
      showMsg("ok", "作品已保存");
    } catch {
      showMsg("err", "保存失败，请稍后重试");
    } finally {
      setSaving(false);
    }
  };

  const removeWork = async () => {
    if (!window.confirm(`确定删除作品「${work.title}」？删除后序号将自动重排。`)) return;
    setSaving(true);
    try {
      const result = await deleteWork(work.id);
      if (!result.success) {
        showMsg("err", result.error || "删除失败，请稍后重试");
        return;
      }
      router.push(editMode ? "/gallery?galleryEdit=1" : "/gallery");
    } catch {
      showMsg("err", "删除失败，请稍后重试");
    } finally {
      setSaving(false);
    }
  };

  const linkTo = (id: string) => (editMode ? `/gallery/${id}?galleryEdit=1` : `/gallery/${id}`);

  return (
    <div className="gd-root">
      <header className="gd-top">
        <Link className="gd-back" href={editMode ? "/gallery?galleryEdit=1" : "/gallery"}>
          ← 龙坞图鉴
        </Link>
        <span className="gd-top-meta">LONGWOO · GALLERY</span>
      </header>

      <main className="gd-main">
        {/* 编辑模式横幅 */}
        {editMode && (
          <div className="gd-edit-banner">
            <span className="gd-edit-banner-text">编辑模式：可直接修改作品内容</span>
            <span className="gd-edit-banner-actions">
              <button type="button" className="gd-btn-solid" onClick={() => router.push("/gallery?galleryEdit=1&new=1")}>
                + 新增作品
              </button>
              <Link className="gd-btn-ghost" href="/gallery">
                退出编辑
              </Link>
            </span>
          </div>
        )}

        {editMsg && (
          <div className={`gd-edit-msg ${editMsg.type === "ok" ? "gd-edit-msg--ok" : ""}`}>
            {editMsg.text}
          </div>
        )}

        {editing ? (
          /* ===== 编辑表单 ===== */
          <div className="gd-edit-form">
            <div className="gd-edit-img-block">
              {draft.image_url ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img className="gd-edit-img" src={absImageUrl(draft.image_url)} alt="preview" />
                  <p className="gd-edit-tip">重新上传将替换当前图片</p>
                </>
              ) : (
                <div className="gd-edit-img-empty">尚未选择图片</div>
              )}
              <label className="gd-btn-ghost gd-edit-upload">
                {uploading ? "上传中…" : "上传图片"}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/gif,image/webp"
                  className="gd-edit-file"
                  disabled={uploading}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f)
                      uploadImage(f, (url) => setDraft((d) => ({ ...d, image_url: url })));
                    e.target.value = "";
                  }}
                />
              </label>
            </div>

            <label className="gd-edit-label">作品名称</label>
            <input className="gd-edit-input" type="text" maxLength={50} value={draft.title}
              onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))} />

            <label className="gd-edit-label">类型标签</label>
            <input className="gd-edit-input" type="text" maxLength={30} value={draft.tag}
              onChange={(e) => setDraft((d) => ({ ...d, tag: e.target.value }))} />

            <label className="gd-edit-label">作品描述</label>
            <textarea className="gd-edit-input" rows={4} maxLength={500} value={draft.description}
              onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))} />

            <div className="gd-edit-row">
              <div className="gd-edit-col">
                <label className="gd-edit-label">定制类型</label>
                <input className="gd-edit-input" type="text" maxLength={30} value={draft.work_type}
                  onChange={(e) => setDraft((d) => ({ ...d, work_type: e.target.value }))} />
              </div>
              <div className="gd-edit-col">
                <label className="gd-edit-label">交付周期</label>
                <input className="gd-edit-input" type="text" maxLength={30} value={draft.delivery}
                  onChange={(e) => setDraft((d) => ({ ...d, delivery: e.target.value }))} />
              </div>
            </div>

            <label className="gd-edit-label">制作工艺</label>
            <input className="gd-edit-input" type="text" maxLength={50} value={draft.craft}
              onChange={(e) => setDraft((d) => ({ ...d, craft: e.target.value }))} />

            <div className="gd-edit-actions">
              <button type="button" className="gd-btn-solid" disabled={saving} onClick={saveEdit}>
                {saving ? "保存中…" : "保存修改"}
              </button>
              <button type="button" className="gd-btn-ghost gd-btn--danger"
                disabled={saving} onClick={removeWork}>
                删除作品
              </button>
              <button type="button" className="gd-btn-ghost"
                onClick={() => { setEditing(false); setDraft(toDraft(work)); }}>
                取消
              </button>
            </div>
          </div>
        ) : (
          /* ===== 展示视图 ===== */
          <>
            <section className="gd-hero">
              <div
                ref={cardBoxRef}
                className={`gd-card-box${editMode ? " gd-card-box--edit" : ""}`}
                role="button"
                tabIndex={0}
                aria-label={work.image_url ? `${work.title}：点击查看原图` : work.title}
                onClick={openLightbox}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    openLightbox();
                  }
                }}
                onMouseOver={(e) => {
                  const el = (e.target as HTMLElement).closest?.("[data-zone]");
                  if (el instanceof HTMLElement) tiltFromZone(el);
                }}
                onMouseLeave={resetCardTilt}
              >
                {/* 卡面：5:7 标准 PTCG 卡牌比例 */}
                <div className="gd-card-face">
                  {work.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      className="gd-card-img"
                      src={absImageUrl(work.image_url)}
                      alt={work.title}
                      width={800}
                      height={800}
                      decoding="async"
                      draggable={false}
                    />
                  ) : (
                    <div className="gd-card-img gd-card-img--empty" aria-hidden="true" />
                  )}
                  <span className="gd-card-frame" aria-hidden="true" />
                  {work.code && <span className="gd-code">No.{work.code}</span>}
                  <span className="gd-card-zoom" aria-hidden="true">查看原图</span>
                </div>

                {/* 5×5 检视热区（悬浮任意一格即向该方向倾斜） */}
                <div className="gd-card-canvas" aria-hidden="true">
                  {Array.from({ length: 25 }, (_, k) => (
                    <span key={k} data-zone={k} className="gd-zone" />
                  ))}
                </div>

                {editMode && (
                  <button
                    type="button"
                    className="gd-btn-solid gd-hero-edit"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDraft(toDraft(work));
                      setEditing(true);
                    }}
                  >
                    编辑作品
                  </button>
                )}
              </div>
            </section>

            <section className="gd-info">
              <div className="gd-title-row">
                <h1 className="gd-title">{work.title}</h1>
                {work.tag && <span className="gd-tag">{work.tag}</span>}
              </div>
              {work.description && <p className="gd-desc">{work.description}</p>}
            </section>

            <section className="gd-specs">
              <div className="gd-spec">
                <span className="gd-spec-label">定制类型</span>
                <span className="gd-spec-value">{work.work_type || "全装定制"}</span>
              </div>
              <div className="gd-spec">
                <span className="gd-spec-label">交付周期</span>
                <span className="gd-spec-value">{work.delivery || "预计 4-6 周"}</span>
              </div>
              <div className="gd-spec">
                <span className="gd-spec-label">制作工艺</span>
                <span className="gd-spec-value">{work.craft || "立体剪裁 · 手工缝制"}</span>
              </div>
            </section>
          </>
        )}

        {/* 更多作品 */}
        <section className="gd-more">
          <div className="gd-more-head">
            <span className="gd-more-kicker">MORE WORKS</span>
            <h2 className="gd-more-title">更多作品</h2>
          </div>
          {others.length === 0 ? (
            <p className="gd-empty">暂无其他作品</p>
          ) : (
            <div className="gd-more-grid">
              {others.map((w, i) => (
                <WorkFlipCard key={w.id} work={w} index={i} href={linkTo(w.id)} />
              ))}
            </div>
          )}
        </section>
      </main>

      <footer className="gd-foot">
        <p>© 2026 LongWoo Studio. All rights reserved.</p>
      </footer>

      {/* 图片放大 */}
      {lightbox && (
        <div className="gd-overlay" onClick={() => setLightbox(null)}>
          <button type="button" className="gd-overlay-close" onClick={() => setLightbox(null)} aria-label="close">
            ×
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={lightbox} alt="作品大图" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </div>
  );
}
