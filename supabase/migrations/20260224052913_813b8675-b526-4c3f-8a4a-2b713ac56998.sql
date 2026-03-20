
-- Add target_user_id column (null = all users, specific uuid = individual user)
ALTER TABLE public.notifications ADD COLUMN target_user_id uuid DEFAULT NULL;
