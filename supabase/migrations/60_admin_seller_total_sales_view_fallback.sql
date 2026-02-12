-- 60_admin_seller_total_sales_view_fallback.sql
-- Fix admin seller sales showing 0 when order_items.seller_id is NULL.
-- We add a fallback path that derives seller_id from products for rows where product still exists.
-- This way admin can see sales even for older orders created before seller_id snapshot was stored.

BEGIN;

CREATE OR REPLACE VIEW public.admin_seller_total_sales AS
WITH resolved_items AS (
  SELECT
    COALESCE(oi.seller_id, p.seller_id) AS seller_id,
    oi.order_id
  FROM public.order_items oi
  LEFT JOIN public.products p ON p.id = oi.product_id
  WHERE COALESCE(oi.seller_id, p.seller_id) IS NOT NULL
), seller_sales AS (
  SELECT
    ri.seller_id,
    COUNT(DISTINCT o.id) FILTER (WHERE o.status <> 'cancelled') AS orders_count,
    COALESCE(SUM(o.total) FILTER (WHERE o.status <> 'cancelled'), 0) AS gross_sales
  FROM resolved_items ri
  JOIN public.orders o ON o.id = ri.order_id
  GROUP BY ri.seller_id
)
SELECT
  s.id AS seller_id,
  s.name AS seller_name,
  s.email AS seller_email,
  COALESCE(ss.orders_count, 0) AS orders_count,
  COALESCE(ss.gross_sales, 0) AS gross_sales
FROM public.sellers s
LEFT JOIN seller_sales ss ON ss.seller_id = s.id;

COMMIT;
