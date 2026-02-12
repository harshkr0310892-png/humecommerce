-- Add seller_id to products for per-seller isolation
ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS seller_id uuid REFERENCES public.sellers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_products_seller_id ON public.products(seller_id);

