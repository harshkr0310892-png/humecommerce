-- Add RLS policy to allow sellers to view returns for their products
-- Since sellers authenticate via session storage (not Supabase Auth),
-- we grant access to authenticated users and let the app filter by seller's products

-- First, check if RLS is enabled on returns table
-- If not enabled, enable it
ALTER TABLE public.returns ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to SELECT returns
-- The application will filter by seller's products
CREATE POLICY "Authenticated users can view returns" ON public.returns
FOR SELECT TO authenticated
USING (true);

-- Allow authenticated users to UPDATE returns (for status changes)
CREATE POLICY "Authenticated users can update returns" ON public.returns
FOR UPDATE TO authenticated
USING (true)
WITH CHECK (
  return_status IN ('approved', 'rejected', 'processing', 'completed', 'cancelled')
);
