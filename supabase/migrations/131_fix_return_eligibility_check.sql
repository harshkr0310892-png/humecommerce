-- Fix return eligibility check to calculate 7-day window from delivery date, not order creation date
-- Previously it was checking from order creation date, but it should check from when order was delivered

-- Update the function to check from delivery date (when status became 'delivered')
CREATE OR REPLACE FUNCTION check_return_eligibility()
RETURNS TRIGGER 
LANGUAGE plpgsql
AS $$
DECLARE
    order_status TEXT;
    order_delivered_at TIMESTAMP WITH TIME ZONE;
BEGIN
    -- Get the order status and the time when it was delivered
    -- We'll get the status from the orders table
    SELECT status INTO order_status
    FROM orders 
    WHERE id = NEW.order_id;
    
    -- Check if order status is delivered
    IF order_status != 'delivered' THEN
        RAISE EXCEPTION 'Return can only be requested for delivered orders';
    END IF;
    
    -- Get the exact time when the order was marked as delivered
    -- Look for the order's updated_at timestamp which should correspond to delivery
    SELECT updated_at INTO order_delivered_at
    FROM orders 
    WHERE id = NEW.order_id;
    
    -- If we couldn't get the delivered time, fall back to created_at
    IF order_delivered_at IS NULL THEN
        SELECT created_at INTO order_delivered_at
        FROM orders 
        WHERE id = NEW.order_id;
    END IF;
    
    -- Check if order was delivered within 7-day return window
    -- Using the delivery date (updated_at) instead of creation date
    IF order_delivered_at < NOW() - INTERVAL '7 days' THEN
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

-- Also update the update function to use delivery date
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