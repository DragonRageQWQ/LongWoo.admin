import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 允许 public/ 下的静态 HTML 文件直接访问
  // public/index.html → /
  // public/order-step1.html → /order-step1.html
  async rewrites() {
    return [
      {
        source: '/',
        destination: '/index.html',
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "picsum.photos",
      },
    ],
  },
};

export default nextConfig;
