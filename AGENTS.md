# LongWoo 龙坞平台 — Codex 项目交接文档

> 本文档为 AI 代理（Codex / Claude / 等）的项目上下文指引，涵盖架构、安全、数据库、开发规范等全部关键信息。

---

## 1. 项目概述

**LongWoo 龙坞** 是一个兽装定制工作室的委托管理平台，提供在线委托提交、估价管理、工单追踪、交付管理等功能。

- **域名**: https://www.longwoo.studio
- **部署平台**: Vercel
- **后端服务**: Supabase (Auth + PostgreSQL + Storage)
- **前端框架**: Next.js 16 + React 19
- **语言**: TypeScript (strict mode)
- **样式**: Tailwind CSS v4

### 核心业务流程

```
客户提交委托 → 管理员估价 → 客户确认 → 管理员接单 → 处理中 → 交付 → 完成
   pending    estimated    accepted(管理员接单)  processing  delivered  completed
                                                                    ↓
                                                                 rejected(拒单)
```

---

## 2. 技术栈

| 类别 | 技术 | 版本 |
|------|------|------|
| 前端框架 | Next.js | 16.2.11 |
| UI 库 | React | 19.2.4 |
| 样式 | Tailwind CSS | v4 |
| 图标 | lucide-react | ^1.26.0 |
| 后端 BaaS | Supabase | @supabase/ssr ^0.12.3, @supabase/supabase-js ^2.110.8 |
| 语言 | TypeScript | ^5 |
| 代码检查 | ESLint | ^9 |
| 部署 | Vercel | — |

### Next.js 16 重要提示

> **This is NOT the Next.js you know.** Next.js 16 有破坏性变更，API、约定和文件结构可能与训练数据不同。编写代码前请阅读 `node_modules/next/dist/docs/` 中的相关指南。

---

## 3. 项目结构

