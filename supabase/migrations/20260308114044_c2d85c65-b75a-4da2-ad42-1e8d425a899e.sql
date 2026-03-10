-- Fix audit_logs INSERT policy to be more restrictive
DROP POLICY IF EXISTS "System can create audit logs" ON public.audit_logs;

-- Only authenticated users can create audit logs (for their own actions)
CREATE POLICY "Authenticated users can create audit logs" ON public.audit_logs
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() OR user_id IS NULL);