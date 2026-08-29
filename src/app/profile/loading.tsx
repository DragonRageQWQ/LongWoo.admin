// 个人中心加载骨架（墨色极简）
// 性能优化（PERF-07）：App Router 动态页导航时立即渲染 loading UI，
// 用户点击"个人中心"后即刻看到页面框架（骨架占位），而非白屏等待 RSC，
// 感知延迟大幅降低；数据到达后由 ProfileShell 替换。
import "./profile.css";

export default function ProfileLoading() {
  return (
    <div className="pf-root">
      {/* 顶部栏骨架 */}
      <header className="pf-top">
        <div className="pf-top-inner">
          <div className="pf-skeleton pf-brand-skel" />
          <div className="pf-top-actions">
            <div className="pf-skeleton pf-top-link-skel" />
            <div className="pf-skeleton pf-top-link-skel" />
          </div>
        </div>
      </header>

      {/* 主体骨架 */}
      <main className="pf-main">
        <div className="pf-skeleton pf-kicker-skel" />
        <div className="pf-skeleton pf-title-skel" />
        <div className="pf-skeleton pf-sub-skel" />

        <section className="pf-card pf-user">
          <div className="pf-skeleton pf-avatar-skel" />
          <div className="pf-user-body">
            <div className="pf-skeleton pf-name-skel" />
            <div className="pf-skeleton pf-meta-skel" />
          </div>
        </section>

        <div className="pf-skeleton pf-kicker-skel" />
        <div className="pf-grid">
          {[0, 1, 2].map((i) => (
            <div key={i} className="pf-skeleton pf-link-card-skel" />
          ))}
        </div>

        <div className="pf-skeleton pf-kicker-skel" />
        <div className="pf-card">
          <div className="pf-skeleton pf-order-skel" />
          <div className="pf-skeleton pf-order-skel" />
          <div className="pf-skeleton pf-order-skel" />
        </div>
      </main>
    </div>
  );
}
