
-- Create notifications table
CREATE TABLE public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  titulo TEXT NOT NULL,
  mensagem TEXT NOT NULL,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Admins can insert notifications
CREATE POLICY "Admins can insert notifications"
ON public.notifications
FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- All authenticated users can view notifications
CREATE POLICY "Users can view notifications"
ON public.notifications
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Admins can delete notifications
CREATE POLICY "Admins can delete notifications"
ON public.notifications
FOR DELETE
USING (public.has_role(auth.uid(), 'admin'));

-- Create user_notifications table to track read status per user
CREATE TABLE public.user_notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  notification_id UUID NOT NULL REFERENCES public.notifications(id) ON DELETE CASCADE,
  lida BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, notification_id)
);

-- Enable RLS
ALTER TABLE public.user_notifications ENABLE ROW LEVEL SECURITY;

-- Users can view their own notification status
CREATE POLICY "Users can view own notification status"
ON public.user_notifications
FOR SELECT
USING (auth.uid() = user_id);

-- Users can insert their own notification status
CREATE POLICY "Users can insert own notification status"
ON public.user_notifications
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can update their own notification status (mark as read)
CREATE POLICY "Users can update own notification status"
ON public.user_notifications
FOR UPDATE
USING (auth.uid() = user_id);
