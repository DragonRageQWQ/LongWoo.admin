/**
 * 桌宠内置音色目录（服务端 Edge Read Aloud TTS 引擎）
 *
 * 背景：浏览器自带语音依赖用户手动安装系统/浏览器语音包，多数用户没有。
 * 桌宠因此在服务端提供「内置音色」库（免费、零 Key），用户打开即用。
 *
 * 实现说明：
 * - 每个音色对应微软 Edge Read Aloud 的 neural voice（与 Edge 浏览器朗读功能同源）。
 * - 服务端代理合成（见 src/app/api/pet/tts/route.ts），key 不外泄、可限流。
 * - 运行时以 `edge:${id}` 作为选中标识（voiceURI），与浏览器系统语音隔离。
 *
 * 注意：Edge Read Aloud 面向终端用户网页服务，适合灰度/自有小规模使用；
 * 若商业化大规模商用建议替换为 Azure Speech（同为这些音色，接口语义一致）。
 */

export interface PetBuiltinVoice {
  /** 引擎音色 id（微软 neural voice 名，如 zh-CN-XiaoxiaoNeural） */
  id: string;
  /** 中文昵称（UI 展示用） */
  label: string;
  /** 引擎短名（UI 副标题展示用） */
  name: string;
  /** 语言 BCP-47 */
  lang: string;
  gender: 'male' | 'female';
}

/** 运行时内置音色标识前缀（与浏览器系统语音区分） */
export const PET_BUILTIN_PREFIX = 'edge:';

/** 内置音色运行时标识（voiceURI）：edge:zh-CN-XiaoxiaoNeural */
export function petBuiltinVoiceURI(id: string): string {
  return `${PET_BUILTIN_PREFIX}${id}`;
}

/** 由运行时标识还原引擎 id；非内置音色返回 null */
export function petBuiltinEngineId(voiceURI: string): string | null {
  if (typeof voiceURI !== 'string' || !voiceURI.startsWith(PET_BUILTIN_PREFIX)) return null;
  return voiceURI.slice(PET_BUILTIN_PREFIX.length);
}

export const PET_BUILTIN_VOICES: PetBuiltinVoice[] = [
  // 简体中文（女 / 男 / 方言梗，适合毛绒桌宠 demo）
  { id: 'zh-CN-XiaoxiaoNeural', label: '晓晓', name: 'Xiaoxiao', lang: 'zh-CN', gender: 'female' },
  { id: 'zh-CN-XiaoyiNeural', label: '晓伊', name: 'Xiaoyi', lang: 'zh-CN', gender: 'female' },
  { id: 'zh-CN-YunxiNeural', label: '云希', name: 'Yunxi', lang: 'zh-CN', gender: 'male' },
  { id: 'zh-CN-YunjianNeural', label: '云健', name: 'Yunjian', lang: 'zh-CN', gender: 'male' },
  { id: 'zh-CN-liaoning-XiaobeiNeural', label: '晓北', name: 'Xiaobei（东北腔）', lang: 'zh-CN', gender: 'female' },
  // 繁体中文
  { id: 'zh-TW-HsiaoChenNeural', label: '曉臻', name: 'HsiaoChen', lang: 'zh-TW', gender: 'female' },
  // 英文
  { id: 'en-US-AriaNeural', label: '阿丽雅', name: 'Aria', lang: 'en-US', gender: 'female' },
  { id: 'en-US-GuyNeural', label: '盖伊', name: 'Guy', lang: 'en-US', gender: 'male' },
  // 日文
  { id: 'ja-JP-NanamiNeural', label: '七海', name: 'Nanami', lang: 'ja-JP', gender: 'female' },
  // 韩文
  { id: 'ko-KR-SunHiNeural', label: '孙熙', name: 'SunHi', lang: 'ko-KR', gender: 'female' },
  // 俄文
  { id: 'ru-RU-SvetlanaNeural', label: '斯维特兰娜', name: 'Svetlana', lang: 'ru-RU', gender: 'female' },
  // 法文
  { id: 'fr-FR-DeniseNeural', label: '丹妮丝', name: 'Denise', lang: 'fr-FR', gender: 'female' },
];

const BUILTIN_ID_SET = new Set(PET_BUILTIN_VOICES.map((v) => v.id));

export function isBuiltinEngineId(id: string): boolean {
  return BUILTIN_ID_SET.has(id);
}

export function findBuiltinVoice(id: string): PetBuiltinVoice | null {
  return PET_BUILTIN_VOICES.find((v) => v.id === id) ?? null;
}

/** 将运行时音调（0.5~2）映射为 Edge prosody 相对音高（Hz），1 → '+0Hz' */
export function petPitchToHz(pitch: number): string {
  const safe = Math.min(2, Math.max(0.5, typeof pitch === 'number' ? pitch : 1));
  const hz = Math.round((safe - 1) * 150);
  return hz === 0 ? '+0Hz' : hz > 0 ? `+${hz}Hz` : `${hz}Hz`;
}

/** 语速（倍率，1 = 原速）映射为 Edge prosody rate 百分比 */
export function petRateToPercent(rate: number): string {
  const safe = Math.min(2, Math.max(0.5, typeof rate === 'number' ? rate : 1));
  const pct = Math.round((safe - 1) * 100);
  return pct === 0 ? '+0%' : pct > 0 ? `+${pct}%` : `${pct}%`;
}

/** XML 转义，防止文本破坏 SSML（msedge-tts 会把文本拼进 SSML） */
export function escapeSsmlText(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
