
CREATE TABLE public.email_settings (
  id INT PRIMARY KEY DEFAULT 1,
  provider TEXT NOT NULL DEFAULT 'lovable',
  smtp_host TEXT,
  smtp_port INT,
  smtp_secure BOOLEAN NOT NULL DEFAULT true,
  smtp_username TEXT,
  smtp_password TEXT,
  from_email TEXT,
  from_name TEXT,
  reply_to TEXT,
  enabled BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT single_row CHECK (id = 1)
);

INSERT INTO public.email_settings (id) VALUES (1) ON CONFLICT DO NOTHING;

GRANT SELECT, INSERT, UPDATE ON public.email_settings TO authenticated;
GRANT ALL ON public.email_settings TO service_role;

ALTER TABLE public.email_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can read email settings"
  ON public.email_settings FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update email settings"
  ON public.email_settings FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER email_settings_updated_at
  BEFORE UPDATE ON public.email_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
