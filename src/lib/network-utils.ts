/**
 * 网络请求有限重试工具
 *
 * 背景：登录/认证链路中多次调用 Supabase 外部 API（generateLink、
 * /auth/v1/verify 等），偶发的网络抖动会导致整个登录流程失败，
 * 用户体验为"验证码报错但重试即成功"。
 *
 * 本工具对临时性失败（网络异常、5xx）做有限重试；4xx 等业务错误
 * 不重试（重试无意义，验证码错误重试同样会失败）。
 */

export interface RetryOptions {
  /** 最大重试次数（不含首次调用），默认 2 */
  retries?: number
  /** 重试间隔（ms），默认 300 */
  delayMs?: number
  /** 判断是否为可重试的临时错误，默认网络异常或 5xx */
  isRetryable?: (error: unknown, response: { ok: boolean; status: number } | null) => boolean
}

export interface RetryFetchResponse {
  ok: boolean
  status: number
  json: () => Promise<unknown>
  text: () => Promise<string>
}

/**
 * 对一次性 fetch 调用执行有限重试。
 *
 * @param attempt 执行网络请求的函数（每次重试重新调用）
 * @param options 重试配置
 * @returns 解析后的 JSON 数据；最终仍失败返回 null
 */
export async function fetchWithRetry(
  attempt: () => Promise<RetryFetchResponse>,
  options: RetryOptions = {}
): Promise<unknown | null> {
  const { retries = 2, delayMs = 300 } = options
  const isRetryable =
    options.isRetryable ??
    ((error, response) => {
      // 网络异常（fetch 抛错）
      if (error) return true
      // 5xx 服务端错误
      if (response && !response.ok && response.status >= 500) return true
      return false
    })

  for (let i = 0; i <= retries; i += 1) {
    try {
      const response = await attempt()
      if (response.ok) {
        return await response.json()
      }
      if (!isRetryable(null, response)) {
        return null
      }
    } catch (error) {
      if (!isRetryable(error, null)) {
        return null
      }
    }

    // 最后一次尝试也失败，返回 null
    if (i < retries) {
      await new Promise(resolve => setTimeout(resolve, delayMs * (i + 1)))
    }
  }

  return null
}
