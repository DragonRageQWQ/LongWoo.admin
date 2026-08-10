-- ============================================================
-- add_drop_focus_fields.sql
-- "购买掉落"图片焦点字段：解决长图/大图时卡片裁剪无法选中角色焦点的问题
-- focus_x / focus_y - 焦点（角色所在位置）相对原图的百分比坐标（0-100，默认 50=居中）
-- 卡片封面用 object-fit: cover + object-position: {focus_x}% {focus_y}% 聚焦展示
-- ============================================================

alter table public.drop_items
  add column if not exists focus_x real not null default 50,
  add column if not exists focus_y real not null default 50;

-- 焦点坐标合法性约束（0-100）
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'drop_items_focus_x_check'
      and conrelid = 'public.drop_items'::regclass
  ) then
    alter table public.drop_items
      add constraint drop_items_focus_x_check check (focus_x >= 0 and focus_x <= 100);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'drop_items_focus_y_check'
      and conrelid = 'public.drop_items'::regclass
  ) then
    alter table public.drop_items
      add constraint drop_items_focus_y_check check (focus_y >= 0 and focus_y <= 100);
  end if;
end $$;