```
longwoo-platform/
├── src/
│   ├── middleware.ts              # 三级权限路由保护（Edge Runtime）
│   ├── app/                       # Next.js App Router
│   │   ├── layout.tsx             # 根布局
│   │   ├── page.tsx               # 首页（重定向到 public/index.html）
│   │   ├── login/                 # 登录页（邮箱验证码 + QQ OAuth）
│   │   ├── profile/               # 个人中心（普通用户可访问）
│   │   ├── order/
│   │   │   ├── submit/            # 委托提交页（公开）
│   │   │   └── query/             # 委托查询页（公开，按单号+手机号）
│   │   ├── admin/dashboard/       # 管理后台（仅 admin）
│   │   ├── studio/dashboard/      # 工作台（仅 admin，即工作室用户）
│   │   ├── api/
│   │   │   ├── auth/login/        # 登录 API Route（验证码登录核心）
│   │   │   ├── auth/logout/       # 登出 API Route
│   │   │   ├── auth/diagnose/     # 认证诊断（开发环境）
│   │   │   ├── order/create/      # 委托创建 API Route
│   │   │   └── session-check/     # 会话检查 API Route
│   │   ├── auth/
│   │   │   ├── callback/          # Supabase Auth 回调
│   │   │   └── qq/                # QQ OAuth 回调
│   │   ├── about/                 # 关于页面
│   │   ├── services/              # 服务介绍页面
│   │   ├── error.tsx              # 错误边界
│   │   ├── global-error.tsx       # 全局错误边界
│   │   └── not-found.tsx          # 404 页面
│   ├── actions/                   # Server Actions
│   │   ├── auth-actions.ts        # 认证相关（发送验证码、登出、获取会话）
│   │   ├── order-actions.ts       # 委托单 CRUD（创建、查询、估价、接单等）
│   │   ├── admin-actions.ts       # 管理员操作（授权、审计日志）
│   │   └── profile-actions.ts     # 个人信息管理（头像、密码等）
│   ├── lib/                       # 核心库
│   │   ├── constants.ts           # 全局常量（速率限制、角色、文件上传等）
│   │   ├── auth.ts                # 统一权限工具（getCurrentUser, requireAdmin 等）
│   │   ├── csrf.ts                # CSRF 保护（Server Actions）
│   │   ├── api-csrf.ts            # CSRF 保护（API Routes）
│   │   ├── rate-limit.ts          # 数据库速率限制（原子 RPC + 回退）
│   │   ├── otp-store.ts           # OTP 验证码存储（SHA-256 哈希）
│   │   ├── order-utils.ts         # 订单验证工具（输入校验、UUID、URL）
│   │   ├── postgrest-utils.ts     # PostgREST 查询安全转义
│   │   ├── utils.ts               # 通用工具（脱敏、日期、状态标签）
│   │   ├── file-validation.ts     # 文件上传验证
│   │   ├── profile.ts             # Profile 获取/创建逻辑
│   │   ├── email-templates.ts     # 邮件模板
│   │   └── supabase/
│   │       ├── server.ts          # 服务端 Supabase 客户端 + getSessionUser
│   │       ├── admin.ts           # Admin 客户端（service_role，绕过 RLS）
│   │       ├── client.ts          # 浏览器端 Supabase 客户端
│   │       └── cookie-utils.ts    # Cookie 编解码 + JWT 验证（安全核心）
│   ├── types/
│   │   └── database.ts            # 所有数据库类型定义
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Header.tsx         # 导航栏
│   │   │   └── Footer.tsx         # 页脚
│   │   ├── shared/
│   │   │   ├── OrderDetailModal.tsx
│   │   │   ├── InfoRow.tsx
│   │   │   └── StatusBadge.tsx
│   │   ├── providers/
│   │   │   └── SessionProvider.tsx
│   │   └── ui/
│   │       └── Button.tsx
│   └── app/admin/dashboard/_components/
│       ├── AdminSidebar.tsx
│       ├── OrderList.tsx
│       ├── OrderDetailModal.tsx
│       ├── StatsOverview.tsx
│       └── UserManagement.tsx
├── supabase/
│   └── migrations/                # SQL 迁移文件（按顺序执行）
│       ├── 001_create_tables.sql          # 初始表结构
│       ├── add_uid_and_password_fields.sql # UID + has_password 字段
│       ├── create_otp_codes_table.sql     # OTP 验证码表
│       ├── rbac_role_migration.sql        # RBAC 角色迁移（studio→user）
│       ├── profiles_rls_field_protection.sql # profiles 字段级保护
│       ├── fix_profiles_rls_policies.sql  # RLS 策略修复
│       ├── fix_rls_and_security.sql       # RLS + 安全加固（重要）
│       ├── rate_limit_rpc.sql             # 原子速率限制 RPC
│       └── performance_security_optimization.sql # 性能 + 安全优化
├── public/                        # 静态文件
│   ├── index.html                 # 营销首页
│   ├── order-step*.html           # 委托流程静态页
│   └── css/                       # 编译后的 Tailwind CSS
├── next.config.ts                 # Next.js 配置（安全头、CSP、rewrites）
├── tsconfig.json                  # TypeScript 配置
├── eslint.config.mjs             # ESLint 配置
├── postcss.config.mjs            # PostCSS 配置
├── .env.example                   # 环境变量模板
└── package.json
```

---

## 4. 环境配置

### 必需环境变量

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# 站点 URL（部署后填写实际域名）
NEXT_PUBLIC_SITE_URL=https://www.longwoo.studio

# QQ OAuth（可选）
QQ_CLIENT_ID=
QQ_CLIENT_SECRET=

# 邮件服务（可选，使用 Resend）
RESEND_API_KEY=
RESEND_FROM_EMAIL=noreply@longwoo.studio

