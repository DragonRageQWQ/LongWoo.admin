import Link from "next/link";
import { Home, Search, Package } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-lw-gray px-4">
      <div className="max-w-md w-full text-center">
        {/* 404 大字 */}
        <div className="relative mb-8">
          <h1 className="text-[120px] sm:text-[160px] font-bold leading-none text-lw-accent select-none">
            404
          </h1>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-24 h-24 sm:w-32 sm:h-32 bg-white rounded-full shadow-lg flex items-center justify-center -mt-8">
              <Search className="w-10 h-10 sm:w-12 sm:h-12 text-lw-accent" />
            </div>
          </div>
        </div>

        {/* 文案 */}
        <h2 className="text-xl font-bold text-lw-black mb-2">
          页面走丢了
        </h2>
        <p className="text-sm text-gray-500 mb-8 leading-relaxed">
          您访问的页面不存在或已被移除，请检查网址是否正确，或返回首页继续浏览。
        </p>

        {/* 操作按钮 */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-lw-accent text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Home className="w-4 h-4" />
            返回首页
          </Link>
          <Link
            href="/order-step1.html"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-white text-lw-black text-sm font-medium rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
          >
            <Package className="w-4 h-4" />
            提交委托
          </Link>
        </div>
      </div>
    </div>
  );
}
