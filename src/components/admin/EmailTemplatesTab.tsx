import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  listEmailTemplates,
  upsertEmailTemplate,
  deleteEmailTemplate,
  previewEmailTemplate,
  listReservationOccasions,
  type EmailTemplateRow,
} from "@/lib/email-templates.functions";
import { Plus, Trash2, Save, Eye } from "lucide-react";

type TplKey = EmailTemplateRow["template_key"];

const TPL_LABELS: Record<TplKey, string> = {
  reservation_request: "Reservierungsanfrage (Gast)",
  reservation_confirmed: "Bestätigung (Gast)",
  reservation_declined: "Absage (Gast)",
  reservation_cancelled: "Stornierung (Gast)",
  admin_notification: "Neue Reservierung (Admin)",
  admin_cancellation: "Stornierung (Admin)",
};

const TPL_KEYS: TplKey[] = [
  "reservation_request",
  "reservation_confirmed",
  "reservation_declined",
  "reservation_cancelled",
  "admin_notification",
  "admin_cancellation",
];

const PLACEHOLDERS: { token: string; desc: string }[] = [
  { token: "{name}", desc: "Gastname" },
  { token: "{email}", desc: "E-Mail" },
  { token: "{telefon}", desc: "Telefon" },
  { token: "{personen}", desc: "Personenzahl" },
  { token: "{datum}", desc: "Datum (leer wenn keins)" },
  { token: "{datum_or_offen}", desc: "Datum oder 'Kein Datum'" },
  { token: "{uhrzeit}", desc: "Uhrzeit (leer wenn keine)" },
  { token: "{uhrzeit_prefix}", desc: "' um HH:MM' oder leer" },
  { token: "{anlass}", desc: "Anlass" },
  { token: "{anlass_suffix}", desc: "' · Anlass' oder leer" },
  { token: "{restaurant}", desc: "Restaurantname" },
  { token: "{storno_link}", desc: "Storno-URL" },
  { token: "{storno_block}", desc: "Kompletter Storno-Absatz mit Button" },
  { token: "{notes}", desc: "Anmerkungen (Klartext)" },
  { token: "{notes_block}", desc: "Anmerkungen als grauer Kasten" },
  { token: "{fee_block}", desc: "Storno-Gebühr-Hinweis (Admin-Storno)" },
];

export function EmailTemplatesTab() {
  const qc = useQueryClient();
  const listFn = useServerFn(listEmailTemplates);
  const occFn = useServerFn(listReservationOccasions);

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["email-templates"],
    queryFn: () => listFn(),
  });
  const { data: occasions = [] } = useQuery({
    queryKey: ["reservation-occasions-for-templates"],
    queryFn: () => occFn(),
  });

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ new?: { template_key: TplKey; occasion: string } } | null>(null);

  const grouped = useMemo(() => {
    const g: Record<TplKey, EmailTemplateRow[]> = {
      reservation_request: [],
      reservation_confirmed: [],
      reservation_declined: [],
      reservation_cancelled: [],
      admin_notification: [],
      admin_cancellation: [],
    };
    for (const t of templates) g[t.template_key]?.push(t);
    for (const k of TPL_KEYS) {
      g[k].sort((a, b) => {
        if (a.occasion === null) return -1;
        if (b.occasion === null) return 1;
        return a.occasion.localeCompare(b.occasion);
      });
    }
    return g;
  }, [templates]);

  const selected = draft?.new
    ? null
    : templates.find((t) => t.id === selectedId) ??
      (templates.length > 0 && !selectedId ? templates[0] : null);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
      <aside className="bg-card border border-border rounded-sm p-3 h-fit lg:sticky lg:top-20 max-h-[calc(100vh-6rem)] overflow-y-auto">
        <div className="text-xs uppercase tracking-widest text-muted-foreground px-2 py-1">Vorlagen</div>
        {isLoading && <div className="p-2 text-sm text-muted-foreground">Lade …</div>}
        {TPL_KEYS.map((key) => (
          <TemplateGroup
            key={key}
            label={TPL_LABELS[key]}
            rows={grouped[key]}
            selectedId={selected?.id ?? null}
            onSelect={(id) => {
              setDraft(null);
              setSelectedId(id);
            }}
            onAddOverride={(occasion) => {
              setSelectedId(null);
              setDraft({ new: { template_key: key, occasion } });
            }}
            occasions={occasions}
            existingOccasions={grouped[key].map((r) => r.occasion).filter((o): o is string => !!o)}
          />
        ))}
      </aside>

      <section className="min-w-0">
        {draft?.new ? (
          <TemplateEditor
            key={`new-${draft.new.template_key}-${draft.new.occasion}`}
            initial={{
              id: null,
              template_key: draft.new.template_key,
              occasion: draft.new.occasion,
              subject: (grouped[draft.new.template_key][0]?.subject) ?? "",
              body_html: (grouped[draft.new.template_key][0]?.body_html) ?? "",
              enabled: true,
              created_at: "",
              updated_at: "",
            }}
            onSaved={(id) => {
              setDraft(null);
              setSelectedId(id);
              qc.invalidateQueries({ queryKey: ["email-templates"] });
            }}
            onCancel={() => setDraft(null)}
          />
        ) : selected ? (
          <TemplateEditor
            key={selected.id}
            initial={selected}
            onSaved={(id) => {
              setSelectedId(id);
              qc.invalidateQueries({ queryKey: ["email-templates"] });
            }}
            onDeleted={() => {
              setSelectedId(null);
              qc.invalidateQueries({ queryKey: ["email-templates"] });
            }}
          />
        ) : (
          <div className="bg-card border border-border rounded-sm p-8 text-sm text-muted-foreground">
            Wähle links eine Vorlage aus.
          </div>
        )}
      </section>
    </div>
  );
}

