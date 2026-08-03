/**
 * 用户管理页面的服务端元数据计算（纯函数，便于测试）
 *
 * 用途：listAllUsers 在一次 Server Action 请求中同时返回
 * 用户列表与当前操作者权限元数据，客户端无需再单独发起
 * checkIsZeroUser 请求，消除"权限检查 → 拉列表"的串行瀑布。
 *
 * 安全（FIND-09）：零号用户 UID 由服务端计算下发，前端不硬编码。
 */
import { ZERO_USER_UID } from '@/lib/constants'
import type { UserRole } from '@/types/database'

export interface UserListMeta {
  /** 当前操作者是否为零号用户（超级管理员） */
  isZeroUser: boolean
  /** 当前操作者是否为管理员 */
  isAdmin: boolean
  /** 当前操作者 UID（null 表示未登录） */
  currentUserUid: number | null
  /** 零号用户 UID（由服务端下发，前端不硬编码） */
  zeroUserUid: number
}

/**
 * 根据当前用户信息计算用户管理页的权限元数据
 *
 * @param uid  当前用户 UID（未登录为 null）
 * @param role 当前用户角色（未登录为 null）
 */
export function buildUserListMeta(
  uid: number | null,
  role: UserRole | null
): UserListMeta {
  const isAdmin = role === 'admin'
  return {
    isZeroUser: isAdmin && uid !== null && uid === ZERO_USER_UID,
    isAdmin,
    currentUserUid: uid,
    zeroUserUid: ZERO_USER_UID,
  }
}