# 调试（可选）
DEBUG_AUTH=false
```

### 本地开发

```bash
npm install
npm run dev    # http://localhost:3000
```

### 构建

```bash
npm run build
npm run start
```

### 静态 CSS 构建（public/ 下的 HTML 页面）

```bash
npm run build:static-css
```

---

## 5. 数据库架构

### 核心表

| 表名 | 用途 | 关键字段 |
|------|------|----------|
| `profiles` | 用户资料（扩展 auth.users） | id(UUID), uid(int), email, role('user'\|'admin'), is_active, has_password |
| `orders` | 委托单 | order_no, status, customer_name/phone/email, requirements, estimated_price, studio_user_id |
| `service_types` | 服务类型 | name, price_range, sort_order, is_active |
| `order_attachments` | 委托单附件 | order_id, file_name, file_path |
| `order_replies` | 委托单回复 | order_id, reply_type('site'\|'email'\|'sms'), content, sender_id |
| `operation_logs` | 操作日志 | order_id, user_id, action, details(jsonb) |
| `case_items` | 案例展示 | title, image_url, is_featured |
| `otp_codes` | OTP 验证码 | email, code(SHA-256), expires_at, used, attempts |
| `rate_limits` | 速率限制 | key, expires_at |
| `admin_audit_log` | 管理员审计日志 | operator_uid, action, target_uid |

### 订单状态流转

```
pending → estimated → accepted → processing → delivered → completed
   ↓         ↓
