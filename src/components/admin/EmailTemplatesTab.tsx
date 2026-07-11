import { useEffect, useMemo, useRef, useState } from "react";
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
import {
  Plus,
  Trash2,
  Save,
  Maximize2,
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Heading2,
  List as ListIcon,
  ListOrdered,
  Link as LinkIcon,
  Undo2,
  Redo2,
  Tag,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmDialog, PromptDialog } from "./InAppDialogs";

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

const PLACEHOLDERS: { token: string; label: string }[] = [
  { token: "{name}", label: "Gastname" },
  { token: "{personen}", label: "Personenzahl" },
  { token: "{datum_or_offen}", label: "Datum" },
  { token: "{uhrzeit_prefix}", label: "Uhrzeit" },
  { token: "{anlass}", label: "Anlass" },
  { token: "{restaurant}", label: "Restaurantname" },
  { token: "{email}", label: "E-Mail" },
  { token: "{telefon}", label: "Telefon" },
  { token: "{notes_block}", label: "Anmerkungen (Kasten)" },
  { token: "{storno_block}", label: "Storno-Absatz mit Button" },
  { token: "{fee_block}", label: "Storno-Gebühr-Hinweis" },
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
    <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6">
      <aside className="bg-card border border-border rounded-sm p-3 h-fit lg:sticky lg:top-20 max-h-[calc(100vh-6rem)] overflow-y-auto">
        <div className="text-xs uppercase tracking-widest text-muted-foreground px-2 py-1">
          Vorlagen
        </div>
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
              subject: grouped[draft.new.template_key][0]?.subject ?? "",
              body_html: grouped[draft.new.template_key][0]?.body_html ?? "",
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
      <button
        onClick={() => {
          const standard = rows.find((r) => r.occasion === null);
          if (standard) onSelect(standard.id);
        }}
        className="w-full text-left px-2 pt-2 pb-1 text-xs font-semibold text-foreground/80 hover:text-gold"
      >
        {label}
      </button>
      <ul className="space-y-0.5">
        {rows.map((r) => (
          <li key={r.id}>
            <button
              onClick={() => onSelect(r.id)}
              className={`w-full text-left px-2 py-1.5 text-sm rounded flex items-center gap-2 ${
                selectedId === r.id ? "bg-gold/15 text-foreground" : "hover:bg-muted/50 text-muted-foreground"
              }`}
            >
              <span className="truncate flex-1">{r.occasion === null ? "Standard" : r.occasion}</span>
              {!r.enabled && <span className="text-[10px] text-destructive uppercase">Aus</span>}
            </button>
          </li>
        ))}
      </ul>
      <div className="px-2 pt-1">
        {pickerOpen ? (
          <div className="mt-1 bg-background border border-border rounded p-2 space-y-1">
            {available.length === 0 && (
              <div className="text-xs text-muted-foreground py-1">
                Alle Anlässe sind bereits konfiguriert.
              </div>
            )}
            {available.map((o) => (
              <button
                key={o}
                onClick={() => {
                  setPickerOpen(false);
                  onAddOverride(o);
                }}
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

// ------------------------- Rich text editor -------------------------

function RichEditor({
  html,
  onChange,
}: {
  html: string;
  onChange: (html: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const initialized = useRef(false);
  const [linkOpen, setLinkOpen] = useState(false);

  // Set initial HTML only once; avoid clobbering while user types.
  useEffect(() => {
    if (!ref.current) return;
    if (!initialized.current) {
      ref.current.innerHTML = html || "";
      initialized.current = true;
    }
  }, [html]);

  const exec = (cmd: string, val?: string) => {
    ref.current?.focus();
    document.execCommand(cmd, false, val);
    onChange(ref.current?.innerHTML ?? "");
  };

  const insertAtCaret = (text: string) => {
    ref.current?.focus();
    document.execCommand("insertText", false, text);
    onChange(ref.current?.innerHTML ?? "");
  };

  const insertLink = () => setLinkOpen(true);

  const btn =
    "inline-flex items-center justify-center h-8 w-8 rounded text-muted-foreground hover:bg-muted hover:text-foreground";

  return (
    <div className="border border-border rounded-sm bg-background">
      <div className="flex flex-wrap items-center gap-0.5 border-b border-border p-1.5">
        <button type="button" title="Fett" onMouseDown={(e) => e.preventDefault()} onClick={() => exec("bold")} className={btn}>
          <Bold className="w-4 h-4" />
        </button>
        <button type="button" title="Kursiv" onMouseDown={(e) => e.preventDefault()} onClick={() => exec("italic")} className={btn}>
          <Italic className="w-4 h-4" />
        </button>
        <button type="button" title="Unterstreichen" onMouseDown={(e) => e.preventDefault()} onClick={() => exec("underline")} className={btn}>
          <UnderlineIcon className="w-4 h-4" />
        </button>
        <div className="w-px h-5 bg-border mx-1" />
        <button type="button" title="Überschrift" onMouseDown={(e) => e.preventDefault()} onClick={() => exec("formatBlock", "H2")} className={btn}>
          <Heading2 className="w-4 h-4" />
        </button>
        <button type="button" title="Absatz" onMouseDown={(e) => e.preventDefault()} onClick={() => exec("formatBlock", "P")} className="inline-flex items-center justify-center h-8 px-2 rounded text-xs text-muted-foreground hover:bg-muted hover:text-foreground">
          P
        </button>
        <div className="w-px h-5 bg-border mx-1" />
        <button type="button" title="Aufzählung" onMouseDown={(e) => e.preventDefault()} onClick={() => exec("insertUnorderedList")} className={btn}>
          <ListIcon className="w-4 h-4" />
        </button>
        <button type="button" title="Nummerierte Liste" onMouseDown={(e) => e.preventDefault()} onClick={() => exec("insertOrderedList")} className={btn}>
          <ListOrdered className="w-4 h-4" />
        </button>
        <div className="w-px h-5 bg-border mx-1" />
        <button type="button" title="Link" onMouseDown={(e) => e.preventDefault()} onClick={insertLink} className={btn}>
          <LinkIcon className="w-4 h-4" />
        </button>

        <div className="w-px h-5 bg-border mx-1" />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              className="inline-flex items-center gap-1 h-8 px-2 rounded text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
              title="Platzhalter einfügen"
            >
              <Tag className="w-3.5 h-3.5" /> Platzhalter
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="max-h-80 overflow-y-auto">
            {PLACEHOLDERS.map((p) => (
              <DropdownMenuItem
                key={p.token}
                onSelect={() => insertAtCaret(p.token)}
                className="flex justify-between gap-4 text-xs"
              >
                <span className="text-muted-foreground">{p.label}</span>
                <code className="font-mono">{p.token}</code>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="ml-auto flex gap-0.5">
          <button type="button" title="Rückgängig" onMouseDown={(e) => e.preventDefault()} onClick={() => exec("undo")} className={btn}>
            <Undo2 className="w-4 h-4" />
          </button>
          <button type="button" title="Wiederherstellen" onMouseDown={(e) => e.preventDefault()} onClick={() => exec("redo")} className={btn}>
            <Redo2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        onInput={() => onChange(ref.current?.innerHTML ?? "")}
        className="min-h-[320px] max-h-[520px] overflow-y-auto p-4 text-sm leading-relaxed focus:outline-none prose prose-sm max-w-none [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:mt-3 [&_h2]:mb-2 [&_p]:my-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_a]:text-blue-600 [&_a]:underline"
      />
      <PromptDialog
        open={linkOpen}
        onOpenChange={setLinkOpen}
        title="Link einfügen"
        description="Gib die vollständige URL ein (z. B. https://…)."
        placeholder="https://…"
        required
        confirmLabel="Einfügen"
        onSubmit={(url) => { if (url.trim()) exec("createLink", url.trim()); }}
      />
    </div>
  );
}

// ------------------------- Live preview -------------------------

function useDebouncedPreview(subject: string, body: string, occasion: string | null) {
  const previewFn = useServerFn(previewEmailTemplate);
  const [result, setResult] = useState<{ subject: string; html: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      try {
        setLoading(true);
        const res = await previewFn({ data: { subject, body_html: body, occasion } });
        setResult({ subject: res.subject, html: res.html });
      } catch {
        // ignore preview errors while typing
      } finally {
        setLoading(false);
      }
    }, 400);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subject, body, occasion]);

  return { result, loading };
}

function PreviewFrame({
  html,
  subject,
  height = 520,
}: {
  html: string;
  subject: string;
  height?: number;
}) {
  return (
    <div className="flex flex-col h-full">
      <div className="border-b border-border px-3 py-2 text-xs bg-muted/40 rounded-t-sm">
        <span className="text-muted-foreground">Betreff: </span>
        <strong className="text-foreground">{subject || "—"}</strong>
      </div>
      <iframe
        title="Vorschau"
        srcDoc={`<!doctype html><html><body style="margin:0;background:#f3f4f6;padding:24px;font-family:Arial,sans-serif;">${html}</body></html>`}
        className="w-full bg-white border-x border-b border-border rounded-b-sm flex-1"
        style={{ minHeight: height }}
        sandbox=""
      />
    </div>
  );
}

// ------------------------- Editor -------------------------

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

  const [subject, setSubject] = useState(initial.subject);
  const [body, setBody] = useState(initial.body_html);
  const [enabled, setEnabled] = useState(initial.enabled);
  const [fullscreen, setFullscreen] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  const isOverride = initial.occasion !== null;
  const { result: preview, loading: previewLoading } = useDebouncedPreview(
    subject,
    body,
    initial.occasion,
  );

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
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <h2 className="font-display text-lg">{TPL_LABELS[initial.template_key]}</h2>
          <span className="text-xs text-muted-foreground">·</span>
          <span className="text-sm text-muted-foreground">
            {initial.occasion === null ? "Standard" : `Für Anlass: ${initial.occasion}`}
          </span>
          <label className="ml-auto flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
            />
            Aktiv
          </label>
        </div>

        <label className="block text-xs uppercase tracking-widest text-muted-foreground mb-1">
          Betreff
        </label>
        <input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          className="w-full bg-background border border-border rounded-sm px-3 py-2 text-sm mb-4"
          placeholder="z. B. Ihre Reservation bei {restaurant}"
        />

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs uppercase tracking-widest text-muted-foreground">
                Nachricht
              </label>
              <span className="text-[11px] text-muted-foreground">
                Tipp: Über <strong>Platzhalter</strong> im Editor Namen, Datum etc. einfügen.
              </span>
            </div>
            <RichEditor html={body} onChange={setBody} />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs uppercase tracking-widest text-muted-foreground">
                Live-Vorschau {previewLoading && <span className="opacity-60">…</span>}
              </label>
              <button
                onClick={() => setFullscreen(true)}
                className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-gold"
              >
                <Maximize2 className="w-3 h-3" /> Vollbild
              </button>
            </div>
            <PreviewFrame
              html={preview?.html ?? ""}
              subject={preview?.subject ?? subject}
              height={520}
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mt-4">
          <button
            onClick={() => saveMut.mutate()}
            disabled={saveMut.isPending}
            className="inline-flex items-center gap-1.5 rounded-full bg-gold px-4 py-2 text-xs uppercase tracking-widest text-gold-foreground disabled:opacity-50"
          >
            <Save className="w-3.5 h-3.5" /> {saveMut.isPending ? "…" : "Speichern"}
          </button>
          {isOverride && initial.id && (
            <button
              onClick={() => {
                if (confirm("Diesen Anlass-Override löschen? Standard-Vorlage wird wieder verwendet."))
                  deleteMut.mutate();
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

      <Dialog open={fullscreen} onOpenChange={setFullscreen}>
        <DialogContent className="max-w-4xl w-[95vw] h-[90vh] flex flex-col p-4">
          <DialogHeader>
            <DialogTitle className="text-base">Vorschau — {TPL_LABELS[initial.template_key]}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 min-h-0">
            <PreviewFrame
              html={preview?.html ?? ""}
              subject={preview?.subject ?? subject}
              height={700}
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
