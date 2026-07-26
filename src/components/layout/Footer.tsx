export default function Footer() {
  return (
    <footer className="w-full bg-lw-gray">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          {/* 工作室名称 */}
          <div className="text-lg font-bold text-lw-black">LongWoo 工作室</div>

          {/* 联系方式 */}
          <div className="flex flex-col items-center md:items-end gap-1 text-sm text-gray-500">
            <span>邮箱：contact@longwoo.com</span>
            <span>电话：400-000-0000</span>
          </div>
        </div>

        {/* 分隔线 */}
        <div className="border-t border-gray-200 mt-6 pt-6">
          <p className="text-center text-xs text-gray-400">
            &copy; {new Date().getFullYear()} LongWoo 工作室. 保留所有权利.
          </p>
        </div>
      </div>
    </footer>
  );
}
