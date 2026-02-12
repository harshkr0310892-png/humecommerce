alter table public.products
  drop constraint if exists products_stock_status_check;

update public.products
set stock_status = 'sold_out'
where stock_status in ('out_of_stock', 'unavailable', 'deleted', 'inactive');

alter table public.products
  add constraint products_stock_status_check
  check (stock_status = any (array['in_stock'::text, 'low_stock'::text, 'sold_out'::text]));

