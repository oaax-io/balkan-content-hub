import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useRef, useMemo } from "react";
import { listSiteContent, updateSiteContent, uploadSiteImage } from "@/lib/admin.functions";
import { toast } from "sonner";
import {
  Home, Coffee, UtensilsCrossed, PartyPopper, Users, CalendarDays, ChevronDown, ChevronRight,
} from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

type Row = { key: string; value: string; label: string; kind: string; sort_order: number; preview_url: string };

const RESERVATION_KEYS = new Set([
  "reservation_occasions",
  "reservation_event_dates",
  "reservation_occasions_with_dates",
  "reservation_disclaimer",
]);

type Section = { id: string; title: string; keys: string[] };
type Page = { id: string; label: string; icon: typeof Home; sections: Section[] };

const PAGES: Page[] = [
  {
    id: "home", label: "Home", icon: Home,
    sections: [
      { id: "hero", title: "Hero (oberer Bereich)", keys: ["hero_eyebrow", "hero_title", "hero_subtitle", "hero_cta_label", "hero_image"] },
      { id: "slider", title: "Bilder-Slider", keys: ["slider_1", "slider_2", "slider_3"] },
      { id: "intro", title: "Intro-Sektion", keys: ["intro_eyebrow", "intro_title", "intro_text", "intro_image"] },
      { id: "host", title: "Gastgeberin", keys: ["host_eyebrow", "host_title", "host_name", "host_text", "host_image"] },
      { id: "gallery", title: "Galerie", keys: ["gallery_1", "gallery_2", "gallery_3"] },
      { id: "offers", title: "Angebote (3 Karten)", keys: [
        "offers_eyebrow", "offers_title",
        "offers_brunch_label", "offers_brunch_desc", "offers_brunch_cta",
        "offers_dinner_label", "offers_dinner_desc", "offers_dinner_cta",
        "offers_events_label", "offers_events_desc", "offers_events_cta",
      ]},
    ],
  },
  {
    id: "brunch", label: "Brunch", icon: Coffee,
    sections: [
      { id: "hero", title: "Hero", keys: ["brunch_eyebrow", "brunch_title", "brunch_subtitle", "brunch_intro", "brunch_text", "brunch_image"] },
      { id: "feature1", title: "Block 1", keys: ["brunch_feature1_title", "brunch_feature1_text", "brunch_feature1_image"] },
      { id: "feature2", title: "Block 2", keys: ["brunch_feature2_title", "brunch_feature2_text", "brunch_feature2_image"] },
      { id: "feature3", title: "Block 3", keys: ["brunch_feature3_title", "brunch_feature3_text", "brunch_feature3_image"] },
    ],
  },
  {
    id: "dinner", label: "Dinner", icon: UtensilsCrossed,
    sections: [
      { id: "hero", title: "Hero", keys: ["dinner_eyebrow", "dinner_title", "dinner_subtitle"] },
      { id: "feature1", title: "Block 1", keys: ["dinner_feature1_title", "dinner_feature1_text", "dinner_feature1_image"] },
      { id: "feature2", title: "Block 2", keys: ["dinner_feature2_title", "dinner_feature2_text", "dinner_feature2_image"] },
    ],
  },
  {
    id: "events", label: "Events", icon: PartyPopper,
    sections: [
      { id: "hero", title: "Hero", keys: ["events_subtitle"] },
      { id: "feature1", title: "Block 1", keys: ["events_feature1_title", "events_feature1_text", "events_feature1_image"] },
      { id: "feature2", title: "Block 2", keys: ["events_feature2_title", "events_feature2_text", "events_feature2_image"] },
      { id: "feature3", title: "Block 3", keys: ["events_feature3_title", "events_feature3_text", "events_feature3_image"] },
      { id: "cta", title: "Call-to-Action", keys: ["events_cta_title", "events_cta_text"] },
    ],
  },
  {
    id: "about", label: "Über uns", icon: Users,
    sections: [
      { id: "hero", title: "Hero", keys: ["about_eyebrow", "about_title", "about_subtitle", "about_hero_image"] },
      { id: "content", title: "Inhalt", keys: ["about_text", "about_image"] },
    ],
  },
  {
    id: "reservation", label: "Reservierung", icon: CalendarDays,
    sections: [
      { id: "form", title: "Formular-Optionen", keys: ["reservation_occasions", "reservation_event_dates", "reservation_occasions_with_dates", "reservation_disclaimer"] },
    ],
  },
];

