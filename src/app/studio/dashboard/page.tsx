"use client";

import { useState } from "react";
import { User, Package, Clock, Eye, CheckCircle } from "lucide-react";
import Button from "@/components/ui/Button";

type TabKey = "pending_quote" | "pending_accept" | "accepted" | "delivered";

interface Order {
  id: string;
  type: string;
  customer: string;
  createdAt: string;
  status: TabKey;
}

const tabs: { key: TabKey; label: string; icon: React.ElementType }[] = [
  { key: "pending_quote", label: "待估价", icon: Clock },
  { key: "pending_accept", label: "待接单", icon: Package },
  { key: "accepted", label: "已接委托", icon: Eye },
  { key: "delivered", label: "已交付", icon: CheckCircle },
];

// 模拟数据
const mockOrders: Record<TabKey, Order[]> = {
  pending_quote: [
    { id: "LW202412001", type: "全套兽装", customer: "张三", createdAt: "2024-12-18", status: "pending_quote" },
    { id: "LW202412003", type: "头套定制", customer: "李四", createdAt: "2024-12-19", status: "pending_quote" },
  ],
  pending_accept: [
    { id: "LW202412002", type: "半套兽装", customer: "王五", createdAt: "2024-12-17", status: "pending_accept" },
  ],
  accepted: [
    { id: "LW202412004", type: "配件定制", customer: "赵六", createdAt: "2024-12-15", status: "accepted" },
  ],
  delivered: [
    { id: "LW202412005", type: "全套兽装", customer: "孙七", createdAt: "2024-12-10", status: "delivered" },
  ],
};

export default function StudioDashboardPage() {
  const [activeTab, setActiveTab] = useState<TabKey>("pending_quote");

  const currentOrders = mockOrders[activeTab] ?? [];

  return (
    <div className="w-full min-h-[calc(100vh-4rem)] bg-lw-gray">
      {/* 顶部信息栏 */}
      <div className="bg-white border-b border-gray-100 px-4 sm:px-6 lg:px-8 py-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-lw-accent text-white flex items-center justify-center">
              <User className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-lw-black">工作室工作台</h1>
              <p className="text-sm text-gray-400">LongWoo 工作室</p>
            </div>
          </div>
          <div className="text-sm text-gray-500">
            欢迎回来！
          </div>
        </div>
      </div>

      {/* Tab 切换 */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex flex-wrap gap-2 mb-6">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                activeTab === tab.key
                  ? "bg-lw-accent text-white"
                  : "bg-white text-lw-black hover:bg-gray-100"
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
              <span className="text-xs opacity-75">
                ({(mockOrders[tab.key] ?? []).length})
              </span>
            </button>
          ))}
        </div>

        {/* 委托单列表 */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          {/* 表格头 */}
          <div className="hidden sm:grid grid-cols-5 gap-4 px-6 py-3 bg-gray-50 text-xs font-medium text-gray-400 uppercase">
            <span>单号</span>
            <span>类型</span>
            <span>客户</span>
            <span>时间</span>
            <span className="text-right">操作</span>
          </div>

          {/* 表格内容 */}
          {currentOrders.length === 0 ? (
            <div className="py-16 text-center text-gray-400 text-sm">
              暂无委托单
            </div>
          ) : (
            currentOrders.map((order) => (
              <div
                key={order.id}
                className="grid grid-cols-1 sm:grid-cols-5 gap-2 sm:gap-4 px-6 py-4 border-t border-gray-50 items-center"
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-lw-black">
                    {order.id}
                  </span>
                </div>
                <span className="text-sm text-gray-600">{order.type}</span>
                <span className="text-sm text-gray-600">{order.customer}</span>
                <span className="text-sm text-gray-400">{order.createdAt}</span>
                <div className="flex gap-2 sm:justify-end">
                  <Button variant="outline" size="sm">
                    查看
                  </Button>
                  {order.status === "pending_quote" && (
                    <Button variant="primary" size="sm">
                      估价
                    </Button>
                  )}
                  {order.status === "pending_accept" && (
                    <Button variant="primary" size="sm">
                      接单
                    </Button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
