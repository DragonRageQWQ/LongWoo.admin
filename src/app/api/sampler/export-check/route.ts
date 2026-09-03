import { NextRequest, NextResponse } from 'next/server'
import { validateApiCsrf } from '@/lib/api-csrf'
import { getCurrentUser } from '@/lib/auth'
import { hasUserTag } from '@/lib/user-tags'

export const dynamic = 'force-dynamic'

/**
 * GET /api/sampler/export-check
 * 取色器「数据导出」授权检查（灰度授权放行）：
 *   1) 必须登录（401）
 *   2) 必须为管理员账号（403）
 *   3) 管理员账号须携带「测试B」授权标签 testB（403，tag 仅超管可授予）
 * 客户端仅在返回 exportAllowed:true 时允许下载文件 / 复制导出色卡。
 */
export async function GET(request: NextRequest) {
  // CSRF 校验（Origin/Referer 白名单）
  const csrfError = validateApiCsrf(request)
  if (csrfError) return csrfError

  const currentUser = await getCurrentUser()
  if (!currentUser) {
    return NextResponse.json(
      { success: false, error: '请先登录', exportAllowed: false, code: 'not-logged-in' },
      { status: 401 }
    )
  }

  const isAdmin = currentUser.role === 'admin'
  if (!isAdmin) {
    return NextResponse.json(
      { success: false, error: '数据导出暂仅对管理员开放', exportAllowed: false, code: 'admin-required' },
      { status: 403 }
    )
  }

  const hasTestB = hasUserTag(currentUser.profile?.tags, 'testB')
  if (!hasTestB) {
    return NextResponse.json(
      { success: false, error: '账号未获「测试B」导出授权标签，请联系超管开通后使用', exportAllowed: false, code: 'tag-required' },
      { status: 403 }
    )
  }

  return NextResponse.json({
    success: true,
    exportAllowed: true,
    role: currentUser.role,
    uid: currentUser.uid,
  })
}
