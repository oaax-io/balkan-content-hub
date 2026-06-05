
CREATE TABLE public.occasion_capacities (
  occasion TEXT PRIMARY KEY,
  max_reservations INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.occasion_capacities TO authenticated;
GRANT ALL ON public.occasion_capacities TO service_role;

ALTER TABLE public.occasion_capacities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin manage occasion_capacities"
  ON public.occasion_capacities FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER occasion_capacities_set_updated_at
  BEFORE UPDATE ON public.occasion_capacities
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
