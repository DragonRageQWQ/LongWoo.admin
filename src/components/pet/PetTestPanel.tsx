"use client";

import { useState } from "react";
import {
  Cat,
  Sparkles,
  MessageCircle,
  Settings,
  Play,
  RefreshCw,
  Heart,
  Smile,
  Frown,
  AlertCircle,
  Moon,
  Hand,
  Zap,
} from "lucide-react";
import PetIframe from "@/components/pet/PetIframe";
import { PET_CONFIG } from "@/lib/pet/config";
import type { PetMood } from "@/lib/pet/types";
import { useLanguage } from "@/components/i18n/LanguageProvider";

const MOOD_BUTTONS: { mood: PetMood; label: string; icon: any; color: string }[] = [
  { mood: "idle", label: "待机", icon: Cat, color: "bg-slate-500/20 text-slate-300 border-slate-400/30" },
  { mood: "happy", label: "开心", icon: Smile, color: "bg-amber-500/20 text-amber-300 border-amber-400/30" },
  { mood: "surprise", label: "惊讶", icon: AlertCircle, color: "bg-purple-500/20 text-purple-300 border-purple-400/30" },
  { mood: "sad", label: "难过", icon: Frown, color: "bg-blue-500/20 text-blue-300 border-blue-400/30" },
  { mood: "wave", label: "挥手", icon: Hand, color: "bg-green-500/20 text-green-300 border-green-400/30" },
  { mood: "sleep", label: "休眠", icon: Moon, color: "bg-indigo-500/20 text-indigo-300 border-indigo-400/30" },
];

const SAMPLE_PHRASES = [
  "你好呀~",
  "今天过得怎么样？",
  "我好开心！",
  "摸摸头~",
  "要加油哦！",
  "晚安~",
];

