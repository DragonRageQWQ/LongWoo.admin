-- ============================================================
-- create_drop_items.sql
-- "购买掉落"管理表：支持管理后台增删改 + 三态掉落状态机
-- 状态定义：
--   on_sale   发售（可以购买）
--   preparing 准备（只能查看，不能购买）
--   adopted   领养（已被其他用户购买，交付过程中）
-- ============================================================

-- 掉落表
create table if not exists public.drop_items (
  id uuid primary key default gen_random_uuid(),
  title text not null,                          -- 掉落标题
  description text not null default '',         -- 介绍信息
  image_url text not null,                      -- 介绍图片（相对路径或 Storage URL）
  price numeric(10,2) not null default 0,       -- 价格（RMB）
  status text not null default 'preparing',     -- 掉落状态：on_sale / preparing / adopted
  copyright text not null default '',           -- 版权说明
  delivery text not null default '',            -- 交付说明
  includes text not null default '',            -- 包含内容（如：双视图/标准全装/定制外衣/定制道具）
  sort_order int not null default 0,            -- 排序权重
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint drop_items_status_check check (status in ('on_sale', 'preparing', 'adopted')),
  constraint drop_items_price_check check (price >= 0)
);

create index if not exists drop_items_sort_order_idx on public.drop_items (sort_order);
create index if not exists drop_items_status_idx on public.drop_items (status);

-- RLS
alter table public.drop_items enable row level security;

-- 公开读：仅展示启用中的掉落（含全部三种状态，前端按状态渲染购买能力）
drop policy if exists drop_items_public_read on public.drop_items;
create policy drop_items_public_read on public.drop_items
  for select using (is_active = true);

-- service_role 全权（写操作经 Server Actions + service_role 客户端执行）
drop policy if exists drop_items_service_all on public.drop_items;
create policy drop_items_service_all on public.drop_items
  for all using (auth.jwt() ->> 'role' = 'service_role')
  with check (auth.jwt() ->> 'role' = 'service_role');

-- 初始数据：迁移现有 3 个掉落（默认状态为 发售）
insert into public.drop_items (title, description, image_url, price, status, copyright, delivery, includes, sort_order)
values
  ('百丈冰', '含 双视图/标准全装/定制外衣/定制道具', 'assets/image_7_yi19x4.jpg', 35000, 'on_sale',
   '全部版权转让/可商用*', '成品部分（含头/手）立即交付\n剩余部分预计 4-6 周后交付*', '双视图/标准全装/定制外衣/定制道具', 1),
  ('千钧破', '含 双视图/标准全装/定制外衣/定制道具', 'assets/image_8_yi19x4.jpg', 32000, 'on_sale',
   '部分版权转让/不可商用*', '成品部分立即交付 剩余部分预计 4-6 周后交付*', '双视图/标准全装/定制外衣/定制道具', 2),
  ('万里凝', '含 双视图/标准全装/定制外衣/定制道具', 'assets/image_9_yi19x4.jpg', 32000, 'on_sale',
   '全部版权转让/不可商用*', '成品部分立即交付 剩余部分预计 4-6 周后交付*', '双视图/标准全装/定制外衣/定制道具', 3)
on conflict (id) do nothing;
