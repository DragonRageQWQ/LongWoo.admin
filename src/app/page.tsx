import { redirect } from 'next/navigation'

// 首页由 public/index.html 静态文件提供
// 此路由仅作为 Next.js App Router 的占位，重定向到静态首页
export default function HomePage() {
  redirect('/index.html')
}
