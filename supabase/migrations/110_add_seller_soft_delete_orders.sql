alter table public.orders
add column if not exists seller_deleted boolean not null default false;

alter table public.orders
add column if not exists seller_deleted_at timestamptz;

create index if not exists orders_seller_deleted_idx on public.orders (seller_deleted);
