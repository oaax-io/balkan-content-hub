import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { createReservation, createReservationSetupIntent } from "@/lib/reservations.functions";
import { getStripe, getStripeEnvironment, isPaidOccasion } from "@/lib/stripe";
import { toast } from "sonner";

const COUNTRY_CODES = [
  { code: "+41", label: "+41" },
  { code: "+49", label: "+49" },
  { code: "+43", label: "+43" },
  { code: "+39", label: "+39" },
  { code: "+33", label: "+33" },
  { code: "+31", label: "+31" },
  { code: "+44", label: "+44" },
  { code: "+1", label: "+1" },
];

// Reservierungen ab 2 Personen. Kleinere Gruppen bitte telefonisch anfragen.
const PARTY_SIZES = [
  ...Array.from({ length: 15 }, (_, i) => `${i + 2} Personen`), // 2 … 16
  "Mehr als 16 (Wir werden Sie kontaktieren)",
];

export interface ReservationCardProps {
  eventDates: string[];
  disclaimer?: string;
  occasions?: string[];
  occasionsWithDates?: string[];
  paidOccasions?: string[];
  variant?: "overlay" | "page";
}

interface FormValues {
  guest_name: string;
  guest_email: string;
  country_code: string;
  guest_phone: string;
  party_size: number;
  occasion: string;
  event_date: string;
  event_date_label: string;
  notes: string;
}

function parseEventDates(eventDates: string[], occasion?: string) {
  const occNorm = (occasion || "").trim().toLowerCase();
  if (!occNorm) return [];
  const parsed = eventDates
    .map((raw) => {
      const idx = raw.indexOf("::");
      const forOcc = idx >= 0 ? raw.slice(0, idx).trim().toLowerCase() : "";
      const rest = idx >= 0 ? raw.slice(idx + 2).trim() : raw.trim();
      return { forOcc, rest };
    })
    // Strikte Trennung: nur Daten, die exakt zu diesem Anlass gehören
    .filter((d) => d.forOcc === occNorm)
    .map((d) => {
      const [machine, ...rest] = d.rest.split("|");
      const machineDate = (machine || "").trim();
      const displayLabel = rest.length > 0 ? rest.join("|").trim() : machineDate;
      return { machineDate, displayLabel };
    })
    .filter((d) => d.machineDate.length > 0);

  const byDate = new Map<string, { machineDate: string; displayLabel: string }>();
  for (const d of parsed) {
    if (!byDate.has(d.machineDate)) byDate.set(d.machineDate, d);
  }
  return Array.from(byDate.values());
}


