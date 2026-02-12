-- Enhance return policies to enforce 7-day return window

-- Create a function to check if order is eligible for return (within 7 days)
CREATE OR REPLACE FUNCTION is_order_return_eligible(order_id_param UUID) 
RETURNS BOOLEAN 
LANGUAGE plpgsql
AS $$
DECLARE
    order_created_at TIMESTAMP WITH TIME ZONE;
BEGIN
    SELECT created_at INTO order_created_at 
    FROM orders 
    WHERE id = order_id_param;
    
    IF order_created_at IS NULL THEN
        RETURN FALSE;
    END IF;
    
    -- Check if the order was created within the last 7 days
    RETURN order_created_at >= NOW() - INTERVAL '7 days';
END;
$$;

-- Update the returns table RLS policy to enforce 7-day return window
DROP POLICY IF EXISTS "Customers can insert own returns" ON public.returns;
CREATE POLICY "Customers can insert own returns" ON public.returns
FOR INSERT WITH CHECK (
  auth.uid() IN (
    SELECT user_id FROM public.orders o 
    WHERE o.id = returns.order_id AND o.status = 'delivered'
  )
  AND is_order_return_eligible(returns.order_id)  -- Enforce 7-day return window
);

-- Create a trigger function to enforce return eligibility
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
    
    RETURN NEW;
END;
$$;

-- Create trigger to enforce return eligibility
DROP TRIGGER IF EXISTS check_return_eligibility_trigger ON public.returns;
CREATE TRIGGER check_return_eligibility_trigger
    BEFORE INSERT ON public.returns
    FOR EACH ROW
    EXECUTE FUNCTION check_return_eligibility();

-- Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_returns_order_id ON public.returns(order_id);
CREATE INDEX IF NOT EXISTS idx_returns_status ON public.returns(return_status);
CREATE INDEX IF NOT EXISTS idx_returns_requested_at ON public.returns(requested_at);
CREATE INDEX IF NOT EXISTS idx_orders_return_status ON public.orders(return_status);