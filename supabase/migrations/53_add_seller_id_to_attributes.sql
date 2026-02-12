-- Add seller_id to attribute tables
ALTER TABLE public.product_attributes
ADD COLUMN IF NOT EXISTS seller_id uuid REFERENCES public.sellers(id) ON DELETE CASCADE;

ALTER TABLE public.product_attribute_values
ADD COLUMN IF NOT EXISTS seller_id uuid REFERENCES public.sellers(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_product_attributes_seller_id ON public.product_attributes(seller_id);
CREATE INDEX IF NOT EXISTS idx_product_attribute_values_seller_id ON public.product_attribute_values(seller_id);

