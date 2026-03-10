-- Enable realtime for kot_tickets and order_items
ALTER PUBLICATION supabase_realtime ADD TABLE public.kot_tickets;
ALTER PUBLICATION supabase_realtime ADD TABLE public.order_items;

-- Add UPDATE policy for kot_tickets so kitchen staff can update them
CREATE POLICY "Staff can update KOT tickets"
ON public.kot_tickets
FOR UPDATE
TO authenticated
USING (order_id IN (SELECT orders.id FROM orders WHERE orders.business_id = get_user_business_id(auth.uid())))
WITH CHECK (order_id IN (SELECT orders.id FROM orders WHERE orders.business_id = get_user_business_id(auth.uid())));