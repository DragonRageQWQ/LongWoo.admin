"use client";

import { useEffect } from "react";
import { RotateCcw, AlertCircle } from "lucide-react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("页面错误:", error);
  }, [error]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-6">
          <AlertCircle className="w-8 h-8 text-red-500" />
        </div>
        <h1 className="text-xl font-bold text-lw-black mb-2">
          页面出错了
        </h1>
        <p className="text-sm text-gray-500 mb-6">
          抱歉，页面加载时发生了错误。请尝试重新加载，如果问题持续出现请联系工作室。
        </p>
        {error.digest && (
          <p className="text-xs text-gray-300 mb-6 font-mono">
            错误代码: {error.digest}
          </p>
        )}
        <button
          onClick={reset}
          className="inline-flex items-center gap-2 px-6 py-2.5 bg-lw-accent text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors cursor-pointer"
        >
          <RotateCcw className="w-4 h-4" />
          重新加载
        </button>
      </div>
    </div>
  );
}
