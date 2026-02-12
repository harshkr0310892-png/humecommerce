-- Add images field to returns table to allow image attachments for return requests

-- Add images column to returns table
ALTER TABLE public.returns 
ADD COLUMN IF NOT EXISTS images TEXT[] DEFAULT '{}';

-- Update the returns table RLS policy to allow customers to update their returns (to add images)
-- Customers can update their own returns (only status from requested to cancelled, and add images)
DROP POLICY IF EXISTS "Customers can update own returns" ON public.returns;
CREATE POLICY "Customers can update own returns" ON public.returns
FOR UPDATE USING (
  auth.uid() IN (
    SELECT user_id FROM public.orders o 
    WHERE o.id = returns.order_id
  )
) WITH CHECK (
  (return_status = 'cancelled' AND returns.return_status = 'requested') 
  OR 
  (images <@ returns.images OR array_length(images, 1) <= 6) -- Allow adding images up to 6
);

-- Update the Supabase function to handle the new images field
CREATE OR REPLACE FUNCTION check_return_eligibility()
RETURNS TRIGGER 
LANGUAGE plpgsql
AS $$
DECLARE
    order_status TEXT;
    order_created_at TIMESTAMP WITH TIME ZONE;
BEGIN
    -- Get the order status and creation date
    SELECT status, created_at INTO order_status, order_created_at
    FROM orders 
    WHERE id = NEW.order_id;
    
    -- Check if order status is delivered
    IF order_status != 'delivered' THEN
        RAISE EXCEPTION 'Return can only be requested for delivered orders';
    END IF;
    
    -- Check if order is within 7-day return window
    IF order_created_at < NOW() - INTERVAL '7 days' THEN
        RAISE EXCEPTION 'Return period has expired (7 days)';
    END IF;
    
    -- Validate image count if images are provided
    IF NEW.images IS NOT NULL AND array_length(NEW.images, 1) > 6 THEN
        RAISE EXCEPTION 'Maximum 6 images allowed for return requests';
    END IF;
    
    -- Check minimum images requirement (if images are provided)
    IF NEW.images IS NOT NULL AND array_length(NEW.images, 1) < 2 THEN
        RAISE EXCEPTION 'Minimum 2 images required for return requests';
    END IF;
    
    RETURN NEW;
END;
$$;

-- Update the trigger to use the modified function
DROP TRIGGER IF EXISTS check_return_eligibility_trigger ON public.returns;
CREATE TRIGGER check_return_eligibility_trigger
    BEFORE INSERT ON public.returns
    FOR EACH ROW
    EXECUTE FUNCTION check_return_eligibility();

-- Update the trigger for updates as well
CREATE OR REPLACE FUNCTION check_return_update_eligibility()
RETURNS TRIGGER 
LANGUAGE plpgsql
AS $$
BEGIN
    -- Validate image count if images are being updated
    IF TG_OP = 'UPDATE' AND NEW.images IS NOT NULL AND OLD.images IS DISTINCT FROM NEW.images THEN
        IF array_length(NEW.images, 1) > 6 THEN
            RAISE EXCEPTION 'Maximum 6 images allowed for return requests';
        END IF;
        
        -- Only check minimum if images are being added (not when initially creating)
        IF array_length(NEW.images, 1) < 2 AND array_length(OLD.images, 1) = 0 THEN
            RAISE EXCEPTION 'Minimum 2 images required for return requests';
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$;

-- Create update trigger
CREATE TRIGGER check_return_update_eligibility_trigger
    BEFORE UPDATE ON public.returns
    FOR EACH ROW
    EXECUTE FUNCTION check_return_update_eligibility();