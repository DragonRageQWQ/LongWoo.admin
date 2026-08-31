import { redirect } from "next/navigation";

/**
 * 灰度测试 · 图片取色器（已合并）
 *
 * 图片取色器已与毛布取样器合体为「图片与毛布取样器」（/gray-test/sampler），
 * 本路由保留旧入口兼容，直接重定向。
 */
export const metadata = {
  title: "图片与毛布取样器 | LongWoo",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default function ColorPickerPage() {
  redirect("/gray-test/sampler");
}
