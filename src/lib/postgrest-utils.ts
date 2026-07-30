/**
 * PostgREST 查询安全工具
 *
 * 提供 PostgREST 过滤字符串的转义函数，
 * 防止搜索关键词注入（如 `xxx),status.eq.completed` 绕过过滤）。
 */

/**
 * 转义 PostgREST 过滤字符串中的特殊字符
 *
 * PostgREST 的 or()/filter() 语法使用 `,` `.` `(` `)` `\` 作为分隔符，
 * 用户输入的关键词如果包含这些字符，可能注入额外的过滤条件。
 *
 * @example
 * // 不安全：用户输入 "xxx),status.eq.completed" 可绕过搜索
 * query.or(`email.ilike.%${keyword}%`)
 * // 安全：转义后特殊字符被字面化
 * query.or(`email.ilike.%${escapePostgrestKeyword(keyword)}%`)
 */
export function escapePostgrestKeyword(keyword: string): string {
  return keyword
    .replace(/\\/g, '\\\\')
    .replace(/,/g, '\\,')
    .replace(/\./g, '\\.')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
}

/**
 * 转义 ilike 搜索关键词中的通配符
 *
 * PostgREST 的 ilike 过滤器使用 `%` 和 `_` 作为通配符，
 * 用户输入这些字符会改变匹配范围（如 `%` 匹配所有内容）。
 *
 * 安全修复：在 ilike 查询中使用此函数替代 escapePostgrestKeyword，
 * 或在 escapePostgrestKeyword 之后调用。
 *
 * @example
 * // 不安全：用户输入 "%" 会匹配所有记录
 * query.ilike(`%${keyword}%`)
 * // 安全：通配符被转义为字面量
 * query.ilike(`%${escapeIlikeKeyword(keyword)}%`)
 */
export function escapeIlikeKeyword(keyword: string): string {
  return keyword
    .replace(/\\/g, '\\\\')
    .replace(/%/g, '\\%')
    .replace(/_/g, '\\_')
}

/**
 * HTML 转义，防止 XSS 注入
 * 在将用户输入插入 HTML 邮件模板前调用
 */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
