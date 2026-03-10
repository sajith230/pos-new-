
-- Drop the overly permissive policy and replace with service_role scoped one
DROP POLICY "System can insert notifications" ON public.notifications;

-- Triggers with SECURITY DEFINER bypass RLS anyway, so no extra policy needed.
-- The existing "Admins/Managers can insert notifications" policy covers manual inserts.
