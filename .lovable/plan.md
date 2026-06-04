## Ziel
Nachbau der Website balkaneros.ch (Home, Über uns, Kontakt) im dunklen Balkaneros-CI (schwarz/gold, „Homemade Cuisine"-Look) plus geschützter Admin-Bereich zum Bearbeiten von Texten/Bildern/Kontakt/Öffnungszeiten und zum Verwalten von Reservierungen mit automatischer E-Mail-Bestätigung.

## Öffentliche Seiten
- **/** – Home: Fullscreen-Hero („Köstlichkeiten aus dem Herzen des Balkans"), Intro-Sektion, „Tisch reservieren"-CTA, Bildergalerie, Footer mit Kontakt
- **/ueber-uns** – Story-Text, Team-/Atmosphärenbilder
- **/kontakt** – Adresse (AMAYA Rothenburg), Telefon, E-Mail, Öffnungszeiten, eingebettete Google-Maps-Karte
- **/reservieren** – Reservierungsformular (Name, E-Mail, Telefon, Datum/Uhrzeit, Personen, Notiz)

Alle dynamischen Inhalte (Texte, Bilder, Kontaktdaten, Öffnungszeiten) werden aus der Datenbank gelesen – nichts ist hartcodiert.

## Admin-Bereich (`/admin`)
Geschützt durch einen einzigen festen Admin-Account (E-Mail + Passwort, von dir einmalig festgelegt).

Dashboard-Tabs:
1. **Inhalte** – Bearbeiten aller Texte (Hero-Titel/Untertitel, Intro, Über-uns-Story usw.) sowie Hochladen/Tauschen der Bilder (Hero, Galerie, Über uns)
2. **Kontakt & Öffnungszeiten** – Adresse, Telefon, E-Mail, Social-Links, Wochentage mit Öffnungs-/Schliesszeiten
3. **Reservierungen** – Tabelle aller Anfragen mit Status (neu / bestätigt / abgelehnt), Detailansicht, Aktionen „Bestätigen" / „Ablehnen" (löst E-Mail an Gast aus)

## Reservierungs-Flow
1. Gast füllt Formular aus → Eintrag in DB (Status: `pending`)
2. Automatische **Bestätigungs-E-Mail** an Gast („Wir haben deine Anfrage erhalten") + **Benachrichtigung** an Restaurant-E-Mail
3. Admin bestätigt/lehnt ab → Gast erhält finale **Status-E-Mail**

E-Mails via Lovable Emails (eigene Absender-Domain, brandkonforme Templates).

## CI / Design
Übernommen von balkaneros.ch:
- Dunkler Hintergrund (fast schwarz), Gold-Akzent (#C9A961-Bereich) für Logo/Buttons
- Serif-Display-Font für Headlines, sauberer Sans für Body
- Logo + Wortmarke „BALKANEROS – Homemade Cuisine" aus der Originalseite übernommen (du lädst es im Admin hoch oder ich ziehe es initial vom Original)
- Atmosphärische Foodfotos als Hero/Galerie

## Technisches (Kurzfassung)
- Lovable Cloud (DB + Auth + Storage)
- Tabellen: `site_content` (key/value für Texte & Bild-URLs), `opening_hours`, `contact_info`, `reservations`
- RLS: öffentliches Lesen für Site-Inhalte; Schreiben + Reservierungs-Verwaltung nur für Admin-Rolle (`user_roles`-Tabelle, `has_role()`-Funktion)
- Reservierungs-INSERT öffentlich erlaubt, SELECT/UPDATE nur Admin
- Lovable Emails für Domain + Templates (Eingang/Bestätigung/Ablehnung)
- TanStack Start Routen, geschütztes `_authenticated/admin`-Layout

## Was ich von dir später noch brauche
- Admin-E-Mail-Adresse für den Login
- Restaurant-E-Mail, an die neue Reservierungen gehen sollen
- (Optional) eigene Domain für die Versand-Adresse der E-Mails – sonst nutzen wir einen Lovable-Subdomain-Absender
