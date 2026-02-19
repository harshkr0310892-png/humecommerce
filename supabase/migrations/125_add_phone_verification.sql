create table if not exists public.phone_verification_otps (
  id uuid not null default gen_random_uuid() primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  phone_e164 text not null,
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

create index if not exists phone_verification_otps_user_id_idx on public.phone_verification_otps (user_id);
create index if not exists phone_verification_otps_phone_e164_idx on public.phone_verification_otps (phone_e164);
create index if not exists phone_verification_otps_created_at_idx on public.phone_verification_otps (created_at desc);

alter table public.phone_verification_otps enable row level security;

drop policy if exists "No access" on public.phone_verification_otps;
create policy "No access" on public.phone_verification_otps
for all
using (false)
with check (false);

alter table public.customer_profiles
add column if not exists phone_verified_at timestamp with time zone;

create or replace function public.customer_profiles_reset_phone_verified()
returns trigger
language plpgsql
as $$
begin
  if new.phone is distinct from old.phone then
    new.phone_verified_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists customer_profiles_reset_phone_verified on public.customer_profiles;
create trigger customer_profiles_reset_phone_verified
before update on public.customer_profiles
for each row
execute function public.customer_profiles_reset_phone_verified();

create or replace function public.is_phone_verified(uid uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.customer_profiles cp
    where cp.user_id = uid
      and cp.phone_verified_at is not null
  );
$$;

alter table public.orders enable row level security;

do $$
declare
  r record;
begin
  for r in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'orders'
  loop
    execute 'drop policy if exists ' || quote_ident(r.policyname) || ' on public.orders;';
  end loop;
end $$;

create policy "Orders read all" on public.orders
for select to public
using (true);

create policy "Orders insert verified customers" on public.orders
for insert to authenticated
with check (
  user_id = auth.uid()
  and public.is_phone_verified(auth.uid())
);

create policy "Orders update all" on public.orders
for update to public
using (true)
with check (true);

create policy "Orders delete all" on public.orders
for delete to public
using (true);

drop policy if exists "Authenticated insert for contact submissions" on public.contact_submissions;
drop policy if exists "Authenticated verified insert for contact submissions" on public.contact_submissions;

create policy "Authenticated verified insert for contact submissions"
on public.contact_submissions
for insert
to authenticated
with check (public.is_phone_verified(auth.uid()));
