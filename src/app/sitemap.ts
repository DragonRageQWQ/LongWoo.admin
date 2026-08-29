import type { MetadataRoute } from "next";

/**
 * 动态站点地图（SEO）
 * - 与 public/sitemap.xml 冲突时 App Router 路由优先，故静态 sitemap.xml 已删除
 * - 仅收录可公开索引的页面：登录/个人中心/后台/灰度/ai 工作区均不收录
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://www.longwoo.studio";

  return [
    { url: `${base}/`, changeFrequency: "weekly", priority: 1.0 },
    { url: `${base}/services`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/gallery`, changeFrequency: "weekly", priority: 0.8 },
    { url: `${base}/about`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${base}/order/query`, changeFrequency: "monthly", priority: 0.5 },
  ];
}
