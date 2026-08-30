import type { MetadataRoute } from "next";
import { createClient } from "@/lib/supabase/server";

/**
 * 动态站点地图（SEO）
 * - 与 public/sitemap.xml 冲突时 App Router 路由优先，故静态 sitemap.xml 已删除
 * - 仅收录可公开索引的页面：登录/个人中心/后台/灰度/ai 工作区均不收录
 * - 龙坞图鉴作品详情页 /gallery/[id] 随作品动态收录
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = "https://www.longwoo.studio";

  const entries: MetadataRoute.Sitemap = [
    { url: `${base}/`, changeFrequency: "weekly", priority: 1.0 },
    { url: `${base}/services`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/gallery`, changeFrequency: "weekly", priority: 0.8 },
    { url: `${base}/about`, changeFrequency: "monthly", priority: 0.6 },
  ];

  // 动态收录作品详情页（启用中的作品）
  try {
    const supabase = await createClient();
    const { data } = await supabase
      .from("works")
      .select("id, updated_at")
      .eq("is_active", true);
    for (const w of data ?? []) {
      entries.push({
        url: `${base}/gallery/${w.id}`,
        changeFrequency: "monthly",
        priority: 0.7,
        lastModified: w.updated_at ? new Date(w.updated_at) : undefined,
      });
    }
  } catch {
    // 作品查询失败时仅保留基础条目，不影响站点地图整体可用
  }

  return entries;
}
