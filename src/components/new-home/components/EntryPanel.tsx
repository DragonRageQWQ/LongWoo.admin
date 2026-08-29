"use client";

import { useCallback, useEffect, useState } from "react";
import type { Gt2EntryCopy } from "../copy";

interface GalleryItem {
  id: string;
  code?: string;
  title: string;
  tag?: string;
  image_url?: string;
}

/**
 * 入口面板：通用展示组件（商店/查询/图鉴等栏目共用）。
 * 当 gallery=true 时，在 CTA 下方渲染「龙坞图鉴」作品网格（数据源 /api/works）。
 */
export default function EntryPanel({
  entry,
  mark,
  gallery = false,
}: {
  entry: Gt2EntryCopy;
  mark: string;
  gallery?: boolean;
}) {
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [loading, setLoading] = useState(gallery);
  const [loadError, setLoadError] = useState(false);

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
    if (gallery) loadWorks();
  }, [gallery, loadWorks]);

  return (
    <div className="gt2-panel-inner gt2-panel-inner--center">
      <span className="gt2-watermark" aria-hidden="true">{mark}</span>
      <div className="gt2-entry">
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
        <ul className="gt2-entry-list gt2-stagger" style={{ "--i": 3 } as React.CSSProperties}>
          {entry.features.map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>
        <div className="gt2-entry-cta gt2-stagger" style={{ "--i": 4 } as React.CSSProperties}>
          <a className="gt2-btn-solid" href={entry.href}>
            {entry.cta}
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 12h14" />
              <path d="M12 5l7 7-7 7" />
            </svg>
          </a>
        </div>
      </div>

      {gallery && (
        <div id="gallery" className="gt2-gallery gt2-stagger" style={{ "--i": 5 } as React.CSSProperties}>
          <div className="gt2-gallery-head">
            <span className="gt2-gallery-kicker">WORKS</span>
            <h2 className="gt2-gallery-title">{entry.title} · 作品</h2>
          </div>

          {loading ? (
            <div className="gt2-gallery-empty">加载中…</div>
          ) : loadError ? (
            <div className="gt2-gallery-empty">作品加载失败</div>
          ) : items.length === 0 ? (
            <div className="gt2-gallery-empty">暂无作品</div>
          ) : (
            <div className="gt2-gallery-grid">
              {items.map((w) => (
                <a key={w.id} className="gt2-gallery-card" href={`/works-detail.html?id=${encodeURIComponent(w.id)}`}>
                  {w.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img className="gt2-gallery-img" src={w.image_url} alt={w.title} loading="lazy" decoding="async" />
                  ) : (
                    <div className="gt2-gallery-img gt2-gallery-img--empty" />
                  )}
                  <div className="gt2-gallery-card-body">
                    <h3 className="gt2-gallery-card-title">{w.title}</h3>
                    {w.tag && <p className="gt2-gallery-card-tag">{w.tag}</p>}
                  </div>
                </a>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
