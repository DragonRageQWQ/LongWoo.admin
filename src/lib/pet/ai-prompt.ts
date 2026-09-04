/**
 * 桌宠 AI 生成提示词模板
 *
 * 固定提示词用于确保所有用户生成的桌宠贴图：
 * 1. 严格遵守 3 头身 Q 版比例
 * 2. 正面站姿正对镜头
 * 3. 统一毛绒玩偶质感
 * 4. 便于后期自动分割和骨骼绑定
 */

/** 正向提示词（固定不可修改） */
export const PET_POSITIVE_PROMPT = `masterpiece, best quality, 8k, ultra-detailed,
product studio photography, soft diffused studio lighting,
seamless pure transparent background,
collectible short fursuit plush toy, 3-headed chibi furry character,
matte soft plush texture, fine short fur, no long fluffy clumps,
strictly follow the fixed template pose: front view exactly facing camera, standard neutral standing posture,
100% consistent body proportion and outline with template base model,
preserve original character color palette, fur markings, patterns, horns, ears, tail shape, wing structure,
clean rounded sculpt, no deformed parts,
no pose change, no angle change, no style deviation,
high quality game sprite, ready for spine skeleton mapping`;

/** 反向提示词（固定不可修改） */
export const PET_NEGATIVE_PROMPT = `(worst quality, low quality:1.4), blurry, deformed, asymmetric,
dynamic pose, side view, angle deviation, jumping, walking,
long fur, fluffy messy fur, real animal fur,
extra limbs, missing parts, changed body proportion,
complex background, shadow, text, watermark, 3d render noise,
illustration painting style, cartoon distortion`;

/** AI 生成参数 */
export const PET_AI_CONFIG = {
  model: 'seedream-v3',
  width: 1024,
  height: 1024,
  steps: 30,
  cfgScale: 7,
  sampler: 'DPM++ 2M Karras',
  controlNet: {
    type: 'canny', // 或 lineart / depth
    weight: 0.9,
    guidanceStart: 0.0,
    guidanceEnd: 1.0,
  },
};

/**
 * 标准插槽名称列表（Spine 插槽一一对应）
 * 自动分割时按此列表输出
 */
export const PET_SLOT_NAMES = [
  'body',    // 躯干
  'head',    // 头部外壳
  'face',    // 五官图层
  'earL',    // 左耳
  'earR',    // 右耳
  'tail',    // 尾巴
  'armL',    // 左臂
  'armR',    // 右臂
  'legL',    // 左腿
  'legR',    // 右腿
  'wing',    // 翅膀（可选）
  'horn',    // 犄角（可选）
] as const;

export type PetSlotName = typeof PET_SLOT_NAMES[number];

/**
 * 分色蒙版图颜色映射（用于 SAM 自动分割）
 * 每个部位对应一个唯一的纯色色值
 */
export const PET_MASK_COLORS: Record<PetSlotName, string> = {
  body:  '#ff0000', // 红
  head:  '#00ff00', // 绿
  face:  '#0000ff', // 蓝
  earL:  '#ffff00', // 黄
  earR:  '#ff00ff', // 品红
  tail:  '#00ffff', // 青
  armL:  '#ff8800', // 橙
  armR:  '#8800ff', // 紫
  legL:  '#00ff88', // 翠绿
  legR:  '#ff0088', // 玫红
  wing:  '#88ff00', // 黄绿
  horn:  '#0088ff', // 天蓝
};

/**
 * 公共骨骼动画列表
 * 制作 Spine 工程时动画命名必须与此一致
 */
export const PET_ANIMATIONS = [
  'idle',     // 待机：呼吸起伏、轻微晃动、随机眨眼
  'happy',    // 开心：小跳跃、头部晃动
  'surprise', // 惊讶：抬头睁大眼，身体微震
  'sad',      // 难过：低头垂肩，尾巴下垂
  'wave',     // 挥手：抬起一只手打招呼
  'sleep',    // 休眠：闭眼缓慢晃动
  'drag',     // 拖拽：肢体松弛跟随
] as const;

export type PetAnimation = typeof PET_ANIMATIONS[number];

/**
 * Spine 骨骼层级结构（参考）
 * root
 * └── torso
 *     ├─ head (IK)
 *     ├─ armL (IK)
 *     ├─ armR (IK)
 *     ├─ legL (IK)
 *     ├─ legR (IK)
 *     ├─ tail_1 → tail_2 → tail_3 → tail_4
 *     ├─ earL / earR
 *     ├─ wing (可选)
 *     └─ horn (可选)
 */
