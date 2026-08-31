/**
 * 灰度测试 · 中间页配置
 *
 * /gray-test 中间页（hub）展示此数组中的全部测试入口，
 * 管理员在中间页自行选择要跳转的测试页面。
 *
 * 新增测试入口：仅需在本数组追加一个条目，无需改动页面代码。
 * 每个条目：
 * - id:          唯一标识（如 test1 / test2 / ...）
 * - label:       选项编号，显示为 test1 / test2 ...
 * - title:       选项名称
 * - description: 选项说明（展示在卡片上）
 * - href:        点击后跳转的目标路径（站内或站外绝对 URL 均可）
 */
export interface GrayTestEntry {
  id: string
  label: string
  title: string
  description: string
  href: string
}

export const grayTestEntries: GrayTestEntry[] = [
  {
    id: "test1",
    label: "test1",
    title: "交互式背景画布",
    description: "原灰度测试页：随机作品背景 + 毛玻璃蒙版调节 + 背景随机切换",
    href: "/gray-test/test1",
  },
  {
    id: "test2",
    label: "test2",
    title: "旧版首页（已归档）",
    description:
      "旧版官网首页静态页，已由新首页（根路径 /）替代，此处仅供灰度预览（页面顶部有「已归档」标识）",
    href: "/gray-test/test2",
  },
  {
    id: "colorpicker",
    label: "test3",
    title: "图片取色器",
    description:
      "上传图片进行像素级选点（最多 10 点），自动计算 sRGB / OKLab / 潘通参考色并展示在下方菜单",
    href: "/gray-test/colorpicker",
  },
  {
    id: "sampler",
    label: "new",
    title: "毛布取样器",
    description:
      "上传图片像素取色，客户端按 OKLab 色差自动匹配毛布库 Top 20（图片按需加载）",
    href: "/gray-test/sampler",
  },
  {
    id: "ai-chat",
    label: "ai",
    title: "AI 助手（暂未开放）",
    description: "兽装定制相关问题咨询；功能暂未开启，入口仅保留在灰度环境",
    href: "/ai-chat.html",
  },
]
