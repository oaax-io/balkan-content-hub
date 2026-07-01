ALTER TABLE public.reservations
  ADD COLUMN IF NOT EXISTS stripe_customer_id text,
  ADD COLUMN IF NOT EXISTS stripe_payment_method_id text,
  ADD COLUMN IF NOT EXISTS stripe_setup_intent_id text,
  ADD COLUMN IF NOT EXISTS cancellation_fee_amount integer NOT NULL DEFAULT 5000,
  ADD COLUMN IF NOT EXISTS cancellation_fee_currency text NOT NULL DEFAULT 'chf',
  ADD COLUMN IF NOT EXISTS cancellation_fee_charged_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancellation_fee_payment_intent_id text,
  ADD COLUMN IF NOT EXISTS cancellation_fee_charge_status text,
  ADD COLUMN IF NOT EXISTS cancellation_terms_accepted boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS cancellation_terms_accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS is_paid_occasion boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancellation_reason text;