import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getSessionUser } from "@/lib/supabase/server";
import { listMyOrdersFor } from "@/actions/order-actions";
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
 *
 * 性能优化（PERF-06）：先做零网络的本地 JWT 验签（verifyAccessTokenWithUser
 * 本地验签，无网络往返）拿到受信的 userId/email，随后 profiles 查询与
 * orders 查询通过 Promise.all 真正并行（原先 listMyOrders 需等 profiles
 * 查询完成后才发起，2 次 Supabase RTT 串行），SSR 耗时降为单次 RTT 时长。
 */
export default async function ProfilePage() {
  // 本地 JWT 验签（零网络），提前拿到 userId/email 供订单查询使用
  const session = await getSessionUser();
  if (!session) {
    redirect("/login");
  }

  const [currentUser, ordersResult] = await Promise.all([
    getCurrentUser(),
    listMyOrdersFor(session.id, session.email ?? null, 20).catch(() => ({
      success: false as const,
      error: "加载订单失败",
    })),
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
