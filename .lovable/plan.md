
## Ziel

Neuer Gutschein-Verkaufsflow auf balkaneros.ch mit Stripe-Checkout, automatischer PDF-Generierung, E-Mail-Versand an den Käufer und einer vollständigen Admin-Verwaltung inkl. eindeutiger Gutschein-Nummer.

## Frontend

**Runder Badge im HeroSlider** (oberhalb des Titels, rechts-oben schwebend, Gold-Design, klein & mobile-freundlich):
- Aufschrift: „Gutscheine 🎁"
- Klick öffnet ein zentriertes Dialog-Popup.

**Popup „Gutschein verschenken"** — zwei Schritte:
1. **Betrag wählen** — 3 hübsche Kacheln (CHF 100 / 200 / 300) mit Balkaneros-Muster-Hintergrund (Gold-Ornamente, dunkler Card-Look) + darunter Feld „Individueller Betrag (CHF 20 – 1000)".
2. **Beschenkte Person** — Vorname, Nachname (Pflicht) + optionale persönliche Nachricht/Widmung + Käufer-Name & E-Mail.
   Button „Zur Zahlung" → Stripe Embedded Checkout in einem Modal.

Nach Zahlung: Erfolgsmeldung im Return-View „Gutschein wurde an [Käufer-Email] gesendet".

## Backend

**Neue DB-Tabelle `vouchers`** (Migration mit GRANTs & RLS):
- `id`, `voucher_code` (unique, Format `BAL-XXXX-XXXX-XXXX`), `amount_chf` (numeric), `recipient_first_name`, `recipient_last_name`, `personal_message` (nullable), `buyer_name`, `buyer_email`, `status` (`pending` | `paid` | `redeemed` | `cancelled`), `stripe_session_id`, `issued_at`, `expires_at` (Kauf + 2 Jahre), `redeemed_at` (nullable), `redeemed_note`, `pdf_url` (Storage-Pfad), `created_at`, `updated_at`.
- RLS: nur admin liest/ändert; service_role vollständig.
- Neuer Storage-Bucket `vouchers` (privat) für die PDFs; signed URLs für Admin-Download.

**Stripe-Produkte** (via `payments--batch_create_product`):
- `gutschein_100` / CHF 100
- `gutschein_200` / CHF 200
- `gutschein_300` / CHF 300
- Individueller Betrag über `price_data` (dynamisch).

**Server Functions** (`src/lib/vouchers.functions.ts`):
- `createVoucherCheckout({ amountChf, recipientFirstName, recipientLastName, personalMessage, buyerName, buyerEmail })` → legt `pending`-Voucher an, generiert Code, erstellt Stripe Embedded Checkout Session (`return_url` → `/gutschein-danke?session_id={CHECKOUT_SESSION_ID}`), speichert `stripe_session_id`, gibt `clientSecret` zurück.
- `getVoucherBySessionId({ sessionId })` — für Return-Seite.
- Admin-only: `listVouchers`, `updateVoucher` (Betrag/Empfänger/Status/Notiz), `regenerateVoucherPdf`, `getVoucherPdfUrl` (signed URL), `previewVoucherPdf` (Dummy-Voucher).

**Webhook-Handler** `src/routes/api/public/payments/webhook.ts`:
- Auf `checkout.session.completed` für Voucher-Sessions (via `metadata.voucher_id`):
  1. Status → `paid`, `issued_at = now()`, `expires_at = now() + 2 Jahre`.
  2. PDF generieren (siehe unten), in `vouchers`-Bucket ablegen, `pdf_url` speichern.
  3. Bestätigungs-E-Mail an Käufer via Lovable-Email-Infrastruktur mit PDF-Anhang bzw. Signed-Download-Link.
- Der bestehende managed Subscription-Webhook bleibt unangetastet (kein Konflikt, da unterschiedliche Event-Typen).

**PDF-Generator** (`src/lib/voucher-pdf.server.ts`, `pdf-lib`, Worker-kompatibel):
- A4 Querformat, dunkler Balkan-Hintergrund (base64 embedded), Gold-Rahmen mit Ornament, Balkaneros-Logo/Wortmarke, grosse Überschrift „GUTSCHEIN", Betrag (CHF …), Empfänger-Name, optionale persönliche Widmung, Gutschein-Nummer als Grosstext + QR-Code, Ausstellungsdatum, Ablaufdatum, Fusszeile mit Restaurant-Angaben.
- Rückgabe: `Uint8Array` → in Supabase Storage geladen.

**E-Mail** (nutzt das bestehende `email_templates`-System, neuer Template-Key `voucher_purchase`):
- An Käufer, HTML mit Vorschau des Gutscheins + Signed-Download-Link (7 Tage gültig, re-generierbar via Admin) + PDF-Anhang via Resend/Lovable.
- Platzhalter: `{buyer_name}`, `{recipient_name}`, `{amount}`, `{voucher_code}`, `{expires_at}`, `{pdf_link}`.

## Admin

**Neuer Tab „Gutscheine"** in `src/routes/_authenticated/admin.tsx` (Icon `Gift`):
- Tabelle mit Filter (Status, Zeitraum, Suche nach Code/Empfänger).
- Spalten: Code, Betrag, Empfänger, Käufer, Status, Ausgestellt, Läuft ab.
- Zeilen-Actions: **Bearbeiten** (Dialog: Betrag, Empfänger-Namen, Widmung, Status, Ablaufdatum, interne Notiz), **PDF ansehen** (öffnet Signed URL), **PDF neu generieren**, **Als eingelöst markieren** (mit Notiz-Feld, Datum), **Stornieren**.
- **Vorschau-Button** oben rechts: rendert einen Dummy-Voucher-PDF mit Beispieldaten in einem Iframe — nützlich zum Prüfen des Designs nach Content-Änderungen.
- Zusätzliches Content-Feld unter „Inhalte & Bilder": Text auf dem PDF (Fusszeile / Einlösebedingungen) editierbar.

## Technische Details

- Stripe: `createStripeClient` + `managed_payments: { enabled: true }` (CH-Seller eligible), Tax-Code `txcd_10501000` (Prepaid gift certificate).
- PDF: `pdf-lib` (worker-safe, kein Sharp/Canvas). QR: `qrcode`-Package (WASM-frei).
- Voucher-Code: `crypto.randomBytes(9)` → Base32 → `BAL-XXXX-XXXX-XXXX`.
- Sicherheit: PDF-Bucket privat, Zugriff ausschliesslich über signed URLs (7 Tage). Neu-Generierung nur admin.
- Bestehende „Dinner & Dance"-Reservierungs-Flow bleibt komplett unberührt.

## Reihenfolge der Umsetzung

1. Migration `vouchers` + Storage-Bucket.
2. Stripe-Produkte anlegen.
3. `voucher-pdf.server.ts` + Server Functions.
4. Webhook erweitern.
5. Frontend: Badge + Popup + Checkout + Danke-Seite.
6. Admin-Tab.
7. E-Mail-Template im vorhandenen Editor freischalten.

Nach Bestätigung baue ich alles in dieser Reihenfolge. Aufgrund des Umfangs werden es mehrere Turns — ich starte mit Migration + Stripe-Produkten und melde mich dann für Schritt 2 zurück.
