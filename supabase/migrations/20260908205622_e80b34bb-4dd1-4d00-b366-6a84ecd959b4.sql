ALTER TABLE public.reservations
  ADD COLUMN IF NOT EXISTS ticket_price_rappen integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ticket_total_rappen integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ticket_currency text NOT NULL DEFAULT 'chf',
  ADD COLUMN IF NOT EXISTS ticket_payment_status text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS ticket_paid_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS stripe_checkout_session_id text,
  ADD COLUMN IF NOT EXISTS stripe_payment_intent_id text;

INSERT INTO public.site_content (key, value, label, kind, sort_order)
VALUES
  ('reservation_occasion_prices', '', 'Ticketpreise pro Anlass (Anlass::CHF)', 'textarea', 60),
  ('reservation_occasion_min_guests', '', 'Mindestanzahl Gäste pro Anlass (Anlass::Anzahl)', 'textarea', 61)
ON CONFLICT (key) DO NOTHING;