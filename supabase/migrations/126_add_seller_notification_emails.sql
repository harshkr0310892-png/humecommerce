-- Create seller_notification_emails table to store seller email addresses for notifications
CREATE TABLE IF NOT EXISTS public.seller_notification_emails (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    seller_id uuid NOT NULL REFERENCES public.sellers(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    is_primary BOOLEAN DEFAULT FALSE,
    created_at timestamptz DEFAULT now() NOT NULL,
    updated_at timestamptz DEFAULT now() NOT NULL
);

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS seller_notification_emails_seller_id_idx ON public.seller_notification_emails(seller_id);
CREATE INDEX IF NOT EXISTS seller_notification_emails_email_idx ON public.seller_notification_emails(email);

-- Enable Row Level Security
ALTER TABLE public.seller_notification_emails ENABLE ROW LEVEL SECURITY;

-- Create policies to allow sellers to manage their own notification emails
DROP POLICY IF EXISTS "Sellers can manage their notification emails" ON public.seller_notification_emails;
CREATE POLICY "Sellers can manage their notification emails" ON public.seller_notification_emails
    FOR ALL USING (
        auth.role() = 'authenticated' AND 
        (
            -- Allow if the seller_id matches the authenticated user's email in the sellers table
            seller_id IN (
                SELECT id FROM public.sellers 
                WHERE email = auth.jwt() ->> 'email'
            )
            OR 
            -- Allow for service role (for admin operations)
            auth.role() = 'service_role'
        )
    )
    WITH CHECK (
        auth.role() = 'authenticated' AND 
        (
            -- Allow if the seller_id matches the authenticated user's email in the sellers table
            seller_id IN (
                SELECT id FROM public.sellers 
                WHERE email = auth.jwt() ->> 'email'
            )
            OR 
            -- Allow for service role (for admin operations)
            auth.role() = 'service_role'
        )
    );

-- Create trigger to update the updated_at column
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_seller_notification_emails_updated_at
    BEFORE UPDATE ON public.seller_notification_emails
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Ensure there's only one primary email per seller
CREATE UNIQUE INDEX IF NOT EXISTS seller_notification_emails_primary_per_seller_idx 
ON public.seller_notification_emails(seller_id) 
WHERE is_primary = true;