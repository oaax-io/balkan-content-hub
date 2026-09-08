ALTER TABLE public.reservations
  ADD COLUMN IF NOT EXISTS no_show_fee_amount integer NOT NULL DEFAULT 5000;