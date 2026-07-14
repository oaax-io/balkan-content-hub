import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { publicDataQuery } from "@/lib/queries";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { buildSeoMeta } from "@/lib/seo-head";

export const Route = createFileRoute("/agb")({
  head: ({ loaderData }) => ({
    meta: buildSeoMeta(loaderData, "/agb", {
      title: "AGB — Balkaneros",
      description: "Allgemeine Geschäftsbedingungen von Balkaneros Events / Fine Moments GmbH — Reservationen, Stornierungen, Gutscheine.",
    }),
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(publicDataQuery),
  component: AGB,
  errorComponent: ({ error }) => <div className="p-10">Fehler: {error.message}</div>,
});

function AGB() {
  const { data } = useSuspenseQuery(publicDataQuery);
  const { contact, hours } = data;

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <section className="pt-32 pb-20 px-4 sm:px-6">
        <div className="mx-auto max-w-3xl">
          <p className="text-gold tracking-[0.3em] uppercase text-xs mb-3 text-center">Rechtliches</p>
          <h1 className="font-display text-4xl sm:text-5xl text-center mb-2">Allgemeine Geschäftsbedingungen</h1>
          <p className="text-center text-sm text-muted-foreground mb-12">
            Stand: {new Date().toLocaleDateString("de-CH", { year: "numeric", month: "long" })}
          </p>

          <div className="space-y-10 text-sm leading-relaxed text-foreground/90">
            <section>
              <h2 className="font-display text-2xl mb-3 text-gold">1. Geltungsbereich</h2>
              <p>
                Diese Allgemeinen Geschäftsbedingungen (AGB) regeln das Vertragsverhältnis zwischen der
                Fine Moments GmbH, Kaspar-Koppstrasse 90, CH-6030 Ebikon (nachfolgend «Balkaneros»),
                und ihren Gästen bzw. Kunden. Mit einer Reservation, dem Kauf eines Gutscheins oder
                der Teilnahme an einer Veranstaltung von Balkaneros werden diese AGB anerkannt.
                Abweichende Vereinbarungen bedürfen der schriftlichen Bestätigung.
              </p>
            </section>

            <section>
              <h2 className="font-display text-2xl mb-3 text-gold">2. Reservationen</h2>
              <p className="mb-2">
                Reservationen können online über unsere Website, per E-Mail oder telefonisch
                vorgenommen werden. Eine Reservation gilt erst nach schriftlicher Bestätigung
                durch Balkaneros als verbindlich.
              </p>
              <p className="mb-2">
                Für kostenpflichtige Anlässe (z. B. Dinner-Events, Silvester, spezielle Themenabende,
                Private Bookings) ist für die verbindliche Reservation das Hinterlegen einer gültigen
                Zahlungsmethode erforderlich. Es wird beim Reservieren <strong>keine Anzahlung</strong> und
                <strong>kein Ticketpreis</strong> abgebucht; die Karte dient ausschliesslich als Absicherung für
                Storno- und No-Show-Gebühren. Bei regulären Tischreservationen ist keine hinterlegte
                Zahlungsmethode nötig.
              </p>
              <p>
                Der reservierte Tisch steht ab der gebuchten Zeit für maximal 15 Minuten zur
                Verfügung. Bei verspätetem Erscheinen ohne vorherige Mitteilung behalten wir uns
                vor, den Tisch anderweitig zu vergeben.
              </p>
            </section>

            <section>
              <h2 className="font-display text-2xl mb-3 text-gold">3. Stornierung & Umbuchung</h2>
              <p className="mb-2">
                Für kostenpflichtige Anlässe gilt folgende Stornierungsregelung ab dem
                Veranstaltungsdatum:
              </p>
              <ul className="list-disc pl-6 space-y-1">
                <li>Stornierung <strong>mehr als 7 Tage</strong> vor dem Anlass: kostenlos</li>
                <li>Stornierung <strong>7 Tage oder weniger</strong> vor dem Anlass oder Nichterscheinen («No-Show»): es wird eine Gebühr von <strong>CHF 50 pro Person</strong> auf die hinterlegte Zahlungsmethode belastet</li>
              </ul>
              <p className="mt-2">
                Reguläre Tischreservationen (nicht kostenpflichtige Anlässe) können für gewöhnlich
                kostenlos storniert werden. Für kurzfristige Absagen oder No-Show behalten wir uns
                vor, eine angemessene Ausfallentschädigung in Rechnung zu stellen.
              </p>
              <p className="mt-2">
                Eine Umbuchung auf ein anderes Datum ist auf Anfrage und nach Verfügbarkeit
                möglich; bereits geleistete Zahlungen können angerechnet werden.
              </p>
            </section>

            <section>
              <h2 className="font-display text-2xl mb-3 text-gold">4. Gutscheine</h2>
              <p className="mb-2">
                Balkaneros-Gutscheine sind ausschliesslich für Veranstaltungen und Leistungen
                von Balkaneros Events (Fine Moments GmbH) gültig.
              </p>
              <ul className="list-disc pl-6 space-y-1">
                <li>Gültigkeitsdauer: 2 Jahre ab Kaufdatum.</li>
                <li>Gutscheine sind nicht rückzahlbar und können nicht gegen Bargeld eingelöst werden.</li>
                <li>Eine Teileinlösung ist möglich; ein allfälliger Restbetrag wird auf dem Gutschein vermerkt und kann später eingelöst werden.</li>
                <li>Gutscheine sind übertragbar. Für Verlust, Diebstahl oder Missbrauch übernimmt Balkaneros keine Haftung.</li>
                <li>Nach Ablauf der Gültigkeit verfällt jeglicher Anspruch auf Einlösung; eine Verlängerung erfolgt nur in Ausnahmefällen und nach schriftlicher Zusage.</li>
                <li>Bei begründetem Verdacht auf Missbrauch behalten wir uns vor, einen Gutschein zu sperren.</li>
              </ul>
            </section>

            <section>
              <h2 className="font-display text-2xl mb-3 text-gold">5. Preise & Zahlung</h2>
              <p className="mb-2">
                Alle Preise verstehen sich in Schweizer Franken (CHF) inklusive gesetzlicher
                Mehrwertsteuer. Es gelten die zum Zeitpunkt der Buchung bzw. Bestellung
                gültigen Preise gemäss Website oder individueller Offerte.
              </p>
              <p>
                Die Zahlung erfolgt je nach Angebot vor Ort (Bar, Karte, TWINT) oder online
                per Kreditkarte bzw. TWINT über unseren Zahlungsdienstleister. Bei
                Vorauszahlungen ist der gesamte Betrag bis zum angegebenen Fälligkeitsdatum
                zu entrichten.
              </p>
            </section>

            <section>
              <h2 className="font-display text-2xl mb-3 text-gold">6. Allergien & besondere Ernährungswünsche</h2>
              <p>
                Bitte teile uns Allergien, Unverträglichkeiten oder besondere Ernährungswünsche
                bei der Reservation, spätestens jedoch 48 Stunden vor dem Anlass mit. Wir
                bemühen uns, entsprechende Alternativen anzubieten, können jedoch keine
                Garantie für eine vollständig allergenfreie Zubereitung geben.
              </p>
            </section>

            <section>
              <h2 className="font-display text-2xl mb-3 text-gold">7. Haftung</h2>
              <p>
                Balkaneros haftet nur für Schäden, die auf grobe Fahrlässigkeit oder Vorsatz
                zurückzuführen sind. Für mitgebrachte Garderobe und Wertsachen wird keine
                Haftung übernommen. Programmänderungen sowie die Absage von Veranstaltungen
                aus wichtigen Gründen (z. B. höhere Gewalt, behördliche Anordnungen) bleiben
                ausdrücklich vorbehalten; in diesem Fall werden bereits geleistete Zahlungen
                zurückerstattet oder auf einen Ersatztermin übertragen.
              </p>
            </section>

            <section>
              <h2 className="font-display text-2xl mb-3 text-gold">8. Bild- und Tonaufnahmen</h2>
              <p>
                An unseren Veranstaltungen können Bild- und Tonaufnahmen erstellt werden, die
                zu Marketingzwecken (Website, Social Media) verwendet werden. Wer nicht auf
                Aufnahmen erscheinen möchte, teilt uns dies bitte vor Ort mit.
              </p>
            </section>

            <section>
              <h2 className="font-display text-2xl mb-3 text-gold">9. Datenschutz</h2>
              <p>
                Die im Rahmen von Reservationen, Gutscheinkäufen und Kontaktanfragen
                erhobenen Personendaten werden ausschliesslich zur Vertragsabwicklung und
                Kundenpflege verwendet und nicht an Dritte weitergegeben, soweit dies nicht
                für die Leistungserbringung (z. B. Zahlungsabwicklung) erforderlich ist.
              </p>
            </section>

            <section>
              <h2 className="font-display text-2xl mb-3 text-gold">10. Anwendbares Recht & Gerichtsstand</h2>
              <p>
                Es gilt ausschliesslich Schweizer Recht unter Ausschluss des UN-Kaufrechts.
                Gerichtsstand ist der Sitz der Fine Moments GmbH, sofern keine zwingenden
                gesetzlichen Bestimmungen einen anderen Gerichtsstand vorsehen.
              </p>
            </section>

            <section>
              <h2 className="font-display text-2xl mb-3 text-gold">11. Kontakt</h2>
              <p>
                Fine Moments GmbH<br />
                Kaspar-Koppstrasse 90<br />
                CH-6030 Ebikon<br />
                {contact.phone && <>Telefon: {contact.phone}<br /></>}
                E-Mail: info@balkaneros.ch
              </p>
            </section>
          </div>
        </div>
      </section>
      <SiteFooter contact={contact} hours={hours} />
    </div>
  );
}
