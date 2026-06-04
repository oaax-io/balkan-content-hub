
ALTER TABLE public.reservations
  ADD COLUMN IF NOT EXISTS occasion text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS event_date_label text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS country_code text NOT NULL DEFAULT '';
