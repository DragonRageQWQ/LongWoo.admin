import type { Metadata } from "next";
import "../../admin-ink.css";

export const metadata: Metadata = {
  title: "管理后台 - LongWoo Studio",
  robots: { index: false, follow: false },
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // .admin-ink：墨色极简主题作用域（对齐新首页 UI）
  return <div className="admin-ink min-h-screen">{children}</div>;
}
