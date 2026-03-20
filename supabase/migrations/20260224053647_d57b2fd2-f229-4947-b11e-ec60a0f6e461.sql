
CREATE OR REPLACE FUNCTION public.admin_clear_all_notifications()
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  DELETE FROM public.user_notifications;
  DELETE FROM public.notifications;
END;
$$;
