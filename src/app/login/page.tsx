"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";

type AccountType = "studio" | "admin";

export default function LoginPage() {
  const [accountType, setAccountType] = useState<AccountType>("studio");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: 登录逻辑
  };

  return (
    <div className="w-full min-h-[calc(100vh-4rem)] flex items-center justify-center bg-lw-gray py-12 px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm p-8">
        <h1 className="text-2xl font-bold text-lw-black text-center mb-8">
          登录
        </h1>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* 账号类型选择 */}
          <div>
            <label className="block text-sm font-medium text-lw-black mb-3">
              账号类型
            </label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="accountType"
                  value="studio"
                  checked={accountType === "studio"}
                  onChange={() => setAccountType("studio")}
                  className="w-4 h-4 text-lw-accent accent-lw-accent"
                />
                <span className="text-sm text-gray-600">工作室</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="accountType"
                  value="admin"
                  checked={accountType === "admin"}
                  onChange={() => setAccountType("admin")}
                  className="w-4 h-4 text-lw-accent accent-lw-accent"
                />
                <span className="text-sm text-gray-600">管理员</span>
              </label>
            </div>
          </div>

          {/* 邮箱 */}
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-lw-black mb-1.5"
            >
              邮箱
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="请输入邮箱"
              required
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-lw-accent focus:border-transparent transition"
            />
          </div>

          {/* 密码 */}
          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-lw-black mb-1.5"
            >
              密码
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="请输入密码"
              required
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-lw-accent focus:border-transparent transition"
            />
          </div>

          {/* 登录按钮 */}
          <Button variant="primary" size="lg" className="w-full">
            登录
          </Button>
        </form>
      </div>
    </div>
  );
}
