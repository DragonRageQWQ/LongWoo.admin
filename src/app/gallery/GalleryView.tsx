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
  description?: string;
  work_type?: string;
  delivery?: string;
  craft?: string;
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

/* ---------- 背面主色渐变（从作品正面图采样） ---------- */

function rgbToHsl(r: number, g: number, b: number) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b);
  const mn = Math.min(r, g, b);
  const l = (mx + mn) / 2;
  const d = mx - mn;
  if (d === 0) return { h: 0, s: 0, l };
  const s = d / (1 - Math.abs(2 * l - 1));
  let h: number;
  if (mx === r) h = ((g - b) / d) % 6;
  else if (mx === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  h = (h * 60 + 360) % 360;
  return { h, s, l };
}

const cssHsl = (h: number, s: number, l: number) =>
  `hsl(${Math.round(h)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%)`;

/**
 * 从图片主色生成背面渐变背景：
 * 只统计饱和度足够、非纯黑白的像素（人物毛色/主基色），按饱和度加权平均得主色，
 * 再压暗到可读亮度范围，产出深色底、主色中调、高光的三段式渐变，保证白字可读。
 * 采样失败（跨域图等）返回 null，调用方保留默认墨色渐变。
 */
function extractBackGradient(img: HTMLImageElement): string | null {
  try {
    const size = 48;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, size, size);
    const { data } = ctx.getImageData(0, 0, size, size);
    let r = 0, g = 0, b = 0, wsum = 0;
    for (let p = 0; p < data.length; p += 4) {
      const R = data[p], G = data[p + 1], B = data[p + 2];
      const mx = Math.max(R, G, B);
      const mn = Math.min(R, G, B);
      const sat = mx === 0 ? 0 : (mx - mn) / mx;
      const light = (mx + mn) / 510;
      if (sat < 0.24 || light < 0.1 || light > 0.92) continue;
      const wgt = 0.45 + sat; // 高饱和像素权重更高（主基色优先）
      r += R * wgt; g += G * wgt; b += B * wgt; wsum += wgt;
    }
    if (wsum < 8) return null; // 画面没有足够的主色（如纯灰白剪影）
    const { h, s, l } = rgbToHsl(r / wsum, g / wsum, b / wsum);
    const lMain = Math.min(Math.max(l, 0.17), 0.28); // 压到白字可读的暗度
    const sMain = Math.min(s, 0.58);
    const hi = cssHsl(h, Math.min(sMain + 0.12, 0.7), Math.min(lMain + 0.07, 0.34));
    const mid = cssHsl(h, sMain, lMain);
    const lo = cssHsl(h, Math.min(sMain + 0.08, 0.68), Math.max(lMain - 0.08, 0.07));
    return `linear-gradient(165deg, ${hi} 0%, ${mid} 46%, ${lo} 100%)`;
  } catch {
    return null; // 跨域图片读取被浏览器拦截等，保留默认背景
  }
}

/**
 * 作品翻面卡（普通浏览模式）：
 * 正面为原作品图；背面展示介绍文案，背景取自正面图的主基色渐变。
 * 桌面 hover / 键盘聚焦翻面；移动端左右滑动翻面；点击跳详情。
 */
function WorkFlipCard({
  work,
  index,
  href,
}: {
  work: GalleryItem & Partial<Work>;
  index: number;
  href: string;
}) {
  const [backBg, setBackBg] = useState<string | null>(null);
  const imgUrl = absImageUrl(work.image_url);

  useEffect(() => {
    if (!imgUrl) return;
    let alive = true;
    const probe = new Image();
    probe.decoding = "async";
    probe.onload = () => {
      const bg = extractBackGradient(probe);
      if (alive && bg) setBackBg(bg);
    };
    probe.onerror = () => {};
    probe.src = imgUrl;
    return () => {
      alive = false;
    };
  }, [imgUrl]);

  let touchStart: { x: number; y: number } | null = null;
  let swipeFlipped = false;
  const metaRows: { label: string; value: string }[] = [];
  if (work.work_type) metaRows.push({ label: "类型", value: work.work_type });
  if (work.delivery) metaRows.push({ label: "交付", value: work.delivery });
  if (work.craft) metaRows.push({ label: "工艺", value: work.craft });

  return (
    <a
      className="gl-card gl-flip-card"
      href={href}
      aria-label={`${work.title}${work.tag ? `，${work.tag}` : ""}：${work.description ? "悬停查看介绍" : "查看详情"}`}
      onTouchStart={(e) => {
        const t = e.touches[0];
        if (t) touchStart = { x: t.clientX, y: t.clientY };
      }}
      onTouchEnd={(e) => {
        if (!touchStart) return;
        const t = e.changedTouches[0];
        if (t) {
          const dx = t.clientX - touchStart.x;
          const dy = t.clientY - touchStart.y;
          // 主方向为水平且位移足够时才翻面；竖向滑动保留给页面滚动
          if (Math.abs(dx) > 26 && Math.abs(dx) > Math.abs(dy)) {
            swipeFlipped = true;
            e.currentTarget.classList.toggle("is-flipped");
          }
        }
        touchStart = null;
      }}
      onClick={(e) => {
        if (swipeFlipped) {
          swipeFlipped = false;
          e.preventDefault();
          e.stopPropagation();
        }
      }}
    >
      <span className="gl-flip-inner">
        <span className="gl-flip-face gl-flip-front">
          {/* 正面完全只显示出厂照（5:7，PTCG 对战卡比例），无任何文字叠加 */}
          <div className="gl-img-wrap">
            {imgUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                className="gl-img"
                src={imgUrl}
                alt={work.title}
                loading={index < 3 ? "eager" : "lazy"}
                fetchPriority={index < 3 ? "high" : undefined}
                decoding="async"
                width={500}
                height={700}
              />
            ) : (
              <div className="gl-img gl-img--empty" aria-hidden="true" />
            )}
          </div>
        </span>
        <span className="gl-flip-face gl-flip-back" style={backBg ? { background: backBg } : undefined}>
          <span className="gl-back-kicker">
            {work.code ? `LONGWOO · NO.${work.code}` : "LONGWOO · WORK"}
          </span>
          <h3 className="gl-back-title">{work.title}</h3>
          {work.tag && <span className="gl-back-tag">{work.tag}</span>}
          {work.description && <p className="gl-back-desc">{work.description}</p>}
          {metaRows.length > 0 && (
            <dl className="gl-back-meta">
              {metaRows.map((row) => (
                <div className="gl-back-meta-row" key={row.label}>
                  <dt>{row.label}</dt>
                  <dd>{row.value}</dd>
                </div>
              ))}
            </dl>
          )}
          <span className="gl-back-hint">点击卡片查看完整详情</span>
        </span>
      </span>
    </a>
  );
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

    // 编辑模式：保持原卡片形态，编辑/删除按钮叠加在图上方，不做翻面
    if (editMode) {
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
                width={500}
                height={700}
              />
            ) : (
              <div className="gl-img gl-img--empty" aria-hidden="true" />
            )}
            {w.code && <span className="gl-card-code">No.{w.code}</span>}
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
          </div>
          <div className="gl-card-body">
            <h3 className="gl-card-title">{w.title}</h3>
            {w.tag && <p className="gl-card-tag">{w.tag}</p>}
          </div>
        </a>
      );
    }

    // 普通浏览：翻面卡（正面原图，背面介绍文案 + 取自主图色调的渐变背景）
    return <WorkFlipCard key={w.id} work={w} index={i} href={linkTo(w.id)} />;
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
