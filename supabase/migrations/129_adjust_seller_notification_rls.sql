-- Adjust RLS policy to work with the application's authentication system
-- Since sellers authenticate via session storage rather than Supabase Auth,
-- we need to make the policy more permissive for authenticated users
-- while still maintaining security

-- The policy should allow users to access records related to their seller ID
-- Since the application stores the seller ID in session storage, we need to 
-- handle this via service role operations from the frontend

-- First, drop the existing policy
DROP POLICY IF EXISTS "Sellers can manage their notification emails" ON public.seller_notification_emails;

-- Create a new policy that allows access based on seller_id matching
-- Since sellers don't use Supabase Auth directly, we'll make the policy 
-- allow access based on the row-level data
CREATE POLICY "Sellers can manage their notification emails" ON public.seller_notification_emails
    FOR ALL USING (
        -- Allow service role for backend operations
        auth.role() = 'service_role'
        OR
        -- For direct table access, allow if seller_id matches a valid seller
        -- This is a simplified check - in production you'd want to validate
        -- the user is authenticated as the seller via other means
        EXISTS (
            SELECT 1 FROM sellers 
            WHERE id = seller_notification_emails.seller_id
            AND email = auth.jwt() ->> 'email'
        )
    )
    WITH CHECK (
        -- Same condition for write operations
        auth.role() = 'service_role'
        OR
        EXISTS (
            SELECT 1 FROM sellers 
            WHERE id = seller_notification_emails.seller_id
            AND email = auth.jwt() ->> 'email'
        )
    );

-- Also grant direct table access to authenticated roles as an alternative approach
-- This allows the application to manage the access control logic in the frontend
GRANT ALL ON public.seller_notification_emails TO authenticated;
GRANT USAGE ON SCHEMA public TO authenticated;