CREATE TABLE public.seo_settings (
  path text PRIMARY KEY,
  label text NOT NULL DEFAULT '',
  title text NOT NULL DEFAULT '',
  description text NOT NULL DEFAULT '',
  og_image text NOT NULL DEFAULT '',
  sort_order integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.seo_settings TO anon, authenticated;
GRANT ALL ON public.seo_settings TO service_role;

ALTER TABLE public.seo_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read seo_settings" ON public.seo_settings FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admin write seo_settings" ON public.seo_settings FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

INSERT INTO public.seo_settings (path, label, title, description, sort_order) VALUES
  ('/', 'Startseite', 'Balkaneros — Köstlichkeiten aus dem Herzen des Balkans', 'Hausgemachte Balkan-Küche bei Balkaneros in Rothenburg. Jetzt Tisch reservieren.', 1),
  ('/brunch', 'Brunch', 'Brunch — Balkaneros', 'Hausgemachte Brunch-Köstlichkeiten aus dem Balkan – traditionell, modern und voller Geschmack.', 2),
  ('/dinner', 'Dinner', 'Dinner — Balkaneros', 'Balkaneros Dinner: moderne Balkan-Fusion-Küche mit Live-Musik, Wein und Rakija in Luzern.', 3),
  ('/events', 'Events', 'Exklusiv Events — Balkaneros', 'Geburtstag, Familienfeier oder Firmenanlass – Balkan Dinner mit Live-Musik, ausgewählten Weinen und Rakija in Luzern.', 4),
  ('/ueber-uns', 'Über uns', 'Über uns — Balkaneros', 'Seit 2019 mit dem Balkaneros Dinner in der Schweiz unterwegs. Lerne unsere Geschichte und Gastgeberin Nena Spadea kennen.', 5),
  ('/kontakt', 'Kontakt', 'Kontakt — Balkaneros', 'Adresse, Telefon und Öffnungszeiten von Balkaneros in Rothenburg.', 6),
  ('/reservieren', 'Reservieren', 'Reservieren — Balkaneros', 'Reserviere deinen Tisch bei Balkaneros.', 7);