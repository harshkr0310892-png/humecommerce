-- Add return-related columns to orders table and create returns table

-- Add return status and related columns to orders table
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS return_status TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS return_reason TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS return_request_date TIMESTAMP WITH TIME ZONE DEFAULT NULL,
ADD COLUMN IF NOT EXISTS return_processed_date TIMESTAMP WITH TIME ZONE DEFAULT NULL,
ADD COLUMN IF NOT EXISTS return_refund_amount DECIMAL(10,2) DEFAULT NULL;

-- Create returns table to track return requests
CREATE TABLE IF NOT EXISTS public.returns (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE NOT NULL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  customer_address TEXT NOT NULL,
  return_reason TEXT NOT NULL,
  return_status TEXT DEFAULT 'requested' CHECK (return_status IN ('requested', 'approved', 'rejected', 'refunded', 'cancelled')),
  requested_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  processed_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  refund_amount DECIMAL(10,2) DEFAULT NULL,
  admin_notes TEXT DEFAULT NULL
);

-- Enable RLS on returns table
ALTER TABLE public.returns ENABLE ROW LEVEL SECURITY;

-- Policies for returns table
-- Customers can view their own returns
CREATE POLICY "Customers can view own returns" ON public.returns
FOR SELECT USING (
  auth.uid() IN (
    SELECT user_id FROM public.orders o 
    WHERE o.id = returns.order_id
  )
);

-- Customers can insert their own returns (only if they own the order)
CREATE POLICY "Customers can insert own returns" ON public.returns
FOR INSERT WITH CHECK (
  auth.uid() IN (
    SELECT user_id FROM public.orders o 
    WHERE o.id = returns.order_id AND o.status = 'delivered'
  )
);

-- Customers can update their own returns (only status from requested to cancelled)
CREATE POLICY "Customers can update own returns" ON public.returns
FOR UPDATE USING (
  auth.uid() IN (
    SELECT user_id FROM public.orders o 
    WHERE o.id = returns.order_id
  )
) WITH CHECK (
  return_status = 'cancelled' AND returns.return_status = 'requested'
);

-- Admin can manage all returns
CREATE POLICY "Admin can manage all returns" ON public.returns
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur 
    WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
  )
);