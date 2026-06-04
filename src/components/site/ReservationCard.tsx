import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { createReservation } from "@/lib/reservations.functions";
import { toast } from "sonner";

const COUNTRY_CODES = [
  { code: "+41", label: "Schweiz +41" },
  { code: "+49", label: "Deutschland +49" },
  { code: "+43", label: "Österreich +43" },
  { code: "+39", label: "Italien +39" },
  { code: "+33", label: "Frankreich +33" },
  { code: "+31", label: "Niederlande +31" },
  { code: "+44", label: "UK +44" },
  { code: "+1", label: "USA/Kanada +1" },
];

const PARTY_SIZES = [
  ...Array.from({ length: 15 }, (_, i) => `${i + 2} Personen`),
  "Mehr als 16 (Wir werden Sie kontaktieren)",
];

export interface ReservationCardProps {
  eventDates: string[];
  disclaimer?: string;
  occasions?: string[];
  occasionsWithDates?: string[];
  variant?: "overlay" | "page";
}

export function ReservationCard({
  eventDates,
  disclaimer,
  occasions,
  occasionsWithDates,
  variant = "overlay",
}: ReservationCardProps) {
  const createFn = useServerFn(createReservation);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [occasion, setOccasion] = useState("");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const fd = new FormData(e.currentTarget);
      const partyRaw = String(fd.get("party_size") ?? "2");
      const partyNum = parseInt(partyRaw, 10);
      await createFn({
        data: {
          guest_name: String(fd.get("name") ?? ""),
          guest_email: String(fd.get("email") ?? ""),
          country_code: String(fd.get("country_code") ?? ""),
          guest_phone: String(fd.get("phone") ?? ""),
          party_size: Number.isFinite(partyNum) ? Math.max(1, Math.min(99, partyNum)) : 17,
          occasion: String(fd.get("occasion") ?? ""),
          event_date_label: String(fd.get("event_date") ?? ""),
          notes: String(fd.get("notes") ?? ""),
        },
      });
      setDone(true);
      toast.success("Anfrage gesendet! Wir melden uns per E-Mail.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Senden fehlgeschlagen");
    } finally {
      setSubmitting(false);
    }
  }

  const wrapperBase =
    "bg-[#fdfbf7]/85 text-[#2d2d2d] border border-[#c9b99a]/30 rounded-2xl shadow-2xl backdrop-blur-md";
  const wrapperClass =
    variant === "overlay"
      ? `${wrapperBase} p-5 sm:p-6`
      : `${wrapperBase} p-6 sm:p-8`;

  if (done) {
    return (
      <div className={wrapperClass}>
        <p className="text-[#8b6f5e] tracking-[0.3em] uppercase text-[10px] mb-2 font-semibold">Hvala!</p>
        <h3 className="font-display text-2xl text-[#2d2d2d] mb-2">Anfrage erhalten.</h3>
        <p className="text-sm text-[#5a5a5a]">
          Du erhältst gleich eine Bestätigungs-E-Mail. Wir melden uns mit der finalen Zusage.
        </p>
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

  const showEventDates = dateOccasions.includes(occasion) && eventDates.length > 0;

  return (
    <form onSubmit={onSubmit} className={`${wrapperClass} space-y-3`}>
      <div className="text-center pb-1">
        <p className="text-[#8b6f5e] tracking-[0.3em] uppercase text-[10px] mb-1 font-semibold">
          Balkaneros-Booking
        </p>
        <h3 className="font-display text-xl sm:text-2xl leading-tight text-[#2d2d2d]">
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

      {showEventDates && (
        <Select label="Nächste Event-Daten *" name="event_date" required>
          <option value="">Bitte wählen</option>
          {eventDates.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </Select>
      )}

      <Textarea
        label="Bemerkung (Allergien, Wünsche)"
        name="notes"
        maxLength={1000}
        rows={3}
        placeholder="z.B. Allergien, Geburtstag, Sitzwünsche …"
      />

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-full bg-[#8b6f5e] px-6 py-3 text-sm font-semibold uppercase tracking-widest text-white hover:bg-[#7a6050] active:scale-[0.99] transition disabled:opacity-50"
      >
        {submitting ? "Wird gesendet …" : "Reservieren"}
      </button>

      {disclaimer && (
        <p className="text-[11px] leading-snug text-[#7a7a7a] text-center pt-1">{disclaimer}</p>
      )}
    </form>
  );
}

const fieldBase =
  "w-full bg-white/80 border border-[#d4c8b8]/60 rounded-lg px-3 py-2 text-sm text-[#2d2d2d] placeholder:text-[#9a9a9a]/70 focus:border-[#8b6f5e] focus:ring-1 focus:ring-[#8b6f5e]/30 outline-none transition";

function Input(props: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  const { label, ...rest } = props;
  return (
    <div>
      <label className="block text-[10px] uppercase tracking-[0.2em] text-[#6b6b6b] mb-1 font-medium">
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
      <label className="block text-[10px] uppercase tracking-[0.2em] text-[#6b6b6b] mb-1 font-medium">
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
      <label className="block text-[10px] uppercase tracking-[0.2em] text-[#6b6b6b] mb-1 font-medium">
        {label}
      </label>
      <textarea {...rest} className={`${fieldBase} resize-none`} />
    </div>
  );
}
