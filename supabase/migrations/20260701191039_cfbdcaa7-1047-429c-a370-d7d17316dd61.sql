ALTER TABLE public.reservations
  ADD COLUMN IF NOT EXISTS cancellation_token text UNIQUE,
  ADD COLUMN IF NOT EXISTS cancellation_token_expires_at timestamptz;

CREATE INDEX IF NOT EXISTS reservations_cancellation_token_idx
  ON public.reservations (cancellation_token);