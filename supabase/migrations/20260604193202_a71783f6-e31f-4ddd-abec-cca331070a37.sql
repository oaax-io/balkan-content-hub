
INSERT INTO public.site_content (key, value, label, kind, sort_order) VALUES
  ('about_subtitle', 'Seit 2019 sind wir in diversen Locations in der Schweiz mit unserem Balkaneros Dinner unterwegs', 'Über uns – Untertitel (Hero)', 'text', 0),
  ('about_hero_image', '', 'Über uns – Hero-Bild', 'image', 0),
  ('host_name', 'Nena Spadea', 'Gastgeberin – Name', 'text', 0)
ON CONFLICT (key) DO NOTHING;

UPDATE public.site_content SET value = 'Ein paar Worte über uns' WHERE key = 'about_title';
UPDATE public.site_content SET value = 'Balkaneros?' WHERE key = 'about_eyebrow';
UPDATE public.site_content SET value = 'Balkaneros steht für echte Balkanherzlichkeit, traditionelle Spezialitäten und unvergessliche Abende in besonderem Ambiente. Inspiriert von den vielfältigen Küchen Südosteuropas bringen wir klassische Balkanrezepte in einer modernen, stilvollen Fine-Dining-Interpretation auf den Tisch.

Dabei geht es uns nicht nur ums Essen, sondern um Emotionen, Erinnerungen und das Gefühl von Gemeinschaft – wie bei einem grossen Familienfest. Mit viel Liebe zum Detail, regionalen Zutaten und kulturellen Einflüssen schaffen wir in Luzern ein Genusserlebnis, das Tradition und Moderne auf besondere Weise verbindet.' WHERE key = 'about_text';

UPDATE public.site_content SET value = 'Gastgeberin' WHERE key = 'host_eyebrow';
UPDATE public.site_content SET value = 'Nena Spadea' WHERE key = 'host_title';
UPDATE public.site_content SET value = 'Mit Nena Spadea als Gastgeberin erhält Balkaneros eine persönliche, herzliche und leidenschaftliche Handschrift. Ihre grosse Liebe zur Balkanküche und ihr Gespür für Genuss machen jeden Anlass zu einem besonderen Erlebnis. Mit dem Wunsch, traditionelle Rezepte aus dem Balkan neu zu interpretieren, bringt sie vertraute Aromen auf eine moderne und stilvolle Art auf den Tisch.' WHERE key = 'host_text';
