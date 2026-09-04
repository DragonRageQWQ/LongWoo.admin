"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { PET_CONFIG, EMOTION_MAP } from "@/lib/pet/config";
import type {
  PetMessage,
  PetMood,
  PetTextureConfig,
  PetPosition,
  PetVoiceInfo,
} from "@/lib/pet/types";

interface PetIframeProps {
  /** 是否启用桌宠 */
  enabled?: boolean;
  /** 用户 UID */
  uid?: string;
  /** 用户贴图配置 */
  textures?: PetTextureConfig;
  /** 调试模式 */
  debug?: boolean;
  /** 初始音色 voiceURI（空 = 跟随系统） */
  voiceURI?: string | null;
  /** 初始音调 0.5~2 */
  pitch?: number;
  /** 桌宠就绪回调 */
  onReady?: () => void;
  /** 情绪变化回调 */
  onMoodChange?: (mood: PetMood) => void;
  /** 点击桌宠回调 */
  onClick?: () => void;
  /** 位置变化回调 */
  onPositionChange?: (position: PetPosition) => void;
  /** 可用音色列表更新回调（iframe 枚举完成后推送） */
  onVoicesChange?: (voices: PetVoiceInfo[]) => void;
  /** 当前音色/音调变化回调 */
  onVoiceChange?: (voiceURI: string | null, pitch: number) => void;
}

/**
 * 全局悬浮桌宠容器（iframe 方案）
 *
 * 原理：
 * - 使用全屏透明 iframe 承载桌宠运行时
 * - 桌宠在 iframe 内部独立运行，不受主站路由切换影响
 * - 通过 postMessage 实现主站 ↔ 桌宠双向通信
 *
 * 用法：放在全站 Layout 最外层，确保 z-index 最高
 */