export default function PetTestPanel() {
  const { t, lang } = useLanguage();
  const [petEnabled, setPetEnabled] = useState(true);
  const [debugMode, setDebugMode] = useState(true);
  const [currentMood, setCurrentMood] = useState<PetMood>("idle");
  const [isReady, setIsReady] = useState(false);

  /** 触发情绪动画 */
  const triggerMood = (mood: PetMood) => {
    setCurrentMood(mood);
    if (typeof window !== "undefined" && (window as any).__pet) {
      (window as any).__pet.triggerMood(mood, 2000);
    }
  };

  /** 说话 */
  const speak = (text: string) => {
    if (typeof window !== "undefined" && (window as any).__pet) {
      (window as any).__pet.speak(text, 3000);
    }
  };

  /** 重置位置 */
  const resetPosition = () => {
    if (typeof window !== "undefined" && (window as any).__pet) {
      (window as any).__pet.resetPosition();
    }
  };

  /** 模拟 AI 对话 */
  const simulateChat = () => {
    const replies = [
      { text: "你好呀！今天有什么我可以帮你的吗？", mood: "happy" as PetMood },
      { text: "哇！这个消息好惊喜！", mood: "surprise" as PetMood },
      { text: "嗯嗯，我在听呢~", mood: "idle" as PetMood },
      { text: "别难过啦，我陪着你~", mood: "sad" as PetMood },
      { text: "嘿嘿，很高兴认识你！", mood: "wave" as PetMood },
    ];
    const reply = replies[Math.floor(Math.random() * replies.length)];
    speak(reply.text);
    triggerMood(reply.mood);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* 背景氛围 */}
      <div
        className="pointer-events-none fixed inset-0"
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 50% -20%, rgba(236,72,153,0.12), transparent), radial-gradient(ellipse 60% 40% at 80% 110%, rgba(139,92,246,0.1), transparent)",
        }}
        aria-hidden="true"
      />

      {/* 桌宠 iframe（全局悬浮） */}
      <PetIframe
        enabled={petEnabled}
        debug={debugMode}
        onReady={() => setIsReady(true)}
        onMoodChange={setCurrentMood}
      />

      <div className="relative z-10 max-w-5xl mx-auto px-6 py-8">
        {/* 头部 */}
        <header className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-pink-500/15 border border-pink-400/20 flex items-center justify-center">
              <Cat className="w-5 h-5 text-pink-300" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight">
                {t("pet.test.title")}
              </h1>
              <p className="text-xs text-slate-400 mt-0.5">
                {t("pet.test.subtitle")}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full ${
                isReady
                  ? "bg-green-500/15 text-green-300 border border-green-400/25"
                  : "bg-amber-500/15 text-amber-300 border border-amber-400/25"
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  isReady ? "bg-green-400" : "bg-amber-400 animate-pulse"
                }`}
              />
              {isReady ? t("pet.test.status.ready") : t("pet.test.status.loading")}
            </span>
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* 情绪控制 */}
          <section className="rounded-2xl bg-white/[0.04] border border-white/10 p-5 backdrop-blur-sm">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="w-4 h-4 text-pink-300" />
              <h2 className="text-sm font-semibold">{t("pet.test.moodPanel")}</h2>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {MOOD_BUTTONS.map(({ mood, label, icon: Icon, color }) => (
                <button
                  key={mood}
                  onClick={() => triggerMood(mood)}
                  className={`flex flex-col items-center gap-2 p-3 rounded-xl border transition-all duration-200 hover:scale-105 active:scale-95 ${color}`}
                >
                  <Icon className="w-5 h-5" />
                  <span className="text-xs font-medium">{label}</span>
                </button>
              ))}
            </div>
            <p className="text-xs text-slate-500 mt-4">
              {t("pet.test.moodHint")}
            </p>
          </section>

          {/* 对话测试 */}
          <section className="rounded-2xl bg-white/[0.04] border border-white/10 p-5 backdrop-blur-sm">
            <div className="flex items-center gap-2 mb-4">
              <MessageCircle className="w-4 h-4 text-blue-300" />
              <h2 className="text-sm font-semibold">{t("pet.test.chatPanel")}</h2>
            </div>
            <div className="space-y-3">
              <button
                onClick={simulateChat}
                className="w-full flex items-center justify-center gap-2 p-3 rounded-xl bg-blue-500/20 border border-blue-400/30 text-blue-200 hover:bg-blue-500/30 transition-colors text-sm font-medium"
              >
                <Play className="w-4 h-4" />
                {t("pet.test.simulateChat")}
              </button>
              <div className="flex flex-wrap gap-2">
                {SAMPLE_PHRASES.map((phrase) => (
                  <button
                    key={phrase}
                    onClick={() => speak(phrase)}
                    className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs text-slate-300 hover:bg-white/10 transition-colors"
                  >
                    {phrase}
                  </button>
                ))}
              </div>
            </div>
            <p className="text-xs text-slate-500 mt-4">
              {t("pet.test.chatHint")}
            </p>
          </section>

          {/* 设置 */}
          <section className="rounded-2xl bg-white/[0.04] border border-white/10 p-5 backdrop-blur-sm">
            <div className="flex items-center gap-2 mb-4">
              <Settings className="w-4 h-4 text-purple-300" />
              <h2 className="text-sm font-semibold">{t("pet.test.settings")}</h2>
            </div>
            <div className="space-y-3">
              <label className="flex items-center justify-between p-3 rounded-xl bg-white/5 cursor-pointer hover:bg-white/[0.07] transition-colors">
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-amber-300" />
                  <span className="text-sm">{t("pet.test.enablePet")}</span>
                </div>
                <input
                  type="checkbox"
                  checked={petEnabled}
                  onChange={(e) => setPetEnabled(e.target.checked)}
                  className="w-4 h-4 accent-pink-500"
                />
              </label>
              <label className="flex items-center justify-between p-3 rounded-xl bg-white/5 cursor-pointer hover:bg-white/[0.07] transition-colors">
                <div className="flex items-center gap-2">
                  <Settings className="w-4 h-4 text-cyan-300" />
                  <span className="text-sm">{t("pet.test.debugMode")}</span>
                </div>
                <input
                  type="checkbox"
                  checked={debugMode}
                  onChange={(e) => setDebugMode(e.target.checked)}
                  className="w-4 h-4 accent-pink-500"
                />
              </label>
              <button
                onClick={resetPosition}
                className="w-full flex items-center justify-center gap-2 p-3 rounded-xl bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10 transition-colors text-sm"
              >
                <RefreshCw className="w-4 h-4" />
                {t("pet.test.resetPosition")}
              </button>
            </div>
          </section>

          {/* 架构说明 */}
          <section className="rounded-2xl bg-white/[0.04] border border-white/10 p-5 backdrop-blur-sm">
            <div className="flex items-center gap-2 mb-4">
              <Heart className="w-4 h-4 text-rose-300" />
              <h2 className="text-sm font-semibold">{t("pet.test.architecture")}</h2>
            </div>
            <ul className="space-y-2 text-xs text-slate-400">
              <li className="flex items-start gap-2">
                <span className="text-pink-400 mt-0.5">▸</span>
                <span>iframe 全局悬浮方案：页面跳转不消失</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-pink-400 mt-0.5">▸</span>
                <span>Spine 公共骨骼：一套骨骼全站复用</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-pink-400 mt-0.5">▸</span>
                <span>动态换皮：用户贴图自动替换插槽</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-pink-400 mt-0.5">▸</span>
                <span>postMessage 双向通信：主站 ↔ 桌宠</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-pink-400 mt-0.5">▸</span>
                <span>IndexedDB 持久化：位置/状态不丢失</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-pink-400 mt-0.5">▸</span>
                <span>AI 情绪驱动：LLM 返回 mood 自动播动画</span>
              </li>
            </ul>
          </section>
        </div>

        {/* 底部提示 */}
        <div className="mt-8 p-4 rounded-xl bg-pink-500/10 border border-pink-400/20">
          <p className="text-xs text-pink-200 leading-relaxed">
            <strong className="text-pink-300">灰度测试说明：</strong>
            当前预设形象为上传的毛绒兽设图（白底已自动抠除）。正式版本将接入 Spine 骨骼动画系统，
            支持用户自定义兽设贴图、AI 生成专属形象。右下角桌宠可拖拽、点击互动~
          </p>
        </div>
      </div>
    </div>
  );
}
