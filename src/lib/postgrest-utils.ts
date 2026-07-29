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
