"use client";

import { useState } from "react";
import Link from "next/link";
import { Scissors, Paintbrush, Box, Wrench, ArrowRight, CheckCircle } from "lucide-react";
import Button from "@/components/ui/Button";

interface TabData {
  id: string;
  label: string;
  icon: React.ElementType;
  description: string;
  steps: string[];
  price: string;
}

const tabs: TabData[] = [
  {
    id: "fullsuit",
    label: "全套兽装",
    icon: Scissors,
    description:
      "包含头套、手部、脚部、身体及尾巴的完整兽装套装。从头到脚为您打造完整的角色形象，适合展会、演出及日常穿戴。",
    steps: [
      "需求沟通 - 确认角色设定、配色方案和功能需求",
      "设计出图 - 提供 2D/3D 设计稿供确认",
      "材料采购 - 按设计方案采购优质面料与辅料",
      "制作加工 - 裁剪缝制、注模定型、细节装饰",
      "试穿调整 - 内部试穿并做最后调整",
      "交付发货 - 精心包装后发货至客户手中",
    ],
    price: "8,000 - 25,000 元",
  },
  {
    id: "partial",
    label: "半套兽装",
    icon: Paintbrush,
    description:
      "仅包含头套 + 手部 + 尾巴的组合套装。轻便舒适，适合初次体验兽装或需要长时间穿戴的场景。",
    steps: [
      "需求沟通 - 确认角色设定与配色",
      "设计出图 - 提供设计稿供确认",
      "材料采购 - 采购面料与辅料",
      "制作加工 - 头套制作、手部与尾巴缝制",
      "试穿调整 - 试穿确认舒适度",
      "交付发货 - 包装发货",
    ],
    price: "4,000 - 12,000 元",
  },
  {
    id: "head",
    label: "头套定制",
    icon: Box,
    description:
      "独立定制兽装头套，支持 3D 打印骨架与手工建模两种工艺。高还原度、佩戴舒适，是半套兽装的核心部件。",
    steps: [
      "需求沟通 - 确认角色面部特征与配色",
      "建模出图 - 3D 建模或手工纸模",
      "骨架制作 - 3D 打印或手工制作骨架",
      "毛皮缝制 - 覆毛、安装眼鼻牙齿等",
      "内部舒适 - 安装风扇、衬垫等",
      "交付发货 - 包装发货",
    ],
    price: "2,500 - 8,000 元",
  },
  {
    id: "accessories",
    label: "配件定制",
    icon: Wrench,
    description:
      "尾巴、爪子、翅膀等独立配件定制，适用于已有兽装的扩展搭配，或单独作为角色扮演道具使用。",
    steps: [
      "需求沟通 - 确认配件类型与样式",
      "设计出图 - 确认设计方案",
      "材料采购 - 选购面料与配件",
      "制作加工 - 缝制与组装",
      "质量检查 - 确保牢固度与美观度",
      "交付发货 - 包装发货",
    ],
    price: "500 - 5,000 元",
  },
];

export default function ServicesPage() {
  const [activeTab, setActiveTab] = useState(tabs[0].id);

  const currentTab = tabs.find((t) => t.id === activeTab) ?? tabs[0];

  return (
    <>
      {/* Banner */}
      <section className="w-full bg-gradient-to-r from-lw-black to-gray-700 text-white py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-4">
            服务项目
          </h1>
          <p className="text-lg text-gray-300 max-w-2xl mx-auto">
            我们提供多种兽装定制服务，满足您不同的需求与预算。
          </p>
        </div>
      </section>

      {/* Tab 切换 + 内容 */}
      <section className="w-full py-16 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Tab 按钮 */}
          <div className="flex flex-wrap justify-center gap-3 mb-12">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                  activeTab === tab.id
                    ? "bg-lw-accent text-white"
                    : "bg-lw-gray text-lw-black hover:bg-gray-200"
                }`}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>

          {/* 当前 Tab 内容 */}
          <div className="max-w-3xl mx-auto">
            {/* 服务说明 */}
            <h2 className="text-2xl font-bold text-lw-black mb-4">
              {currentTab.label}
            </h2>
            <p className="text-gray-600 leading-relaxed mb-8">
              {currentTab.description}
            </p>

            {/* 流程步骤 */}
            <h3 className="text-lg font-semibold text-lw-black mb-4">制作流程</h3>
            <div className="space-y-3 mb-8">
              {currentTab.steps.map((step, index) => (
                <div key={index} className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 text-lw-accent mt-0.5 flex-shrink-0" />
                  <span className="text-sm text-gray-600">{step}</span>
                </div>
              ))}
            </div>

            {/* 价格参考 */}
            <div className="bg-lw-gray rounded-xl p-6 mb-8">
              <h3 className="text-lg font-semibold text-lw-black mb-2">
                价格参考
              </h3>
              <p className="text-2xl font-bold text-lw-accent">
                {currentTab.price}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                * 最终价格根据设计复杂度和材料选择而定，以下单确认为准。
              </p>
            </div>

            {/* CTA */}
            <div className="text-center">
              <Link href="/order/submit">
                <Button variant="primary" size="lg">
                  立即委托
                  <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
