import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useRef } from "react";
import { listSiteContent, updateSiteContent, uploadSiteImage } from "@/lib/admin.functions";
import { toast } from "sonner";

export function ContentTab() {
  const listFn = useServerFn(listSiteContent);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["site-content-admin"], queryFn: () => listFn() });

  if (isLoading) return <p className="text-muted-foreground">Lade …</p>;
  if (!data) return null;

  return (
    <div className="space-y-4 max-w-3xl">
      <h2 className="font-display text-2xl mb-4">Texte & Bilder</h2>
      {data.map((row) => (
        <ContentRow key={row.key} row={row} onSaved={() => {
          qc.invalidateQueries({ queryKey: ["site-content-admin"] });
          qc.invalidateQueries({ queryKey: ["public-data"] });
        }} />
      ))}
    </div>
  );
}

type Row = { key: string; value: string; label: string; kind: string; sort_order: number; preview_url: string };

function ContentRow({ row, onSaved }: { row: Row; onSaved: () => void }) {
  const updateFn = useServerFn(updateSiteContent);
  const uploadFn = useServerFn(uploadSiteImage);
  const [value, setValue] = useState(row.value);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState(row.preview_url);
  const fileRef = useRef<HTMLInputElement>(null);

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
    <div className="bg-card border border-border rounded-sm p-4">
      <label className="block text-xs uppercase tracking-widest text-muted-foreground mb-2">{row.label}</label>
      {row.kind === "image" ? (
        <div className="flex gap-4 items-start">
          <div className="w-32 h-24 bg-background rounded-sm overflow-hidden border border-border shrink-0">
            {preview ? <img src={preview} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">Kein Bild</div>}
          </div>
          <div className="flex-1">
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); }} />
            <button onClick={() => fileRef.current?.click()} disabled={uploading}
              className="rounded-full bg-gold px-5 py-2 text-xs uppercase tracking-widest text-gold-foreground disabled:opacity-50">
              {uploading ? "Lade hoch …" : "Bild ersetzen"}
            </button>
            <p className="text-xs text-muted-foreground mt-2 break-all">{value || "—"}</p>
          </div>
        </div>
      ) : row.kind === "textarea" ? (
        <>
          <textarea rows={3} value={value} onChange={(e) => setValue(e.target.value)}
            className="w-full bg-background border border-border rounded-sm px-3 py-2 focus:border-gold outline-none" />
          <div className="flex justify-end mt-2">
            <button onClick={save} disabled={saving || value === row.value}
              className="rounded-full bg-gold px-5 py-2 text-xs uppercase tracking-widest text-gold-foreground disabled:opacity-50">
              {saving ? "…" : "Speichern"}
            </button>
          </div>
        </>
      ) : (
        <div className="flex gap-2">
          <input value={value} onChange={(e) => setValue(e.target.value)}
            className="flex-1 bg-background border border-border rounded-sm px-3 py-2 focus:border-gold outline-none" />
          <button onClick={save} disabled={saving || value === row.value}
            className="rounded-full bg-gold px-5 py-2 text-xs uppercase tracking-widest text-gold-foreground disabled:opacity-50">
            {saving ? "…" : "Speichern"}
          </button>
        </div>
      )}
    </div>
  );
}
