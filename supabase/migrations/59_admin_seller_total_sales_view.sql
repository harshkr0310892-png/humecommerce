-- 59_admin_seller_total_sales_view.sql
-- Ensures admin can see total sales for EVERY seller (including sellers with 0 sales).
-- Uses orders.status <> 'cancelled' rule.

BEGIN;

CREATE OR REPLACE VIEW public.admin_seller_total_sales AS
SELECT
  s.id AS seller_id,
  s.name AS seller_name,
  s.email AS seller_email,
  COALESCE(x.orders_count, 0) AS orders_count,
  COALESCE(x.gross_sales, 0) AS gross_sales
FROM public.sellers s
LEFT JOIN (
  SELECT
    oi.seller_id,
    COUNT(DISTINCT o.id) FILTER (WHERE o.status <> 'cancelled') AS orders_count,
    COALESCE(SUM(o.total) FILTER (WHERE o.status <> 'cancelled'), 0) AS gross_sales
  FROM public.order_items oi
  JOIN public.orders o ON o.id = oi.order_id
  WHERE oi.seller_id IS NOT NULL
  GROUP BY oi.seller_id
) x ON x.seller_id = s.id;

COMMIT;
