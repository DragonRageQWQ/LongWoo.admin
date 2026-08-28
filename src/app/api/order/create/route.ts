import { NextRequest, NextResponse } from 'next/server'
import { createClient as createBrowserClient } from '@supabase/supabase-js'
import { getSessionUser } from '@/lib/supabase/server'
import { validateApiCsrf } from '@/lib/api-csrf'
import { checkRateLimit } from '@/lib/rate-limit'
import { isValidUUID, validateOrderInput } from '@/lib/order-utils'
import { generateUploadToken } from '@/lib/attachment-token'
import { extractClientIpFromRequest } from '@/lib/server-utils'
import { RATE_LIMIT_ORDER_MAX, RATE_LIMIT_ORDER_WINDOW } from '@/lib/constants'

export const dynamic = 'force-dynamic'

/**
 * POST /api/order/create
 *
 * 供静态 HTML 下单流程（public/order-step1~5.html）通过 fetch 调用，
 * 将 sessionStorage 中收集的订单数据持久化到 Supabase 的 orders 表。
 *
 * 与 src/actions/order-actions.ts 中的 createOrder Server Action 逻辑一致：
 * - 客户可匿名下单（登录为可选）；若已登录则记录 user_id 到 operation_logs
 * - 通过 generate_order_no RPC 生成单号
 * - 插入 orders 表（status = 'pending'）
 * - 记录 operation_logs（失败不影响主流程）
 *
 * 请求体（JSON）：
 *   customerName    string  必填  姓名
 *   customerPhone   string  可选  手机号（11 位，1[3-9]xxxxxxxxx；无短信业务，允许留空）
 *   customerEmail   string  必填  邮箱
 *   requirements    string  必填  需求描述（>= 10 字）
 *   serviceTypeId   string  可选  服务类型 id
 *
 * 返回（JSON）：
 *   成功 { success: true, orderNo: string, orderId: string, uploadToken: string }
 *   失败 { success: false, error: string }
 *
 * 附件：订单创建后，前端用返回的 orderId + uploadToken 调用
 * POST /api/order/upload-attachment 上传设定图片（uploadToken 用于归属校验）。
 */
export async function POST(request: NextRequest) {
  // CSRF 保护：校验 Origin/Referer 头，确保请求来自本站
  const csrfError = validateApiCsrf(request)
  if (csrfError) {
    return csrfError
  }

  // 仅接受 JSON
  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { success: false, error: '请求体不是有效的 JSON' },
      { status: 400 }
    )
  }

  // 解析与清洗字段
  const customerName =
    typeof body.customerName === 'string' ? body.customerName.trim() : ''
  const customerPhone =
    typeof body.customerPhone === 'string' ? body.customerPhone.trim() : ''
  const customerEmail =
    typeof body.customerEmail === 'string' ? body.customerEmail.trim() : ''
  const requirements =
    typeof body.requirements === 'string' ? body.requirements.trim() : ''
  const serviceTypeId =
    typeof body.serviceTypeId === 'string' && body.serviceTypeId.trim()
      ? body.serviceTypeId.trim()
      : null

  const validationError = validateOrderInput({
    customerName,
    customerPhone,
    customerEmail,
    requirements,
  })
  if (validationError) {
    return NextResponse.json(
      { success: false, error: validationError },
      { status: 400 }
    )
  }
  if (serviceTypeId && !isValidUUID(serviceTypeId)) {
    return NextResponse.json(
      { success: false, error: '无效的服务类型' },
      { status: 400 }
    )
  }

  const ip = extractClientIpFromRequest(request)
  const rateLimit = await checkRateLimit(
    `createorder:${ip}`,
    RATE_LIMIT_ORDER_MAX,
    RATE_LIMIT_ORDER_WINDOW
  )
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { success: false, error: '提交过于频繁，请稍后再试' },
      { status: 429 }
    )
  }

  // 验证用户登录状态（通过 Supabase cookie）
  // 客户可匿名下单：登录态仅用于关联 operation_logs，未登录不阻断下单流程
  let userId: string | null = null
  try {
    const user = await getSessionUser()
    userId = user?.id ?? null
  } catch {
    // 读取登录态失败时按匿名处理，不阻断下单
    userId = null
  }

  // 订单写入使用 service_role 客户端（服务端可信，不受 RLS 限制）。
  // 原因：orders 的 SELECT 策略（orders_select_staff）要求当前用户为 user/admin，
  // 而匿名下单用户 current_user_role() 为 NULL，insert().select() 返回新行时会被
  // RLS 拒绝，导致匿名下单 500。service_role 由服务端持有、不暴露给前端，可安全
  // 完成写入与返回；RLS 对直接客户端（anon/authenticated）的读取限制保持不变。
  const serviceSupabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: { autoRefreshToken: false, persistSession: false },
    }
  )

  try {
    // 生成订单号（与 createOrder 一致，调用数据库 RPC）
    const { data: orderNoData, error: orderNoError } = await serviceSupabase
      .rpc('generate_order_no')

    if (orderNoError || !orderNoData) {
      return NextResponse.json(
        { success: false, error: '生成单号失败' },
        { status: 500 }
      )
    }

    const orderNo = orderNoData as string

    // 插入 orders 表（与 createOrder 的字段完全一致，匹配现有数据库 schema）
    // 已登录用户下单时写入 user_id（方案 A：订单关联账号，我的订单优先按 user_id 匹配）
    const { data: order, error: orderError } = await serviceSupabase
      .from('orders')
      .insert({
        order_no: orderNo,
        service_type_id: serviceTypeId,
        status: 'pending',
        customer_name: customerName,
        customer_phone: customerPhone,
        customer_email: customerEmail,
        requirements,
        user_id: userId,
      })
      .select()
      .single()

    if (orderError || !order) {
      console.error('创建订单失败:', orderError?.message)
      return NextResponse.json(
        { success: false, error: '创建订单失败，请稍后重试' },
        { status: 500 }
      )
    }

    // 记录操作日志（与 createOrder 一致；失败不影响主流程）
    try {
      await serviceSupabase.from('operation_logs').insert({
        order_id: order.id,
        user_id: userId,
        action: 'create_order',
        details: {
          customer_name: customerName,
          customer_email: customerEmail,
          source: 'static_html',
        },
      })
    } catch (logError) {
      console.error('记录操作日志失败:', logError)
    }

    return NextResponse.json({
      success: true,
      orderNo,
      orderId: order.id,
      // 安全加固（M-1）：一次性上传凭证，用于后续附件上传的订单归属校验
      uploadToken: generateUploadToken(
        order.id,
        process.env.UPLOAD_TOKEN_SECRET ?? ''
      ),
    })
  } catch (error) {
    console.error('创建订单异常:', error)
    return NextResponse.json(
      { success: false, error: '创建订单时发生未知错误' },
      { status: 500 }
    )
  }
}
