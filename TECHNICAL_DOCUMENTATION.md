# LongWoo 平台技术文档

> 文档依据当前仓库源码整理，更新日期：2026-08-01。

## 1. 项目概述

LongWoo（龙坞）是面向兽装定制工作室的委托管理平台。系统覆盖营销展示、在线提交委托、订单查询、用户认证、工作室接单与交付、管理员估价及用户权限管理。

当前仓库包含两部分：

- `longwoo-platform/`：正式应用，本文档的主要描述对象。
- `../longwoo-studio-design/`：早期静态页面和视觉设计稿，不参与正式应用构建。

正式应用采用 Next.js App Router，动态业务页面与 API 位于 `src/`；营销首页及部分早期委托步骤页位于 `public/`，根路径通过 rewrite 映射到 `public/index.html`。

## 2. 技术栈

| 层级 | 技术 | 当前版本/用途 |
| --- | --- | --- |
| Web 框架 | Next.js | 16.2.11，App Router、Server Actions、Route Handlers |
| UI | React / React DOM | 19.2.4 |
| 开发语言 | TypeScript | 5.x，启用严格检查 |
| 样式 | Tailwind CSS | 4.x，动态页面与静态 HTML 均使用 |
| 图标 | lucide-react | 1.26.x |
| 后端服务 | Supabase | Auth、PostgreSQL、Storage、RLS |
| 部署 | Vercel | 生产域名为 `www.longwoo.studio` |
| 代码质量 | ESLint | 9.x + eslint-config-next |

## 3. 系统架构

```text
浏览器
  ├─ public/*.html                 静态营销与委托展示页
  └─ Next.js 页面                 登录、个人中心、订单、工作台、管理后台
       ├─ Server Actions           认证、资料、订单、管理操作
       ├─ Route Handlers           登录/登出、OAuth、订单创建、会话检查
       ├─ Middleware               /profile、/studio、/admin 路由保护
       └─ Supabase
            ├─ Auth                邮箱 OTP、密码、QQ OAuth 会话
            ├─ PostgreSQL          业务数据、审计日志、限流记录
            ├─ RLS                 行级访问控制
            └─ Storage             用户头像等文件
```

服务端存在三类 Supabase 客户端：浏览器客户端使用 anon key；普通服务端客户端结合用户 Cookie 并受 RLS 约束；管理员客户端使用 service role key 绕过 RLS，仅允许在服务端调用。

## 4. 目录与模块

```text
src/
├─ app/
│  ├─ login/                      登录页
│  ├─ profile/                    用户个人中心
│  ├─ order/submit/               委托提交
│  ├─ order/query/                按单号和手机号查询
│  ├─ studio/dashboard/           工作室订单工作台
│  ├─ admin/dashboard/            管理后台
│  ├─ auth/                       Supabase 与 QQ OAuth 回调
│  └─ api/                        登录、登出、订单创建、诊断等接口
├─ actions/                       Server Actions
│  ├─ auth-actions.ts             OTP、会话、QQ 登录
│  ├─ profile-actions.ts          昵称、头像、密码
│  ├─ order-actions.ts            订单全生命周期
│  └─ admin-actions.ts            用户角色与审计
├─ components/                    布局、共享组件及基础 UI
├─ lib/
│  ├─ supabase/                   三类客户端与 Cookie 编解码
│  ├─ auth.ts                     统一鉴权与授权
│  ├─ csrf.ts / api-csrf.ts       CSRF 校验
│  ├─ rate-limit.ts               数据库限流
│  ├─ otp-store.ts                OTP 哈希存储与验证
│  └─ *-utils.ts                  校验、转义、脱敏等工具
├─ types/database.ts              数据库领域类型
└─ middleware.ts                  受保护路由中间件

supabase/migrations/              数据库迁移
public/                           静态 HTML、CSS、图片和站点文件
```

## 5. 核心业务流程

订单状态定义为：

```text
pending → estimated → accepted → processing → delivered → completed
    └──────────────→ rejected
```

