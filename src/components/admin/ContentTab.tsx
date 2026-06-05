import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useRef, useMemo } from "react";
import { listSiteContent, updateSiteContent, uploadSiteImage } from "@/lib/admin.functions";
import { toast } from "sonner";
import { CalendarDays, FileText, Image as ImageIcon } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

type Row = { key: string; value: string; label: string; kind: string; sort_order: number; preview_url: string };

const RESERVATION_KEYS = new Set([
  "reservation_occasions",
  "reservation_event_dates",
  "reservation_occasions_with_dates",
  "reservation_disclaimer",
]);

export function ContentTab() {
  const listFn = useServerFn(listSiteContent);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["site-content-admin"], queryFn: () => listFn() });

  const groups = useMemo(() => {
    const rows = (data ?? []) as Row[];
    const reservation = rows.filter((r) => RESERVATION_KEYS.has(r.key));
    const images = rows.filter((r) => r.kind === "image");
    const texts = rows.filter((r) => !RESERVATION_KEYS.has(r.key) && r.kind !== "image");
    return { reservation, images, texts };
  }, [data]);

  if (isLoading) return <p className="text-muted-foreground">Lade …</p>;
  if (!data) return null;

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["site-content-admin"] });
    qc.invalidateQueries({ queryKey: ["public-data"] });
  };

  return (
    <div className="space-y-10 max-w-3xl">
      <Section
        icon={<CalendarDays className="w-4 h-4 text-primary" />}
        title="Reservierungsformular"
        description="Diese Werte erscheinen direkt im Reservierungsformular auf der Website. Jede Zeile in den Listen wird zu einem Eintrag im Dropdown."
        rows={groups.reservation}
        onSaved={refresh}
      />
      <Section
        icon={<FileText className="w-4 h-4 text-primary" />}
        title="Texte"
        rows={groups.texts}
        onSaved={refresh}
      />
      <Section
        icon={<ImageIcon className="w-4 h-4 text-primary" />}
        title="Bilder"
        rows={groups.images}
        onSaved={refresh}
      />
    </div>
  );
}

function Section({
  icon, title, description, rows, onSaved,
}: { icon: React.ReactNode; title: string; description?: string; rows: Row[]; onSaved: () => void }) {
  if (!rows.length) return null;
  return (
    <section>
      <div className="mb-4 flex items-center gap-2">
        {icon}
        <h2 className="font-display text-2xl">{title}</h2>
      </div>
      {description && <p className="text-sm text-muted-foreground mb-4">{description}</p>}
      <div className="space-y-4">
        {rows.map((row) => (
          <ContentRow key={row.key} row={row} onSaved={onSaved} />
        ))}
      </div>
    </section>
  );
}

function ContentRow({ row, onSaved }: { row: Row; onSaved: () => void }) {
  const updateFn = useServerFn(updateSiteContent);
  const uploadFn = useServerFn(uploadSiteImage);
  const [value, setValue] = useState(row.value);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState(row.preview_url);
  const fileRef = useRef<HTMLInputElement>(null);

  const isList = row.kind === "textarea" && row.key !== "reservation_disclaimer" && RESERVATION_KEYS.has(row.key);
  const items = isList ? value.split("\n").map((s) => s.trim()).filter(Boolean) : [];

  async function save() {
    setSaving(true);
    try { await updateFn({ data: { key: row.key, value } }); toast.success("Gespeichert"); onSaved(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Fehler"); }
    finally { setSaving(false); }
  }

  async function onFile(file: File) {
    setUploading(true);
    try {
      const buf = await file.arrayBuffer();
      const b64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
      const res = await uploadFn({ data: {
        key: row.key, filename: file.name, content_type: file.type || "image/jpeg", data_base64: b64,
      }});
      setValue(res.path);
      setPreview(res.preview_url);
      toast.success("Bild hochgeladen");
      onSaved();
    } catch (e) { toast.error(e instanceof Error ? e.message : "Upload fehlgeschlagen"); }
    finally { setUploading(false); }
  }

  return (
    <div className="bg-card border border-border rounded-md p-4">
      <label className="block text-xs uppercase tracking-widest text-muted-foreground mb-2">{row.label}</label>
      {row.kind === "image" ? (
        <div className="flex gap-4 items-start">
          <div className="w-32 h-24 bg-background rounded-sm overflow-hidden border border-border shrink-0">
            {preview ? <img src={preview} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">Kein Bild</div>}
          </div>
          <div className="flex-1">
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }} />
            <button onClick={() => fileRef.current?.click()} disabled={uploading}
              className="rounded-full bg-primary px-5 py-2 text-xs uppercase tracking-widest text-primary-foreground disabled:opacity-50">
              {uploading ? "Lade hoch …" : "Bild ersetzen"}
            </button>
            <p className="text-xs text-muted-foreground mt-2 break-all">{value || "—"}</p>
          </div>
        </div>
      ) : row.kind === "textarea" ? (
        <>
          {isList && (
            <p className="text-xs text-muted-foreground mb-2">
              Eine Option pro Zeile — leere Zeilen werden ignoriert.
            </p>
          )}
          <textarea rows={isList ? 6 : 3} value={value} onChange={(e) => setValue(e.target.value)}
            className="w-full bg-background border border-border rounded-sm px-3 py-2 focus:border-primary outline-none font-mono text-sm" />
          {isList && items.length > 0 && (
            <div className="mt-3">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2">Vorschau ({items.length})</div>
              <div className="flex flex-wrap gap-2">
                {items.map((it, i) => (
                  <span key={i} className="inline-flex items-center rounded-full bg-accent text-accent-foreground px-3 py-1 text-xs border border-border">{it}</span>
                ))}
              </div>
            </div>
          )}
          <div className="flex justify-end mt-3">
            <button onClick={save} disabled={saving || value === row.value}
              className="rounded-full bg-primary px-5 py-2 text-xs uppercase tracking-widest text-primary-foreground disabled:opacity-50">
              {saving ? "…" : "Speichern"}
            </button>
          </div>
        </>
      ) : (
        <div className="flex gap-2">
          <input value={value} onChange={(e) => setValue(e.target.value)}
            className="flex-1 bg-background border border-border rounded-sm px-3 py-2 focus:border-primary outline-none" />
          <button onClick={save} disabled={saving || value === row.value}
            className="rounded-full bg-primary px-5 py-2 text-xs uppercase tracking-widest text-primary-foreground disabled:opacity-50">
            {saving ? "…" : "Speichern"}
          </button>
        </div>
      )}
    </div>
  );
}
