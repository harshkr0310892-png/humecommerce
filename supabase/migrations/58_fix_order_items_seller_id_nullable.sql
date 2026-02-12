-- 58_fix_order_items_seller_id_nullable.sql
-- Fix checkout failing with 400 on insert into order_items.
-- Root cause: order_items.seller_id may have been set NOT NULL by a previous migration run,
-- but the frontend may insert NULL seller_id.

BEGIN;

ALTER TABLE public.order_items
ALTER COLUMN seller_id DROP NOT NULL;

COMMIT;