function TemplateGroup({
  label,
  rows,
  selectedId,
  onSelect,
  onAddOverride,
  occasions,
  existingOccasions,
}: {
  label: string;
  rows: EmailTemplateRow[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onAddOverride: (occasion: string) => void;
  occasions: string[];
  existingOccasions: string[];
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const available = occasions.filter((o) => !existingOccasions.includes(o));

  return (
    <div className="mb-3">
      <div className="px-2 pt-2 pb-1 text-xs font-semibold text-foreground/80">{label}</div>
      <ul className="space-y-0.5">
        {rows.map((r) => (
          <li key={r.id}>
            <button
              onClick={() => onSelect(r.id)}
              className={`w-full text-left px-2 py-1.5 text-sm rounded flex items-center gap-2 ${
                selectedId === r.id ? "bg-gold/15 text-foreground" : "hover:bg-muted/50 text-muted-foreground"
              }`}
            >
              <span className="truncate flex-1">
                {r.occasion === null ? "Standard" : r.occasion}
              </span>
              {!r.enabled && <span className="text-[10px] text-destructive uppercase">Aus</span>}
            </button>
          </li>
        ))}
      </ul>
      <div className="px-2 pt-1">
        {pickerOpen ? (
          <div className="mt-1 bg-background border border-border rounded p-2 space-y-1">
            {available.length === 0 && (
              <div className="text-xs text-muted-foreground py-1">Alle Anlässe sind bereits konfiguriert.</div>
            )}
            {available.map((o) => (
              <button
                key={o}
                onClick={() => { setPickerOpen(false); onAddOverride(o); }}
                className="block w-full text-left text-xs px-2 py-1 hover:bg-muted rounded"
              >
                {o}
              </button>
            ))}
            <button
              onClick={() => setPickerOpen(false)}
              className="block w-full text-left text-xs px-2 py-1 text-muted-foreground"
            >
              Abbrechen
            </button>
          </div>
        ) : (
          <button
            onClick={() => setPickerOpen(true)}
            className="text-[11px] text-muted-foreground hover:text-gold flex items-center gap-1 py-1"
          >
            <Plus className="w-3 h-3" /> Für Anlass anpassen
          </button>
        )}
      </div>
    </div>
  );
}

function TemplateEditor({
  initial,
  onSaved,
  onDeleted,
  onCancel,
}: {
  initial: Omit<EmailTemplateRow, "id"> & { id: string | null };
  onSaved: (id: string) => void;
  onDeleted?: () => void;
  onCancel?: () => void;
}) {
  const upsertFn = useServerFn(upsertEmailTemplate);
  const deleteFn = useServerFn(deleteEmailTemplate);
  const previewFn = useServerFn(previewEmailTemplate);

  const [subject, setSubject] = useState(initial.subject);
  const [body, setBody] = useState(initial.body_html);
  const [enabled, setEnabled] = useState(initial.enabled);
  const [previewHtml, setPreviewHtml] = useState<string>("");
  const [previewSubject, setPreviewSubject] = useState<string>("");

  const isOverride = initial.occasion !== null;

  const previewMut = useMutation({
    mutationFn: () => previewFn({ data: { subject, body_html: body, occasion: initial.occasion } }),
    onSuccess: (res) => {
      setPreviewHtml(res.html);
      setPreviewSubject(res.subject);
    },
    onError: (e: any) => toast.error(e?.message ?? "Vorschau fehlgeschlagen"),
  });

  const saveMut = useMutation({
    mutationFn: () =>
      upsertFn({
        data: {
          id: initial.id ?? undefined,
          template_key: initial.template_key,
          occasion: initial.occasion,
          subject,
          body_html: body,
          enabled,
        },
      }),
    onSuccess: (res: any) => {
      toast.success("Vorlage gespeichert");
      onSaved(res.id ?? initial.id!);
    },
    onError: (e: any) => toast.error(e?.message ?? "Speichern fehlgeschlagen"),
  });

  const deleteMut = useMutation({
    mutationFn: () => deleteFn({ data: { id: initial.id! } }),
    onSuccess: () => {
      toast.success("Override gelöscht — Standard-Vorlage ist wieder aktiv.");
      onDeleted?.();
    },
    onError: (e: any) => toast.error(e?.message ?? "Löschen fehlgeschlagen"),
  });

  return (
    <div className="space-y-4">
      <div className="bg-card border border-border rounded-sm p-4">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <h2 className="font-display text-lg">{TPL_LABELS[initial.template_key]}</h2>
          <span className="text-xs text-muted-foreground">·</span>
          <span className="text-sm text-muted-foreground">
            {initial.occasion === null ? "Standard" : `Override: ${initial.occasion}`}
          </span>
          <label className="ml-auto flex items-center gap-2 text-xs">
            <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
            Aktiv
          </label>
        </div>

        <label className="block text-xs uppercase tracking-widest text-muted-foreground mb-1">Betreff</label>
        <input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          className="w-full bg-background border border-border rounded-sm px-3 py-2 text-sm font-mono"
        />

        <label className="block text-xs uppercase tracking-widest text-muted-foreground mt-4 mb-1">HTML-Inhalt</label>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={18}
          className="w-full bg-background border border-border rounded-sm px-3 py-2 text-xs font-mono leading-relaxed"
        />

        <div className="flex flex-wrap gap-2 mt-4">
          <button
            onClick={() => saveMut.mutate()}
            disabled={saveMut.isPending}
            className="inline-flex items-center gap-1.5 rounded-full bg-gold px-4 py-2 text-xs uppercase tracking-widest text-gold-foreground disabled:opacity-50"
          >
            <Save className="w-3.5 h-3.5" /> {saveMut.isPending ? "…" : "Speichern"}
          </button>
          <button
            onClick={() => previewMut.mutate()}
            disabled={previewMut.isPending}
            className="inline-flex items-center gap-1.5 rounded-full border border-gold/50 text-gold px-4 py-2 text-xs uppercase tracking-widest disabled:opacity-50"
          >
            <Eye className="w-3.5 h-3.5" /> Vorschau
          </button>
          {isOverride && initial.id && (
            <button
              onClick={() => {
                if (confirm("Diesen Anlass-Override löschen? Standard-Vorlage wird wieder verwendet.")) deleteMut.mutate();
              }}
              disabled={deleteMut.isPending}
              className="inline-flex items-center gap-1.5 rounded-full border border-destructive/50 text-destructive px-4 py-2 text-xs uppercase tracking-widest disabled:opacity-50 ml-auto"
            >
              <Trash2 className="w-3.5 h-3.5" /> Override löschen
            </button>
          )}
          {onCancel && (
            <button
              onClick={onCancel}
              className="inline-flex items-center gap-1.5 rounded-full border border-border px-4 py-2 text-xs uppercase tracking-widest text-muted-foreground"
            >
              Abbrechen
            </button>
          )}
        </div>
      </div>

      <div className="bg-card border border-border rounded-sm p-4">
        <div className="text-xs uppercase tracking-widest text-muted-foreground mb-2">Platzhalter</div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1 text-xs">
          {PLACEHOLDERS.map((p) => (
            <button
              key={p.token}
              onClick={() => {
                navigator.clipboard?.writeText(p.token);
                toast.success(`${p.token} kopiert`);
              }}
              className="text-left hover:text-gold flex justify-between gap-2"
            >
              <code className="font-mono text-foreground">{p.token}</code>
              <span className="text-muted-foreground truncate">{p.desc}</span>
            </button>
          ))}
        </div>
      </div>

      {previewHtml && (
        <div className="bg-card border border-border rounded-sm p-4">
          <div className="text-xs uppercase tracking-widest text-muted-foreground mb-1">Vorschau</div>
          <div className="text-sm mb-2"><span className="text-muted-foreground">Betreff: </span><strong>{previewSubject}</strong></div>
          <iframe
            title="Vorschau"
            srcDoc={`<!doctype html><html><body style="margin:0;background:#f3f4f6;padding:24px;">${previewHtml}</body></html>`}
            className="w-full h-[600px] bg-white border border-border rounded-sm"
            sandbox=""
          />
        </div>
      )}
    </div>
  );
}
