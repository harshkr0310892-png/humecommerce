-- Create function to call seller notifier
CREATE OR REPLACE FUNCTION public.call_seller_notifier(payload jsonb)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
    url TEXT;
    headers JSONB;
    req_body JSONB;
    response_status INT;
    response_content TEXT;
BEGIN
    -- Prepare the request body
    req_body := jsonb_build_object(
        'event', payload->>'event',
        'order_id', payload->>'order_id',
        'seller_id', payload->>'seller_id',
        'message', payload->>'message',
        'timestamp', NOW()
    );

    -- Prepare headers
    headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.supabase_service_role_key', true)
    );

    -- Get the function URL from settings or use a default
    url := coalesce(current_setting('app.settings.seller_notifier_url', true), 
                   'http://localhost:54321/functions/v1/seller-notifier');

    -- Make the HTTP request
    BEGIN
        SELECT (result).status, (result).content
        INTO response_status, response_content
        FROM http((
            'POST',
            url,
            ARRAY[http_header('Content-Type', 'application/json')],
            req_body::text
        )::http_request) AS result;
        
        -- Log the response for debugging
        IF response_status != 200 THEN
            RAISE WARNING 'Seller notifier error %: %', response_status, response_content;
        END IF;
    EXCEPTION
        WHEN OTHERS THEN
            RAISE WARNING 'Failed to call seller notifier: %', SQLERRM;
    END;
END;
$$;

-- Create function to handle new orders for seller notifications
CREATE OR REPLACE FUNCTION public.on_new_order_for_seller_notification()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    seller_id_var uuid;
BEGIN
    -- Get the seller_id associated with the products in this order
    SELECT DISTINCT oi.seller_id
    INTO seller_id_var
    FROM order_items oi
    WHERE oi.order_id = NEW.id
    LIMIT 1; -- For simplicity, we'll notify the first seller if multiple
    
    -- If we found a seller, trigger the notification
    IF seller_id_var IS NOT NULL THEN
        PERFORM public.call_seller_notifier(
            jsonb_build_object(
                'event', 'new_order',
                'order_id', NEW.id,
                'seller_id', seller_id_var,
                'message', 'A new order has been placed with ID ' || NEW.order_id
            )
        );
    END IF;
    
    RETURN NEW;
END;
$$;

-- Create trigger for new orders
DROP TRIGGER IF EXISTS trg_order_inserted_seller_notify ON public.orders;
CREATE TRIGGER trg_order_inserted_seller_notify
    AFTER INSERT ON public.orders
    FOR EACH ROW
    EXECUTE FUNCTION public.on_new_order_for_seller_notification();

-- Create function to handle order status changes for seller notifications
CREATE OR REPLACE FUNCTION public.on_order_status_changed_for_seller_notification()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    seller_id_var uuid;
    order_id_var text;
BEGIN
    -- Get the order_id and seller_id associated with the products in this order
    SELECT o.order_id, oi.seller_id
    INTO order_id_var, seller_id_var
    FROM orders o
    JOIN order_items oi ON o.id = oi.order_id
    WHERE o.id = NEW.id
    LIMIT 1; -- For simplicity, we'll notify the first seller if multiple
    
    -- Send notification if order was cancelled (from any status to cancelled)
    IF OLD.status != 'cancelled' AND NEW.status = 'cancelled' AND seller_id_var IS NOT NULL THEN
        PERFORM public.call_seller_notifier(
            jsonb_build_object(
                'event', 'order_cancelled',
                'order_id', NEW.id,
                'seller_id', seller_id_var,
                'message', 'Order ' || order_id_var || ' has been cancelled'
            )
        );
    END IF;
    
    RETURN NEW;
END;
$$;

-- Create trigger for order status changes
DROP TRIGGER IF EXISTS trg_order_status_changed_seller_notify ON public.orders;
CREATE TRIGGER trg_order_status_changed_seller_notify
    AFTER UPDATE OF status ON public.orders
    FOR EACH ROW
    EXECUTE FUNCTION public.on_order_status_changed_for_seller_notification();

-- Create function to handle return requests for seller notifications
CREATE OR REPLACE FUNCTION public.on_return_request_for_seller_notification()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    seller_id_var uuid;
    order_id_var text;
