import Image from "next/image";
import Link from "next/link";
import { Shield, Palette, Clock, Award, ArrowRight } from "lucide-react";
import Button from "@/components/ui/Button";

const advantages = [
  {
    icon: Shield,
    title: "品质保障",
    description: "每件作品均经过严格质量把控，选用优质材料，确保舒适耐穿。",
  },
  {
    icon: Palette,
    title: "个性定制",
    description: "根据您的需求量身打造，从配色到细节，每处都独一无二。",
  },
  {
    icon: Clock,
    title: "高效交付",
    description: "清晰的工期安排与进度跟踪，让您随时掌握委托进展。",
  },
  {
    icon: Award,
    title: "专业团队",
    description: "拥有多年兽装制作经验的匠人团队，技术精湛、审美在线。",
  },
];

const cases = [
  { id: 1, title: "龙族套装", image: "https://picsum.photos/seed/fursuit1/600/400" },
  { id: 2, title: "猫咪半套", image: "https://picsum.photos/seed/fursuit2/600/400" },
  { id: 3, title: "狐狸全套", image: "https://picsum.photos/seed/fursuit3/600/400" },
  { id: 4, title: "狼人套装", image: "https://picsum.photos/seed/fursuit4/600/400" },
];

export default function HomePage() {
  return (
    <>
      {/* Hero Banner */}
      <section className="relative w-full bg-gradient-to-br from-lw-black via-gray-800 to-lw-accent text-white overflow-hidden">
        <div className="absolute inset-0 bg-black/30" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 sm:py-32 lg:py-40 text-center">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight mb-6">
            专业兽装定制工作室
          </h1>
          <p className="text-lg sm:text-xl text-gray-300 max-w-2xl mx-auto mb-10">
            LongWoo 工作室专注于高品质兽装定制，用心打造每一件作品，让您的创意变为现实。
          </p>
          <Link href="/order/submit">
            <Button variant="primary" size="lg" className="text-lg">
              立即委托
              <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
          </Link>
        </div>
      </section>

      {/* 服务优势区 */}
      <section className="w-full py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl sm:text-3xl font-bold text-center text-lw-black mb-12">
            为什么选择我们
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {advantages.map((item) => (
              <div
                key={item.title}
                className="flex flex-col items-center text-center p-6 rounded-xl border border-gray-100 hover:shadow-lg transition-shadow"
              >
                <div className="w-14 h-14 rounded-full bg-lw-gray flex items-center justify-center mb-4">
                  <item.icon className="w-7 h-7 text-lw-accent" />
                </div>
                <h3 className="text-lg font-semibold text-lw-black mb-2">
                  {item.title}
                </h3>
                <p className="text-sm text-gray-500 leading-relaxed">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 案例展示区 */}
      <section className="w-full py-20 bg-lw-gray">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl sm:text-3xl font-bold text-center text-lw-black mb-12">
            精选案例
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {cases.map((item) => (
              <div
                key={item.id}
                className="relative rounded-xl overflow-hidden aspect-[3/2] group"
              >
                <Image
                  src={item.image}
                  alt={item.title}
                  fill
                  className="object-cover group-hover:scale-105 transition-transform duration-300"
                  sizes="(max-width: 640px) 100vw, 50vw"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                <div className="absolute bottom-4 left-4 text-white">
                  <h3 className="text-lg font-semibold">{item.title}</h3>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA 入口区 */}
      <section className="w-full py-20 bg-lw-accent text-white">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            开始您的定制之旅
          </h2>
          <p className="text-lg text-blue-100 mb-8">
            无论您有任何想法，我们都乐意倾听并帮您实现。
          </p>
          <Link href="/order/submit">
            <Button
              variant="secondary"
              size="lg"
              className="bg-white text-lw-accent hover:bg-gray-100"
            >
              提交委托
              <ArrowRight className="ml-2 w-5 h-5" />
            </Button>
          </Link>
        </div>
      </section>
    </>
  );
}
