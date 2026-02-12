create table public.admin_login_otps (
  id uuid not null default gen_random_uuid() primary key,
  email text not null,
  otp_hash text not null,
  otp_salt text not null,
  attempts integer not null default 0,
  expires_at timestamp with time zone not null,
  verified_at timestamp with time zone,
  consumed_at timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  requester_ip text,
  requester_user_agent text
);

create index admin_login_otps_email_idx on public.admin_login_otps (email);

alter table public.admin_login_otps enable row level security;

create policy "No access" on public.admin_login_otps
for all
using (false)
with check (false);

