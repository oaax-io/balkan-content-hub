import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import logo from "@/assets/logo.webp";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Admin-Login — Balkaneros" }] }),
  component: Auth,
});

function Auth() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session) navigate({ to: "/admin", replace: true });
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/admin", replace: true });
    });
    return () => subscription.unsubscribe();
  }, [navigate]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Fehler");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <Link to="/" className="flex justify-center mb-8"><img src={logo} alt="Balkaneros" className="h-14" /></Link>
        <div className="bg-card border border-border rounded-sm p-8">
          <h1 className="font-display text-3xl text-center mb-2">Admin-Login</h1>
          <p className="text-center text-muted-foreground text-sm mb-6">
            Melde dich an, um die Website zu verwalten.
          </p>
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label className="block text-xs uppercase tracking-widest text-muted-foreground mb-2">E-Mail</label>
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-background border border-border rounded-sm px-3 py-2.5 focus:border-gold outline-none" />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-widest text-muted-foreground mb-2">Passwort</label>
              <input type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-background border border-border rounded-sm px-3 py-2.5 focus:border-gold outline-none" />
            </div>
            <button type="submit" disabled={loading}
              className="w-full rounded-full bg-gold px-8 py-3 text-sm font-medium uppercase tracking-widest text-gold-foreground hover:opacity-90 disabled:opacity-50">
              {loading ? "Bitte warten …" : "Einloggen"}
            </button>
          </form>
        </div>
        <p className="text-center text-xs text-muted-foreground mt-6">
          <Link to="/" className="hover:text-gold">← zurück zur Website</Link>
        </p>
      </div>
    </div>
  );
}
