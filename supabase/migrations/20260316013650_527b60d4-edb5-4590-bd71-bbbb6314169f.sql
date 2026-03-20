
CREATE TABLE public.delay_share_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  token uuid NOT NULL DEFAULT gen_random_uuid(),
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(token)
);

ALTER TABLE public.delay_share_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage share links"
  ON public.delay_share_links
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'))
  WITH CHECK (has_role(auth.uid(), 'admin'));