rejected  rejected
```

合法状态转换（在 `updateOrderStatus` 中强制校验）：
- `processing` ← `accepted`
- `delivered` ← `processing`
- `completed` ← `delivered`

### 数据库函数

- `generate_order_no()`: 生成委托单号（格式: LW + YYYYMMDD + 4位序号）
- `current_user_role()`: 获取当前用户角色（RLS 辅助函数）
- `check_rate_limit(p_key, p_max_count, p_window_ms)`: 原子速率限制检查
- `prevent_sensitive_field_modification()`: 触发器，阻止普通用户修改 role/uid/is_active

---

## 6. 认证与授权体系

### 三级权限模型

```
游客 (未登录)       → 仅访问公开页面，受保护路径重定向到 /login
普通用户 (role=user) → 可访问 /profile（个人中心）
管理员 (role=admin)  → 可访问所有路径（/admin/*, /studio/*, /profile）
```

**零号用户** (uid=10001) 是超级管理员，唯一可授予/撤销其他用户管理员权限的用户。

### 认证流程（邮箱验证码登录）

```
1. 用户输入邮箱 → sendEmailOtp Server Action
   ├── CSRF 校验
   ├── IP + 邮箱双重速率限制
   ├── 生成 6 位验证码（crypto.randomInt）
   ├── SHA-256 哈希存入 otp_codes 表
   └── 通过 Resend API 发送邮件

2. 用户输入验证码 → POST /api/auth/login
   ├── CSRF 校验（validateApiCsrf）
   ├── IP + 邮箱双重速率限制
   ├── verifyOtp（不消费，恒定时间比较）
   ├── generateLink(magiclink, send_email: false) 获取 token_hash
   ├── POST /auth/v1/verify 交换 session
   ├── 并行：consumeOtp + getOrCreateProfile
   └── 手动编码 session cookie（base64url + 分片）
```

### 安全核心：Token 验证

**不信任 cookie 内容**，所有认证都通过 Supabase API 验证 access_token：

```typescript
// cookie-utils.ts → verifyAccessToken
const resp = await fetch(`${supabaseUrl}/auth/v1/user`, {
  headers: {
    apikey: anonKey,
    Authorization: `Bearer ${accessToken}`,
  },
})
```

此验证在以下位置调用：
- `middleware.ts` — 每个受保护路由的请求
- `lib/auth.ts` → `getCurrentUser()` — 每个 Server Action
- `lib/supabase/server.ts` → `getSessionUser()` — 通用会话获取

### Middleware 路由保护

```typescript
// src/middleware.ts
const protectedPaths = ['/studio', '/admin', '/profile']
const adminOnlyPaths = ['/admin', '/studio']

// 未登录 → 重定向 /login
// 非管理员访问 admin/studio → 重定向 /profile
```

### 授权工具函数（`src/lib/auth.ts`）

| 函数 | 用途 | 返回 |
|------|------|------|
| `getCurrentUser()` | 获取当前用户（含角色，React cache 缓存） | `{userId, role, uid, profile} \| null` |
| `requireUser()` | 要求已登录 | `{success, user} \| {success: false, error}` |
| `requireAdmin()` | 要求管理员 | 同上 |
| `requireZeroUser()` | 要求零号用户（超级管理员） | 同上 |
| `canUserAccessOrder()` | 验证用户是否有权操作指定订单 | `boolean` |

---

## 7. 安全措施

### 7.1 CSRF 保护

**Server Actions** (`src/lib/csrf.ts`):
- 验证 Origin/Referer 头与 Host 匹配
- 既无 Origin 也无 Referer → 拒绝

**API Routes** (`src/lib/api-csrf.ts`):
- 同样的 Origin/Referer 验证逻辑

所有 Server Action 和 API Route 在入口处调用 `validateCsrf()` / `validateApiCsrf()`。

### 7.2 速率限制

**数据库版**（`src/lib/rate-limit.ts`），兼容 Vercel Serverless 多实例：

| 场景 | 限制 |
|------|------|
| OTP 发送 | IP: 3次/分钟, 邮箱: 3次/分钟 |
| 登录尝试 | IP: 10次/分钟, 邮箱: 5次/分钟 |
| 委托创建 | IP: 10次/分钟 |
| 委托查询 | IP+手机号: 5次/分钟 |
| 头像上传 | 3次/分钟 |
| 邮件回复 | 5次/分钟 |
| 密码修改 | 3次/分钟 |
| 邮箱查询 | 10次/分钟 |

优先使用原子 RPC 函数 `check_rate_limit()`（通过 `pg_advisory_xact_lock` 解决 TOCTOU 竞态），RPC 不可用时回退到 insert-first 模式。

### 7.3 OTP 安全

- 验证码以 **SHA-256 哈希** 存储，数据库泄露无法直接读取
- **恒定时间比较**（`crypto.timingSafeEqual`），防止时序攻击
- 10 分钟过期，最多 5 次尝试
- **延迟消费**：验证成功后不立即消费，建立会话成功后才消费（`consumeOtp`），失败可重试

### 7.4 RLS 策略

所有表启用 Row Level Security：
- `profiles`: 用户仅可读/改自己的记录，`WITH CHECK` 阻止修改 role/uid/is_active
- `orders`: 匿名插入仅限 pending 状态，管理员可读写所有
- `order_attachments`: 管理员可读写，普通用户仅读自己订单的附件
- `operation_logs`: 管理员可读写，普通用户仅读自己订单的日志
- 触发器 `prevent_sensitive_field_modification` 额外保护敏感字段

### 7.5 输入验证与防注入

- **PostgREST 注入**: `escapePostgrestKeyword` + `escapeIlikeKeyword` 转义搜索关键词
- **XSS**: `escapeHtml` 用于邮件模板，`validateUrl` 仅允许 http/https 协议
- **SQL 注入**: `isValidUUID` 验证所有 UUID 参数
- **输入长度**: 所有文本字段有长度限制（customer_name ≤ 50, requirements ≤ 5000 等）
- **手机号格式**: 数据库 CHECK 约束 + 应用层验证 `^1[3-9][0-9]{9}$`
- **邮箱格式**: 数据库 CHECK 约束 + 应用层验证

### 7.6 数据脱敏

- `maskPhone`: 138****1234
- `maskEmail`: ab****@example.com
- 管理员可查看完整信息，普通用户仅看脱敏数据
- 查询 profiles 时仅选取必要字段（display_name, avatar_url），不泄露 email/role/has_password

### 7.7 安全响应头（`next.config.ts`）

- `Content-Security-Policy`: 限制 script/style/img/connect 来源
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: SAMEORIGIN`
- `Strict-Transport-Security`: HSTS 2 年
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy`: 禁用 camera/microphone/geolocation

### 7.8 Cookie 安全

```typescript
SECURE_COOKIE_OPTIONS = {
  path: '/',
  httpOnly: true,              // 禁止 JS 读取
  secure: production,          // 仅 HTTPS
  sameSite: 'lax',
  maxAge: 7 * 24 * 60 * 60    // 7 天
}
```

---

## 8. 核心业务逻辑

### 8.1 Server Actions 索引

#### `auth-actions.ts`
| 函数 | 说明 |
|------|------|
| `sendEmailOtp(email)` | 发送验证码（CSRF + 速率限制 + SHA-256 存储） |
| `logoutUser()` | 登出（清除所有 cookie 分片） |
| `getSession()` | 获取当前会话和 profile |
| `signInWithQQ()` | QQ OAuth 登录入口 |

#### `order-actions.ts`
| 函数 | 说明 | 权限 |
|------|------|------|
| `createOrder(formData)` | 创建委托单 | 公开 |
| `getOrders(filters)` | 查询委托单列表（分页/搜索/筛选） | admin |
| `getOrderById(id)` | 查询委托单详情 | 登录 + 授权 |
| `submitEstimate(orderId, price, notes)` | 提交估价 | admin |
| `acceptOrder(orderId)` | 接单（条件更新防竞态） | admin |
| `rejectOrder(orderId, reason)` | 拒单 | admin |
| `updateOrderStatus(orderId, status, deliveryUrl?)` | 更新进度（状态机校验） | admin |
| `replySite(orderId, content)` | 站内回复 | admin |
| `replyEmail(orderId, content)` | 邮件回复（Resend API） | admin |
| `queryOrderByNo(orderNo, phone)` | 按单号+手机号查询 | 公开 |
| `getStudioOrders(filters)` | 工作台委托单列表 | 登录 |
| `getOrderStatusCounts()` | 状态计数统计 | 登录 |
| `getServiceTypes()` | 获取服务类型 | 公开 |

#### `admin-actions.ts`
| 函数 | 说明 | 权限 |
|------|------|------|
| `grantAdminRole(targetUid)` | 授予管理员权限 | zero_user |
| `revokeAdminRole(targetUid)` | 撤销管理员权限 | zero_user |
| `listAllUsers(options)` | 用户列表（分页/搜索） | admin |
| `getAdminAuditLog(options)` | 审计日志 | zero_user |
| `checkIsZeroUser()` | 检查是否零号用户 | admin |

### 8.2 并发安全

- **接单防竞态**: 条件更新 `.eq('status', 'pending/estimated').is('studio_user_id', null)`，数据库层面原子操作
- **状态转换**: `updateOrderStatus` 使用 `.in('status', allowedFromStatuses)` 确保合法转换
- **速率限制**: `pg_advisory_xact_lock` 序列化同一 key 的并发请求

### 8.3 审计日志

所有管理员操作（授权/撤销管理员）记录到 `admin_audit_log` 表，包含操作者、目标用户、操作前后状态。

---

## 9. 开发规范

### 9.1 代码组织

- **Server Actions** 放在 `src/actions/`，文件顶部必须有 `'use server'`
- **纯同步验证函数** 不放在 `'use server'` 文件中（会报错），放在 `src/lib/` 下的普通模块
- **Supabase 客户端** 三种：
  - `server.ts` → Server Components / Server Actions（anon key + cookie）
  - `admin.ts` → 需要绕过 RLS 的特权操作（service_role key）
  - `client.ts` → 浏览器端（anon key）

### 9.2 安全规范

**每个 Server Action / API Route 必须遵循：**

1. CSRF 校验（`validateCsrf()` 或 `validateApiCsrf()`）
2. 输入验证（格式、长度、类型）
3. 速率限制（敏感操作）
4. 权限校验（`requireUser` / `requireAdmin` / `requireZeroUser`）
5. 业务逻辑执行
6. 记录操作日志（`operation_logs`）
7. `revalidatePath` 刷新缓存

**数据库查询安全：**
- 搜索关键词必须 `escapePostgrestKeyword` + `escapeIlikeKeyword`
- UUID 参数必须 `isValidUUID` 验证
- URL 参数必须 `validateUrl` 验证
- 分页 `limit` 必须 `Math.min(limit, MAX_PAGE_LIMIT)`

**敏感数据处理：**
- 手机号脱敏 `maskPhone`
- 邮箱脱敏 `maskEmail`
- profiles 查询仅选取必要字段
- 邮件内容 `escapeHtml` 防止 XSS

### 9.3 路径别名

```json
// tsconfig.json
"paths": { "@/*": ["./src/*"] }
```

使用 `@/lib/...`, `@/actions/...`, `@/types/...`, `@/components/...`

### 9.4 常量管理

所有魔法数字/字符串集中在 `src/lib/constants.ts`，不要在代码中硬编码。

### 9.5 ESLint

```bash
npm run lint
```

已知特殊处理：Effect 中的 setState 需添加 `// eslint-disable-next-line react-hooks/set-state-in-effect`

---

## 10. 部署指南

### Vercel 部署

1. 推送代码到 GitHub
2. 在 Vercel 导入项目
3. 配置环境变量（参考 `.env.example`）
4. 部署

### 数据库迁移

迁移文件在 `supabase/migrations/`，需在 Supabase Dashboard → SQL Editor 中**按顺序执行**。

执行顺序：
1. `001_create_tables.sql`
2. `add_uid_and_password_fields.sql`
3. `create_otp_codes_table.sql`
4. `rbac_role_migration.sql`
5. `profiles_rls_field_protection.sql`
6. `fix_profiles_rls_policies.sql`
7. `fix_rls_and_security.sql`
8. `rate_limit_rpc.sql`
9. `performance_security_optimization.sql`

### 静态页面 CSS

`public/` 下的 HTML 页面使用独立的 Tailwind CSS，需单独构建：

```bash
npm run build:static-css
```

---

## 11. 已知问题与注意事项

### 注意事项

1. **Next.js 16 破坏性变更**: 编写代码前务必查阅 `node_modules/next/dist/docs/`
2. **Edge Runtime 限制**: middleware 运行在 Edge Runtime，不能使用 Node.js API（如 `crypto` 模块的部分功能），使用 `atob` 替代 `Buffer`
3. **Vercel 超时**: Hobby 计划默认 10 秒超时，登录 API 设置了 `maxDuration = 60`
4. **Cookie 分片**: Supabase session cookie 超过 3180 字符会自动分片，`cookie-utils.ts` 处理编解码
5. **Supabase Service Role Key**: 严禁暴露到客户端，仅用于服务端特权操作
6. **QQ OAuth 回调地址**: 生产环境 `https://www.longwoo.studio/auth/qq/callback`，本地 `http://localhost:3000/auth/qq/callback`

### 常见问题

- **登录后 cookie 未同步**: 登录 API 使用手动 cookie 编码（`encodeSessionCookie`），不走 `supabase.auth.setSession`
- **middleware 中 "Invalid API key"**: 使用直接 `fetch` 调用 `/auth/v1/user`，而非 Supabase SDK
- **profiles 表 RLS 导致写入失败**: 使用 `createAdminClient()`（service_role）绕过 RLS

---

## 12. 关键文件快速索引

| 文件 | 作用 |
|------|------|
| `src/middleware.ts` | 路由权限保护（三级权限） |
| `src/lib/auth.ts` | 统一权限工具（getCurrentUser 等） |
| `src/lib/constants.ts` | 全局常量 |
| `src/lib/csrf.ts` | CSRF 保护（Server Actions） |
| `src/lib/api-csrf.ts` | CSRF 保护（API Routes） |
| `src/lib/rate-limit.ts` | 数据库速率限制 |
| `src/lib/otp-store.ts` | OTP 验证码安全存储 |
| `src/lib/supabase/server.ts` | 服务端 Supabase 客户端 |
| `src/lib/supabase/admin.ts` | Admin 客户端（service_role） |
| `src/lib/supabase/cookie-utils.ts` | Cookie 编解码 + JWT 验证 |
| `src/lib/postgrest-utils.ts` | PostgREST 查询安全转义 |
| `src/lib/order-utils.ts` | 订单输入验证 |
| `src/lib/utils.ts` | 脱敏、日期、状态标签 |
| `src/actions/auth-actions.ts` | 认证 Server Actions |
| `src/actions/order-actions.ts` | 委托单 Server Actions |
| `src/actions/admin-actions.ts` | 管理员 Server Actions |
| `src/types/database.ts` | 数据库类型定义 |
| `src/app/api/auth/login/route.ts` | 登录 API Route（核心） |
| `next.config.ts` | 安全头 + CSP + rewrites |
| `supabase/migrations/` | SQL 迁移文件 |

---

## 13. 版本历史

- **v1.0.8(731)**: 工作台待估价和管理后台绑定真实数据库；添加导航按钮（返回首页/进入工作台/进入管理后台）。SHA: a794ca0

---

*本文档由 TRAE AI 助手整理，最后更新于 2026-07-31。*
