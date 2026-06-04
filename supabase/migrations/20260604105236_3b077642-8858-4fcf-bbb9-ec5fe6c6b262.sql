
-- Roles
CREATE TYPE public.app_role AS ENUM ('admin');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "Users read own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Updated-at helper
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- Site content (key/value, holds texts and image urls)
CREATE TABLE public.site_content (
  key text PRIMARY KEY,
  value text NOT NULL DEFAULT '',
  label text NOT NULL DEFAULT '',
  kind text NOT NULL DEFAULT 'text', -- text | textarea | image
  sort_order int NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.site_content TO anon, authenticated;
GRANT ALL ON public.site_content TO service_role;
ALTER TABLE public.site_content ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read site_content" ON public.site_content FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admin write site_content" ON public.site_content FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_site_content_updated BEFORE UPDATE ON public.site_content
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Contact info (single row)
CREATE TABLE public.contact_info (
  id int PRIMARY KEY DEFAULT 1,
  restaurant_name text NOT NULL DEFAULT 'Balkaneros',
  address_line1 text NOT NULL DEFAULT '',
  address_line2 text NOT NULL DEFAULT '',
  city text NOT NULL DEFAULT '',
  postal_code text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  notification_email text NOT NULL DEFAULT '',
  instagram_url text NOT NULL DEFAULT '',
  facebook_url text NOT NULL DEFAULT '',
  maps_embed_url text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT contact_singleton CHECK (id = 1)
);
GRANT SELECT ON public.contact_info TO anon, authenticated;
GRANT ALL ON public.contact_info TO service_role;
ALTER TABLE public.contact_info ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read contact_info" ON public.contact_info FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admin write contact_info" ON public.contact_info FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_contact_info_updated BEFORE UPDATE ON public.contact_info
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Opening hours (one row per weekday 0-6, 0=Sunday)
CREATE TABLE public.opening_hours (
  weekday smallint PRIMARY KEY CHECK (weekday BETWEEN 0 AND 6),
  label text NOT NULL,
  is_closed boolean NOT NULL DEFAULT false,
  open_time text NOT NULL DEFAULT '',  -- e.g. "17:00"
  close_time text NOT NULL DEFAULT '', -- e.g. "23:00"
  note text NOT NULL DEFAULT '',
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.opening_hours TO anon, authenticated;
GRANT ALL ON public.opening_hours TO service_role;
ALTER TABLE public.opening_hours ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read opening_hours" ON public.opening_hours FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Admin write opening_hours" ON public.opening_hours FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_opening_hours_updated BEFORE UPDATE ON public.opening_hours
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Reservations
CREATE TYPE public.reservation_status AS ENUM ('pending','confirmed','declined','cancelled');

CREATE TABLE public.reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_name text NOT NULL,
  guest_email text NOT NULL,
  guest_phone text NOT NULL DEFAULT '',
  party_size int NOT NULL CHECK (party_size BETWEEN 1 AND 50),
  reservation_date date NOT NULL,
  reservation_time text NOT NULL, -- "19:30"
  notes text NOT NULL DEFAULT '',
  status public.reservation_status NOT NULL DEFAULT 'pending',
  admin_note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT INSERT ON public.reservations TO anon, authenticated;
GRANT SELECT, UPDATE, DELETE ON public.reservations TO authenticated;
GRANT ALL ON public.reservations TO service_role;
ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;
-- Anyone can create a reservation request
CREATE POLICY "Anyone can insert reservation" ON public.reservations FOR INSERT TO anon, authenticated WITH CHECK (true);
-- Only admin can read/update
CREATE POLICY "Admin read reservations" ON public.reservations FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin update reservations" ON public.reservations FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin delete reservations" ON public.reservations FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE TRIGGER trg_reservations_updated BEFORE UPDATE ON public.reservations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_reservations_date ON public.reservations(reservation_date DESC, created_at DESC);
CREATE INDEX idx_reservations_status ON public.reservations(status);

-- Seed site content
INSERT INTO public.site_content (key, label, value, kind, sort_order) VALUES
  ('hero_eyebrow', 'Hero · kleiner Gruß (oben)', 'Dobro večer!', 'text', 10),
  ('hero_title', 'Hero · Titel', 'Köstlichkeiten aus dem Herzen des Balkans', 'textarea', 20),
  ('hero_subtitle', 'Hero · Untertitel', 'Dein exklusives Erlebnis bei uns in AMAYA Rothenburg.', 'textarea', 30),
  ('hero_cta_label', 'Hero · Button-Text', 'Tisch reservieren', 'text', 40),
  ('hero_image', 'Hero · Hintergrundbild (URL)', '', 'image', 50),
  ('intro_eyebrow', 'Intro · Gruß', 'Dobro došli und herzlich willkommen', 'text', 110),
  ('intro_title', 'Intro · Titel', 'Mit Liebe gekocht, mit Stil präsentiert', 'textarea', 120),
  ('intro_text', 'Intro · Text', 'Bei Balkaneros verbinden wir traditionelle Balkan-Küche mit einem warmen, modernen Erlebnis. Hausgemacht, herzhaft, ehrlich.', 'textarea', 130),
  ('intro_image', 'Intro · Bild (URL)', '', 'image', 140),
  ('about_title', 'Über uns · Titel', 'Unsere Geschichte', 'text', 210),
  ('about_text', 'Über uns · Story', 'Balkaneros ist mehr als ein Restaurant — es ist eine Hommage an die Aromen, Düfte und Rituale unserer Heimat. Jede Speise wird mit Sorgfalt zubereitet und mit Stolz serviert.', 'textarea', 220),
  ('about_image', 'Über uns · Bild (URL)', '', 'image', 230),
  ('gallery_1', 'Galerie · Bild 1 (URL)', '', 'image', 310),
  ('gallery_2', 'Galerie · Bild 2 (URL)', '', 'image', 320),
  ('gallery_3', 'Galerie · Bild 3 (URL)', '', 'image', 330);

-- Seed contact info
INSERT INTO public.contact_info (id, restaurant_name, address_line1, city, postal_code, phone, email, notification_email)
VALUES (1, 'Balkaneros @ AMAYA', 'Stationsstrasse 14', 'Rothenburg', '6023', '+41 00 000 00 00', 'info@balkaneros.ch', 'info@balkaneros.ch');

-- Seed opening hours
INSERT INTO public.opening_hours (weekday, label, is_closed, open_time, close_time) VALUES
  (1, 'Montag', true, '', ''),
  (2, 'Dienstag', true, '', ''),
  (3, 'Mittwoch', false, '17:00', '23:00'),
  (4, 'Donnerstag', false, '17:00', '23:00'),
  (5, 'Freitag', false, '17:00', '00:00'),
  (6, 'Samstag', false, '17:00', '00:00'),
  (0, 'Sonntag', false, '11:00', '15:00');

-- Storage policies for public bucket 'site-images' (bucket created via tool separately)
CREATE POLICY "Public read site-images" ON storage.objects FOR SELECT TO anon, authenticated USING (bucket_id = 'site-images');
CREATE POLICY "Admin upload site-images" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'site-images' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin update site-images" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'site-images' AND public.has_role(auth.uid(), 'admin')) WITH CHECK (bucket_id = 'site-images' AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admin delete site-images" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'site-images' AND public.has_role(auth.uid(), 'admin'));
