import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getEmailSettings, updateEmailSettings, sendTestEmail } from "@/lib/email-settings.functions";
import { toast } from "sonner";
import { Mail, Server, Info, Send } from "lucide-react";


type Form = {
  smtp_host: string;
  smtp_port: number | "";
  smtp_secure: boolean;
  smtp_username: string;
  smtp_password: string;
  from_email: string;
  from_name: string;
  reply_to: string;
  enabled: boolean;
};

const EMPTY: Form = {
  smtp_host: "",
  smtp_port: 587,
  smtp_secure: true,
  smtp_username: "",
  smtp_password: "",
  from_email: "",
  from_name: "",
  reply_to: "",
  enabled: false,
};

export function EmailTab() {
  const getFn = useServerFn(getEmailSettings);
  const saveFn = useServerFn(updateEmailSettings);
  const testFn = useServerFn(sendTestEmail);
  const { data, refetch, isLoading } = useQuery({ queryKey: ["email-settings"], queryFn: () => getFn() });
  const [form, setForm] = useState<Form>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [testEmail, setTestEmail] = useState("");
  const [testTemplate, setTestTemplate] = useState<
    "request_received" | "confirmed" | "declined" | "cancelled" | "admin_notification"
  >("confirmed");
  const [testing, setTesting] = useState(false);

  async function sendTest() {
    if (!testEmail) {
      toast.error("Bitte E-Mail-Adresse eingeben");
      return;
    }
    setTesting(true);
    try {
      await testFn({ data: { to: testEmail, template: testTemplate } });
      toast.success(`Test-E-Mail an ${testEmail} versendet`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Fehler beim Versand");
    } finally {
      setTesting(false);
    }
  }


  useEffect(() => {
    if (data) {
      setForm({
        smtp_host: data.smtp_host ?? "",
        smtp_port: data.smtp_port ?? 587,
        smtp_secure: data.smtp_secure ?? true,
        smtp_username: data.smtp_username ?? "",
        smtp_password: data.smtp_password ?? "",
        from_email: data.from_email ?? "",
        from_name: data.from_name ?? "",
        reply_to: data.reply_to ?? "",
        enabled: data.enabled ?? false,
      });
    }
  }, [data]);

  function set<K extends keyof Form>(k: K, v: Form[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      await saveFn({
        data: {
          ...form,
          provider: "smtp",
          smtp_port: form.smtp_port === "" ? null : Number(form.smtp_port),
        } as any,
      });
      toast.success("Einstellungen gespeichert");
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Fehler beim Speichern");
    } finally {
      setSaving(false);
    }
  }

  if (isLoading) return <div className="text-muted-foreground text-sm">Lade …</div>;

  return (
    <div className="space-y-8 max-w-3xl">
      <header>
        <h2 className="font-display text-3xl">E-Mail-Versand (SMTP)</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Versand erfolgt über den hinterlegten SMTP-Server.
        </p>
      </header>

      <div className="rounded-md border border-gold/30 bg-gold/5 p-4 flex gap-3 text-sm">
        <Info className="w-4 h-4 text-gold shrink-0 mt-0.5" />
        <div className="text-foreground/80">
          Alle transaktionalen E-Mails (Reservierungsbestätigung, Storno-Link, Admin-Benachrichtigung)
          werden über die untenstehenden SMTP-Zugangsdaten versendet.
        </div>
      </div>

      <form onSubmit={save} className="space-y-6">
        <section className="bg-card border border-border rounded-sm p-6 space-y-4">
          <div className="flex items-center gap-3">
            <Mail className="w-5 h-5 text-gold" />
            <h3 className="font-display text-xl">Absender</h3>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="Absender-Name">
              <input
                type="text"
                value={form.from_name}
                onChange={(e) => set("from_name", e.target.value)}
                placeholder="Balkaneros"
                className={inputClass}
              />
            </Field>
            <Field label="Absender-E-Mail">
              <input
                type="email"
                value={form.from_email}
                onChange={(e) => set("from_email", e.target.value)}
                placeholder="notify@balkaneros.ch"
                className={inputClass}
              />
            </Field>
            <Field label="Antwort an (optional)" className="sm:col-span-2">
              <input
                type="email"
                value={form.reply_to}
                onChange={(e) => set("reply_to", e.target.value)}
                placeholder="info@balkaneros.ch"
                className={inputClass}
              />
            </Field>
          </div>
        </section>

        <section className="bg-card border border-gold/50 rounded-sm p-6 space-y-4">
          <div className="flex items-center gap-3">
            <Server className="w-5 h-5 text-gold" />
            <h3 className="font-display text-xl">SMTP-Zugangsdaten</h3>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="SMTP-Host">
              <input
                type="text"
                value={form.smtp_host}
                onChange={(e) => set("smtp_host", e.target.value)}
                placeholder="smtp.example.com"
                className={inputClass}
              />
            </Field>
            <Field label="Port">
              <input
                type="number"
                value={form.smtp_port}
                onChange={(e) =>
                  set("smtp_port", e.target.value === "" ? "" : Number(e.target.value))
                }
                placeholder="587"
                className={inputClass}
              />
            </Field>
            <Field label="Benutzername">
              <input
                type="text"
                value={form.smtp_username}
                onChange={(e) => set("smtp_username", e.target.value)}
                autoComplete="off"
                className={inputClass}
              />
            </Field>
            <Field label="Passwort">
              <input
                type="password"
                value={form.smtp_password}
                onChange={(e) => set("smtp_password", e.target.value)}
                autoComplete="new-password"
                placeholder="••••••••"
                className={inputClass}
              />
            </Field>
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <input
                type="checkbox"
                checked={form.smtp_secure}
                onChange={(e) => set("smtp_secure", e.target.checked)}
                className="w-4 h-4 accent-[hsl(var(--gold))]"
              />
              TLS/SSL verwenden (empfohlen — Port 465 = SSL, Port 587 = STARTTLS)
            </label>
          </div>
        </section>

        <section className="bg-card border border-border rounded-sm p-6">
          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              checked={form.enabled}
              onChange={(e) => set("enabled", e.target.checked)}
              className="w-4 h-4 accent-[hsl(var(--gold))] mt-1"
            />
            <div>
              <div className="font-medium">E-Mail-Versand aktivieren</div>
              <div className="text-xs text-muted-foreground mt-1">
                Wenn deaktiviert, werden keine automatischen E-Mails versendet.
              </div>
            </div>
          </label>
        </section>

        <div className="flex justify-end gap-3">
          <button
            type="submit"
            disabled={saving}
            className="rounded-full bg-gold px-6 py-2.5 text-xs uppercase tracking-widest text-gold-foreground disabled:opacity-50"
          >
            {saving ? "Speichern …" : "Einstellungen speichern"}
          </button>
        </div>
      </form>
    </div>
  );
}

const inputClass =
  "w-full bg-background border border-border rounded-sm px-3 py-2.5 text-sm focus:border-gold outline-none";

function Field({
  label,
  children,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label className="block text-xs uppercase tracking-widest text-muted-foreground mb-2">
        {label}
      </label>
      {children}
    </div>
  );
}
