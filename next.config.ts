import type { NextConfig } from "next";

// 从环境变量提取 Supabase 域名，用于 CSP 和图片优化配置
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseHost = supabaseUrl.replace(/^https?:\/\//, '').replace(/\/.*$/, '');

const nextConfig: NextConfig = {
  // 隐藏 X-Powered-By 响应头，减少信息泄露
  poweredByHeader: false,

  // 允许 public/ 下的静态 HTML 文件直接访问
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
      ...(supabaseHost ? [{
        protocol: "https" as const,
        hostname: supabaseHost,
      }] : []),
    ],
  },
  // 安全响应头
  async headers() {
    // 生产环境移除 'unsafe-eval'，降低 XSS 注入风险
    const scriptSrc = process.env.NODE_ENV === 'production'
      ? "script-src 'self' 'unsafe-inline'"
      : "script-src 'self' 'unsafe-inline' 'unsafe-eval'";

    // 动态构建 connect-src，从环境变量读取 Supabase 域名
    const supabaseWsUrl = supabaseUrl.replace(/^https/, 'wss');
    const connectSrc = [
      "'self'",
      ...(supabaseUrl ? [supabaseUrl, supabaseWsUrl] : []),
    ].join(' ');

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
              `connect-src ${connectSrc}`,
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
  // 构建时类型检查：启用以捕获类型错误
  typescript: {
    ignoreBuildErrors: false,
  },
};

export default nextConfig;