export function ReservationCard({
  eventDates,
  disclaimer,
  occasions,
  occasionsWithDates,
  paidOccasions,
  variant = "overlay",
}: ReservationCardProps) {
  const createFn = useServerFn(createReservation);
  const setupFn = useServerFn(createReservationSetupIntent);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [occasion, setOccasion] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);

  // Stripe stage
  const [stripeStage, setStripeStage] = useState<null | {
    clientSecret: string;
    customerId: string;
    values: FormValues;
  }>(null);

  const paid = isPaidOccasion(occasion, paidOccasions);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const fd = new FormData(e.currentTarget);
      const occasionValue = String(fd.get("occasion") ?? "");
      const parsedDates = parseEventDates(eventDates, occasionValue);

      const partyRaw = String(fd.get("party_size") ?? "2");
      const partyNum = parseInt(partyRaw, 10);
      const eventDateMachine = String(fd.get("event_date") ?? "");
      const selectedEvent = parsedDates.find((d) => d.machineDate === eventDateMachine);
      const values: FormValues = {
        guest_name: String(fd.get("name") ?? ""),
        guest_email: String(fd.get("email") ?? ""),
        country_code: String(fd.get("country_code") ?? ""),
        guest_phone: String(fd.get("phone") ?? ""),
        party_size: Number.isFinite(partyNum) ? Math.max(2, Math.min(99, partyNum)) : 17,
        occasion: String(fd.get("occasion") ?? ""),
        event_date: eventDateMachine,
        event_date_label: selectedEvent?.displayLabel ?? eventDateMachine,
        notes: String(fd.get("notes") ?? ""),
      };

      if (isPaidOccasion(values.occasion, paidOccasions)) {
        if (!termsAccepted) {
          toast.error("Bitte akzeptiere die Stornierungsbedingungen.");
          setSubmitting(false);
          return;
        }
        const result = await setupFn({
          data: {
            guest_name: values.guest_name,
            guest_email: values.guest_email,
            occasion: values.occasion,
            environment: getStripeEnvironment(),
          },
        });
        if ("error" in result) throw new Error(result.error);
        setStripeStage({ clientSecret: result.client_secret, customerId: result.customer_id, values });
        setSubmitting(false);
        return;
      }

      await createFn({ data: values });
      setDone(true);
      toast.success("Anfrage gesendet! Wir melden uns per E-Mail.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Senden fehlgeschlagen");
    } finally {
      setSubmitting(false);
    }
  }

  async function onPaymentMethodReady(paymentMethodId: string, setupIntentId: string) {
    if (!stripeStage) return;
    try {
      await createFn({
        data: {
          ...stripeStage.values,
          stripe_customer_id: stripeStage.customerId,
          stripe_payment_method_id: paymentMethodId,
          stripe_setup_intent_id: setupIntentId,
          cancellation_terms_accepted: true,
        },
      });
      setDone(true);
      toast.success("Reservation gesendet! Wir melden uns per E-Mail.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Speichern fehlgeschlagen");
    }
  }

  const wrapperBase =
    "bg-[#fdfbf7]/55 text-[#1a1a1a] border border-gold/40 rounded-2xl shadow-2xl backdrop-blur-xl";
  const wrapperClass =
    variant === "overlay" ? `${wrapperBase} p-5 sm:p-6` : `${wrapperBase} p-6 sm:p-8`;

  if (done) {
    return (
      <div className={wrapperClass}>
        <p className="text-[#8a6a14] tracking-[0.3em] uppercase text-[10px] mb-2 font-bold">Hvala!</p>
        <h3 className="font-display text-2xl text-[#1a1a1a] mb-2">Anfrage erhalten.</h3>
        <p className="text-sm text-[#2d2d2d]">
          Du erhältst gleich eine Bestätigungs-E-Mail. Wir melden uns mit der finalen Zusage.
        </p>
      </div>
    );
  }

  // Stage 2: Payment method entry
  if (stripeStage) {
    return (
      <div className={wrapperClass}>
        <div className="text-center pb-3">
          <p className="text-[#8a6a14] tracking-[0.3em] uppercase text-[10px] mb-1 font-bold">
            Zahlungsmethode hinterlegen
          </p>
          <h3 className="font-display text-xl text-[#1a1a1a]">
            Es wird nichts abgebucht.
          </h3>
          <p className="text-xs text-[#2d2d2d] mt-2">
            Für <strong>{stripeStage.values.occasion}</strong> hinterlegst du eine Karte als
            Absicherung. Bei Stornierung weniger als 7 Tage vor dem Anlass können CHF 50 pro Person belastet werden.
          </p>
        </div>
        <Elements
          stripe={getStripe()}
          options={{ clientSecret: stripeStage.clientSecret, appearance: { theme: "stripe" } }}
        >
          <PaymentMethodForm
            email={stripeStage.values.guest_email}
            name={stripeStage.values.guest_name}
            onReady={onPaymentMethodReady}
            onCancel={() => setStripeStage(null)}
          />
        </Elements>
      </div>
    );
  }

  const occasionList =
    occasions && occasions.length > 0
      ? occasions
      : [
          "Dinner & Dance (99.- pro Person)",
          "Balkan Brunch",
          "Exklusiv Event",
          "Keine (Nur eine Anfrage)",
        ];

  const dateOccasions =
    occasionsWithDates && occasionsWithDates.length > 0
      ? occasionsWithDates
      : ["Dinner & Dance (99.- pro Person)"];

  const dateRequired = dateOccasions.includes(occasion);
  const availableDates = parseEventDates(eventDates, occasion);
  const showEventDates = !!occasion && availableDates.length > 0;


  return (
    <form onSubmit={onSubmit} className={`${wrapperClass} space-y-3`}>
      <div className="text-center pb-1">
        <p className="text-[#8a6a14] tracking-[0.3em] uppercase text-[10px] mb-1 font-bold">
          Balkaneros-Booking
        </p>
        <h3 className="font-display text-xl sm:text-2xl leading-tight text-[#1a1a1a]">
          Wir freuen uns, dich bei uns verwöhnen zu dürfen.
        </h3>
      </div>

      <Select
        label="Was ist der Anlass deiner Reservation? *"
        name="occasion"
        required
        value={occasion}
        onChange={(e) => setOccasion(e.target.value)}
      >
        <option value="">Bitte wählen</option>
        {occasionList.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </Select>

      <Input label="Name *" name="name" required maxLength={120} autoComplete="name" />

      <Input
        label="E-Mail *"
        name="email"
        type="email"
        required
        maxLength={255}
        autoComplete="email"
        inputMode="email"
      />

      <div className="grid grid-cols-[7.5rem_1fr] gap-2">
        <Select label="Vorwahl" name="country_code" defaultValue="+41">
          {COUNTRY_CODES.map((c) => (
            <option key={c.code} value={c.code}>
              {c.label}
            </option>
          ))}
        </Select>
        <Input label="Telefon" name="phone" type="tel" maxLength={40} autoComplete="tel" inputMode="tel" />
      </div>

      <Select label="Personen *" name="party_size" required defaultValue="2">
        {PARTY_SIZES.map((p, i) => (
          <option key={p} value={i < 15 ? String(i + 2) : "17"}>
            {p}
          </option>
        ))}
      </Select>

      {showEventDates ? (
        <Select
          label={dateRequired ? "Nächste Event-Daten *" : "Datum (optional)"}
          name="event_date"
          required={dateRequired}
        >
          <option value="">{dateRequired ? "Bitte wählen" : "Kein Datum"}</option>
          {availableDates.map((d) => (
            <option key={d.machineDate} value={d.machineDate}>
              {d.displayLabel}
            </option>
          ))}
        </Select>
      ) : occasion && dateRequired ? (
        <div className="text-xs text-[#2d2d2d] bg-white/70 border border-gold/40 rounded-lg px-3 py-2">
          Noch kein Datum bekannt für <strong>{occasion}</strong>. Wir melden uns bei dir.
        </div>
      ) : null}


      <Textarea
        label="Bemerkung (Allergien, Wünsche)"
        name="notes"
        maxLength={1000}
        rows={3}
        placeholder="z.B. Allergien, Geburtstag, Sitzwünsche …"
      />

      {paid && (
        <label className="flex items-start gap-2 text-[12px] leading-snug text-[#1a1a1a] bg-white/70 border border-gold/40 rounded-lg p-3">
          <input
            type="checkbox"
            checked={termsAccepted}
            onChange={(e) => setTermsAccepted(e.target.checked)}
            className="mt-0.5 accent-[#8a6a14]"
          />
          <span className="whitespace-pre-line">
            {disclaimer && disclaimer.trim().length > 0 ? (
              disclaimer
            ) : (
              <>
                Ich akzeptiere, dass bei Stornierung weniger als <strong>7 Tage</strong> vor dem
                Anlass oder bei Nichterscheinen eine Gebühr von <strong>CHF 50</strong> auf die
                hinterlegte Zahlungsmethode belastet werden kann. Beim Reservieren wird{" "}
                <strong>nichts abgebucht</strong>.
              </>
            )}
          </span>
        </label>
      )}

      <button
        type="submit"
        disabled={submitting || (paid && !termsAccepted)}
        className="w-full rounded-full bg-gold px-6 py-3 text-sm font-bold uppercase tracking-widest text-[#0d0d0d] hover:bg-[#0d0d0d] hover:text-gold border border-gold active:scale-[0.99] transition disabled:opacity-50"
      >
        {submitting ? "Wird gesendet …" : paid ? "Weiter zur Zahlungsmethode" : "Reservieren"}
      </button>
    </form>
  );
}


