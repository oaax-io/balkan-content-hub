
CREATE TABLE public.vouchers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  voucher_code TEXT NOT NULL UNIQUE,
  amount_chf NUMERIC(10,2) NOT NULL CHECK (amount_chf > 0),
  recipient_first_name TEXT NOT NULL,
  recipient_last_name TEXT NOT NULL,
  personal_message TEXT,
  buyer_name TEXT NOT NULL,
  buyer_email TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','paid','redeemed','cancelled')),
  stripe_session_id TEXT UNIQUE,
  stripe_payment_intent_id TEXT,
  issued_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  redeemed_at TIMESTAMPTZ,
  redeemed_note TEXT,
  internal_note TEXT,
  pdf_path TEXT,
  email_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_vouchers_status ON public.vouchers(status);
CREATE INDEX idx_vouchers_code ON public.vouchers(voucher_code);
CREATE INDEX idx_vouchers_session ON public.vouchers(stripe_session_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.vouchers TO authenticated;
GRANT ALL ON public.vouchers TO service_role;

ALTER TABLE public.vouchers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all vouchers"
  ON public.vouchers FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update vouchers"
  ON public.vouchers FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can insert vouchers"
  ON public.vouchers FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete vouchers"
  ON public.vouchers FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_vouchers_updated_at
  BEFORE UPDATE ON public.vouchers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Site-Content: zusätzliche Voucher-Texte (Fusszeile PDF, Bedingungen)
INSERT INTO public.site_content (key, value)
VALUES 
  ('voucher_pdf_footer', 'Einlösbar für alle Speisen und Getränke im Restaurant Balkaneros. Nicht in bar auszahlbar. Restbeträge werden gutgeschrieben.'),
  ('voucher_pdf_terms', 'Gültig 2 Jahre ab Ausstellungsdatum. Verlust wird nicht ersetzt.')
ON CONFLICT (key) DO NOTHING;
