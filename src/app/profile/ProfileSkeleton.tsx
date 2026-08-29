// 个人中心加载骨架（墨色极简，PERF-07/08 共享）
// 服务端导航 loading.tsx 与客户端取数（ProfileShell dataLoading）复用同一骨架，
// 保证点击"个人中心"后即刻出现与正式页面结构一致的占位框架。
import "./profile.css";

export default function ProfileSkeleton() {
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
