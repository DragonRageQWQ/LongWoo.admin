/**
 * 桌宠相关类型定义
 */

export type PetMood = 'idle' | 'happy' | 'surprise' | 'sad' | 'wave' | 'sleep';

export interface PetPosition {
  x: number;
  y: number;
}

export interface PetTextureConfig {
  body?: string;
  head?: string;
  face?: string;
  earL?: string;
  earR?: string;
  tail?: string;
  armL?: string;
  armR?: string;
  legL?: string;
  legR?: string;
  wing?: string;
  horn?: string;
}

export interface PetUserConfig {
  uid: string;
  enableWing: boolean;
  enableHorn: boolean;
  textureList: PetTextureConfig;
}

export interface PetState {
  mood: PetMood;
  position: PetPosition | null;
  uid: string;
}

/** 音色来源 */
export type PetVoiceSource = 'system' | 'builtin';

/** TTS 可用音色信息（系统语音 = speechSynthesis.getVoices()；内置音色 = 服务端合成） */
export interface PetVoiceInfo {
  voiceURI: string;
  name: string;
  lang: string;
  isDefault: boolean;
  localService: boolean;
  /** 来源：system=浏览器系统语音，builtin=服务端内置音色（免安装） */
  source?: PetVoiceSource;
}

/**
 * postMessage 消息类型
 */
export type PetMessageType =
  | 'pet:ready'
  | 'pet:mood'
  | 'pet:speak'
  | 'pet:trigger'
  | 'pet:reset'
  | 'pet:config'
  | 'pet:debug'
  | 'pet:ping'
  | 'pet:pong'
  | 'pet:click'
  | 'pet:position'
  | 'pet:texturesApplied'
  | 'pet:getVoices'
  | 'pet:setVoice'
  | 'pet:voices'
  | 'pet:voiceChanged';

export interface PetMessage {
  type: PetMessageType;
  mood?: PetMood;
  text?: string;
  duration?: number;
  uid?: string;
  textures?: PetTextureConfig;
  show?: boolean;
  ready?: boolean;
  position?: PetPosition;
  /** 音色 voiceURI（null / 空串 = 跟随系统默认） */
  voiceURI?: string | null;
  /** 音调 0.5~2（1 = 原声） */
  pitch?: number;
  /** 可用音色列表（iframe -> 宿主） */
  voices?: PetVoiceInfo[];
  /** 当前选中音色（iframe -> 宿主） */
  selected?: string | null;
  /** 是否试听（宿主 -> iframe，设置音色后朗读一句示例） */
  preview?: boolean;
}