export function ContentTab() {
  const listFn = useServerFn(listSiteContent);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["site-content-admin"], queryFn: () => listFn() });

  const rowMap = useMemo(() => {
    const map = new Map<string, Row>();
    for (const r of (data ?? []) as Row[]) map.set(r.key, r);
    return map;
  }, [data]);

  const usedKeys = useMemo(() => {
    const s = new Set<string>();
    for (const p of PAGES) for (const sec of p.sections) for (const k of sec.keys) s.add(k);
    return s;
  }, []);

  const orphans = useMemo(() => {
    return ((data ?? []) as Row[]).filter((r) => !usedKeys.has(r.key));
  }, [data, usedKeys]);

  if (isLoading) return <p className="text-muted-foreground">Lade …</p>;
  if (!data) return null;

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["site-content-admin"] });
    qc.invalidateQueries({ queryKey: ["public-data"] });
  };

  return (
    <Tabs defaultValue="home" className="max-w-4xl">
      <TabsList className="mb-6 flex-wrap h-auto">
        {PAGES.map((p) => (
          <TabsTrigger key={p.id} value={p.id}>
            <p.icon className="w-4 h-4 mr-2" />
            {p.label}
          </TabsTrigger>
        ))}
        {orphans.length > 0 && <TabsTrigger value="other">Sonstige</TabsTrigger>}
      </TabsList>

      {PAGES.map((page) => (
        <TabsContent key={page.id} value={page.id} className="space-y-3">
          <div className="mb-4 flex items-center gap-2">
            <page.icon className="w-5 h-5 text-primary" />
            <h2 className="font-display text-2xl text-foreground">{page.label}</h2>
          </div>
          {page.sections.map((sec) => {
            const rows = sec.keys.map((k) => rowMap.get(k)).filter(Boolean) as Row[];
            if (!rows.length) return null;
            return <SectionBlock key={sec.id} title={sec.title} rows={rows} onSaved={refresh} pageId={page.id} secId={sec.id} />;
          })}
        </TabsContent>
      ))}

      {orphans.length > 0 && (
        <TabsContent value="other" className="space-y-3">
          <div className="mb-4">
            <h2 className="font-display text-2xl text-foreground">Sonstige Inhalte</h2>
            <p className="text-sm text-muted-foreground">Nicht zugeordnete Felder.</p>
          </div>
          <SectionBlock title="Alle" rows={orphans} onSaved={refresh} pageId="other" secId="all" defaultOpen />
        </TabsContent>
      )}
    </Tabs>
  );
}

function SectionBlock({
  title, rows, onSaved, pageId, secId, defaultOpen = true,
}: { title: string; rows: Row[]; onSaved: () => void; pageId: string; secId: string; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const imageCount = rows.filter((r) => r.kind === "image").length;
  return (
    <div className="border border-border rounded-md bg-card overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-accent/30 transition-colors"
      >
        {open ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
        <span className="font-medium text-foreground">{title}</span>
        <span className="ml-auto text-xs text-muted-foreground">
          {rows.length} {rows.length === 1 ? "Feld" : "Felder"}{imageCount > 0 && ` · ${imageCount} Bild${imageCount === 1 ? "" : "er"}`}
        </span>
      </button>
      {open && (
        <div className="px-4 pb-4 pt-1 space-y-3 border-t border-border bg-background/50">
          {rows.map((row) => (
            <ContentRow key={row.key} row={row} onSaved={onSaved} />
          ))}
        </div>
      )}
    </div>
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
  const label = row.label || row.key;

  async function save() {
    setSaving(true);
    try { await updateFn({ data: { key: row.key, value } }); toast.success("Gespeichert"); onSaved(); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Fehler"); }
    finally { setSaving(false); }
  }

  async function onFile(file: File) {
    if (file.size > 15 * 1024 * 1024) {
      toast.error("Bild ist zu gross (max. 15 MB)");
      return;
    }
    setUploading(true);
    try {
      const buf = await file.arrayBuffer();
      const bytes = new Uint8Array(buf);
      let binary = "";
      const CHUNK = 0x8000;
      for (let i = 0; i < bytes.length; i += CHUNK) {
        binary += String.fromCharCode.apply(
          null,
          Array.from(bytes.subarray(i, Math.min(i + CHUNK, bytes.length))),
        );
      }
      const b64 = btoa(binary);
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
      <label className="block text-xs uppercase tracking-widest text-muted-foreground mb-2">{label}</label>
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