- 客户提交委托后生成 `pending` 订单及 `LW + 日期 + 序号` 格式的单号。
- 管理员提交价格和说明后进入 `estimated`。
- 工作室接单后进入 `accepted`；接单采用条件更新以避免多人并发抢单。
- 制作、交付和完成依次对应 `processing`、`delivered`、`completed`。
- 管理动作写入 `operation_logs`，角色授予和撤销写入 `admin_audit_log`。

`order-actions.ts` 提供订单创建、列表查询、详情、估价、接单、拒单、状态更新、站内/邮件回复、公开查询、状态统计和服务类型查询。

## 6. 认证与权限

### 6.1 角色模型

| 身份 | 权限 |
| --- | --- |
| 游客 | 访问公开页面、提交委托、按单号查询 |
| 普通用户 `user` | 以上权限及 `/profile` |
| 管理员 `admin` | 访问 `/studio`、`/admin`，处理全部订单 |
| 零号用户（UID 10001） | 管理员权限，并可授予/撤销其他管理员角色 |

中间件保护 `/profile`、`/studio` 和 `/admin`。它不会直接信任 Cookie 中的用户 ID，而是取出 access token 后调用 Supabase Auth 用户接口验证；访问管理路径时再查询 `profiles.role`。

### 6.2 登录方式

- 邮箱验证码：生成 6 位 OTP，以 SHA-256 哈希写入 `otp_codes`，有效期 10 分钟，最多尝试 5 次。会话建立成功后才消费验证码。
- 密码登录：由个人资料相关 Server Action 处理，并有失败次数限制。
- QQ OAuth：由 `/auth/qq` 发起，`/auth/qq/callback` 完成回调。
- Supabase OAuth 回调：`/auth/callback`。

Supabase 会话 Cookie 支持 base64url 编码和分片，单片最大 3180 字符；Cookie 为 HttpOnly、SameSite=Lax，生产环境启用 Secure，默认保存 7 天。

## 7. 数据模型

| 表 | 用途 |
| --- | --- |
| `profiles` | 扩展 Auth 用户，保存 UID、角色、昵称、头像及启用状态 |
| `service_types` | 服务类型和价格范围 |
| `orders` | 委托主体、客户信息、状态、估价和交付信息 |
| `order_attachments` | 委托附件元数据 |
| `order_replies` | 站内、邮件、短信回复记录 |
| `operation_logs` | 订单操作日志 |
| `case_items` | 官网案例展示 |
| `otp_codes` | OTP 哈希、过期时间、使用状态和尝试次数 |
| `rate_limits` | 分布式请求限流状态 |
| `admin_audit_log` | 管理员角色变更审计 |

所有核心表启用 RLS。迁移还提供订单号生成、当前角色查询、敏感字段保护、原子限流、状态统计等数据库函数。`profiles` 的 `role`、`uid`、`is_active` 等字段同时通过 RLS 与触发器防止普通用户提权。

## 8. 安全设计

- Server Actions 与写入型 API 在入口校验 Origin/Referer，防止跨站请求伪造。
- OTP 采用加密安全随机数、SHA-256 哈希和恒定时间比较。
- 限流状态存储在 PostgreSQL，优先调用带事务锁的原子 RPC，适配 Vercel 多实例。
- UUID、URL、邮箱、手机号、文本长度、价格和上传文件均在应用层校验；头像还校验文件魔数。
- PostgREST 搜索字符会转义，邮件 HTML 会编码，手机号和邮箱在非管理场景脱敏。
- `next.config.ts` 统一设置 CSP、HSTS、X-Frame-Options、nosniff、Referrer-Policy 和 Permissions-Policy。
- `SUPABASE_SERVICE_ROLE_KEY` 只可用于服务端，严禁使用 `NEXT_PUBLIC_` 前缀或暴露到浏览器。

## 9. 环境变量

复制 `.env.example` 为 `.env.local` 并配置：

