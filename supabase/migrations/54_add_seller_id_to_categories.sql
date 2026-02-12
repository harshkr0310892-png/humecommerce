-- Add seller_id to categories
ALTER TABLE public.categories
ADD COLUMN IF NOT EXISTS seller_id uuid REFERENCES public.sellers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_categories_seller_id ON public.categories(seller_id);

