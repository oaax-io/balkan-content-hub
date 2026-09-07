CREATE TABLE public.newsletter_subscribers (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL DEFAULT '',
  email text NOT NULL,
  source text NOT NULL DEFAULT 'manual',
  subscribed boolean NOT NULL DEFAULT true,
  note text NOT NULL DEFAULT '',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX newsletter_subscribers_email_key ON public.newsletter_subscribers (lower(email));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.newsletter_subscribers TO authenticated;
GRANT ALL ON public.newsletter_subscribers TO service_role;

ALTER TABLE public.newsletter_subscribers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage newsletter subscribers"
ON public.newsletter_subscribers FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER newsletter_subscribers_set_updated_at
BEFORE UPDATE ON public.newsletter_subscribers
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

INSERT INTO public.newsletter_subscribers (name, email, source)
SELECT DISTINCT ON (lower(r.guest_email)) r.guest_name, lower(r.guest_email), 'reservation'
FROM public.reservations r
WHERE r.guest_email <> '' AND r.guest_email LIKE '%@%'
ORDER BY lower(r.guest_email), r.created_at DESC;