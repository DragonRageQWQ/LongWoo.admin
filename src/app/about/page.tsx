import Image from "next/image";
import { Heart, Users, Target, Star } from "lucide-react";

const members = [
  {
    name: "龙龙",
    role: "创始人 / 主设计师",
    avatar: "https://picsum.photos/seed/member1/200/200",
    bio: "拥有 6 年兽装设计经验，负责整体创意与品质把控。",
  },
  {
    name: "小灰",
    role: "制作主管",
    avatar: "https://picsum.photos/seed/member2/200/200",
    bio: "精通剪裁与缝制工艺，对细节有着极致追求。",
  },
  {
    name: "阿白",
    role: "客户经理",
    avatar: "https://picsum.photos/seed/member3/200/200",
    bio: "耐心细致，负责客户沟通与项目进度跟踪。",
  },
];

const timeline = [
  { year: "2020", event: "LongWoo 工作室成立，开始承接兽装定制委托。" },
  { year: "2021", event: "团队扩展至 3 人，建立标准化制作流程。" },
  { year: "2022", event: "完成第 100 件作品，客户好评率达 98%。" },
  { year: "2023", event: "推出在线委托系统，服务全国客户。" },
  { year: "2024", event: "引入 3D 建模预览服务，提升定制体验。" },
];

export default function AboutPage() {
  return (
    <>
      {/* Banner */}
      <section className="w-full bg-gradient-to-r from-lw-black to-gray-700 text-white py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-4">
            关于 LongWoo
          </h1>
          <p className="text-lg text-gray-300 max-w-2xl mx-auto">
            我们是一支热爱兽装文化的专业团队，致力于让每位客户的想象力变为触手可及的现实。
          </p>
        </div>
      </section>

      {/* 品牌理念 */}
      <section className="w-full py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl sm:text-3xl font-bold text-center text-lw-black mb-12">
            品牌理念
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="flex flex-col items-center text-center p-6">
              <div className="w-14 h-14 rounded-full bg-lw-gray flex items-center justify-center mb-4">
                <Heart className="w-7 h-7 text-lw-accent" />
              </div>
              <h3 className="text-lg font-semibold mb-2">用心制作</h3>
              <p className="text-sm text-gray-500">
                每一件兽装都倾注了我们的热情与匠心，从设计到成品全程精心打磨。
              </p>
            </div>
            <div className="flex flex-col items-center text-center p-6">
              <div className="w-14 h-14 rounded-full bg-lw-gray flex items-center justify-center mb-4">
                <Users className="w-7 h-7 text-lw-accent" />
              </div>
              <h3 className="text-lg font-semibold mb-2">客户至上</h3>
              <p className="text-sm text-gray-500">
                我们重视每一位客户的需求，保持透明沟通，确保成品符合期待。
              </p>
            </div>
            <div className="flex flex-col items-center text-center p-6">
              <div className="w-14 h-14 rounded-full bg-lw-gray flex items-center justify-center mb-4">
                <Target className="w-7 h-7 text-lw-accent" />
              </div>
              <h3 className="text-lg font-semibold mb-2">追求卓越</h3>
              <p className="text-sm text-gray-500">
                不断精进工艺与技术，持续提升品质，力求每件作品都是精品。
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 团队成员 */}
      <section className="w-full py-20 bg-lw-gray">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl sm:text-3xl font-bold text-center text-lw-black mb-12">
            核心团队
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 max-w-4xl mx-auto">
            {members.map((member) => (
              <div
                key={member.name}
                className="flex flex-col items-center text-center bg-white rounded-xl p-6 shadow-sm"
              >
                <div className="w-24 h-24 rounded-full overflow-hidden mb-4">
                  <Image
                    src={member.avatar}
                    alt={member.name}
                    width={96}
                    height={96}
                    className="object-cover w-full h-full"
                  />
                </div>
                <h3 className="text-lg font-semibold text-lw-black">{member.name}</h3>
                <p className="text-sm text-lw-accent font-medium mb-2">
                  {member.role}
                </p>
                <p className="text-sm text-gray-500">{member.bio}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 发展历程 */}
      <section className="w-full py-20 bg-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl sm:text-3xl font-bold text-center text-lw-black mb-12">
            发展历程
          </h2>
          <div className="relative">
            {/* 中间竖线 */}
            <div className="absolute left-4 sm:left-1/2 sm:-translate-x-px top-0 bottom-0 w-0.5 bg-gray-200" />
            <div className="space-y-10">
              {timeline.map((item) => (
                <div key={item.year} className="relative flex items-start">
                  {/* 圆点 */}
                  <div className="absolute left-4 sm:left-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-lw-accent border-2 border-white shadow-sm mt-1.5" />
                  {/* 内容 */}
                  <div className="ml-10 sm:ml-0 sm:w-[calc(50%-2rem)] sm:text-right sm:pr-8">
                    <span className="text-sm font-bold text-lw-accent">
                      {item.year}
                    </span>
                    <p className="text-sm text-gray-600 mt-1">{item.event}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
