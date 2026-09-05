import Link from "next/link";
import s from "./not-found.module.css";

/** 404：黑洞主题。任意不存在路径（含 URL 后追加乱码）都会落入此页。 */
export default function NotFound() {
  return (
    <main className={s.page}>
      <div className={s.stage}>
        {/* 中央黑洞：吸积波纹 + 弧光 + 事件视界 */}
        <div className={s.hole} aria-hidden="true">
          {Array.from({ length: 10 }, (_, k) => (
            <i key={k} className={s.wave} style={{ animationDelay: `${0.3 * (k + 1)}s` }} />
          ))}
          <span className={s.disc} />
          <span className={s.core} />
        </div>

        {/* 透镜文字：被黑洞轻微吸入，主体保持可读 */}
        <div className={s.textBlock}>
          <p className={s.eyebrow}>Event Horizon · Lost in Gravity</p>
          <h1 className={s.title} aria-label="404">404</h1>
          <p className={s.sub}>
            你访问的页面已越过事件视界，
            <b> 被黑洞吞噬</b>，化作一缕引力波。
          </p>
        </div>

        {/* 返回原点 */}
        <Link href="/" className={s.btn}>
          <svg
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M19 12H5" />
            <path d="M12 19l-7-7 7-7" />
          </svg>
          返回原点
        </Link>
      </div>
    </main>
  );
}
