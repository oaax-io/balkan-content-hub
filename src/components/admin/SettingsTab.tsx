import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { KeyRound, User, ShieldCheck } from "lucide-react";

export function SettingsTab() {
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? ""));
  }, []);

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    if (pw.length < 8) { toast.error("Mindestens 8 Zeichen"); return; }
    if (pw !== pw2) { toast.error("Passwörter stimmen nicht überein"); return; }
    setSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: pw });
      if (error) throw error;
      toast.success("Passwort aktualisiert");
      setPw(""); setPw2("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Fehler");
    } finally { setSaving(false); }
  }

  return (
    <div className="space-y-8 max-w-2xl">
      <header>
        <h2 className="font-display text-3xl">Einstellungen</h2>
        <p className="text-sm text-muted-foreground mt-1">Kontoeinstellungen und Sicherheit.</p>
      </header>

      <section className="bg-card border border-border rounded-sm p-6">
        <div className="flex items-center gap-3 mb-4">
          <User className="w-5 h-5 text-gold" />
          <h3 className="font-display text-xl">Konto</h3>
        </div>
        <div className="grid sm:grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-xs uppercase tracking-widest text-muted-foreground mb-1">E-Mail</div>
            <div className="font-medium">{email || "—"}</div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-widest text-muted-foreground mb-1">Rolle</div>
            <div className="font-medium flex items-center gap-1.5"><ShieldCheck className="w-4 h-4 text-gold" /> Administrator</div>
          </div>
        </div>
      </section>

      <section className="bg-card border border-border rounded-sm p-6">
        <div className="flex items-center gap-3 mb-4">
          <KeyRound className="w-5 h-5 text-gold" />
          <h3 className="font-display text-xl">Passwort ändern</h3>
        </div>
        <form onSubmit={changePassword} className="space-y-4">
          <div>
            <label className="block text-xs uppercase tracking-widest text-muted-foreground mb-2">Neues Passwort</label>
            <input type="password" required minLength={8} value={pw} onChange={(e) => setPw(e.target.value)}
              className="w-full bg-background border border-border rounded-sm px-3 py-2.5 focus:border-gold outline-none" />
          </div>
          <div>
            <label className="block text-xs uppercase tracking-widest text-muted-foreground mb-2">Wiederholen</label>
            <input type="password" required minLength={8} value={pw2} onChange={(e) => setPw2(e.target.value)}
              className="w-full bg-background border border-border rounded-sm px-3 py-2.5 focus:border-gold outline-none" />
          </div>
          <div className="flex justify-end">
            <button type="submit" disabled={saving}
              className="rounded-full bg-gold px-6 py-2.5 text-xs uppercase tracking-widest text-gold-foreground disabled:opacity-50">
              {saving ? "…" : "Passwort speichern"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
