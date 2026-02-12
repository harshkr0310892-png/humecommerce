-- Add missing columns to orders table for address and payment information

-- Add state column
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS customer_state TEXT;

-- Add pincode column
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS customer_pincode TEXT;

-- Add landmark columns
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS customer_landmark1 TEXT;

ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS customer_landmark2 TEXT;

ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS customer_landmark3 TEXT;

-- Add payment_method column with default value 'online'
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'online' NOT NULL;

-- Update the orders_status_check constraint to include failed status if needed
-- (keeping existing constraint as is since we found it in migration 37)