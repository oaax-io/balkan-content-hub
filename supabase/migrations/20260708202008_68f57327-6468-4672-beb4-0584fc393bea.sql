CREATE TABLE public.email_templates (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  template_key text NOT NULL,
  occasion text,
  subject text NOT NULL DEFAULT '',
  body_html text NOT NULL DEFAULT '',
  enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX email_templates_key_occasion_uidx
  ON public.email_templates (template_key, COALESCE(occasion, ''));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.email_templates TO authenticated;
GRANT ALL ON public.email_templates TO service_role;

ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage email templates"
  ON public.email_templates
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER email_templates_set_updated_at
  BEFORE UPDATE ON public.email_templates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Seed default templates (occasion = NULL). Placeholders in {curly_braces}.

INSERT INTO public.email_templates (template_key, occasion, subject, body_html) VALUES
('reservation_request', NULL,
 'Reservierungsanfrage bei {restaurant} erhalten',
 '<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;padding:24px;background:#0f0f0f;color:#f5f5f5;">
    <h2 style="color:#d4af37;font-family:Georgia,serif;">Hvala – wir haben Ihre Anfrage erhalten</h2>
    <p>Liebe/r {name},</p>
    <p>danke für Ihre Reservierungsanfrage bei <strong>{restaurant}</strong>. Wir melden uns in Kürze mit einer Bestätigung.</p>
    <p><strong>Datum:</strong> {datum_or_offen}<br/>
       <strong>Uhrzeit:</strong> {uhrzeit_or_dash}<br/>
       <strong>Personen:</strong> {personen}<br/>
       <strong>Anlass:</strong> {anlass_or_dash}</p>
    <p style="color:#aaa;font-size:13px;">Bei Fragen einfach auf diese E-Mail antworten.</p>
    {storno_block}
    <p style="margin-top:24px;color:#d4af37;font-family:Georgia,serif;">— {restaurant}</p>
  </div>'),

('reservation_confirmed', NULL,
 'Ihre Reservierung bei {restaurant} ist bestätigt',
 '<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;padding:24px;background:#0f0f0f;color:#f5f5f5;">
    <h2 style="color:#d4af37;font-family:Georgia,serif;">Reservierung bestätigt</h2>
    <p>Liebe/r {name},</p>
    <p>wir freuen uns auf Sie am <strong>{datum}</strong>{uhrzeit_strong_prefix} ({personen} Personen).</p>
    {storno_block}
    <p style="margin-top:24px;color:#d4af37;font-family:Georgia,serif;">— {restaurant}</p>
  </div>'),

('reservation_declined', NULL,
 'Ihre Reservierungsanfrage bei {restaurant}',
 '<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;padding:24px;background:#0f0f0f;color:#f5f5f5;">
    <h2 style="color:#d4af37;font-family:Georgia,serif;">Reservierungsanfrage</h2>
    <p>Liebe/r {name},</p>
    <p>leider können wir Ihre Anfrage für {datum_or_offen}{uhrzeit_prefix} nicht annehmen. Wir würden uns trotzdem freuen, Sie an einem anderen Tag bei uns begrüssen zu dürfen.</p>
    <p style="margin-top:24px;color:#d4af37;font-family:Georgia,serif;">— {restaurant}</p>
  </div>'),

('reservation_cancelled', NULL,
 'Ihre Reservierung bei {restaurant} wurde storniert',
 '<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;padding:24px;background:#0f0f0f;color:#f5f5f5;">
    <h2 style="color:#d4af37;font-family:Georgia,serif;">Reservierung storniert</h2>
    <p>Liebe/r {name},</p>
    <p>Ihre Reservierung am <strong>{datum_or_offen}</strong>{uhrzeit_strong_prefix} ({personen} Personen) wurde storniert. Schade, dass es diesmal nicht geklappt hat – wir würden uns freuen, Sie bald wieder bei uns begrüssen zu dürfen.</p>
    <p style="margin-top:24px;color:#d4af37;font-family:Georgia,serif;">— {restaurant}</p>
  </div>'),

('admin_notification', NULL,
 'Neue Reservierung: {name}{datum_or_anlass_suffix}',
 '<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;padding:16px;">
    <h2 style="color:#111;">Neue Reservierungsanfrage</h2>
    <p><strong>{name}</strong> &lt;{email}&gt;</p>
    <p>Telefon: {telefon_or_dash}</p>
    <p>{datum_or_offen}{uhrzeit_prefix} · {personen} Personen{anlass_suffix}</p>
    {notes_block}
    <p><a href="/admin">Im Admin öffnen →</a></p>
  </div>'),

('admin_cancellation', NULL,
 'Stornierung: {name}{datum_or_anlass_suffix}',
 '<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;padding:16px;">
    <h2 style="color:#111;">Reservierung storniert</h2>
    <p><strong>{name}</strong> &lt;{email}&gt;</p>
    <p>Telefon: {telefon_or_dash}</p>
    <p>{datum_or_offen}{uhrzeit_prefix} · {personen} Personen{anlass_suffix}</p>
    {fee_block}
    {notes_block}
    <p><a href="/admin">Im Admin öffnen →</a></p>
  </div>');
