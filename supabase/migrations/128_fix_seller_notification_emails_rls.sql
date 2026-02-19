-- Fix RLS policy for seller_notification_emails to work with session-based authentication
-- The application authenticates sellers via session storage, not Supabase Auth.
-- We need to adjust the RLS policy to work with the application's authentication flow.

-- Drop the existing policy
DROP POLICY IF EXISTS "Sellers can manage their notification emails" ON public.seller_notification_emails;

-- Create a function that can be used to manage seller notification emails
-- This function will be called from the application layer with proper seller validation
CREATE OR REPLACE FUNCTION public.add_seller_notification_email(
    p_seller_id UUID,
    p_email TEXT,
    p_is_primary BOOLEAN DEFAULT FALSE
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER -- Runs with elevated privileges
AS $$
DECLARE
    seller_count INTEGER;
BEGIN
    -- Validate input
    IF p_email IS NULL OR LENGTH(TRIM(p_email)) = 0 THEN
        RAISE EXCEPTION 'Email cannot be empty';
    END IF;
    
    -- Validate email format
    IF p_email !~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' THEN
        RAISE EXCEPTION 'Invalid email format';
    END IF;
    
    -- Check if seller exists
    SELECT COUNT(*) INTO seller_count FROM sellers WHERE id = p_seller_id;
    IF seller_count = 0 THEN
        RAISE EXCEPTION 'Seller does not exist';
    END IF;
    
    -- If setting as primary, unset other primary emails for this seller
    IF p_is_primary THEN
        UPDATE seller_notification_emails 
        SET is_primary = FALSE 
        WHERE seller_id = p_seller_id AND is_primary = TRUE;
    ELSE
        -- If no primary email exists and we're not setting this as primary, 
        -- and there are no other emails, make this one primary
        IF NOT EXISTS (SELECT 1 FROM seller_notification_emails WHERE seller_id = p_seller_id) THEN
            p_is_primary := TRUE;
        END IF;
    END IF;
    
    -- Insert the new email
    INSERT INTO seller_notification_emails (seller_id, email, is_primary)
    VALUES (p_seller_id, LOWER(TRIM(p_email)), p_is_primary);
END;
$$;

CREATE OR REPLACE FUNCTION public.update_seller_notification_email(
    p_id UUID,
    p_email TEXT,
    p_is_primary BOOLEAN
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    current_seller_id UUID;
    seller_count INTEGER;
BEGIN
    -- Get the seller_id for the email being updated
    SELECT seller_id INTO current_seller_id FROM seller_notification_emails WHERE id = p_id;
    
    IF current_seller_id IS NULL THEN
        RAISE EXCEPTION 'Email record not found';
    END IF;
    
    -- Validate input
    IF p_email IS NULL OR LENGTH(TRIM(p_email)) = 0 THEN
        RAISE EXCEPTION 'Email cannot be empty';
    END IF;
    
    -- Validate email format
    IF p_email !~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$' THEN
        RAISE EXCEPTION 'Invalid email format';
    END IF;
    
    -- Check if seller exists
    SELECT COUNT(*) INTO seller_count FROM sellers WHERE id = current_seller_id;
    IF seller_count = 0 THEN
        RAISE EXCEPTION 'Seller does not exist';
    END IF;
    
    -- If setting as primary, unset other primary emails for this seller
    IF p_is_primary THEN
        UPDATE seller_notification_emails 
        SET is_primary = FALSE 
        WHERE seller_id = current_seller_id AND id != p_id AND is_primary = TRUE;
    END IF;
    
    -- Update the email
    UPDATE seller_notification_emails 
    SET email = LOWER(TRIM(p_email)), is_primary = p_is_primary
    WHERE id = p_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_seller_notification_email(p_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    current_seller_id UUID;
BEGIN
    -- Get the seller_id for the email being deleted
    SELECT seller_id INTO current_seller_id FROM seller_notification_emails WHERE id = p_id;
    
    IF current_seller_id IS NULL THEN
        RAISE EXCEPTION 'Email record not found';
    END IF;
    
    -- Delete the email
    DELETE FROM seller_notification_emails WHERE id = p_id;
END;
$$;

-- Grant permissions to use these functions
GRANT EXECUTE ON FUNCTION public.add_seller_notification_email(UUID, TEXT, BOOLEAN) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.update_seller_notification_email(UUID, TEXT, BOOLEAN) TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.delete_seller_notification_email(UUID) TO authenticated, anon;

-- Update the component to use these functions instead of direct table access
-- The RLS policy will remain restrictive, but these functions can operate with elevated privileges