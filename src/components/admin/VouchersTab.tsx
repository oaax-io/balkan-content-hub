import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listVouchers, updateVoucher, getVoucherPdfUrl, regenerateVoucherPdf, previewVoucherPdf,
} from "@/lib/vouchers.functions";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Eye, RefreshCw, Save, FileText } from "lucide-react";
import { VoucherPdfPreview } from "./VoucherPdfPreview";


type Voucher = {
  id: string;
  voucher_code: string;
  amount_chf: number;
  recipient_first_name: string;
  recipient_last_name: string;
  personal_message: string | null;
  buyer_name: string;
  buyer_email: string;
  status: string;
  issued_at: string | null;
  expires_at: string | null;
  redeemed_at: string | null;
  redeemed_note: string | null;
  internal_note: string | null;
  pdf_path: string | null;
  email_sent_at: string | null;
  created_at: string;
};

const STATUS_LABELS: Record<string, { label: string; class: string }> = {
  pending: { label: "Ausstehend", class: "bg-yellow-500/15 text-yellow-500 border-yellow-500/30" },
  paid: { label: "Bezahlt", class: "bg-green-500/15 text-green-600 border-green-500/30" },
  redeemed: { label: "Eingelöst", class: "bg-blue-500/15 text-blue-600 border-blue-500/30" },
  cancelled: { label: "Storniert", class: "bg-red-500/15 text-red-600 border-red-500/30" },
};

