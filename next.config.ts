import type { NextConfig } from "next";

// 从环境变量提取 Supabase 域名，用于 CSP 和图片优化配置
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseHost = supabaseUrl.replace(/^https?:\/\//, '').replace(/\/.*$/, '');

const nextConfig: NextConfig = {
  // 隐藏 X-Powered-By 响应头，减少信息泄露
  poweredByHeader: false,

  // 首页重定向到 public/index.html（静态文件，CDN 缓存）
  // 使用 redirects 而非 rewrites/页面内 redirect()：
  // - redirects 由 Vercel 边缘层处理，不启动 Serverless 函数，彻底消除冷启动等待
  // - 页面内 redirect() 每次访问都要渲染 Serverless 路由，冷启动可长达数秒
  async redirects() {
    return [
      {
        source: '/',
        destination: '/index.html',
        permanent: false,
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
              "style-src 'self' 'unsafe-inline' https://cdn-font.hyperos.mi.com",
              "img-src 'self' data: https: blob:",
              "font-src 'self' data: https://cdn-file.hyperos.mi.com",
              `connect-src ${connectSrc}`,
              "object-src 'none'",
              "frame-ancestors 'self'",
              "base-uri 'self'",
              "form-action 'self'",
            ].join('; '),
          },
        ],
      },
      // ===== 静态资源 HTTP 长缓存（性能优化） =====
      // assets 图片文件名带唯一随机后缀，内容不变，可 immutable 缓存 1 年
      {
        source: '/assets/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      // css/js 为固定文件名（common.js / theme.css / i18n-*.js），
      // 缓存与 HTML 同步为 1 小时：避免部署后新 HTML + 旧 JS/CSS 混用导致白屏。
      // 根治方案：文件名内容哈希（构建时注入版本号）。
      {
        source: '/css/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=3600' },
        ],
      },
      {
        source: '/js/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=3600' },
        ],
      },
      // 静态 HTML 页面内容可能更新，缓存 1 小时
      {
        source: '/:path*.html',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=3600' },
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
