/**
 * 桌宠后端 API 接口定义
 *
 * 实际部署时这些接口由后端实现，前端仅调用。
 * 此文件作为接口契约文档，供前后端对齐使用。
 */

import type { PetTextureConfig, PetMood } from './types';

// ============== 请求类型 ==============

/** 创建桌宠任务请求 */
export interface CreatePetRequest {
  /** 用户上传的原始兽设图片 URL（base64 或 OSS 地址） */
  sourceImage: string;
  /** 用户 ID */
  uid: string;
  /** 是否启用翅膀 */
  enableWing?: boolean;
  /** 是否启用犄角 */
  enableHorn?: boolean;
}

/** 获取桌宠信息请求 */
export interface GetPetInfoRequest {
  uid: string;
}

// ============== 响应类型 ==============

/** 创建任务响应 */
export interface CreatePetResponse {
  /** 任务 ID，用于轮询状态 */
  taskId: string;
  /** 状态：pending / processing / completed / failed */
  status: 'pending' | 'processing' | 'completed' | 'failed';
  /** 预估剩余时间（秒） */
  estimatedSeconds?: number;
}

/** 任务状态查询响应 */
export interface TaskStatusResponse {
  taskId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress?: number; // 0-100
  message?: string;
  result?: PetUserConfig;
  error?: string;
}

/** 用户桌宠配置 */
export interface PetUserConfig {
  uid: string;
  enableWing: boolean;
  enableHorn: boolean;
  textureList: PetTextureConfig;
  /** 创建时间 */
  createdAt: string;
  /** 最后更新时间 */
  updatedAt: string;
}

/** AI 对话响应（LLM 返回格式） */
export interface PetChatResponse {
  /** 回复文本 */
  replyText: string;
  /** 情绪，用于驱动桌宠动画 */
  mood: PetMood | string;
  /** 可选：对话 ID */
  chatId?: string;
}

// ============== 接口列表 ==============

export const PET_API = {
  /**
   * POST /api/pet/create
   * 提交原图发起 AI 生成任务
   */
  create: {
    method: 'POST',
    path: '/api/pet/create',
    requestType: {} as CreatePetRequest,
    responseType: {} as CreatePetResponse,
  },

  /**
   * GET /api/pet/task?taskId=xxx
   * 查询生成任务状态
   */
  taskStatus: {
    method: 'GET',
    path: '/api/pet/task',
    responseType: {} as TaskStatusResponse,
  },

  /**
   * GET /api/pet/info?uid=xxx
   * 获取用户贴图 CDN 地址配置
   */
  getInfo: {
    method: 'GET',
    path: '/api/pet/info',
    responseType: {} as PetUserConfig,
  },

  /**
   * POST /api/pet/chat
   * AI 对话接口（返回带 mood 的结构化回复）
   */
  chat: {
    method: 'POST',
    path: '/api/pet/chat',
    responseType: {} as PetChatResponse,
  },
};

// ============== 前端调用示例 ==============
/*
// 1. 发起生成任务
const task = await fetch('/api/pet/create', {
  method: 'POST',
  body: JSON.stringify({ sourceImage, uid }),
}).then(r => r.json());

// 2. 轮询任务状态
const status = await fetch(`/api/pet/task?taskId=${task.taskId}`)
  .then(r => r.json());

// 3. 获取用户配置
const config = await fetch(`/api/pet/info?uid=${uid}`)
  .then(r => r.json());

// 4. 应用到桌宠
window.__pet.applyTextures(config.textureList);
*/
