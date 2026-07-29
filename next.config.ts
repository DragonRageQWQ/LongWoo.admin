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
  // TypeScript 检查在 CI 中单独执行（npx tsc --noEmit），
  // 构建时跳过以避免 worker 内存溢出
  typescript: {
    ignoreBuildErrors: true,
  },
  // 限制 worker 数量，避免内存溢出
  experimental: {
    workerThreads: false,
    cpus: 1,
  },
};

export default nextConfig;
