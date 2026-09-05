"use client";

import { useEffect, useState } from "react";
import "./flip-card.css";

/** 翻面卡所需的作品字段（列表页/详情页“更多作品”通用） */
export interface FlipWork {
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
 * 作品翻面卡（图鉴列表 / 详情页“更多作品”共用）：
 * 正面为原作品图（5:7 PTCG 对战卡比例）；背面展示介绍文案，
 * 背景取自正面图的主基色渐变。桌面 hover / 键盘聚焦翻面；
 * 移动端左右滑动翻面；点击跳详情。
 */
export default function WorkFlipCard({
  work,
  index = 0,
  href,
}: {
  work: FlipWork;
  index?: number;
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
      className="gfc-card"
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
      <span className="gfc-inner">
        <span className="gfc-face gfc-front">
          {/* 正面完全只显示出厂照（5:7，PTCG 对战卡比例），无任何文字叠加 */}
          <span className="gfc-media">
            {imgUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                className="gfc-img"
                src={imgUrl}
                alt={work.title}
                loading={index < 3 ? "eager" : "lazy"}
                fetchPriority={index < 3 ? "high" : undefined}
                decoding="async"
                width={500}
                height={700}
              />
            ) : (
              <span className="gfc-img gfc-img--empty" aria-hidden="true" />
            )}
          </span>
        </span>
        <span className="gfc-face gfc-back" style={backBg ? { background: backBg } : undefined}>
          <span className="gfc-back-kicker">
            {work.code ? `LONGWOO · NO.${work.code}` : "LONGWOO · WORK"}
          </span>
          <h3 className="gfc-back-title">{work.title}</h3>
          {work.tag && <span className="gfc-back-tag">{work.tag}</span>}
          {work.description && <p className="gfc-back-desc">{work.description}</p>}
          {metaRows.length > 0 && (
            <dl className="gfc-back-meta">
              {metaRows.map((row) => (
                <div className="gfc-back-meta-row" key={row.label}>
                  <dt>{row.label}</dt>
                  <dd>{row.value}</dd>
                </div>
              ))}
            </dl>
          )}
          <span className="gfc-back-hint">点击卡片查看完整详情</span>
        </span>
      </span>
    </a>
  );
}
