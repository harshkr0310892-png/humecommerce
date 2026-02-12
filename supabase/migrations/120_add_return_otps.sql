create table if not exists public.return_otps (
  id uuid not null default gen_random_uuid() primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  order_id uuid not null references public.orders(id) on delete cascade,
  otp_hash text not null,
  otp_salt text not null,
  attempts integer not null default 0,
  expires_at timestamp with time zone not null,
  consumed_at timestamp with time zone,
  created_at timestamp with time zone not null default now()
);

create index if not exists return_otps_user_order_idx on public.return_otps (user_id, order_id);
create index if not exists return_otps_expires_idx on public.return_otps (expires_at);

alter table public.return_otps enable row level security;

create policy "No access" on public.return_otps
for all
using (false)
with check (false);
