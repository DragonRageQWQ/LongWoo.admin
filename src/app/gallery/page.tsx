import type { Metadata } from "next";
import GalleryView from "./GalleryView";
import "./gallery.css";
import "./flip-card.css";

export const metadata: Metadata = {
  title: "龙坞图鉴 | LongWoo Studio",
  description:
    "LongWoo 龙坞工作室作品图鉴：原创角色、定制案例与完成作品全记录。从设计到交付，翻阅属于我们的兽装世界。",
  robots: { index: true, follow: true },
  alternates: { canonical: "/gallery" },
};

export default function GalleryPage() {
  return <GalleryView />;
}
