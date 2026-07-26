"use client";

import { useState } from "react";
import { Search, Package } from "lucide-react";
import Button from "@/components/ui/Button";

interface QueryResult {
  orderId: string;
  type: string;
  status: "pending_quote" | "quoted" | "in_progress" | "completed";
  statusLabel: string;
  progress: string;
  updatedAt: string;
}

const statusColors: Record<string, string> = {
  pending_quote: "bg-yellow-100 text-yellow-700",
  quoted: "bg-blue-100 text-blue-700",
  in_progress: "bg-purple-100 text-purple-700",
  completed: "bg-green-100 text-green-700",
};

export default function OrderQueryPage() {
  const [orderId, setOrderId] = useState("");
  const [phone, setPhone] = useState("");
  const [result, setResult] = useState<QueryResult | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleQuery = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setResult(null);

    if (!orderId.trim() || !phone.trim()) {
      setError("请输入委托单号和手机号");
      return;
    }

    setLoading(true);
    // TODO: 调用后端查询接口
    // 模拟数据
    setTimeout(() => {
      setResult({
        orderId: orderId,
        type: "全套兽装",
        status: "in_progress",
        statusLabel: "制作中",
        progress: "已完成头套骨架制作，正在进行毛皮缝制。",
        updatedAt: "2024-12-20 14:30",
      });
      setLoading(false);
    }, 800);
  };

  return (
    <div className="w-full min-h-[calc(100vh-4rem)] flex items-center justify-center bg-lw-gray py-12 px-4">
      <div className="w-full max-w-lg">
        <h1 className="text-2xl font-bold text-lw-black text-center mb-8">
          委托进度查询
        </h1>

        <div className="bg-white rounded-2xl shadow-sm p-6 sm:p-8">
          <form onSubmit={handleQuery} className="space-y-5">
            <div>
              <label
                htmlFor="orderId"
                className="block text-sm font-medium text-lw-black mb-1.5"
              >
                委托单号
              </label>
              <input
                id="orderId"
                type="text"
                value={orderId}
                onChange={(e) => setOrderId(e.target.value)}
                placeholder="请输入委托单号"
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-lw-accent focus:border-transparent transition"
              />
            </div>

            <div>
              <label
                htmlFor="queryPhone"
                className="block text-sm font-medium text-lw-black mb-1.5"
              >
                手机号
              </label>
              <input
                id="queryPhone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="请输入提交委托时使用的手机号"
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-lw-accent focus:border-transparent transition"
              />
            </div>

            {error && (
              <p className="text-sm text-red-500">{error}</p>
            )}

            <Button variant="primary" size="lg" className="w-full" disabled={loading}>
              {loading ? (
                "查询中..."
              ) : (
                <>
                  <Search className="w-4 h-4 mr-2" />
                  查询
                </>
              )}
            </Button>
          </form>

          {/* 查询结果 */}
          {result && (
            <div className="mt-6 pt-6 border-t border-gray-100">
              <div className="bg-lw-gray rounded-xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Package className="w-5 h-5 text-lw-accent" />
                    <span className="font-medium text-lw-black">
                      {result.orderId}
                    </span>
                  </div>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-medium ${
                      statusColors[result.status] ?? "bg-gray-100 text-gray-600"
                    }`}
                  >
                    {result.statusLabel}
                  </span>
                </div>
                <div className="text-sm text-gray-600">
                  <span className="text-gray-400">服务类型：</span>
                  {result.type}
                </div>
                <div className="text-sm text-gray-600">
                  <span className="text-gray-400">最新进展：</span>
                  {result.progress}
                </div>
                <div className="text-xs text-gray-400">
                  更新时间：{result.updatedAt}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
