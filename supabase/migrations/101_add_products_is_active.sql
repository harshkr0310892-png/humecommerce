-- Migration: add is_active column to products if missing and activate specific product
-- Adds `is_active` boolean column (default true) to `products` and sets the target product to active.

BEGIN;

-- Add column if it doesn't exist
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;

-- Ensure the specific product is active (replace id if needed)
UPDATE public.products
SET is_active = true
WHERE id = 'a21120c0-58a5-4193-ab24-c4ab63b8f6f1';

COMMIT;
