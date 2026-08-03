import { redirect } from 'next/navigation'

// 下单流程已统一到静态 5 步流程（public/order-step1.html）
// 此路由保留以兼容旧链接，直接重定向到统一下单入口
export default function OrderSubmitPage() {
  redirect('/order-step1.html')
}
