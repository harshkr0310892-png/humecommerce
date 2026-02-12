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