| 变量 | 必需 | 说明 |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | 是 | Supabase 项目 URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 是 | 浏览器及普通服务端客户端使用的 anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | 是 | 服务端特权操作密钥 |
| `NEXT_PUBLIC_SITE_URL` | 生产必需 | 主站公开地址（CSRF 白名单主域名）；本地默认 `http://localhost:3000` |
| `NEXT_PUBLIC_ADDITIONAL_SITE_URLS` | 否 | 附加生产域名（逗号分隔，如 `https://longwoo.com.cn,https://www.longwoo.com.cn`），一并加入 CSRF Origin 白名单 |
| `QQ_CLIENT_ID` / `QQ_CLIENT_SECRET` | 否 | QQ 互联登录 |
| `RESEND_API_KEY` | 否 | Resend 邮件发送 |
| `RESEND_FROM_EMAIL` | 否 | 发件地址，默认 `noreply@longwoo.studio` |

不要提交 `.env.local`，也不要将真实密钥写入文档、日志或客户端代码。

## 10. 本地开发与质量检查

```bash
npm install
npm run dev
```

默认访问 `http://localhost:3000`。常用命令：

```bash
npm run lint               # ESLint 检查
npm run build              # 生产构建
npm run start              # 启动生产构建
npm run build:static-css   # 重新生成 public 静态页 CSS
```

修改 `public/**/*.html` 使用到的 Tailwind 类后，需要执行 `build:static-css`。修改动态页面后，至少执行 lint 和生产构建。

## 11. 数据库初始化与部署

数据库迁移位于 `supabase/migrations/`。它们存在前后依赖，应按文件的业务演进顺序应用：先初始化表，再增加 UID/密码、OTP、RBAC 与 RLS 修复，最后应用限流及性能安全优化。生产环境执行前应先在测试 Supabase 项目验证，并记录已执行版本，避免重复运行非幂等语句。

应用推荐通过 Vercel 部署：

1. 连接代码仓库并将 Root Directory 指向 `longwoo-platform`。
2. 配置上述环境变量。
3. 执行 `npm run build`。
4. 配置 OAuth 回调地址；生产 QQ 回调为 `https://www.longwoo.studio/auth/qq/callback`。
5. 发布后验证首页、登录、订单提交/查询、工作台、管理后台和安全响应头。

仓库中的 `deploy.ps1` 会修改全局 Git 代理、自动提交并可能强制推送，不适合作为通用部署入口；除非明确理解其影响，否则应使用正常的 Git/Vercel 流程。

## 12. 维护注意事项

- 当前首页是静态 HTML rewrite，并非 `src/app/page.tsx` 渲染；排查首页问题时先检查 `public/index.html` 与 `next.config.ts`。
- Next.js 16 API 与旧版本存在差异，升级依赖或新增框架能力前应对照对应版本文档。
- Middleware 运行环境对 Node.js API 有限制，通用认证逻辑需保持 Edge 兼容。
- 使用 admin Supabase 客户端前必须先完成应用层授权；service role 会绕过 RLS。
- 状态变更必须沿用条件更新和合法状态机，避免并发覆盖或跳级。
- 当前工作区已有未提交的 OTP、Cookie 与迁移改动；维护时不要覆盖这些改动，并确保 `add_attempts_to_otp_codes.sql` 已在目标数据库应用。

## 13. 建议的测试清单

当前 `package.json` 未定义自动化测试命令，发布前至少执行以下回归：

- 游客、普通用户、管理员、零号用户的路由访问控制。
- OTP 正确、错误、过期、超次数、重复使用及限流场景。
- 密码与 QQ 登录、登出、Cookie 过期及分片会话。
- 委托创建、公开查询、估价、并发接单、拒单和完整状态流转。
- 普通用户越权读取/修改订单或角色时被拒绝。
- 邮件失败、附件格式伪造、非法 URL/UUID 和超长输入。
- 生产构建、静态首页资源、CSP 与各类安全响应头。

