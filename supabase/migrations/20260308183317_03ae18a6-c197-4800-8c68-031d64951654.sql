
-- Add preference columns
ALTER TABLE public.notification_preferences
  ADD COLUMN order_ready boolean NOT NULL DEFAULT true,
  ADD COLUMN order_cancelled boolean NOT NULL DEFAULT true;

-- Trigger function: notify when order status changes to 'ready'
CREATE OR REPLACE FUNCTION public.notify_order_ready()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
DECLARE
  _table_name text;
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'ready' THEN
    SELECT t.name INTO _table_name FROM tables t WHERE t.id = NEW.table_id;
    INSERT INTO notifications (business_id, title, message, type, category, reference_id, reference_type)
    VALUES (
      NEW.business_id,
      'Order Ready',
      'Order #' || NEW.order_number || COALESCE(' - ' || _table_name, '') || ' is ready to serve',
      'info',
      'order_ready',
      NEW.id,
      'order'
    );
  END IF;
  RETURN NEW;
END;
$$;

-- Trigger function: notify when order status changes to 'cancelled'
CREATE OR REPLACE FUNCTION public.notify_order_cancelled()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status AND NEW.status = 'cancelled' THEN
    INSERT INTO notifications (business_id, title, message, type, category, reference_id, reference_type)
    VALUES (
      NEW.business_id,
      'Order Cancelled',
      'Order #' || NEW.order_number || ' has been cancelled',
      'warning',
      'order_cancelled',
      NEW.id,
      'order'
    );
  END IF;
  RETURN NEW;
END;
$$;

-- Attach triggers to orders table
CREATE TRIGGER trg_notify_order_ready
  AFTER UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_order_ready();

CREATE TRIGGER trg_notify_order_cancelled
  AFTER UPDATE ON public.orders
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_order_cancelled();
