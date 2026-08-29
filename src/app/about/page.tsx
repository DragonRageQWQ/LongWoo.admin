import type { Metadata } from "next";
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";

export const metadata: Metadata = {
  title: "关于我们 - LongWoo Studio",
  description: "LongWoo 龙坞是一家专注于高品质兽装定制与销售的专业工作室，致力于为每一位客户提供独一无二的作品。",
  alternates: { canonical: "/about" },
};

export default function AboutPage() {
  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Header />

      <main className="flex-1 max-w-3xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center mb-12">
          <h1 className="text-3xl sm:text-4xl font-bold text-lw-black mb-4">
            关于 LongWoo Studio
          </h1>
          <p className="text-gray-500">龙坞创意设计工作室</p>
        </div>

        <div className="prose prose-gray max-w-none">
          <p className="text-gray-600 leading-relaxed mb-6">
            LongWoo Studio 是一家专注于高品质兽装定制的工作室。我们致力于为每一位客户提供独特、精美的定制作品，
            从设计到交付，每一处细节都倾注我们的热忱与专业。
          </p>

          <h2 className="text-xl font-bold text-lw-black mt-8 mb-4">我们的理念</h2>
          <p className="text-gray-600 leading-relaxed mb-6">
            每一件作品都是独一无二的艺术品。我们相信，优秀的定制不仅是技术的展现，更是对客户个性的理解与尊重。
            从材料选择到工艺细节，我们追求极致的完美。
          </p>

          <h2 className="text-xl font-bold text-lw-black mt-8 mb-4">服务范围</h2>
          <p className="text-gray-600 leading-relaxed mb-6">
            我们提供从全装定制到局部配件的全方位服务，涵盖头套、爪套、尾巴、身体套装等各类兽装组件。
            无论您是首次定制还是资深爱好者，我们都能为您量身打造满意的作品。
          </p>

          <h2 className="text-xl font-bold text-lw-black mt-8 mb-4">联系我们</h2>
          <p className="text-gray-600 leading-relaxed">
            如果您有任何问题或合作意向，欢迎通过网站提交委托，或发送邮件至{" "}
            <a
              href="mailto:hello@longwoo.studio"
              className="text-lw-accent hover:underline"
            >
              hello@longwoo.studio
            </a>
            ，我们将在 1-2 个工作日内回复您。
          </p>
        </div>
      </main>

      <Footer />
    </div>
  );
}
