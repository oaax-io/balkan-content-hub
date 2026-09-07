import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  listNewsletterSubscribers,
  saveNewsletterSubscriber,
  deleteNewsletterSubscriber,
  importFromReservations,
} from "@/lib/newsletter.functions";
import { ConfirmDialog } from "@/components/admin/InAppDialogs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Download, RefreshCw, Trash2, Pencil, Plus, Search } from "lucide-react";

type Row = {
  id: string;
  name: string;
  email: string;
  source: string;
  subscribed: boolean;
  note: string;
  created_at: string;
};

export function NewsletterTab() {
  const listFn = useServerFn(listNewsletterSubscribers);
  const saveFn = useServerFn(saveNewsletterSubscriber);
  const delFn = useServerFn(deleteNewsletterSubscriber);
  const importFn = useServerFn(importFromReservations);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["newsletter-subscribers"],
    queryFn: () => listFn(),
  });

  const rows = (data ?? []) as Row[];
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [editRow, setEditRow] = useState<Partial<Row> | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [formError, setFormError] = useState("");

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((r) => r.name.toLowerCase().includes(term) || r.email.toLowerCase().includes(term));
  }, [rows, q]);

  const activeCount = rows.filter((r) => r.subscribed).length;

  async function doImport() {
    setBusy(true);
    try {
      const res = await importFn();
      toast.success(res.added > 0 ? `${res.added} neue Adresse(n) übernommen.` : "Keine neuen Adressen gefunden.");
      refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Fehler beim Import");
    } finally {
      setBusy(false);
    }
  }

  async function doSave() {
    if (!editRow) return;
    setFormError("");
    const email = (editRow.email ?? "").trim();
    if (!email || !email.includes("@")) {
      setFormError("Bitte eine gültige E-Mail-Adresse eingeben.");
      return;
    }
    setBusy(true);
    try {
      await saveFn({
        data: {
          ...(editRow.id ? { id: editRow.id } : {}),
          name: (editRow.name ?? "").trim(),
          email,
          note: (editRow.note ?? "").trim(),
          subscribed: editRow.subscribed ?? true,
        },
      });
      toast.success("Gespeichert.");
      setEditRow(null);
      refetch();
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Fehler beim Speichern");
    } finally {
      setBusy(false);
    }
  }

  async function doDelete(id: string) {
    setBusy(true);
    try {
      await delFn({ data: { id } });
      toast.success("Eintrag gelöscht.");
      refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Fehler beim Löschen");
    } finally {
      setBusy(false);
      setConfirmId(null);
    }
  }

  function exportCsv() {
    const head = "Name;E-Mail;Status;Herkunft;Erfasst am";
    const lines = filtered.map((r) =>
      [
        r.name.replace(/;/g, ","),
        r.email,
        r.subscribed ? "angemeldet" : "abgemeldet",
        r.source === "reservation" ? "Reservierung" : "manuell",
        new Date(r.created_at).toLocaleDateString("de-CH"),
      ].join(";"),
    );
    const blob = new Blob(["\uFEFF" + [head, ...lines].join("\r\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `newsletter-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Adressen total" value={rows.length} />
        <StatCard label="Angemeldet" value={activeCount} />
        <StatCard label="Abgemeldet" value={rows.length - activeCount} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name oder E-Mail suchen …" className="pl-9" />
        </div>
        <Button variant="outline" onClick={doImport} disabled={busy}>
          <RefreshCw className="w-4 h-4 mr-2" /> Aus Reservierungen übernehmen
        </Button>
        <Button variant="outline" onClick={exportCsv} disabled={filtered.length === 0}>
          <Download className="w-4 h-4 mr-2" /> CSV Export
        </Button>
        <Button onClick={() => { setFormError(""); setEditRow({ name: "", email: "", note: "", subscribed: true }); }}>
          <Plus className="w-4 h-4 mr-2" /> Adresse hinzufügen
        </Button>
      </div>

      <div className="border border-border rounded-sm overflow-x-auto bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-xs uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="text-left px-4 py-3">Name</th>
              <th className="text-left px-4 py-3">E-Mail</th>
              <th className="text-left px-4 py-3">Status</th>
              <th className="text-left px-4 py-3">Herkunft</th>
              <th className="text-left px-4 py-3">Erfasst</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">Lade …</td></tr>
            )}
            {!isLoading && filtered.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">Keine Einträge.</td></tr>
            )}
            {filtered.map((r) => (
              <tr key={r.id} className="border-t border-border">
                <td className="px-4 py-3">{r.name || "—"}</td>
                <td className="px-4 py-3">{r.email}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-1 rounded-full ${r.subscribed ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                    {r.subscribed ? "angemeldet" : "abgemeldet"}
                  </span>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{r.source === "reservation" ? "Reservierung" : "manuell"}</td>
                <td className="px-4 py-3 text-muted-foreground">{new Date(r.created_at).toLocaleDateString("de-CH")}</td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-1">
                    <Button size="icon" variant="ghost" onClick={() => { setFormError(""); setEditRow(r); }} aria-label="Bearbeiten">
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => setConfirmId(r.id)} aria-label="Löschen">
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Dialog open={!!editRow} onOpenChange={(v) => !v && setEditRow(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editRow?.id ? "Adresse bearbeiten" : "Adresse hinzufügen"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input value={editRow?.name ?? ""} onChange={(e) => setEditRow((p) => ({ ...p, name: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>E-Mail</Label>
              <Input type="email" value={editRow?.email ?? ""} onChange={(e) => setEditRow((p) => ({ ...p, email: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Notiz</Label>
              <Input value={editRow?.note ?? ""} onChange={(e) => setEditRow((p) => ({ ...p, note: e.target.value }))} />
            </div>
            <div className="flex items-center justify-between">
              <Label>Newsletter angemeldet</Label>
              <Switch checked={editRow?.subscribed ?? true} onCheckedChange={(v) => setEditRow((p) => ({ ...p, subscribed: v }))} />
            </div>
            {formError && (
              <div className="rounded-sm border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{formError}</div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditRow(null)}>Abbrechen</Button>
            <Button onClick={doSave} disabled={busy}>Speichern</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!confirmId}
        onOpenChange={(v) => !v && setConfirmId(null)}
        title="Adresse löschen?"
        description="Der Eintrag wird endgültig aus dem Newsletter entfernt."
        confirmLabel="Löschen"
        destructive
        onConfirm={() => confirmId && doDelete(confirmId)}
      />
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="border border-border rounded-sm bg-card p-4">
      <div className="text-xs uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="font-display text-2xl mt-1">{value}</div>
    </div>
  );
}
