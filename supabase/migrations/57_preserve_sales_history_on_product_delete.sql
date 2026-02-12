-- 57_preserve_sales_history_on_product_delete.sql
-- Goal:
-- 1) Keep seller sales/profit visible even if a product is deleted, as long as the order was DELIVERED.
-- 2) If an order is CANCELLED (customer/seller cancelled) and then deleted, it should not contribute to sales.
--
-- Approach:
-- - Store seller_id snapshot on order_items at order creation time.
-- - Make product_id on order_items nullable and set to NULL on product deletion, preserving order_items rows.
-- - Add a view to compute seller sales using orders.status != 'cancelled'.

BEGIN;

-- 1) Add seller_id snapshot to order_items (nullable for existing rows; backfill below)
ALTER TABLE public.order_items
ADD COLUMN IF NOT EXISTS seller_id uuid;

-- 2) Backfill seller_id for existing order_items from products (only for rows whose product still exists)
UPDATE public.order_items oi
SET seller_id = p.seller_id
FROM public.products p
WHERE oi.seller_id IS NULL
  AND oi.product_id = p.id;

-- 3) Keep seller_id nullable at DB level.
--
-- Why:
-- - Your current cart/checkout flow may not always include seller_id in the payload.
-- - Enforcing NOT NULL breaks checkout with a 400 error.
--
-- Sales history is still preserved because we:
-- - backfill seller_id for existing rows, and
-- - keep order_items rows when products are deleted (ON DELETE SET NULL on product_id).
--
-- IMPORTANT:
-- For best accuracy going forward, ensure the frontend sends seller_id for each cart item.
ALTER TABLE public.order_items
ALTER COLUMN seller_id DROP NOT NULL;

-- 4) Add FK to sellers (do NOT cascade; keep history)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'order_items_seller_id_fkey'
  ) THEN
    ALTER TABLE public.order_items
    ADD CONSTRAINT order_items_seller_id_fkey
    FOREIGN KEY (seller_id)
    REFERENCES public.sellers(id)
    ON DELETE SET NULL;
  END IF;
END $$;

-- 5) Change order_items.product_id FK behavior so deleting a product does NOT delete order_items
--    We drop and recreate the FK as ON DELETE SET NULL.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'order_items_product_id_fkey'
  ) THEN
    ALTER TABLE public.order_items DROP CONSTRAINT order_items_product_id_fkey;
  END IF;
END $$;

-- product_id must be nullable to allow ON DELETE SET NULL
ALTER TABLE public.order_items
ALTER COLUMN product_id DROP NOT NULL;

ALTER TABLE public.order_items
ADD CONSTRAINT order_items_product_id_fkey
FOREIGN KEY (product_id)
REFERENCES public.products(id)
ON DELETE SET NULL;

-- Helpful index for seller dashboards
CREATE INDEX IF NOT EXISTS idx_order_items_seller_id ON public.order_items(seller_id);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON public.order_items(order_id);

-- 6) Optional: a view that returns sales totals per seller.
--    Profit rule here: include all non-cancelled orders. If you only want DELIVERED, change filter to status='delivered'.
CREATE OR REPLACE VIEW public.seller_sales_summary AS
SELECT
  oi.seller_id,
  COUNT(DISTINCT o.id) FILTER (WHERE o.status <> 'cancelled') AS orders_count,
  COALESCE(SUM(o.total) FILTER (WHERE o.status <> 'cancelled'), 0) AS gross_sales
FROM public.order_items oi
JOIN public.orders o ON o.id = oi.order_id
GROUP BY oi.seller_id;

COMMIT;
