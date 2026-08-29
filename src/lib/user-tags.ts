/**
 * 用户标签（tag）体系
 *
 * 标签类别（全部仅超管 uid=10001 可授予/撤销）：
 * - blacklist  拉黑（软封禁）：可正常浏览网页，但禁止使用业务内容（下单/聊天等）
 * - ban        硬封禁：登录接口伪装超时失败，已有会话立即失效，无法正常登录
 * - testA~D    测试用户标记（灰度测试分区分组）
 * - vip / svip 特殊用户标记（权限位，供未来业务扩展）
 */

export const USER_TAG_KEYS = [
  'blacklist',
  'ban',
  'testA',
  'testB',
  'testC',
  'testD',
  'vip',
  'svip',
] as const;

export type UserTagKey = (typeof USER_TAG_KEYS)[number];

/** 标签展示名（后台管理界面） */
export const USER_TAG_LABELS: Record<UserTagKey, string> = {
  blacklist: '拉黑',
  ban: '硬封禁',
  testA: '测试A',
  testB: '测试B',
  testC: '测试C',
  testD: '测试D',
  vip: 'VIP',
  svip: 'SVIP',
};

/** 标签徽章配色（后台展示） */
export const USER_TAG_STYLES: Record<UserTagKey, string> = {
  blacklist: 'bg-red-50 text-red-700 border-red-200',
  ban: 'bg-gray-800 text-white border-gray-800',
  testA: 'bg-blue-50 text-blue-700 border-blue-200',
  testB: 'bg-blue-50 text-blue-700 border-blue-200',
  testC: 'bg-blue-50 text-blue-700 border-blue-200',
  testD: 'bg-blue-50 text-blue-700 border-blue-200',
  vip: 'bg-amber-50 text-amber-700 border-amber-200',
  svip: 'bg-orange-50 text-orange-700 border-orange-200',
};

/** 标签白名单（服务端校验，拒绝任意字符串注入） */
const TAG_WHITELIST = new Set<string>(USER_TAG_KEYS);

/** 是否为合法标签 */
export function isUserTag(value: string): value is UserTagKey {
  return TAG_WHITELIST.has(value);
}

/** 清洗标签数组：白名单过滤 + 去重，返回规范化后的合法标签列表 */
export function sanitizeTags(tags: unknown): UserTagKey[] {
  if (!Array.isArray(tags)) return [];
  const seen = new Set<UserTagKey>();
  const result: UserTagKey[] = [];
  for (const item of tags) {
    if (typeof item === 'string' && isUserTag(item) && !seen.has(item)) {
      seen.add(item);
      result.push(item);
    }
  }
  return result;
}

/** 读取用户 tags（兼容 null/undefined/脏数据） */
export function readUserTags(tags: unknown): UserTagKey[] {
  return sanitizeTags(tags);
}

/** 是否含指定标签 */
export function hasUserTag(tags: unknown, tag: UserTagKey): boolean {
  return readUserTags(tags).includes(tag);
}
