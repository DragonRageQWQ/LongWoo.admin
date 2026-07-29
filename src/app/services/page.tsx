import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import type { ServiceType } from "@/types/database";

export const metadata: Metadata = {
  title: "服务项目 - LongWoo Studio",
  description: "浏览 LongWoo 工作室提供的兽装定制服务项目，包括全装定制、半装定制等多种选项。",
};

// 服务类型变更频率低，使用 ISR 每小时重新生成
export const revalidate = 3600;

export default async function ServicesPage() {
  const supabase = await createClient();

  const { data: services, error: servicesError } = await supabase
    .from("service_types")
    .select("*")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Header />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* 页面标题 */}
        <div className="text-center mb-12">
          <h1 className="text-3xl sm:text-4xl font-bold text-lw-black">服务项目</h1>
          <p className="mt-3 text-gray-500">
            专业的兽装定制服务，满足您的个性化需求
          </p>
        </div>

        {/* 服务列表 */}
        {servicesError ? (
          <div className="text-center py-20">
            <p className="text-red-500 mb-2">加载服务项目时出错</p>
            <p className="text-sm text-gray-400">请稍后刷新页面重试</p>
          </div>
        ) : services && services.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {services.map((service: ServiceType) => (
              <div
                key={service.id}
                className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow"
              >
                <h3 className="text-lg font-bold text-lw-black mb-2">
                  {service.name}
                </h3>
                {service.description && (
                  <p className="text-sm text-gray-600 leading-relaxed mb-4">
                    {service.description}
                  </p>
                )}
                {service.price_range && (
                  <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-50">
                    <span className="text-xs text-gray-400">参考价格</span>
                    <span className="text-sm font-medium text-lw-accent">
                      {service.price_range}
                    </span>
                  </div>
                )}
                {service.process_steps && (
                  <div className="mt-3 text-xs text-gray-400">
                    {service.process_steps}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-20">
            <p className="text-gray-400">暂无服务项目，请稍后再来</p>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
