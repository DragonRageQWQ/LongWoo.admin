import { describe, it, expect, vi } from 'vitest'
import { confirmPasswordSet } from './password-confirm'

describe('confirmPasswordSet', () => {
  it('updateUserById 无错误时无需验证，直接确认成功', async () => {
    const verifyLogin = vi.fn()
    const result = await confirmPasswordSet({
      email: 'a@b.com',
      newPassword: 'newpass123',
      updateError: null,
      attemptLogin: verifyLogin,
    })
    expect(result).toEqual({ success: true })
    expect(verifyLogin).not.toHaveBeenCalled()
  })

  it('updateUserById 报错但新密码可登录（响应丢失场景）→ 判定成功', async () => {
    const attemptLogin = vi.fn().mockResolvedValue({ error: null })
    const result = await confirmPasswordSet({
      email: 'a@b.com',
      newPassword: 'newpass123',
      updateError: new Error('network timeout'),
      attemptLogin,
    })
    expect(result).toEqual({ success: true })
    expect(attemptLogin).toHaveBeenCalledWith('a@b.com', 'newpass123')
  })

  it('updateUserById 报错且新密码无法登录 → 判定失败', async () => {
    const attemptLogin = vi.fn().mockResolvedValue({ error: new Error('invalid credentials') })
    const result = await confirmPasswordSet({
      email: 'a@b.com',
      newPassword: 'newpass123',
      updateError: new Error('server error'),
      attemptLogin,
    })
    expect(result.success).toBe(false)
  })

  it('updateUserById 报错且新密码登录也异常 → 判定失败而非误报成功', async () => {
    const attemptLogin = vi.fn().mockRejectedValue(new Error('unreachable'))
    const result = await confirmPasswordSet({
      email: 'a@b.com',
      newPassword: 'newpass123',
      updateError: new Error('server error'),
      attemptLogin,
    })
    expect(result.success).toBe(false)
  })
})
