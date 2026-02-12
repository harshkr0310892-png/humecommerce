do $$
declare
  backup_schema text := 'net_backup_' || to_char(clock_timestamp(),'YYYYMMDDHH24MISS');
begin
  if exists (select 1 from pg_extension where extname = 'pg_net') then
    return;
  end if;

  if exists (select 1 from pg_namespace where nspname = 'net') then
    execute format('alter schema net rename to %I', backup_schema);
  end if;

  execute 'create extension pg_net';
end $$;

create or replace function public.call_order_notifier(payload jsonb)
returns void
language plpgsql
as $$
declare
  function_url text := 'https://hdstelpktngunkqzsfkd.supabase.co/functions/v1/order-notifier';
  headers jsonb := jsonb_build_object('content-type','application/json');
  req_headers jsonb;
  auth_header text;
  api_key text;
begin
  begin
    req_headers := nullif(current_setting('request.headers', true), '')::jsonb;
  exception when others then
    req_headers := null;
  end;

  auth_header := coalesce(req_headers ->> 'authorization', req_headers ->> 'Authorization');
  api_key := coalesce(req_headers ->> 'apikey', req_headers ->> 'Apikey', req_headers ->> 'x-api-key', req_headers ->> 'X-Api-Key');

  if auth_header is not null and auth_header <> '' then
    headers := headers || jsonb_build_object('authorization', auth_header);
  end if;

  if api_key is not null and api_key <> '' then
    headers := headers || jsonb_build_object('apikey', api_key);
  end if;

  perform net.http_post(url := function_url, headers := headers, body := payload);
end;
$$;

create or replace function public.on_order_status_changed()
returns trigger
language plpgsql
as $$
declare
  claims_text text := current_setting('request.jwt.claims', true);
  actor_email text;
begin
  if claims_text is not null then
    actor_email := (claims_text::jsonb ->> 'email');
  end if;

  if new.status is distinct from old.status then
    perform public.call_order_notifier(
      jsonb_build_object(
        'event','order_status_changed',
        'order_id',new.id,
        'old_status',old.status,
        'new_status',new.status,
        'actor','system',
        'actor_email',actor_email
      )
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_order_status_changed_email on public.orders;
create trigger trg_order_status_changed_email
after update of status on public.orders
for each row
execute function public.on_order_status_changed();

create or replace function public.on_order_message_created()
returns trigger
language plpgsql
as $$
declare
  claims_text text := current_setting('request.jwt.claims', true);
  actor_email text;
begin
  if claims_text is not null then
    actor_email := (claims_text::jsonb ->> 'email');
  end if;

  perform public.call_order_notifier(
    jsonb_build_object(
      'event','order_message_created',
      'order_id',new.order_id,
      'message',new.message,
      'actor',case when coalesce(new.is_delivery_boy,false) then 'delivery_boy' when coalesce(new.is_admin,false) then 'admin' else 'seller' end,
      'actor_email',actor_email
    )
  );
  return new;
end;
$$;

drop trigger if exists trg_order_message_created_email on public.order_messages;
create trigger trg_order_message_created_email
after insert on public.order_messages
for each row
execute function public.on_order_message_created();

