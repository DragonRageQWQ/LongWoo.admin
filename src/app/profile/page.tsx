import { cookies } from "next/headers";
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
 * 交互（编辑昵称/头像/密码/认领/退出）仍由客户端组件处理。
 */
export default async function ProfilePage() {
  // 服务端鉴权：未登录重定向（middleware 已做路由级拦截，此处纵深防御）
  // getCurrentUser 内部校验 is_active，非激活用户返回 null
  const currentUser = await getCurrentUser();
  if (!currentUser) {
    redirect("/login");
  }

  // 读取语言 cookie（保持与根布局一致；ProfileShell 内部用客户端 useLanguage）
  void cookies();

  // 服务端预取订单列表（listMyOrders 内部 getCurrentUser 由 React.cache 同请求去重）
  let orders: Order[] = [];
  let ordersError: string | null = null;
  try {
    const result = await listMyOrders(20);
    if (result.success && result.data) {
      orders = result.data;
    } else {
      ordersError = result.error ?? null;
    }
  } catch {
    ordersError = "加载订单失败";
  }

  return (
    <ProfileShell
      initialProfile={currentUser.profile}
      initialOrders={orders}
      initialError={ordersError}
      isAdmin={currentUser.role === "admin"}
    />
  );
}
