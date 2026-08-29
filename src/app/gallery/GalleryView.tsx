"use client";

import { useCallback, useEffect, useState } from "react";

interface GalleryItem {
  id: string;
  code?: string;
  title: string;
  tag?: string;
  image_url?: string;
}

/**
 * 龙坞图鉴页：独立页面展示工作室全部作品。
 * 图片性能优化：首屏 6 张 eager+fetchpriority，其余 loading=lazy；
 * aspect-ratio 占位防 CLS；decoding=async 异步解码。
 */
export default function GalleryView() {
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [loading, setLoading] = useState(true);
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
    loadWorks();
  }, [loadWorks]);

  return (
    <div className="gl-root">
      <header className="gl-top">
        <a className="gl-back" href="/">← LongWoo Studio</a>
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
          </div>

          {loading ? (
            <div className="gl-empty">加载中…</div>
          ) : loadError ? (
            <div className="gl-empty">作品加载失败，请稍后重试</div>
          ) : items.length === 0 ? (
            <div className="gl-empty">暂无作品</div>
          ) : (
            <div className="gl-grid">
              {items.map((w, i) => (
                <a key={w.id} className="gl-card" href={`/works-detail.html?id=${encodeURIComponent(w.id)}`}>
                  <div className="gl-img-wrap">
                    {w.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        className="gl-img"
                        src={w.image_url}
                        alt={w.title}
                        loading={i < 6 ? "eager" : "lazy"}
                        fetchPriority={i < 3 ? "high" : undefined}
                        decoding="async"
                        width={600}
                        height={600}
                      />
                    ) : (
                      <div className="gl-img gl-img--empty" aria-hidden="true" />
                    )}
                  </div>
                  <div className="gl-card-body">
                    <h3 className="gl-card-title">{w.title}</h3>
                    {w.tag && <p className="gl-card-tag">{w.tag}</p>}
                  </div>
                </a>
              ))}
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
