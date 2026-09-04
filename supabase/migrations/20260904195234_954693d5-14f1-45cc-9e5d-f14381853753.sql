CREATE TABLE IF NOT EXISTS public.mail_log (
  id uuid primary key default gen_random_uuid(),
  recipient text not null,
  subject text not null default '',
  template_key text not null default '',
  status text not null default 'sent',
  error_message text,
  reservation_id uuid,
  created_at timestamptz not null default now()
);
GRANT SELECT ON public.mail_log TO authenticated;
GRANT ALL ON public.mail_log TO service_role;
ALTER TABLE public.mail_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read mail log" ON public.mail_log FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE INDEX IF NOT EXISTS mail_log_created_at_idx ON public.mail_log (created_at DESC);