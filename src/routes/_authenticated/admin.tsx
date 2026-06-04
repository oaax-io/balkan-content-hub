import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { checkIsAdmin, claimAdmin } from "@/lib/admin.functions";
import { ContentTab } from "@/components/admin/ContentTab";
import { ContactTab } from "@/components/admin/ContactTab";
import { ReservationsTab } from "@/components/admin/ReservationsTab";
import { toast } from "sonner";
import logo from "@/assets/logo.webp";
import { LogOut } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Admin — Balkaneros" }] }),
  component: Admin,
});

type Tab = "content" | "contact" | "reservations";

function Admin() {
  const navigate = useNavigate();
  const checkFn = useServerFn(checkIsAdmin);
  const claimFn = useServerFn(claimAdmin);
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["is-admin"],
    queryFn: () => checkFn(),
  });
  const [tab, setTab] = useState<Tab>("reservations");
  const [claiming, setClaiming] = useState(false);

  async function doClaim() {
    setClaiming(true);
    try {
      const res = await claimFn();
      if (res.ok) { toast.success("Du bist jetzt Admin."); refetch(); }
      else toast.error("Es existiert bereits ein Admin-Account.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Fehler");
    } finally { setClaiming(false); }
  }

  async function logout() {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  useEffect(() => {
    if (data && !data.isAdmin) {
      // user is logged in but not admin
    }
  }, [data]);

  if (isLoading) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Lade …</div>;

  if (!data?.isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="bg-card border border-border rounded-sm p-8 max-w-md text-center">
          <h1 className="font-display text-2xl mb-3">Kein Admin-Zugriff</h1>
          <p className="text-muted-foreground text-sm mb-6">
            Dein Konto hat noch keine Admin-Rechte. Wenn noch kein Admin existiert,
            kannst du dich jetzt als erster Admin einrichten.
          </p>
          <button onClick={doClaim} disabled={claiming}
            className="rounded-full bg-gold px-6 py-2.5 text-sm uppercase tracking-widest text-gold-foreground disabled:opacity-50">
            {claiming ? "…" : "Als Admin einrichten"}
          </button>
          <button onClick={logout} className="block mx-auto mt-4 text-xs text-muted-foreground hover:text-gold">Abmelden</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-border bg-card">
        <div className="mx-auto max-w-7xl px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-3"><img src={logo} alt="Balkaneros" className="h-10" /></Link>
          <h1 className="font-display text-xl hidden md:block">Admin</h1>
          <button onClick={logout} className="text-sm text-muted-foreground hover:text-gold flex items-center gap-2">
            <LogOut className="w-4 h-4" /> Abmelden
          </button>
        </div>
        <nav className="mx-auto max-w-7xl px-6 flex gap-1 -mb-px">
          {([
            ["reservations", "Reservierungen"],
            ["content", "Inhalte & Bilder"],
            ["contact", "Kontakt & Öffnungszeiten"],
          ] as const).map(([k, label]) => (
            <button key={k} onClick={() => setTab(k)}
              className={`px-4 py-3 text-sm border-b-2 transition ${tab === k ? "border-gold text-gold" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
              {label}
            </button>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-7xl px-6 py-10">
        {tab === "reservations" && <ReservationsTab />}
        {tab === "content" && <ContentTab />}
        {tab === "contact" && <ContactTab />}
      </main>
    </div>
  );
}
