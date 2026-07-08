import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { checkIsAdmin, claimAdmin } from "@/lib/admin.functions";
import { listReservations } from "@/lib/reservations.functions";
import { DashboardTab } from "@/components/admin/DashboardTab";
import { ContentTab } from "@/components/admin/ContentTab";
import { ContactTab } from "@/components/admin/ContactTab";
import { ReservationsTab } from "@/components/admin/ReservationsTab";
import { SettingsTab } from "@/components/admin/SettingsTab";
import { SeoTab } from "@/components/admin/SeoTab";
import { AnalyticsTab } from "@/components/admin/AnalyticsTab";
import { EmailTab } from "@/components/admin/EmailTab";
import { EmailTemplatesTab } from "@/components/admin/EmailTemplatesTab";
import { toast } from "sonner";

import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarTrigger,
  SidebarMenuBadge,
} from "@/components/ui/sidebar";
import { LayoutDashboard, CalendarDays, FileText, MapPin, Settings, LogOut, ExternalLink, ShieldCheck, Search, BarChart3, Mail } from "lucide-react";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Admin — Balkaneros" }] }),
  component: Admin,
});

type Tab = "dashboard" | "reservations" | "content" | "contact" | "analytics" | "seo" | "email" | "settings";

const NAV: { key: Tab; label: string; icon: typeof LayoutDashboard }[] = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { key: "reservations", label: "Reservierungen", icon: CalendarDays },
  { key: "content", label: "Inhalte & Bilder", icon: FileText },
  { key: "contact", label: "Kontakt & Zeiten", icon: MapPin },
  { key: "analytics", label: "Website Analytics", icon: BarChart3 },
  { key: "seo", label: "SEO Optimierung", icon: Search },
  { key: "email", label: "E-Mail-Versand", icon: Mail },
  { key: "settings", label: "Einstellungen", icon: Settings },
];

const TITLES: Record<Tab, string> = {
  dashboard: "Dashboard",
  reservations: "Reservierungen",
  content: "Inhalte & Bilder",
  contact: "Kontakt & Öffnungszeiten",
  analytics: "Website Analytics",
  seo: "SEO Optimierung",
  email: "E-Mail-Versand (SMTP)",
  settings: "Einstellungen",
};

function Admin() {
  const checkFn = useServerFn(checkIsAdmin);
  const { data, isLoading, refetch } = useQuery({ queryKey: ["is-admin"], queryFn: () => checkFn() });

  if (isLoading) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Lade …</div>;
  if (!data?.isAdmin) return <NoAccess onClaimed={refetch} />;
  return <AdminShell />;
}

function AdminShell() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("dashboard");
  const listFn = useServerFn(listReservations);
  const { data: reservations } = useQuery({ queryKey: ["reservations"], queryFn: () => listFn() });
  const pendingCount = (reservations ?? []).filter((r) => r.status === "pending").length;

  async function logout() {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="light">
      <SidebarProvider>
        <div className="min-h-screen flex w-full bg-background text-foreground">
          <Sidebar className="border-r border-sidebar-border">
            <SidebarHeader className="border-b border-sidebar-border">
              <Link to="/" className="flex items-center gap-3 px-2 py-3">
                <div className="leading-tight">
                  <div className="font-display text-base text-sidebar-foreground">Balkaneros</div>
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground">Admin</div>
                </div>
              </Link>
            </SidebarHeader>

            <SidebarContent>
              <SidebarGroup>
                <SidebarGroupLabel>Verwaltung</SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    {NAV.map((item) => (
                      <SidebarMenuItem key={item.key}>
                        <SidebarMenuButton isActive={tab === item.key} onClick={() => setTab(item.key)} tooltip={item.label}>
                          <item.icon className="w-4 h-4" />
                          <span>{item.label}</span>
                        </SidebarMenuButton>
                        {item.key === "reservations" && pendingCount > 0 && (
                          <SidebarMenuBadge className="bg-primary text-primary-foreground">{pendingCount}</SidebarMenuBadge>
                        )}
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>

              <SidebarGroup>
                <SidebarGroupLabel>Website</SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu>
                    <SidebarMenuItem>
                      <SidebarMenuButton asChild tooltip="Website öffnen">
                        <Link to="/" target="_blank">
                          <ExternalLink className="w-4 h-4" />
                          <span>Website öffnen</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            </SidebarContent>

            <SidebarFooter className="border-t border-sidebar-border">
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton onClick={logout} tooltip="Abmelden">
                    <LogOut className="w-4 h-4" />
                    <span>Abmelden</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarFooter>
          </Sidebar>

          <div className="flex-1 flex flex-col min-w-0">
            <header className="h-14 border-b border-border bg-card flex items-center gap-3 px-4 sticky top-0 z-10">
              <SidebarTrigger />
              <div className="h-5 w-px bg-border" />
              <h1 className="font-display text-lg text-foreground">{TITLES[tab]}</h1>
              <div className="ml-auto flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <ShieldCheck className="w-4 h-4 text-primary" /> Administrator
              </div>
            </header>

            <main className="flex-1 px-6 py-8 overflow-y-auto bg-background">
              <div className="mx-auto max-w-6xl">
                {tab === "dashboard" && <DashboardTab onNavigate={(t) => setTab(t as Tab)} />}
                {tab === "reservations" && <ReservationsTab />}
                {tab === "content" && <ContentTab />}
                {tab === "contact" && <ContactTab />}
                {tab === "analytics" && <AnalyticsTab />}
                {tab === "seo" && <SeoTab />}
                {tab === "email" && <EmailTab />}
                {tab === "settings" && <SettingsTab />}
              </div>
            </main>
          </div>
        </div>
      </SidebarProvider>
    </div>
  );
}

function NoAccess({ onClaimed }: { onClaimed: () => void }) {
  const navigate = useNavigate();
  const claimFn = useServerFn(claimAdmin);
  const [claiming, setClaiming] = useState(false);

  async function doClaim() {
    setClaiming(true);
    try {
      const res = await claimFn();
      if (res.ok) { toast.success("Du bist jetzt Admin."); onClaimed(); }
      else toast.error("Es existiert bereits ein Admin-Account.");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Fehler"); }
    finally { setClaiming(false); }
  }

  async function logout() {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="bg-card border border-border rounded-sm p-8 max-w-md text-center">
        <h1 className="font-display text-2xl mb-3">Kein Admin-Zugriff</h1>
        <p className="text-muted-foreground text-sm mb-6">
          Dein Konto hat noch keine Admin-Rechte. Wenn noch kein Admin existiert, kannst du dich jetzt als erster Admin einrichten.
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
