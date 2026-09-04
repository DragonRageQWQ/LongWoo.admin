/**
 * 桌宠配置
 */
import type { PetMood } from './types';

export const PET_CONFIG = {
  /** iframe 运行时地址 */
  runtimeUrl: '/pet-runtime.html',

  /** 默认情绪 */
  defaultMood: 'idle' as PetMood,

  /** 无操作自动休眠时间（毫秒） */
  idleTimeout: 60000,

  /** 对话气泡默认显示时长（毫秒） */
  speechDuration: 2500,

  /**  localStorage 存储键 */
  storageKey: 'longwoo_pet_state',

  /** z-index 层级（确保在最上层） */
  zIndex: 9999,

  /** 默认大小 */
  defaultSize: {
    width: 120,
    height: 140,
  },

  /** 支持的情绪列表 */
  moods: ['idle', 'happy', 'surprise', 'sad', 'wave', 'sleep'] as PetMood[],

  /** 默认音调（1 = 原声；<1 低沉，>1 尖细） */
  defaultPitch: 1,

  /** 音调可调范围 */
  pitchRange: { min: 0.5, max: 2, step: 0.1 },

  /** TTS 默认语速 */
  defaultRate: 1.1,

  /** localStorage 中 voice 配置键 */
  voiceStorageKey: 'longwoo_pet_voice',
};

/**
 * 情绪映射：LLM 输出 mood → 桌宠动画
 */
export const EMOTION_MAP: Record<string, PetMood> = {
  idle: 'idle',
  neutral: 'idle',
  normal: 'idle',
  happy: 'happy',
  joy: 'happy',
  excited: 'happy',
  surprise: 'surprise',
  shocked: 'surprise',
  sad: 'sad',
  upset: 'sad',
  cry: 'sad',
  wave: 'wave',
  greeting: 'wave',
  hello: 'wave',
  sleep: 'sleep',
  sleepy: 'sleep',
  tired: 'sleep',
};
