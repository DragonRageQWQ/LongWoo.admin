"use client";

import { useEffect } from "react";
import { RotateCcw, AlertCircle } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("全局错误:", error);
  }, [error]);

  return (
    <html lang="zh-CN" className="h-full antialiased">
      <body
        className="min-h-full"
        style={{
          fontFamily:
            "'PingFang SC', 'Microsoft YaHei', 'Noto Sans CJK SC', sans-serif",
          color: "#101010",
          background: "#FFFFFF",
        }}
      >
        <div className="min-h-screen flex items-center justify-center px-4">
          <div className="text-center max-w-md">
            <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-6">
              <AlertCircle className="w-8 h-8 text-red-500" />
            </div>
            <h1 className="text-xl font-bold mb-2">系统错误</h1>
            <p className="text-sm text-gray-500 mb-6">
              抱歉，系统发生了严重错误。请尝试重新加载页面。
            </p>
            {error.digest && (
              <p className="text-xs text-gray-300 mb-6 font-mono">
                错误代码: {error.digest}
              </p>
            )}
            <button
              onClick={reset}
              className="inline-flex items-center gap-2 px-6 py-2.5 text-white text-sm font-medium rounded-lg transition-colors cursor-pointer"
              style={{ backgroundColor: "#2563EB" }}
            >
              <RotateCcw className="w-4 h-4" />
              重新加载
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
