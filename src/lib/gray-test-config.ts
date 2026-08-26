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
]
