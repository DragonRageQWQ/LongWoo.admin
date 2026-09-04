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
  | 'pet:texturesApplied';

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
}