BEGIN
    -- Get the public order_id from the orders table
    SELECT order_id INTO order_id_var FROM orders WHERE id = NEW.order_id;
    
    -- Get the seller_id associated with the products in this order
    SELECT DISTINCT oi.seller_id
    INTO seller_id_var
    FROM order_items oi
    WHERE oi.order_id = NEW.order_id
    LIMIT 1; -- For simplicity, we'll notify the first seller if multiple
    
    -- If we found a seller, trigger the notification
    IF seller_id_var IS NOT NULL THEN
        PERFORM public.call_seller_notifier(
            jsonb_build_object(
                'event', 'return_requested',
                'order_id', NEW.order_id,
                'seller_id', seller_id_var,
                'message', 'A return request has been made for order ' || order_id_var || '. Reason: ' || COALESCE(NEW.return_reason, 'Not specified')
            )
        );
    END IF;
    
    RETURN NEW;
END;
$$;

-- Create trigger for return requests
DROP TRIGGER IF EXISTS trg_return_request_created_seller_notify ON public.returns;
CREATE TRIGGER trg_return_request_created_seller_notify
    AFTER INSERT ON public.returns
    FOR EACH ROW
    EXECUTE FUNCTION public.on_return_request_for_seller_notification();

-- Create function to handle return status changes for seller notifications
CREATE OR REPLACE FUNCTION public.on_return_status_changed_for_seller_notification()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    seller_id_var uuid;
    order_id_var text;
BEGIN
    -- Get the public order_id from the orders table
    SELECT order_id INTO order_id_var FROM orders WHERE id = NEW.order_id;
    
    -- Get the seller_id associated with the products in this order
    SELECT DISTINCT oi.seller_id
    INTO seller_id_var
    FROM order_items oi
    WHERE oi.order_id = NEW.order_id
    LIMIT 1; -- For simplicity, we'll notify the first seller if multiple
    
    -- Send notification when return status changes
    IF seller_id_var IS NOT NULL THEN
        -- Determine the event based on status
        IF (OLD.return_status IS NULL OR OLD.return_status != 'approved') AND NEW.return_status = 'approved' THEN
            PERFORM public.call_seller_notifier(
                jsonb_build_object(
                    'event', 'return_approved',
                    'order_id', NEW.order_id,
                    'seller_id', seller_id_var,
                    'message', 'Return request for order ' || order_id_var || ' has been approved'
                )
            );
        ELSIF (OLD.return_status IS NULL OR OLD.return_status != 'rejected') AND NEW.return_status = 'rejected' THEN
            PERFORM public.call_seller_notifier(
                jsonb_build_object(
                    'event', 'return_rejected',
                    'order_id', NEW.order_id,
                    'seller_id', seller_id_var,
                    'message', 'Return request for order ' || order_id_var || ' has been rejected'
                )
            );
        ELSIF (OLD.return_status IS NULL OR OLD.return_status != 'cancelled') AND NEW.return_status = 'cancelled' THEN
            PERFORM public.call_seller_notifier(
                jsonb_build_object(
                    'event', 'return_cancelled',
                    'order_id', NEW.order_id,
                    'seller_id', seller_id_var,
                    'message', 'Return request for order ' || order_id_var || ' has been cancelled'
                )
            );
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$;

-- Create trigger for return status changes
DROP TRIGGER IF EXISTS trg_return_status_changed_seller_notify ON public.returns;
CREATE TRIGGER trg_return_status_changed_seller_notify
    AFTER UPDATE OF return_status ON public.returns
    FOR EACH ROW
    EXECUTE FUNCTION public.on_return_status_changed_for_seller_notification();

-- Function to handle HTTP requests if the http extension is not available
-- This is a fallback in case the http extension isn't enabled
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'http') THEN
        RAISE NOTICE 'HTTP extension not available, creating a dummy function for call_seller_notifier';
        DROP FUNCTION IF EXISTS public.call_seller_notifier(jsonb);
        CREATE OR REPLACE FUNCTION public.call_seller_notifier(payload jsonb)
        RETURNS void
        LANGUAGE plpgsql
        AS $func$
        BEGIN
            -- Log the call for debugging since we can't make HTTP requests
            RAISE NOTICE 'Would call seller notifier with payload: %', payload;
        END;
        $func$;
    END IF;
END $$;