export function VouchersTab() {
  const qc = useQueryClient();
  const listFn = useServerFn(listVouchers);
  const previewFn = useServerFn(previewVoucherPdf);
  const { data: vouchers, isLoading } = useQuery<Voucher[]>({ queryKey: ["vouchers"], queryFn: () => listFn() as Promise<Voucher[]> });

  const [filter, setFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Voucher | null>(null);
  const [preview, setPreview] = useState<{ bytes: Uint8Array; url: string } | null>(null);

  const filtered = (vouchers ?? []).filter((v) => {
    if (filter !== "all" && v.status !== filter) return false;
    const s = search.trim().toLowerCase();
    if (!s) return true;
    return (
      v.voucher_code.toLowerCase().includes(s) ||
      v.recipient_first_name.toLowerCase().includes(s) ||
      v.recipient_last_name.toLowerCase().includes(s) ||
      v.buyer_name.toLowerCase().includes(s) ||
      v.buyer_email.toLowerCase().includes(s)
    );
  });

  async function openPreview() {
    try {
      const res = await previewFn();
      const bin = atob(res.pdfBase64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const blob = new Blob([bytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      setPreview((prev) => {
        if (prev) URL.revokeObjectURL(prev.url);
        return { bytes, url };
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Fehler");
    }
  }



  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between gap-3 items-start sm:items-center">
        <div>
          <h2 className="font-display text-2xl">Gutscheine</h2>
          <p className="text-sm text-muted-foreground">Alle verkauften Gutscheine · {filtered.length} von {vouchers?.length ?? 0}</p>
        </div>
        <button onClick={openPreview} className="rounded-full border border-gold px-5 py-2 text-xs uppercase tracking-widest text-gold hover:bg-gold/10 inline-flex items-center gap-2">
          <FileText className="w-3.5 h-3.5" /> Vorschau PDF
        </button>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <select value={filter} onChange={(e) => setFilter(e.target.value)} className="rounded-sm border border-border bg-card px-3 py-1.5 text-sm">
          <option value="all">Alle Status</option>
          <option value="pending">Ausstehend</option>
          <option value="paid">Bezahlt</option>
          <option value="redeemed">Eingelöst</option>
          <option value="cancelled">Storniert</option>
        </select>
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Suche Code, Name, E-Mail…"
          className="rounded-sm border border-border bg-card px-3 py-1.5 text-sm flex-1 min-w-[200px]" />
      </div>

      {isLoading ? (
        <p className="text-muted-foreground text-sm">Lade …</p>
      ) : filtered.length === 0 ? (
        <div className="border border-dashed border-border rounded-sm p-10 text-center text-muted-foreground text-sm">
          Keine Gutscheine gefunden.
        </div>
      ) : (
        <div className="overflow-x-auto border border-border rounded-sm">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="text-left px-3 py-2.5">Code</th>
                <th className="text-right px-3 py-2.5">Betrag</th>
                <th className="text-left px-3 py-2.5">Empfänger</th>
                <th className="text-left px-3 py-2.5">Käufer</th>
                <th className="text-left px-3 py-2.5">Status</th>
                <th className="text-left px-3 py-2.5">Ausgestellt</th>
                <th className="text-left px-3 py-2.5">Läuft ab</th>
                <th className="px-3 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((v) => {
                const st = STATUS_LABELS[v.status] || STATUS_LABELS.pending;
                return (
                  <tr key={v.id} className="border-t border-border hover:bg-muted/20">
                    <td className="px-3 py-2 font-mono text-xs text-gold">{v.voucher_code}</td>
                    <td className="px-3 py-2 text-right font-medium">CHF {Number(v.amount_chf).toFixed(0)}</td>
                    <td className="px-3 py-2">{v.recipient_first_name} {v.recipient_last_name}</td>
                    <td className="px-3 py-2">
                      <div>{v.buyer_name}</div>
                      <div className="text-xs text-muted-foreground">{v.buyer_email}</div>
                    </td>
                    <td className="px-3 py-2">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wider border ${st.class}`}>{st.label}</span>
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{v.issued_at ? new Date(v.issued_at).toLocaleDateString("de-CH") : "—"}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{v.expires_at ? new Date(v.expires_at).toLocaleDateString("de-CH") : "—"}</td>
                    <td className="px-3 py-2 text-right">
                      <button onClick={() => setEditing(v)} className="text-gold text-xs hover:underline">Bearbeiten</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {editing && <EditDialog voucher={editing} onClose={() => { setEditing(null); qc.invalidateQueries({ queryKey: ["vouchers"] }); }} />}

      <Dialog open={!!preview} onOpenChange={(o) => { if (!o) { if (preview) URL.revokeObjectURL(preview.url); setPreview(null); } }}>
        <DialogContent className="max-w-5xl h-[90vh] p-0 overflow-hidden flex flex-col">
          <DialogTitle className="sr-only">Gutschein PDF Vorschau</DialogTitle>
          <DialogDescription className="sr-only">Beispiel-Gutschein zum Prüfen des Designs</DialogDescription>
          {preview && (
            <>
              <div className="flex items-center justify-between px-4 py-2 border-b bg-card">
                <span className="text-xs uppercase tracking-widest text-gold">Gutschein Vorschau</span>
                <a href={preview.url} target="_blank" rel="noreferrer" className="text-xs text-muted-foreground hover:text-gold underline">In neuem Tab öffnen</a>
              </div>
              <div className="flex-1 min-h-0">
                <VoucherPdfPreview bytes={preview.bytes} />
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>


    </div>
  );
}

function EditDialog({ voucher, onClose }: { voucher: Voucher; onClose: () => void }) {
  const updateFn = useServerFn(updateVoucher);
  const pdfUrlFn = useServerFn(getVoucherPdfUrl);
  const regenFn = useServerFn(regenerateVoucherPdf);
  const [v, setV] = useState({
    amount_chf: Number(voucher.amount_chf),
    recipient_first_name: voucher.recipient_first_name,
    recipient_last_name: voucher.recipient_last_name,
    personal_message: voucher.personal_message ?? "",
    buyer_name: voucher.buyer_name,
    buyer_email: voucher.buyer_email,
    status: voucher.status as "pending" | "paid" | "redeemed" | "cancelled",
    expires_at: voucher.expires_at ? voucher.expires_at.slice(0, 10) : "",
    redeemed_note: voucher.redeemed_note ?? "",
    internal_note: voucher.internal_note ?? "",
  });
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      await updateFn({
        data: {
          id: voucher.id,
          amount_chf: v.amount_chf,
          recipient_first_name: v.recipient_first_name,
          recipient_last_name: v.recipient_last_name,
          personal_message: v.personal_message || null,
          buyer_name: v.buyer_name,
          buyer_email: v.buyer_email,
          status: v.status,
          expires_at: v.expires_at ? new Date(v.expires_at).toISOString() : null,
          redeemed_note: v.redeemed_note || null,
          internal_note: v.internal_note || null,
        },
      });
      toast.success("Gutschein gespeichert");
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Fehler");
    } finally {
      setSaving(false);
    }
  }

  async function openPdf() {
    try {
      const res = await pdfUrlFn({ data: { id: voucher.id } });
      if (res.url) window.open(res.url, "_blank");
      else toast.error("Kein PDF vorhanden. Bitte zuerst neu generieren.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Fehler");
    }
  }

  async function regen() {
    try {
      await regenFn({ data: { id: voucher.id } });
      toast.success("PDF neu generiert");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Fehler");
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[95vh] overflow-y-auto">
        <DialogTitle className="font-display text-xl">Gutschein bearbeiten</DialogTitle>
        <DialogDescription className="text-xs font-mono text-gold">{voucher.voucher_code}</DialogDescription>

        <div className="space-y-4 mt-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Betrag CHF">
              <input type="number" value={v.amount_chf} onChange={(e) => setV({ ...v, amount_chf: Number(e.target.value) })} className={inputCls} />
            </Field>
            <Field label="Status">
              <select value={v.status} onChange={(e) => setV({ ...v, status: e.target.value as typeof v.status })} className={inputCls}>
                <option value="pending">Ausstehend</option>
                <option value="paid">Bezahlt</option>
                <option value="redeemed">Eingelöst</option>
                <option value="cancelled">Storniert</option>
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Vorname Empfänger"><input value={v.recipient_first_name} onChange={(e) => setV({ ...v, recipient_first_name: e.target.value })} className={inputCls} /></Field>
            <Field label="Nachname Empfänger"><input value={v.recipient_last_name} onChange={(e) => setV({ ...v, recipient_last_name: e.target.value })} className={inputCls} /></Field>
          </div>

          <Field label="Persönliche Nachricht">
            <textarea value={v.personal_message} onChange={(e) => setV({ ...v, personal_message: e.target.value })} rows={2} className={inputCls} />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Käufer Name"><input value={v.buyer_name} onChange={(e) => setV({ ...v, buyer_name: e.target.value })} className={inputCls} /></Field>
            <Field label="Käufer E-Mail"><input value={v.buyer_email} onChange={(e) => setV({ ...v, buyer_email: e.target.value })} className={inputCls} /></Field>
          </div>

          <Field label="Läuft ab"><input type="date" value={v.expires_at} onChange={(e) => setV({ ...v, expires_at: e.target.value })} className={inputCls} /></Field>

          <Field label="Einlöse-Notiz (nur bei Einlösung)">
            <textarea value={v.redeemed_note} onChange={(e) => setV({ ...v, redeemed_note: e.target.value })} rows={2} className={inputCls}
              placeholder="z.B. eingelöst am … Restbetrag CHF …" />
          </Field>

          <Field label="Interne Notiz">
            <textarea value={v.internal_note} onChange={(e) => setV({ ...v, internal_note: e.target.value })} rows={2} className={inputCls} />
          </Field>
        </div>

        <div className="flex flex-wrap gap-2 mt-6 pt-4 border-t">
          <button onClick={openPdf} className="rounded-sm border border-border px-4 py-2 text-xs inline-flex items-center gap-2"><Eye className="w-3.5 h-3.5" /> PDF ansehen</button>
          <button onClick={regen} className="rounded-sm border border-border px-4 py-2 text-xs inline-flex items-center gap-2"><RefreshCw className="w-3.5 h-3.5" /> PDF neu generieren</button>
          <div className="flex-1" />
          <button onClick={onClose} className="rounded-sm border border-border px-4 py-2 text-xs">Abbrechen</button>
          <button onClick={save} disabled={saving} className="rounded-sm bg-gold text-gold-foreground px-5 py-2 text-xs inline-flex items-center gap-2 disabled:opacity-50">
            <Save className="w-3.5 h-3.5" /> {saving ? "…" : "Speichern"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

const inputCls = "w-full rounded-sm border border-border bg-card px-3 py-1.5 text-sm focus:outline-none focus:border-gold";
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[10px] uppercase tracking-wider text-muted-foreground mb-1">{label}</span>
      {children}
    </label>
  );
}
