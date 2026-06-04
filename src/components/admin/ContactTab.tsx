import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { getContactInfo, updateContactInfo, updateOpeningHour } from "@/lib/admin.functions";
import { publicDataQuery } from "@/lib/queries";
import { toast } from "sonner";

const WEEKDAYS = [
  { weekday: 1, label: "Montag" },
  { weekday: 2, label: "Dienstag" },
  { weekday: 3, label: "Mittwoch" },
  { weekday: 4, label: "Donnerstag" },
  { weekday: 5, label: "Freitag" },
  { weekday: 6, label: "Samstag" },
  { weekday: 0, label: "Sonntag" },
];

export function ContactTab() {
  const qc = useQueryClient();
  const getFn = useServerFn(getContactInfo);
  const updFn = useServerFn(updateContactInfo);
  const hourFn = useServerFn(updateOpeningHour);
  const { data: contact, isLoading } = useQuery({ queryKey: ["contact-admin"], queryFn: () => getFn() });
  const publicData = useQuery(publicDataQuery);
  const [form, setForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (contact) setForm({
      restaurant_name: contact.restaurant_name ?? "",
      address_line1: contact.address_line1 ?? "",
      address_line2: contact.address_line2 ?? "",
      city: contact.city ?? "",
      postal_code: contact.postal_code ?? "",
      phone: contact.phone ?? "",
      email: contact.email ?? "",
      notification_email: contact.notification_email ?? "",
      instagram_url: contact.instagram_url ?? "",
      facebook_url: contact.facebook_url ?? "",
      maps_embed_url: contact.maps_embed_url ?? "",
    });
  }, [contact]);

  async function save() {
    setSaving(true);
    try {
      await updFn({ data: form as never });
      toast.success("Kontakt gespeichert");
      qc.invalidateQueries({ queryKey: ["public-data"] });
    } catch (e) { toast.error(e instanceof Error ? e.message : "Fehler"); }
    finally { setSaving(false); }
  }

  if (isLoading || !contact) return <p className="text-muted-foreground">Lade …</p>;

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div className="space-y-10 max-w-3xl">
      <section>
        <h2 className="font-display text-2xl mb-4">Kontakt & Adresse</h2>
        <div className="bg-card border border-border rounded-sm p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Restaurant-Name" value={form.restaurant_name} onChange={set("restaurant_name")} />
          <Field label="Telefon" value={form.phone} onChange={set("phone")} />
          <Field label="Adresse Zeile 1" value={form.address_line1} onChange={set("address_line1")} />
          <Field label="Adresse Zeile 2" value={form.address_line2} onChange={set("address_line2")} />
          <Field label="PLZ" value={form.postal_code} onChange={set("postal_code")} />
          <Field label="Ort" value={form.city} onChange={set("city")} />
          <Field label="Öffentliche E-Mail" value={form.email} onChange={set("email")} />
          <Field label="Benachrichtigungs-E-Mail (für neue Reservierungen)" value={form.notification_email} onChange={set("notification_email")} />
          <Field label="Instagram URL" value={form.instagram_url} onChange={set("instagram_url")} />
          <Field label="Facebook URL" value={form.facebook_url} onChange={set("facebook_url")} />
          <div className="sm:col-span-2">
            <label className="block text-xs uppercase tracking-widest text-muted-foreground mb-2">Google Maps Embed URL</label>
            <textarea rows={2} value={form.maps_embed_url} onChange={set("maps_embed_url")}
              className="w-full bg-background border border-border rounded-sm px-3 py-2 focus:border-gold outline-none text-sm" />
          </div>
          <div className="sm:col-span-2 flex justify-end">
            <button onClick={save} disabled={saving}
              className="rounded-full bg-gold px-6 py-2.5 text-xs uppercase tracking-widest text-gold-foreground disabled:opacity-50">
              {saving ? "…" : "Speichern"}
            </button>
          </div>
        </div>
      </section>

      <section>
        <h2 className="font-display text-2xl mb-4">Öffnungszeiten</h2>
        <div className="bg-card border border-border rounded-sm p-6 space-y-3">
          {WEEKDAYS.map((d) => {
            const row = publicData.data?.hours.find((h) => h.weekday === d.weekday);
            if (!row) return null;
            return <HourRow key={d.weekday} row={row} onSave={async (patch) => {
              try {
                await hourFn({ data: { weekday: d.weekday, ...patch } });
                toast.success(`${d.label} gespeichert`);
                qc.invalidateQueries({ queryKey: ["public-data"] });
              } catch (e) { toast.error(e instanceof Error ? e.message : "Fehler"); }
            }} />;
          })}
        </div>
      </section>
    </div>
  );
}

function Field({ label, ...rest }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label className="block text-xs uppercase tracking-widest text-muted-foreground mb-2">{label}</label>
      <input {...rest} className="w-full bg-background border border-border rounded-sm px-3 py-2 focus:border-gold outline-none text-sm" />
    </div>
  );
}

type Hour = { weekday: number; label: string; is_closed: boolean; open_time: string; close_time: string; note: string };
function HourRow({ row, onSave }: { row: Hour; onSave: (patch: Omit<Hour, "weekday" | "label">) => Promise<void> }) {
  const [closed, setClosed] = useState(row.is_closed);
  const [open, setOpen] = useState(row.open_time);
  const [close, setClose] = useState(row.close_time);
  const [note, setNote] = useState(row.note);

  return (
    <div className="flex flex-wrap items-center gap-3 py-2 border-b border-border last:border-0">
      <span className="w-24 text-sm">{row.label}</span>
      <label className="flex items-center gap-2 text-xs">
        <input type="checkbox" checked={closed} onChange={(e) => setClosed(e.target.checked)} /> geschlossen
      </label>
      <input type="time" value={open} onChange={(e) => setOpen(e.target.value)} disabled={closed}
        className="bg-background border border-border rounded-sm px-2 py-1.5 text-sm disabled:opacity-40" />
      <span>–</span>
      <input type="time" value={close} onChange={(e) => setClose(e.target.value)} disabled={closed}
        className="bg-background border border-border rounded-sm px-2 py-1.5 text-sm disabled:opacity-40" />
      <input type="text" placeholder="Notiz" value={note} onChange={(e) => setNote(e.target.value)}
        className="flex-1 min-w-32 bg-background border border-border rounded-sm px-2 py-1.5 text-sm" />
      <button onClick={() => onSave({ is_closed: closed, open_time: open, close_time: close, note })}
        className="rounded-full bg-gold/90 hover:bg-gold px-4 py-1.5 text-xs uppercase tracking-widest text-gold-foreground">
        Speichern
      </button>
    </div>
  );
}
