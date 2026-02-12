-- Add seller_id to delivery_boys and link to sellers
ALTER TABLE public.delivery_boys
ADD COLUMN IF NOT EXISTS seller_id uuid REFERENCES public.sellers(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_delivery_boys_seller_id ON public.delivery_boys(seller_id);

