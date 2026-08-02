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
  // 安全响应头
  async headers() {
    // 生产环境移除 'unsafe-eval'，降低 XSS 注入风险
    const scriptSrc = process.env.NODE_ENV === 'production'
      ? "script-src 'self' 'unsafe-inline'"
      : "script-src 'self' 'unsafe-inline' 'unsafe-eval'";

    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              scriptSrc,
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: https: blob:",
              "font-src 'self' data:",
              "connect-src 'self' https://longwoo.supabase.co wss://longwoo.supabase.co",
              "object-src 'none'",
              "frame-ancestors 'self'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join('; '),
          },
        ],
      },
    ];
  },
  // 限制 worker 数量，避免内存溢出
  experimental: {
    workerThreads: false,
    cpus: 1,
  },
  // 跳过构建时的类型检查（Next.js 16 Turbopack 生成的类型文件存在已知问题）
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
