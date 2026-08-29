"use client";

import type { Gt2EntryCopy } from "../copy";

/**
 * 入口面板：通用展示组件（商店/查询/关于等栏目共用）。
 * 作品图鉴位于独立页面 /gallery，由 CTA 按钮跳转进入。
 */
export default function EntryPanel({ entry, mark }: { entry: Gt2EntryCopy; mark: string }) {
  return (
    <div className="gt2-panel-inner gt2-panel-inner--center">
      <span className="gt2-watermark" aria-hidden="true">{mark}</span>
      <div className="gt2-entry">
        <div className="gt2-stagger" style={{ "--i": 0 } as React.CSSProperties}>
          <p className="gt2-kicker">{entry.kicker}</p>
        </div>
        <div className="gt2-stagger" style={{ "--i": 1 } as React.CSSProperties}>
          <h1 className="gt2-display">{entry.title}</h1>
          <p className="gt2-display-sub">{entry.titleEn}</p>
        </div>
        <p className="gt2-lead gt2-stagger" style={{ "--i": 2 } as React.CSSProperties}>
          {entry.desc}
        </p>
        <ul className="gt2-entry-list gt2-stagger" style={{ "--i": 3 } as React.CSSProperties}>
          {entry.features.map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>
        <div className="gt2-entry-cta gt2-stagger" style={{ "--i": 4 } as React.CSSProperties}>
          <a className="gt2-btn-solid" href={entry.href}>
            {entry.cta}
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 12h14" />
              <path d="M12 5l7 7-7 7" />
            </svg>
          </a>
        </div>
      </div>
    </div>
  );
}
