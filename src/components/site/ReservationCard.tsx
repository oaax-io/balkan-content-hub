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
  variant?: "overlay" | "page";
}

export function ReservationCard({ eventDates, disclaimer, occasions, variant = "overlay" }: ReservationCardProps) {
  const createFn = useServerFn(createReservation);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

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

  const wrapperClass =
    variant === "overlay"
      ? "bg-[#faf8f5] text-[#2d2d2d] rounded-md p-5 sm:p-6 shadow-2xl border border-[#e8e0d4]"
      : "bg-[#faf8f5] text-[#2d2d2d] border border-[#e8e0d4] rounded-md p-6 sm:p-8";

  if (done) {
    return (
      <div className={wrapperClass}>
        <h3 className="font-display text-2xl text-[#8b6f5e] mb-2">Hvala! Anfrage erhalten.</h3>
        <p className="text-sm text-[#5a4a3a]">
          Du erhältst gleich eine Bestätigungs-E-Mail. Wir melden uns mit der finalen Zusage.
        </p>
      </div>
    );
  }

  const occasionList = occasions && occasions.length > 0 ? occasions : [
    "Dinner & Dance (99.- pro Person)",
    "Balkan Brunch",
    "Exklusiv Event",
    "Keine (Nur eine Anfrage)",
  ];

  return (
    <form onSubmit={onSubmit} className={wrapperClass + " space-y-3"}>
      <div className="text-center">
        <p className="text-[#8b6f5e] tracking-[0.25em] uppercase text-[10px] mb-1 font-semibold">Balkaneros-Booking</p>
        <h3 className="font-display text-xl sm:text-2xl leading-tight text-[#2d2d2d]">
          Wir freuen uns, dich bei uns verwöhnen zu dürfen.
        </h3>
      </div>

      <Select label="Was ist der Anlass deiner Reservation? *" name="occasion" required dark>
        <option value="">Bitte wählen</option>
        {occasionList.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </Select>

      <Input label="Name *" name="name" required maxLength={120} autoComplete="name" dark />

      <Input label="E-Mail *" name="email" type="email" required maxLength={255} autoComplete="email" inputMode="email" dark />

      <div className="grid grid-cols-[7.5rem_1fr] gap-2">
        <Select label="Vorwahl" name="country_code" defaultValue="+41" dark>
          {COUNTRY_CODES.map((c) => (
            <option key={c.code} value={c.code}>{c.label}</option>
          ))}
        </Select>
        <Input label="Telefon" name="phone" type="tel" maxLength={40} autoComplete="tel" inputMode="tel" dark />
      </div>

      <Select label="Personen *" name="party_size" required defaultValue="2" dark>
        {PARTY_SIZES.map((p, i) => (
          <option key={p} value={i < 15 ? String(i + 2) : "17"}>{p}</option>
        ))}
      </Select>

      <Select label="Nächste Event-Daten *" name="event_date" required dark>
        <option value="">Bitte wählen</option>
        {eventDates.map((d) => (
          <option key={d} value={d}>{d}</option>
        ))}
      </Select>

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-full bg-[#8b6f5e] px-6 py-3 text-sm font-semibold uppercase tracking-widest text-white hover:opacity-90 active:scale-[0.99] transition disabled:opacity-50"
      >
        {submitting ? "Wird gesendet …" : "Reservieren"}
      </button>

      {disclaimer && (
        <p className="text-[11px] leading-snug text-[#5a4a3a]/80 text-center pt-1">{disclaimer}</p>
      )}
    </form>
  );
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement> & { label: string; dark?: boolean }) {
  const { label, dark, ...rest } = props;
  return (
    <div>
      <label className="block text-[10px] uppercase tracking-widest text-[#5a4a3a] mb-1 font-medium">{label}</label>
      <input
        {...rest}
        className="w-full bg-white border border-[#d8d0c4] rounded-sm px-3 py-2 text-sm text-[#2d2d2d] placeholder:text-[#a09080] focus:border-[#8b6f5e] outline-none transition"
      />
    </div>
  );
}

function Select(props: React.SelectHTMLAttributes<HTMLSelectElement> & { label: string; dark?: boolean }) {
  const { label, dark, children, ...rest } = props;
  return (
    <div>
      <label className="block text-[10px] uppercase tracking-widest text-[#5a4a3a] mb-1 font-medium">{label}</label>
      <select
        {...rest}
        className="w-full bg-white border border-[#d8d0c4] rounded-sm px-3 py-2 text-sm text-[#2d2d2d] focus:border-[#8b6f5e] outline-none transition"
      >
        {children}
      </select>
    </div>
  );
}