export default function PetIframe({
  enabled = true,
  uid = "guest",
  textures,
  debug = false,
  voiceURI,
  pitch,
  onReady,
  onMoodChange,
  onClick,
  onPositionChange,
  onVoicesChange,
  onVoiceChange,
}: PetIframeProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const isReadyRef = useRef(false);
  const messageQueueRef = useRef<PetMessage[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  /** 发送消息到 iframe */
  const sendMessage = useCallback((message: PetMessage) => {
    const iframe = iframeRef.current;
    if (!iframe || !iframe.contentWindow) {
      messageQueueRef.current.push(message);
      return;
    }
    if (!isReadyRef.current) {
      messageQueueRef.current.push(message);
      return;
    }
    try {
      iframe.contentWindow.postMessage(message, "*");
    } catch (e) {
      console.warn("[pet] 发送消息失败", e);
    }
  }, []);

  /** 处理来自 iframe 的消息 */
  const handleMessage = useCallback(
    (event: MessageEvent) => {
      const data = event.data as PetMessage;
      if (!data || !data.type || !data.type.startsWith("pet:")) return;

      switch (data.type) {
        case "pet:ready":
          isReadyRef.current = true;
          setIsLoaded(true);
          // 发送积压的消息
          while (messageQueueRef.current.length > 0) {
            const msg = messageQueueRef.current.shift();
            if (msg) sendMessage(msg);
          }
          // 发送初始配置（voiceURI/pitch 仅在宿主显式传入时下发，避免覆盖运行时已持久化的音色偏好）
          const configMsg: PetMessage = { type: "pet:config", uid, textures };
          if (voiceURI !== undefined) configMsg.voiceURI = voiceURI;
          if (pitch !== undefined) configMsg.pitch = pitch;
          sendMessage(configMsg);
          if (debug) {
            sendMessage({ type: "pet:debug", show: true });
          }
          onReady?.();
          break;

        case "pet:mood":
          if (data.mood) onMoodChange?.(data.mood);
          break;

        case "pet:click":
          onClick?.();
          break;

        case "pet:position":
          if (data.position) onPositionChange?.(data.position);
          break;

        case "pet:voices":
          // 仅同步可用音色列表；当前选中音色由 pet:voiceChanged 单独推送
          if (data.voices) onVoicesChange?.(data.voices);
          break;

        case "pet:voiceChanged":
          onVoiceChange?.(data.selected ?? null, data.pitch ?? PET_CONFIG.defaultPitch);
          break;
      }
    },
    [
      uid,
      textures,
      voiceURI,
      pitch,
      debug,
      sendMessage,
      onReady,
      onMoodChange,
      onClick,
      onPositionChange,
      onVoicesChange,
      onVoiceChange,
    ]
  );

  /** 播放情绪动画 */
  const setMood = useCallback(
    (mood: PetMood) => {
      sendMessage({ type: "pet:mood", mood });
    },
    [sendMessage]
  );

  /** 触发临时情绪（自动回到 idle） */
  const triggerMood = useCallback(
    (mood: PetMood, duration?: number) => {
      sendMessage({ type: "pet:trigger", mood, duration });
    },
    [sendMessage]
  );

  /** 说话（显示气泡 + TTS） */
  const speak = useCallback(
    (text: string, duration?: number) => {
      sendMessage({ type: "pet:speak", text, duration });
    },
    [sendMessage]
  );

  /** 设置音色 + 音调（可选试听） */
  const setVoice = useCallback(
    (voiceURI: string | null, pitch?: number, preview?: boolean) => {
      sendMessage({ type: "pet:setVoice", voiceURI, pitch, preview });
    },
    [sendMessage]
  );

  /** 主动拉取 iframe 内可用音色列表 */
  const getVoices = useCallback(() => {
    sendMessage({ type: "pet:getVoices" });
  }, [sendMessage]);

  /** 重置位置 */
  const resetPosition = useCallback(() => {
    sendMessage({ type: "pet:reset" });
  }, [sendMessage]);

  /** 根据 LLM 输出的情绪字符串播放动画 */
  const playEmotion = useCallback(
    (emotion: string) => {
      const mood = EMOTION_MAP[emotion.toLowerCase()] || "idle";
      triggerMood(mood, 2000);
    },
    [triggerMood]
  );

  // 暴露方法到 window 供外部调用（调试用）
  useEffect(() => {
    if (typeof window !== "undefined") {
      (window as any).__pet = {
        setMood,
        triggerMood,
        speak,
        setVoice,
        getVoices,
        resetPosition,
        playEmotion,
        isReady: () => isReadyRef.current,
      };
    }
  }, [setMood, triggerMood, speak, setVoice, getVoices, resetPosition, playEmotion]);

  // 监听消息
  useEffect(() => {
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [handleMessage]);

  // iframe 加载完成后 ping 一下
  const handleIframeLoad = useCallback(() => {
    // 稍等一下让 iframe 内部初始化完成
    setTimeout(() => {
      sendMessage({ type: "pet:ping" });
    }, 100);
  }, [sendMessage]);

  // uid/textures/voiceURI/pitch 变化时更新（同样的条件下发规则）
  useEffect(() => {
    if (isReadyRef.current) {
      const configMsg: PetMessage = { type: "pet:config", uid, textures };
      if (voiceURI !== undefined) configMsg.voiceURI = voiceURI;
      if (pitch !== undefined) configMsg.pitch = pitch;
      sendMessage(configMsg);
    }
  }, [uid, textures, voiceURI, pitch, sendMessage]);

  if (!enabled) return null;

  return (
    <iframe
      ref={iframeRef}
      src={`${PET_CONFIG.runtimeUrl}${debug ? "?debug=1" : ""}`}
      title="LongWoo Pet"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        border: "none",
        background: "transparent",
        pointerEvents: "none",
        zIndex: PET_CONFIG.zIndex,
        opacity: isLoaded ? 1 : 0,
        transition: "opacity 0.3s",
      }}
      onLoad={handleIframeLoad}
      allow="speech"
    />
  );
}
