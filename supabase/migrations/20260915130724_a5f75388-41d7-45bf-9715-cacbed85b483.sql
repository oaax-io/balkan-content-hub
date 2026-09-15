ALTER TABLE public.reservations
  ADD COLUMN IF NOT EXISTS fee_charge_kind text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS fee_retry_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS fee_retry_attempts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS fee_retry_next_at timestamptz,
  ADD COLUMN IF NOT EXISTS fee_retry_last_error text;

CREATE INDEX IF NOT EXISTS reservations_fee_retry_idx
  ON public.reservations (fee_retry_next_at)
  WHERE fee_retry_enabled = true;