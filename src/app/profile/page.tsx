import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/supabase/server";
import ProfileShell from "./ProfileShell";

export const metadata = {
  title: "个人中心 | LongWoo Studio",
};

/**
 * 个人中心（服务端轻鉴权 + 客户端并行取数）
 *
 * 性能优化（PERF-08）：服务端仅做零网络的本地 JWT 验签（verifyAccessTokenWithUser
 * 本地验签，不产生 Supabase 网络往返），页面框架（骨架）随导航立即直出；
 * 用户资料与订单列表由客户端 ProfileShell 在 mount 后调用 getProfileBundle
 * 并行获取（profiles 查询与 orders 查询在服务端并行，单次往返返回全部数据）。
 * 相比原先"服务端预取"模式：TTFB 从 ~800ms（2 次 Supabase RTT 串行）降至
 * 仅本地验签耗时，用户点击后即刻看到页面，数据约一个 RTT 后填充。
 *
 * 安全说明：middleware 已对 /profile 做 access token 验证与 is_active 检查
 * （60s TTL 缓存），此处本地验签为兜底鉴权；getProfileBundle 内部再校验
 * profiles.is_active，被封禁用户会被客户端引导回登录页。
 */
export default async function ProfilePage() {
  // 本地 JWT 验签（零网络），未登录重定向
  const session = await getSessionUser();
  if (!session) {
    redirect("/login");
  }

  return <ProfileShell initialProfile={null} initialOrders={[]} initialError={null} isAdmin={false} />;
}
