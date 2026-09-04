/**
 * Spine 运行时加载器（预留接口）
 *
 * 当前演示版本使用 SVG + CSS 动画模拟桌宠效果。
 * 正式版本接入 Spine 后，此模块负责：
 * 1. 加载公共骨骼 JSON + Atlas
 * 2. 初始化 PixiJS + Spine 渲染实例
 * 3. 提供换皮、播放动画等方法
 *
 * 接入步骤：
 * 1. 安装依赖：npm install pixi.js @esotericsoftware/spine-pixi
 * 2. 将 Spine 导出文件放入 /public/pet-base/
 * 3. 替换 pet-runtime.html 中的 SVG 渲染部分为 Spine 渲染
 */

import type { PetMood, PetTextureConfig } from './types';
import { PET_CONFIG } from './config';

/**
 * Spine 运行时接口（契约）
 * 正式实现时需要满足此接口
 */
export interface SpineRuntime {
  /** 加载公共骨骼资源 */
  loadBaseSkeleton(): Promise<void>;

  /** 替换用户贴图 */
  applyTextures(textures: PetTextureConfig): void;

  /** 播放动画 */
  playAnimation(animation: PetMood | string, loop?: boolean): void;

  /** 暂停动画 */
  pause(): void;

  /** 继续动画 */
  resume(): void;

  /** 销毁实例 */
  destroy(): void;
}

/**
 * 占位实现：SVG 版桌宠
 * 当前使用 DOM/SVG 动画，后续替换为 Spine
 */
export class PlaceholderSpineRuntime implements SpineRuntime {
  private container: HTMLElement;
  private currentAnim: string = 'idle';

  constructor(container: HTMLElement) {
    this.container = container;
  }

  async loadBaseSkeleton(): Promise<void> {
    // 占位：实际会加载 JSON + Atlas
    console.log('[Spine] 加载公共骨骼（占位实现）');
    return Promise.resolve();
  }

  applyTextures(textures: PetTextureConfig): void {
    // 占位：实际会遍历插槽替换贴图
    console.log('[Spine] 应用贴图（占位实现）', textures);
  }

  playAnimation(animation: string, loop: boolean = true): void {
    this.currentAnim = animation;
    console.log('[Spine] 播放动画:', animation, 'loop:', loop);
  }

  pause(): void {
    console.log('[Spine] 暂停');
  }

  resume(): void {
    console.log('[Spine] 继续');
  }

  destroy(): void {
    console.log('[Spine] 销毁');
  }
}

/**
 * Spine 资源路径
 */
export const SPINE_ASSETS = {
  skeletonJson: `${PET_CONFIG.runtimeUrl.replace('pet-runtime.html', '')}pet-base/common_furry_skeleton.json`,
  atlas: `${PET_CONFIG.runtimeUrl.replace('pet-runtime.html', '')}pet-base/common_furry.atlas`,
  basePng: `${PET_CONFIG.runtimeUrl.replace('pet-runtime.html', '')}pet-base/common_furry.png`,
};

/**
 * 创建 Spine 运行时实例
 * （当前返回占位实现，接入 Spine 后替换为真实实现）
 */
export function createSpineRuntime(container: HTMLElement): SpineRuntime {
  return new PlaceholderSpineRuntime(container);
}
