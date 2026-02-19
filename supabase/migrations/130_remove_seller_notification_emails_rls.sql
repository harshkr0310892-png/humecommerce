-- Remove RLS policy from seller_notification_emails table to allow direct access
-- This fixes the "new row violates row-level security policy" error

-- Disable Row Level Security for the table
ALTER TABLE public.seller_notification_emails DISABLE ROW LEVEL SECURITY;

-- Drop the existing policy
DROP POLICY IF EXISTS "Sellers can manage their notification emails" ON public.seller_notification_emails;

-- Grant all permissions to authenticated users
GRANT ALL ON public.seller_notification_emails TO authenticated;
GRANT USAGE ON SCHEMA public TO authenticated;