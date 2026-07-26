-- profiles 表（扩展 auth.users）
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text not null,
  role text not null default 'studio' check (role in ('studio', 'admin')),
  phone text,
  display_name text not null,
  avatar_url text,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- service_types 表
create table public.service_types (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  description text,
  process_steps text,
  price_range text,
  sort_order int default 0,
  is_active boolean default true,
  created_at timestamptz default now()
);

-- orders 表（委托单）
create table public.orders (
  id uuid default gen_random_uuid() primary key,
  order_no text unique not null,
  service_type_id uuid references public.service_types(id),
  status text not null default 'pending' check (status in (
    'pending', 'estimated', 'accepted', 'rejected',
    'processing', 'delivered', 'completed'
  )),
  customer_name text not null,
  customer_phone text not null,
  customer_email text not null,
  requirements text not null,
  estimated_price numeric(10,2),
  estimate_notes text,
  reject_reason text,
  studio_user_id uuid references public.profiles(id),
  delivery_url text,
  admin_notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- order_attachments 表
create table public.order_attachments (
  id uuid default gen_random_uuid() primary key,
  order_id uuid references public.orders on delete cascade,
  file_name text not null,
  file_path text not null,
  file_size bigint,
  file_type text,
  uploaded_by uuid references public.profiles(id),
  created_at timestamptz default now()
);

-- order_replies 表
create table public.order_replies (
  id uuid default gen_random_uuid() primary key,
  order_id uuid references public.orders on delete cascade,
  reply_type text not null check (reply_type in ('site', 'email', 'sms')),
  content text not null,
  sender_id uuid references public.profiles(id),
  sent_at timestamptz default now()
);

-- operation_logs 表
create table public.operation_logs (
  id uuid default gen_random_uuid() primary key,
  order_id uuid references public.orders on delete cascade,
  user_id uuid references public.profiles(id),
  action text not null,
  details jsonb,
  created_at timestamptz default now()
);

-- case_items 表
create table public.case_items (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  description text,
  image_url text,
  service_type_id uuid references public.service_types(id),
  is_featured boolean default false,
  sort_order int default 0,
  created_at timestamptz default now()
);

-- 委托单号生成函数和序列
create sequence order_seq start 1;

create or replace function generate_order_no()
returns text as $$
declare
  seq_val bigint;
  date_str text;
begin
  date_str := to_char(now(), 'YYYYMMDD');
  select nextval('order_seq') into seq_val;
  return 'LW' || date_str || lpad(seq_val::text, 4, '0');
end;
$$ language plpgsql;

-- RLS 策略辅助函数
create or replace function public.current_user_role()
returns text as $$
  select role from public.profiles where id = auth.uid();
$$ language sql security definer;

-- 启用所有表的 RLS
alter table public.profiles enable row level security;
alter table public.orders enable row level security;
alter table public.order_attachments enable row level security;
alter table public.order_replies enable row level security;
alter table public.operation_logs enable row level security;
alter table public.case_items enable row level security;
alter table public.service_types enable row level security;

-- profiles RLS
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);
create policy "profiles_select_admin" on public.profiles
  for select using (public.current_user_role() = 'admin');

-- orders RLS
create policy "orders_insert_anon" on public.orders
  for insert with check (true);
create policy "orders_select_staff" on public.orders
  for select using (public.current_user_role() in ('studio', 'admin'));
create policy "orders_update_staff" on public.orders
  for update using (public.current_user_role() in ('studio', 'admin'));

-- order_attachments RLS
create policy "attachments_staff" on public.order_attachments
  for all using (public.current_user_role() in ('studio', 'admin'));

-- order_replies RLS
create policy "replies_staff" on public.order_replies
  for all using (public.current_user_role() in ('studio', 'admin'));

-- operation_logs RLS
create policy "logs_staff" on public.operation_logs
  for all using (public.current_user_role() in ('studio', 'admin'));

-- case_items RLS
create policy "cases_public_read" on public.case_items
  for select using (true);
create policy "cases_admin_write" on public.case_items
  for all using (public.current_user_role() = 'admin');

-- service_types RLS
create policy "services_public_read" on public.service_types
  for select using (is_active = true);
create policy "services_admin_all" on public.service_types
  for all using (public.current_user_role() = 'admin');

-- 索引
create index idx_orders_status on public.orders(status);
create index idx_orders_created_at on public.orders(created_at desc);
create index idx_orders_studio_user on public.orders(studio_user_id);
create index idx_orders_order_no on public.orders(order_no);
create index idx_attachments_order_id on public.order_attachments(order_id);
create index idx_replies_order_id on public.order_replies(order_id);
create index idx_logs_order_id on public.operation_logs(order_id);

-- 初始数据
insert into public.service_types (name, description, price_range, sort_order) values
('兽装定制', 'Fursuit 全身/半身定制', '¥3,000 - ¥15,000', 1),
('兽爪/兽尾', '兽爪手套、兽尾配件定制', '¥200 - ¥2,000', 2),
('Kemono 风格', 'Kemono 风格兽装定制', '¥4,000 - ¥20,000', 3),
('配件定制', '眼珠、牙齿、鼻子等配件', '¥100 - ¥1,500', 4);

insert into public.case_items (title, description, image_url, is_featured, sort_order) values
('猫咪兽装案例', '全手工缝制猫咪风格兽装，含可拆卸尾巴', '/images/case1.jpg', true, 1),
('狐狸半身装案例', '半身狐狸风格兽装，精致毛绒材质', '/images/case2.jpg', true, 2),
('龙系兽装案例', '龙系风格全身兽装，含LED眼睛效果', '/images/case3.jpg', true, 3),
('配件合集案例', '多款兽爪和尾巴配件展示', '/images/case4.jpg', false, 4);
