import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { listMyOrders } from "@/actions/order-actions";
import ProfileShell from "./ProfileShell";
import type { Order } from "@/types/database";

export const metadata = {
  title: "个人中心 | LongWoo Studio",
};

/**
 * 个人中心（服务端预取）
 *
 * 性能优化（PERF-03）：页面改为服务端组件，在 SSR 阶段直接完成鉴权、
 * 读取用户资料与订单列表，初始数据随 HTML 直出；
 * 客户端 ProfileShell 不再发起点位请求（原先 2 个并行 useEffect 加载，
 * 进入页面需等待水合 + 请求往返 + loading 骨架闪烁）。
 * 交互（编辑昵称/头像/密码/退出）仍由客户端组件处理。
 */
export default async function ProfilePage() {
  // 服务端鉴权 + 数据预取并行（PERF-04）：
  // getCurrentUser（鉴权 + profiles）与 listMyOrders（订单）无相互依赖（listMyOrders
  // 内部 getCurrentUser 由 React.cache 同请求去重，profiles 查询仅执行一次），
  // Promise.all 使两次 Supabase 查询并行，SSR 时间从串行 2 RTT 降为 1 RTT 时长。
  const [currentUser, ordersResult] = await Promise.all([
    getCurrentUser(),
    listMyOrders(20).catch(() => ({ success: false as const, error: "加载订单失败" })),
  ]);

  // getCurrentUser 内部校验 is_active，非激活用户返回 null
  if (!currentUser) {
    redirect("/login");
  }

  const orders = ordersResult.success && ordersResult.data ? ordersResult.data : [];
  const ordersError = ordersResult.success ? null : (ordersResult.error ?? "加载订单失败");

  return (
    <ProfileShell
      initialProfile={currentUser.profile}
      initialOrders={orders}
      initialError={ordersError}
      isAdmin={currentUser.role === "admin"}
    />
  );
}
