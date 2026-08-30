import { describe, expect, it } from 'vitest'
import {
  CSRF_ERROR_CODES,
  LOGIN_ERROR_CODES,
  buildLoginError,
  isValidErrorCode,
} from './auth-errors'

describe('auth-errors - 错误码常量', () => {
  it('所有 AUTH 错误码唯一', () => {
    const values = Object.values(LOGIN_ERROR_CODES)
    expect(new Set(values).size).toBe(values.length)
  })

  it('所有 CSRF 错误码唯一', () => {
    const values = Object.values(CSRF_ERROR_CODES)
    expect(new Set(values).size).toBe(values.length)
  })

  it('错误码格式均为 前缀_四位数字（AUTH_xxxx / CSRF_xxxx）', () => {
    const all = [...Object.values(LOGIN_ERROR_CODES), ...Object.values(CSRF_ERROR_CODES)]
    for (const code of all) {
      expect(isValidErrorCode(code)).toBe(true)
    }
  })

  it('未知异常兜底码为 AUTH_9999', () => {
    expect(LOGIN_ERROR_CODES.UNKNOWN).toBe('AUTH_9999')
  })
})

describe('auth-errors - buildLoginError', () => {
  it('返回 { success:false, code, error } 结构', () => {
    const body = buildLoginError(LOGIN_ERROR_CODES.INVALID_CREDENTIALS, '邮箱或密码错误')
    expect(body).toEqual({
      success: false,
      code: 'AUTH_0003',
      error: '邮箱或密码错误',
    })
  })

  it('success 恒为 false（错误响应专用）', () => {
    const body = buildLoginError(LOGIN_ERROR_CODES.RATE_LIMITED, '尝试过于频繁')
    expect(body.success).toBe(false)
  })
})

describe('auth-errors - isValidErrorCode', () => {
  it('合法码通过', () => {
    expect(isValidErrorCode('AUTH_0001')).toBe(true)
    expect(isValidErrorCode('CSRF_0001')).toBe(true)
    expect(isValidErrorCode('AUTH_9999')).toBe(true)
  })

  it('非法格式拒绝', () => {
    expect(isValidErrorCode('AUTH_1')).toBe(false)
    expect(isValidErrorCode('AUTH_00001')).toBe(false)
    expect(isValidErrorCode('AUTH0001')).toBe(false)
    expect(isValidErrorCode('XXX_0001')).toBe(false)
    expect(isValidErrorCode('')).toBe(false)
  })
})
