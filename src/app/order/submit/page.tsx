import { redirect } from 'next/navigation'

// 下单流程已统一到新首页「委托兽装」标签（/?tab=fursuit）
// 此路由保留以兼容旧链接，直接重定向到统一下单入口
export default function OrderSubmitPage() {
  redirect('/?tab=fursuit')
}
