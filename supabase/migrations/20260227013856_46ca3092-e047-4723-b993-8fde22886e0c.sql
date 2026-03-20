CREATE OR REPLACE FUNCTION public.admin_clear_all_notifications()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Verify caller is admin
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can clear all notifications';
  END IF;

  DELETE FROM public.user_notifications;
  DELETE FROM public.notifications;
END;
$$;