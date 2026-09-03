"use client";

import Link from "next/link";
import { useLanguage } from "@/components/i18n/LanguageProvider";
import SamplerDock from "@/components/sampler/SamplerDock";

/**
 * 取色器页头（客户端渲染：标题/返回提示随语言即时切换，无需依赖 SSR cookie）
 * 品牌角标「龙坞 / LongWoo Studio」为品牌词保留。
 */
export default function SamplerHeader() {
  const { t } = useLanguage();
  return (
    <header className="relative z-30 border-b border-neutral-200 bg-white/80 backdrop-blur">
      <div className="max-w-7xl mx-auto w-full px-5 py-3.5 flex items-center justify-between gap-4">
        <Link
          href="/"
          aria-label={`LongWoo 龙坞 · ${t("sampler.page.backHome")}`}
          className="flex items-center gap-2.5 text-neutral-900 flex-shrink-0 no-underline hover:opacity-80 transition-opacity"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/longwoo-logo.svg" alt="LongWoo 龙坞" className="w-7 h-7 block" />
          <span className="text-[15px] font-bold tracking-[0.02em] leading-none">龙坞</span>
          <span className="hidden sm:inline text-[11px] text-neutral-400 font-mono tracking-[0.08em] leading-none">
            LongWoo Studio
          </span>
        </Link>

        <div className="min-w-0 flex-1 flex items-center gap-4">
          <span className="hidden sm:block w-px h-5 bg-neutral-200 flex-shrink-0" aria-hidden="true" />
          <div className="min-w-0">
            <h1 className="text-base font-bold tracking-tight truncate">{t("sampler.page.title")}</h1>
            <p className="hidden sm:block text-[10px] text-neutral-400 mt-0.5 font-mono tracking-wider truncate">
              PIXEL &amp; FABRIC SAMPLER · sRGB / OKLAB / PANTONE / FABRIC MATCH
            </p>
          </div>
        </div>

        <div className="flex-shrink-0">
          <SamplerDock />
        </div>
      </div>
    </header>
  );
}
