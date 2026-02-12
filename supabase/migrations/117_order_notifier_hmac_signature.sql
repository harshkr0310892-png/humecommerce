create or replace function public.get_order_notifier_webhook_secret()
returns text
language plpgsql
security definer
set search_path = public, vault
as $$
declare
  s text;
begin
  select ds.decrypted_secret into s
  from vault.decrypted_secrets ds
  where ds.name = 'order_notifier_webhook_secret'
  order by ds.created_at desc
  limit 1;

  return s;
exception when others then
  return null;
end;
$$;

create or replace function public.order_notifier_signature_base(payload jsonb)
returns text
language sql
immutable
as $$
  select concat_ws(
    E'\n',
    coalesce(payload->>'event',''),
    coalesce(payload->>'order_id',''),
    coalesce(payload->>'old_status',''),
    coalesce(payload->>'new_status',''),
    coalesce(payload->>'message',''),
    coalesce(payload->>'actor_email','')
  );
$$;

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
  secret text;
  signature_base text;
  signature_hex text;
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

  secret := public.get_order_notifier_webhook_secret();
  if secret is not null and secret <> '' then
    signature_base := public.order_notifier_signature_base(payload);
    signature_hex := encode(hmac(signature_base, secret, 'sha256'), 'hex');
    headers := headers || jsonb_build_object('x-order-notifier-signature', 'sha256=' || signature_hex);
  end if;

  perform net.http_post(url := function_url, headers := headers, body := payload);
end;
$$;

