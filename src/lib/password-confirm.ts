/**
 * 修改密码的幂等确认工具
 *
 * 背景：Supabase Admin API 的 updateUserById 偶发"响应丢失/超时"，
 * 服务端已成功修改密码，但客户端收到错误。直接返回失败会让用户
 * 看到"设置密码失败"而密码实际已设置（"报错但成功"）。
 *
 * 方案：updateUserById 返回错误时，用新密码尝试登录验证：
 * - 新密码可登录 → 密码实际已更新（仅响应丢失），判定成功
 * - 新密码无法登录 → 密码确实未更新，判定失败
 * - 验证登录本身异常 → 无法确认，判定失败（宁可不误报成功）
 */

export interface ConfirmPasswordSetOptions {
  email: string
  newPassword: string
  /** updateUserById 返回的错误（null 表示直接成功） */
  updateError: Error | null
  /**
   * 用指定邮箱+密码尝试登录（返回 error 为 null 表示登录成功）
   * 由调用方注入，便于测试。
   */
  attemptLogin: (email: string, password: string) => Promise<{ error: unknown }>
}

export type ConfirmPasswordSetResult =
  | { success: true }
  | { success: false; error: string }

export async function confirmPasswordSet(
  options: ConfirmPasswordSetOptions
): Promise<ConfirmPasswordSetResult> {
  const { email, newPassword, updateError, attemptLogin } = options

  // 更新无错误：直接成功
  if (!updateError) {
    return { success: true }
  }

  // 更新报错：用新密码验证是否实际已设置（响应丢失场景）
  try {
    const loginResult = await attemptLogin(email, newPassword)
    if (!loginResult.error) {
      // 新密码可登录 → 密码已成功设置，仅响应丢失
      return { success: true }
    }
    return { success: false, error: '设置密码失败，请稍后重试' }
  } catch {
    // 验证登录异常：无法确认，不误报成功
    return { success: false, error: '设置密码失败，请稍后重试' }
  }
}
