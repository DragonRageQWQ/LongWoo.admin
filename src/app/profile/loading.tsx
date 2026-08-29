// 个人中心加载骨架（墨色极简）
// 性能优化（PERF-07）：App Router 动态页导航时立即渲染 loading UI，
// 用户点击"个人中心"后即刻看到页面框架（骨架占位），而非白屏等待 RSC，
// 感知延迟大幅降低；数据到达后由 ProfileShell 替换。
import ProfileSkeleton from "./ProfileSkeleton";

export default function ProfileLoading() {
  return <ProfileSkeleton />;
}
