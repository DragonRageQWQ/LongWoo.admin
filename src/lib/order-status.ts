/**
 * 委托单状态机（唯一事实来源）
 *
 * 本模块把散落在 order-actions.ts 各函数里的状态转换规则集中为纯数据与纯函数，
 * 目的有三：
 *   1. 状态机是业务核心，必须可被单元测试覆盖（原先内联在 Server Action 里无法测试）
 *   2. 前端（可做什么操作）与后端（是否放行）共用同一份规则，避免两边漂移
 *   3. 新增状态时，测试会立即暴露遗漏的文案/权限/转换分支
 *
 * 注意：本文件是纯模块，不含 'use server'，可被 Server Action、API Route、
 * 组件与测试自由引用。
 */

/** 全部委托单状态 */
export const ORDER_STATUSES = [
  'pending',    // 待估价
  'estimated',  // 已估价
  'agreed',     // 客户已同意估价
  'accepted',   // 已接单
  'rejected',   // 已拒单（终态）
  'processing', // 处理中
  'delivered',  // 已交付
  'completed',  // 已完成（终态）
] as const

export type OrderStatus = (typeof ORDER_STATUSES)[number]

/**
 * 合法状态转换表
 *
 * key = 目标状态，value = 允许的来源状态集合。
 * 与数据库中的条件更新（`.in('status', ...)`）保持一致——数据库是最后一道防线，
 * 应用层用同一份规则提前拦截并给出可读的错误提示。
 */
export const ALLOWED_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  pending: [],
  estimated: ['pending'],                    // submitEstimate
  agreed: ['estimated'],                     // agreeEstimate（客户同意估价）
  accepted: ['agreed'],                      // acceptOrder
  rejected: ['pending', 'estimated', 'agreed'], // rejectOrder
  processing: ['accepted'],                  // updateOrderStatus
  delivered: ['processing'],                 // updateOrderStatus
  completed: ['delivered'],                  // updateOrderStatus
}

/** 终态：进入后不可再流转 */
export const TERMINAL_STATUSES: readonly OrderStatus[] = ['rejected', 'completed']

/** 管理员可主动推进的状态（对应 updateOrderStatus 的入参白名单） */
export const ADMIN_PUSHABLE_STATUSES: readonly OrderStatus[] = [
  'processing',
  'delivered',
  'completed',
]

/** 是否为合法状态值 */
export function isOrderStatus(value: unknown): value is OrderStatus {
  return typeof value === 'string' && (ORDER_STATUSES as readonly string[]).includes(value)
}

/** 目标状态允许的来源状态列表（非法目标返回空数组） */
export function allowedFromStatuses(target: string): readonly OrderStatus[] {
  if (!isOrderStatus(target)) return []
  return ALLOWED_TRANSITIONS[target]
}

/** 从 from 是否可以流转到 to */
export function canTransition(from: string, to: string): boolean {
  if (!isOrderStatus(from) || !isOrderStatus(to)) return false
  return ALLOWED_TRANSITIONS[to].includes(from)
}

/** 当前状态可流转到的下一批状态（用于前端按钮渲染） */
export function getNextStatuses(from: string): readonly OrderStatus[] {
  if (!isOrderStatus(from)) return []
  return ORDER_STATUSES.filter((to) => ALLOWED_TRANSITIONS[to].includes(from))
}

/** 是否为终态 */
export function isTerminalStatus(status: string): boolean {
  return (TERMINAL_STATUSES as readonly string[]).includes(status)
}

/** 是否处于「尚未分配工作室成员」的开放阶段（接单池） */
export function isUnassignedStage(status: string): boolean {
  return status === 'pending' || status === 'estimated'
}
