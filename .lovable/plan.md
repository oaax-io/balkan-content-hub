## Ziel

Neuer Admin-Bereich „E-Mail-Templates" in der Sidebar, in dem alle transaktionalen E-Mails (Anfrage, Bestätigung, Ablehnung, Storno, Admin-Benachrichtigungen) inhaltlich bearbeitet werden können – global und **pro Anlass individuell**. Damit lässt sich z. B. für „Dinner & Dance" der vom Kunden gewünschte Bestätigungstext hinterlegen, ohne den Code zu ändern.

## Datenbank

Neue Tabelle `email_templates`:

```text
id           uuid PK
template_key text     -- z.B. reservation_confirmed, reservation_cancelled,
                     --      reservation_request, reservation_declined,
                     --      admin_notification, admin_cancellation
occasion     text NULL -- NULL = globaler Default; sonst Anlass-Name
subject      text
body_html    text     -- HTML mit Platzhaltern
enabled      boolean default true
updated_at   timestamptz
UNIQUE (template_key, occasion)
```

RLS: nur Admin darf lesen/schreiben (`has_role(auth.uid(), 'admin')`). GRANTs entsprechend.

Seed: eine Default-Zeile pro `template_key` (occasion NULL) mit den heutigen Texten.

## Platzhalter

Im Editor verfügbar und beim Rendern ersetzt:

- `{name}` – Gastname
- `{personen}` – Personenzahl
- `{datum}` – z.B. „Samstag, 20. Juni 2026" (leer wenn kein Datum)
- `{uhrzeit}` – nur wenn hinterlegt
- `{anlass}` – Anlass-Bezeichnung
- `{event_label}` – Event-Datum-Label (falls gesetzt)
- `{restaurant}` – Restaurantname aus contact_info
- `{storno_link}` – Cancel-URL (nur wenn Token vorhanden)
- `{telefon}`, `{email}`, `{notes}` – Gastdaten (v. a. für Admin-Templates)

## Backend

`src/lib/email.server.ts`:

- Neue Helper `loadTemplate(key, occasion?)`: liest `email_templates` (mit Fallback auf occasion=NULL, sonst hartkodierter Default).
- `renderTemplate(subject, body, vars)`: ersetzt Platzhalter.
- `sendReservationConfirmation` / `sendReservationStatusUpdate` / `sendAdminNotification` / `sendAdminCancellationNotification` nutzen `loadTemplate(..., r.occasion)`, sonst wie bisher.
- Wenn im DB-Template gesetzt, überschreibt es Betreff + Body. Wenn `enabled = false`, wird die E-Mail übersprungen.

Neue Server-Funktionen in `src/lib/email-templates.functions.ts` (admin-only):
- `listEmailTemplates()` → alle Zeilen.
- `upsertEmailTemplate({ template_key, occasion, subject, body_html, enabled })`.
- `deleteEmailTemplate({ id })` – nur wenn occasion nicht NULL (Default nicht löschbar).
- `previewEmailTemplate({ subject, body_html, vars })` → gerendertes HTML für Vorschau.

Test-E-Mail-Funktion (bereits vorhanden) nutzt neu ebenfalls die DB-Templates.

## Admin-UI

Sidebar in `src/routes/_authenticated/admin.tsx`: neuer Tab „E-Mail-Templates" (Icon `MailOpen`).

Neue Komponente `src/components/admin/EmailTemplatesTab.tsx`:

- Linke Spalte: Baumliste
  - Reservierungsanfrage (Gast) – Default + Overrides pro Anlass
  - Bestätigung (Gast) – Default + Overrides
  - Absage (Gast) – Default + Overrides
  - Stornierung (Gast) – Default + Overrides
  - Admin-Benachrichtigung neue Reservation
  - Admin-Benachrichtigung Storno
  - Button „Override für Anlass hinzufügen" (Dropdown mit `reservation_occasions`)
- Rechte Spalte: Editor
  - Betreff (Input)
  - Body (Textarea, monospace, ausreichend hoch)
  - Merkzettel mit Platzhaltern (zum Copy-Paste)
  - Live-Vorschau (rechts oder unter dem Editor) mit Beispieldaten
  - Aktiv-Toggle
  - „Speichern" / „Zurücksetzen auf Default" (bei Override-Zeilen: löscht Override)

Vorschau: rendert HTML in einem sandboxed `<iframe srcdoc>` mit fester Breite (max-w 640px) auf hellem Hintergrund.

## Migration / Rollout

1. Migration: Tabelle + RLS + GRANTs + Seed-Defaults (aktueller HTML-Body je Template).
2. `email.server.ts`: Templates aus DB laden, Platzhalter ersetzen, Fallback beibehalten (wenn DB-Zeile fehlt → hartkodierter Default weiter aktiv, damit nichts bricht).
3. Neue server functions + Admin-Tab bauen.
4. Test-Bereich in EmailTab bleibt bestehen, nutzt neu die DB-Templates.

## Nicht enthalten

- Rich-Text-Editor (WYSIWYG) – bewusst plain HTML, damit du volle Kontrolle hast und der Kunden-Text 1:1 einfügbar ist. Auf Wunsch später ergänzbar.
- Mehrsprachigkeit – aktuell nur DE.
- Versand-Historie / Log-Ansicht – separat.
