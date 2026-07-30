import { NextRequest, NextResponse } from 'next/server'
import { createClient, getSessionUser } from '@/lib/supabase/server'
import { validateApiCsrf } from '@/lib/api-csrf'

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
 *   customerPhone   string  必填  手机号（11 位，1[3-9]xxxxxxxxx）
 *   customerEmail   string  必填  邮箱
 *   requirements    string  必填  需求描述（>= 10 字）
 *   serviceTypeId   string  可选  服务类型 id
 *
 * 返回（JSON）：
 *   成功 { success: true, orderNo: string }
 *   失败 { success: false, error: string }
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

  // 字段校验（与 src/app/order/submit/page.tsx 的校验规则保持一致）
  if (!customerName) {
    return NextResponse.json(
      { success: false, error: '请输入姓名' },
      { status: 400 }
    )
  }
  if (!customerPhone || !/^1[3-9]\d{9}$/.test(customerPhone)) {
    return NextResponse.json(
      { success: false, error: '请输入有效的手机号' },
      { status: 400 }
    )
  }
  if (!customerEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)) {
    return NextResponse.json(
      { success: false, error: '请输入有效的邮箱地址' },
      { status: 400 }
    )
  }
  if (!requirements || requirements.length < 10) {
    return NextResponse.json(
      { success: false, error: '需求描述至少需要 10 个字' },
      { status: 400 }
    )
  }

  const supabase = await createClient()

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

  try {
    // 生成订单号（与 createOrder 一致，调用数据库 RPC）
    const { data: orderNoData, error: orderNoError } = await supabase
      .rpc('generate_order_no')

    if (orderNoError || !orderNoData) {
      return NextResponse.json(
        { success: false, error: '生成单号失败' },
        { status: 500 }
      )
    }

    const orderNo = orderNoData as string

    // 插入 orders 表（与 createOrder 的字段完全一致，匹配现有数据库 schema）
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .insert({
        order_no: orderNo,
        service_type_id: serviceTypeId,
        status: 'pending',
        customer_name: customerName,
        customer_phone: customerPhone,
        customer_email: customerEmail,
        requirements,
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
      await supabase.from('operation_logs').insert({
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

    return NextResponse.json({ success: true, orderNo })
  } catch (error) {
    console.error('创建订单异常:', error)
    return NextResponse.json(
      { success: false, error: '创建订单时发生未知错误' },
      { status: 500 }
    )
  }
}
