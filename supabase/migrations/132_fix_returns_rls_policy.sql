-- Fix RLS policy on returns table that might be causing insertion issues
-- The returns table may have RLS policies that prevent inserting return requests

-- Fix overly restrictive RLS policies on the returns table
-- The returns table should allow customers to insert returns for their own orders
-- that meet the eligibility criteria

-- Drop existing policies that may be too restrictive
DROP POLICY IF EXISTS "Customers can insert own returns" ON public.returns;

-- Create a more appropriate policy that allows customers to insert returns for their own orders
-- The actual eligibility checks should happen in the trigger function, not in RLS
CREATE POLICY "Customers can insert own returns" ON public.returns
FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() IN (
    SELECT user_id FROM public.orders o 
    WHERE o.id = returns.order_id
  )
);

-- Policy for customers to update their own returns (only to add images or cancel before processing)
DROP POLICY IF EXISTS "Customers can update own returns" ON public.returns;
CREATE POLICY "Customers can update own returns" ON public.returns
FOR UPDATE TO authenticated
USING (
  auth.uid() IN (
    SELECT user_id FROM public.orders o 
    WHERE o.id = returns.order_id
  )
)
WITH CHECK (
  auth.uid() IN (
    SELECT user_id FROM public.orders o 
    WHERE o.id = returns.order_id
  )
  AND returns.return_status = 'requested'  -- Only allow updates when still in requested status
);

-- Policy for customers to view their own returns
DROP POLICY IF EXISTS "Customers can view own returns" ON public.returns;
CREATE POLICY "Customers can view own returns" ON public.returns
FOR SELECT TO authenticated
USING (
  auth.uid() IN (
    SELECT user_id FROM public.orders o 
    WHERE o.id = returns.order_id
  )
);

-- Grant necessary permissions
GRANT ALL ON public.returns TO authenticated;
GRANT USAGE ON SCHEMA public TO authenticated;