function PaymentMethodForm({
  email,
  name,
  onReady,
  onCancel,
}: {
  email: string;
  name: string;
  onReady: (paymentMethodId: string, setupIntentId: string) => Promise<void>;
  onCancel: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;
    setBusy(true);
    try {
      const result = await stripe.confirmSetup({
        elements,
        confirmParams: {
          return_url: window.location.href,
          payment_method_data: { billing_details: { email, name } },
        },
        redirect: "if_required",
      });
      if (result.error) {
        toast.error(result.error.message ?? "Karte konnte nicht hinterlegt werden.");
        setBusy(false);
        return;
      }
      const si = result.setupIntent;
      const pm = typeof si?.payment_method === "string" ? si.payment_method : si?.payment_method?.id;
      if (!si || !pm) {
        toast.error("Zahlungsmethode konnte nicht bestätigt werden.");
        setBusy(false);
        return;
      }
      await onReady(pm, si.id);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Fehler beim Bestätigen");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <PaymentElement options={{ layout: "tabs" }} />
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="flex-1 rounded-full border border-gold/50 px-4 py-3 text-xs font-bold uppercase tracking-widest text-[#1a1a1a] hover:bg-white/60 transition disabled:opacity-50"
        >
          Zurück
        </button>
        <button
          type="submit"
          disabled={!stripe || busy}
          className="flex-[2] rounded-full bg-gold px-6 py-3 text-sm font-bold uppercase tracking-widest text-[#0d0d0d] hover:bg-[#0d0d0d] hover:text-gold border border-gold transition disabled:opacity-50"
        >
          {busy ? "Wird bestätigt …" : "Reservation abschliessen"}
        </button>
      </div>
      <p className="text-[11px] text-center text-[#2d2d2d]">
        Es wird jetzt <strong>nichts abgebucht</strong>. Die Karte dient nur als Absicherung.
      </p>
    </form>
  );
}

const fieldBase =
  "w-full bg-white/85 border border-gold/40 rounded-lg px-3 py-2 text-sm text-[#1a1a1a] placeholder:text-[#8a8a8a] focus:border-gold focus:ring-2 focus:ring-gold/40 outline-none transition";

function Input(props: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  const { label, ...rest } = props;
  return (
    <div>
      <label className="block text-[10px] uppercase tracking-[0.2em] text-[#1a1a1a] mb-1 font-semibold">
        {label}
      </label>
      <input {...rest} className={fieldBase} />
    </div>
  );
}

function Select(props: React.SelectHTMLAttributes<HTMLSelectElement> & { label: string }) {
  const { label, children, ...rest } = props;
  return (
    <div>
      <label className="block text-[10px] uppercase tracking-[0.2em] text-[#1a1a1a] mb-1 font-semibold">
        {label}
      </label>
      <select {...rest} className={fieldBase}>
        {children}
      </select>
    </div>
  );
}

function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string }) {
  const { label, ...rest } = props;
  return (
    <div>
      <label className="block text-[10px] uppercase tracking-[0.2em] text-[#1a1a1a] mb-1 font-semibold">
        {label}
      </label>
      <textarea {...rest} className={`${fieldBase} resize-none`} />
    </div>
  );
}
