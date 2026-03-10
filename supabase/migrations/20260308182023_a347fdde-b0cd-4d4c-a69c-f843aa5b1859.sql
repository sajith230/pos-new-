
-- Create notifications table
CREATE TABLE public.notifications (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id uuid NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  user_id uuid NULL,
  title text NOT NULL,
  message text NOT NULL,
  type text NOT NULL DEFAULT 'info',
  category text NULL,
  is_read boolean NOT NULL DEFAULT false,
  reference_id uuid NULL,
  reference_type text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Users can view notifications for their business (targeted to them or broadcast)
CREATE POLICY "Users can view own notifications"
ON public.notifications FOR SELECT TO authenticated
USING (
  business_id = get_user_business_id(auth.uid())
  AND (user_id = auth.uid() OR user_id IS NULL)
);

-- Users can mark their notifications as read
CREATE POLICY "Users can update own notifications"
ON public.notifications FOR UPDATE TO authenticated
USING (
  business_id = get_user_business_id(auth.uid())
  AND (user_id = auth.uid() OR user_id IS NULL)
)
WITH CHECK (
  business_id = get_user_business_id(auth.uid())
  AND (user_id = auth.uid() OR user_id IS NULL)
);

-- Admins/managers can insert notifications
CREATE POLICY "Admins/Managers can insert notifications"
ON public.notifications FOR INSERT TO authenticated
WITH CHECK (
  business_id = get_user_business_id(auth.uid())
  AND (is_admin(auth.uid()) OR has_role(auth.uid(), 'manager'))
);

-- Allow trigger functions (SECURITY DEFINER) to insert via a permissive policy
CREATE POLICY "System can insert notifications"
ON public.notifications FOR INSERT
WITH CHECK (true);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- Trigger function: notify on low stock
CREATE OR REPLACE FUNCTION public.notify_low_stock()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _product_name text;
  _min_stock integer;
  _business_id uuid;
BEGIN
  SELECT p.name, p.min_stock, p.business_id
  INTO _product_name, _min_stock, _business_id
  FROM products p
  WHERE p.id = NEW.product_id AND p.track_inventory = true;

  IF FOUND AND _min_stock IS NOT NULL AND NEW.quantity <= _min_stock THEN
    INSERT INTO notifications (business_id, title, message, type, category, reference_id, reference_type)
    VALUES (
      _business_id,
      'Low Stock Alert',
      _product_name || ' is low on stock (' || NEW.quantity || ' remaining, min: ' || _min_stock || ')',
      'warning',
      'low_stock',
      NEW.product_id,
      'product'
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_inventory_low_stock
AFTER INSERT OR UPDATE OF quantity ON public.inventory
FOR EACH ROW
EXECUTE FUNCTION public.notify_low_stock();

-- Trigger function: notify on new order
CREATE OR REPLACE FUNCTION public.notify_new_order()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO notifications (business_id, title, message, type, category, reference_id, reference_type)
  VALUES (
    NEW.business_id,
    'New Order',
    'Order #' || NEW.order_number || ' (' || NEW.order_type || ') has been placed',
    'info',
    'new_order',
    NEW.id,
    'order'
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_new_order
AFTER INSERT ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.notify_new_order();
