import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Work } from "@/types/database";
import WorkDetailView from "./WorkDetailView";
import "./work-detail.css";

// 作品详情为公开低频变更数据，CDN/ISR 缓存 30 秒（与 /api/works 一致）
export const revalidate = 30;
export const dynamicParams = true;

interface PageProps {
  params: Promise<{ id: string }>;
}

/** 生成详情页 SEO 元信息 */
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase
    .from("works")
    .select("title, tag, description, image_url")
    .eq("id", id)
    .eq("is_active", true)
    .maybeSingle();

  if (!data) {
    return {
      title: "作品未找到 | LongWoo Studio",
      robots: { index: false, follow: false },
    };
  }

  const description = data.description?.slice(0, 150) || `LongWoo 龙坞工作室作品：${data.title}`;
  return {
    title: `${data.title} | 龙坞图鉴 | LongWoo Studio`,
    description,
    openGraph: {
      title: `${data.title} | 龙坞图鉴`,
      description,
      type: "article",
      images: data.image_url ? [{ url: data.image_url }] : undefined,
    },
  };
}

/**
 * 龙坞图鉴 - 作品详情页（/gallery/[id]）
 * 服务端渲染 + 纸墨极简 UI（与新主页一致），替代旧版静态页 works-detail.html。
 * 管理员通过 ?galleryEdit=1 可直接在用户视图编辑作品。
 */
export default async function GalleryWorkDetailPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: work } = await supabase
    .from("works")
    .select("*")
    .eq("id", id)
    .eq("is_active", true)
    .maybeSingle();

  if (!work) {
    notFound();
  }

  // 更多作品（同列表序，排除当前作品）
  const { data: others } = await supabase
    .from("works")
    .select("id, code, title, tag, image_url")
    .eq("is_active", true)
    .neq("id", id)
    .order("sort_order", { ascending: true })
    .limit(12);

  return <WorkDetailView work={work as Work} others={others ?? []} />;
}
