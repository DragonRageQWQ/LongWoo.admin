"use client";

import { useState } from "react";
import {
  ClipboardList,
  Users,
  FileText,
  BarChart3,
  Eye,
  ChevronRight,
} from "lucide-react";
import Button from "@/components/ui/Button";

type NavKey = "orders" | "users" | "content" | "stats";

interface NavItem {
  key: NavKey;
  label: string;
  icon: React.ElementType;
}

const navItems: NavItem[] = [
  { key: "orders", label: "委托管理", icon: ClipboardList },
  { key: "users", label: "用户管理", icon: Users },
  { key: "content", label: "内容管理", icon: FileText },
  { key: "stats", label: "数据统计", icon: BarChart3 },
];

const stats = [
  { label: "今日新增委托", value: 12, change: "+3" },
  { label: "待处理委托", value: 8, change: "" },
  { label: "已完成委托", value: 156, change: "" },
  { label: "注册用户", value: 342, change: "+15" },
];

const mockOrders = [
  { id: "LW202412001", type: "全套兽装", customer: "张三", studio: "LongWoo", status: "制作中", createdAt: "2024-12-18" },
  { id: "LW202412002", type: "半套兽装", customer: "王五", studio: "LongWoo", status: "待估价", createdAt: "2024-12-17" },
  { id: "LW202412003", type: "头套定制", customer: "李四", studio: "LongWoo", status: "已交付", createdAt: "2024-12-19" },
  { id: "LW202412004", type: "配件定制", customer: "赵六", studio: "LongWoo", status: "制作中", createdAt: "2024-12-15" },
  { id: "LW202412005", type: "全套兽装", customer: "孙七", studio: "LongWoo", status: "已接单", createdAt: "2024-12-10" },
];

const statusColors: Record<string, string> = {
  "待估价": "bg-yellow-100 text-yellow-700",
  "已接单": "bg-blue-100 text-blue-700",
  "制作中": "bg-purple-100 text-purple-700",
  "已交付": "bg-green-100 text-green-700",
};

export default function AdminDashboardPage() {
  const [activeNav, setActiveNav] = useState<NavKey>("stats");

  return (
    <div className="w-full min-h-[calc(100vh-4rem)] flex bg-lw-gray">
      {/* 左侧导航栏 */}
      <aside className="w-56 bg-white border-r border-gray-100 flex-shrink-0 hidden lg:block">
        <div className="py-6 px-4">
          <h2 className="text-sm font-bold text-lw-black mb-4 px-2">后台管理</h2>
          <nav className="space-y-1">
            {navItems.map((item) => (
              <button
                key={item.key}
                onClick={() => setActiveNav(item.key)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                  activeNav === item.key
                    ? "bg-lw-accent text-white"
                    : "text-gray-600 hover:bg-lw-gray"
                }`}
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </button>
            ))}
          </nav>
        </div>
      </aside>

      {/* 右侧内容 */}
      <main className="flex-1 p-6 sm:p-8 overflow-y-auto">
        {activeNav === "stats" && (
          <>
            <h1 className="text-xl font-bold text-lw-black mb-6">数据概览</h1>
            {/* 统计卡片 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
              {stats.map((stat) => (
                <div
                  key={stat.label}
                  className="bg-white rounded-xl p-5 shadow-sm"
                >
                  <p className="text-sm text-gray-400 mb-1">{stat.label}</p>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold text-lw-black">
                      {stat.value}
                    </span>
                    {stat.change && (
                      <span className="text-xs text-green-500">
                        {stat.change}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {(activeNav === "stats" || activeNav === "orders") && (
          <>
            <h2 className="text-lg font-semibold text-lw-black mb-4">
              {activeNav === "orders" ? "委托管理" : "近期委托"}
            </h2>
            <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
              {/* 表头 */}
              <div className="hidden sm:grid grid-cols-6 gap-4 px-6 py-3 bg-gray-50 text-xs font-medium text-gray-400 uppercase">
                <span>单号</span>
                <span>类型</span>
                <span>客户</span>
                <span>工作室</span>
                <span>状态</span>
                <span className="text-right">操作</span>
              </div>

              {/* 表格 */}
              {mockOrders.map((order) => (
                <div
                  key={order.id}
                  className="grid grid-cols-2 sm:grid-cols-6 gap-2 sm:gap-4 px-6 py-4 border-t border-gray-50 items-center"
                >
                  <span className="text-sm font-medium text-lw-black">
                    {order.id}
                  </span>
                  <span className="text-sm text-gray-600">{order.type}</span>
                  <span className="text-sm text-gray-600">{order.customer}</span>
                  <span className="text-sm text-gray-600">{order.studio}</span>
                  <span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        statusColors[order.status] ?? "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {order.status}
                    </span>
                  </span>
                  <div className="sm:justify-end hidden sm:flex">
                    <Button variant="ghost" size="sm">
                      <Eye className="w-4 h-4 mr-1" />
                      查看
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {activeNav === "users" && (
          <div>
            <h1 className="text-xl font-bold text-lw-black mb-6">用户管理</h1>
            <div className="bg-white rounded-2xl p-8 text-center text-gray-400 text-sm">
              用户管理功能开发中...
            </div>
          </div>
        )}

        {activeNav === "content" && (
          <div>
            <h1 className="text-xl font-bold text-lw-black mb-6">内容管理</h1>
            <div className="bg-white rounded-2xl p-8 text-center text-gray-400 text-sm">
              内容管理功能开发中...
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
