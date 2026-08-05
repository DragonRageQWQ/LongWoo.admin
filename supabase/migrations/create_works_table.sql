-- ============================================================
-- create_works_table.sql
-- "我们的作品"管理表：支持管理后台增删改，图片编码序号自适应
-- ============================================================

-- 作品表
create table if not exists public.works (
  id uuid primary key default gen_random_uuid(),
  code text not null,                          -- 图片编码序号（'01','02'...），增删后自动重排
  title text not null,                         -- 作品名称
  tag text not null default '全装定制案例',     -- 类型标签
  description text not null default '',        -- 作品描述文案
  work_type text not null default '全装定制',   -- 定制类型
  delivery text not null default '预计 4-6 周', -- 交付周期
  craft text not null default '立体剪裁 · 手工缝制', -- 制作工艺
  image_url text not null,                     -- 图片地址（相对路径或 Storage URL）
  sort_order int not null default 0,           -- 排序权重（与编码一致）
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists works_code_unique on public.works (code);
create index if not exists works_sort_order_idx on public.works (sort_order);

-- RLS
alter table public.works enable row level security;

-- 公开读：仅展示启用中的作品
drop policy if exists works_public_read on public.works;
create policy works_public_read on public.works
  for select using (is_active = true);

-- service_role 全权（写操作经 Server Actions + service_role 客户端执行）
drop policy if exists works_service_all on public.works;
create policy works_service_all on public.works
  for all using (auth.jwt() ->> 'role' = 'service_role')
  with check (auth.jwt() ->> 'role' = 'service_role');

-- 初始数据：迁移现有 5 个作品
insert into public.works (code, title, tag, description, image_url, sort_order)
values
  ('01', '板栗', '全装定制案例', '以栗色为主色调的全装定制作品，立体化剪裁搭配精细绒毛工艺，整体造型还原角色气质，细节表现丰富。', 'assets/image_2_wv337u.jpg', 1),
  ('02', '灰崎', '全装定制案例', '灰色系全装定制作品，注重面部神态与整体线条的刻画，沉稳配色中展现角色独有的气质与细节质感。', 'assets/image_3_wv337u.jpg', 2),
  ('03', '热点', '全装定制案例', '暖色调全装定制作品，造型活泼富有张力，色彩层次过渡自然，将角色的个性与活力完整呈现。', 'assets/image_4_wv337u.jpg', 3),
  ('04', '山桐', '全装定制案例', '以自然色调为主题的全装定制作品，线条流畅、轮廓清晰，通过材质与工艺的结合呈现简洁耐看的视觉效果。', 'assets/image_5_8ofe40.jpg', 4),
  ('05', '渔弎', '全装定制案例', '色彩层次丰富的全装定制作品，造型独特、细节考究，展现角色鲜明个性的同时保证穿着的舒适与耐用。', 'assets/image_6_wv337u.jpg', 5)
on conflict (code) do nothing;
