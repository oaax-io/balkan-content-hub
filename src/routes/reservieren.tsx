import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { publicDataQuery } from "@/lib/queries";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { createReservation } from "@/lib/reservations.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/reservieren")({
  head: () => ({
    meta: [
      { title: "Reservieren — Balkaneros" },
      { name: "description", content: "Reserviere deinen Tisch bei Balkaneros." },
      { property: "og:title", content: "Reservieren — Balkaneros" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(publicDataQuery),
  component: Reserve,
  errorComponent: ({ error }) => <div className="p-10">Fehler: {error.message}</div>,
});

function Reserve() {
  const { data } = useSuspenseQuery(publicDataQuery);
  const { contact, hours } = data;
  const createFn = useServerFn(createReservation);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const fd = new FormData(e.currentTarget);
      await createFn({
        data: {
          guest_name: String(fd.get("name") ?? ""),
          guest_email: String(fd.get("email") ?? ""),
          guest_phone: String(fd.get("phone") ?? ""),
          party_size: Number(fd.get("party_size") ?? 2),
          reservation_date: String(fd.get("date") ?? ""),
          reservation_time: String(fd.get("time") ?? ""),
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

  return (
    <div className="min-h-screen flex flex-col">
      <SiteHeader />
      <section className="pt-40 pb-24 px-6">
        <div className="mx-auto max-w-2xl">
          <p className="text-gold tracking-[0.3em] uppercase text-xs mb-4 text-center">Reservierung</p>
          <h1 className="font-display text-5xl md:text-6xl text-center mb-4">Tisch reservieren</h1>
          <p className="text-center text-muted-foreground mb-12">Sende uns deine Anfrage – wir bestätigen sie per E-Mail.</p>

          {done ? (
            <div className="bg-card border border-gold/30 rounded-sm p-8 text-center">
              <h2 className="font-display text-2xl text-gold mb-3">Hvala! Anfrage erhalten.</h2>
              <p className="text-muted-foreground">Du erhältst gleich eine Bestätigungs-E-Mail. Wir melden uns mit der finalen Zusage.</p>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="space-y-5 bg-card border border-border rounded-sm p-8">
              <Field label="Name" name="name" required maxLength={120} />
              <div className="grid sm:grid-cols-2 gap-5">
                <Field label="E-Mail" name="email" type="email" required maxLength={255} />
                <Field label="Telefon" name="phone" type="tel" maxLength={40} />
              </div>
              <div className="grid sm:grid-cols-3 gap-5">
                <Field label="Datum" name="date" type="date" required />
                <Field label="Uhrzeit" name="time" type="time" required />
                <Field label="Personen" name="party_size" type="number" required min={1} max={50} defaultValue="2" />
              </div>
              <div>
                <label className="block text-xs uppercase tracking-widest text-muted-foreground mb-2">Notiz (optional)</label>
                <textarea name="notes" rows={3} maxLength={1000} className="w-full bg-background border border-border rounded-sm px-3 py-2 focus:border-gold outline-none" />
              </div>
              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-full bg-gold px-8 py-3.5 text-sm font-medium uppercase tracking-widest text-gold-foreground hover:opacity-90 transition disabled:opacity-50"
              >
                {submitting ? "Wird gesendet …" : "Anfrage senden"}
              </button>
            </form>
          )}
        </div>
      </section>
      <SiteFooter contact={contact} hours={hours} />
    </div>
  );
}

function Field(props: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  const { label, ...rest } = props;
  return (
    <div>
      <label className="block text-xs uppercase tracking-widest text-muted-foreground mb-2">{label}</label>
      <input
        {...rest}
        className="w-full bg-background border border-border rounded-sm px-3 py-2.5 focus:border-gold outline-none"
      />
    </div>
  );
}
