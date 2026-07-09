// Email helpers. Sends via SMTP using credentials stored in `email_settings`.
// If SMTP settings are missing or `enabled` is false, sends are skipped.
// Templates (subject + HTML body) are loaded from `email_templates` and support
// per-occasion overrides. Placeholders like {name}, {datum}, {personen} are
// replaced at send time. If a template row is missing, hardcoded defaults are
// used so nothing breaks.
import nodemailer from "nodemailer";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

type Reservation = {
  id: string;
  guest_name: string;
  guest_email: string;
  guest_phone: string;
  party_size: number;
  reservation_date: string;
  reservation_time: string;
  notes: string;
  status: string;
  cancellation_token?: string | null;
  is_paid_occasion?: boolean | null;
  occasion?: string | null;
};

function getSiteBaseUrl(): string {
  return (
    process.env.SITE_URL ||
    process.env.PUBLIC_SITE_URL ||
    "https://balkaneros.ch"
  ).replace(/\/$/, "");
}

async function getContact() {
  const { data } = await supabaseAdmin.from("contact_info").select("*").eq("id", 1).single();
  return data;
}

async function getSmtpSettings() {
  const { data } = await supabaseAdmin.from("email_settings").select("*").eq("id", 1).maybeSingle();
  return data;
}

function fmtDate(d: string) {
  if (!d || d === "1970-01-01") return "";
  const m = d.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return d;
  try {
    return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])).toLocaleDateString("de-CH", {
      weekday: "long", day: "2-digit", month: "long", year: "numeric", timeZone: "UTC",
    });
  } catch { return d; }
}

function hasTime(t: string) {
  return !!t && t !== "00:00";
}

// ---------------------------------------------------------------------------
// Template loading & rendering
// ---------------------------------------------------------------------------

export type TemplateKey =
  | "reservation_request"
  | "reservation_confirmed"
  | "reservation_declined"
  | "reservation_cancelled"
  | "admin_notification"
  | "admin_cancellation";

type TemplateRow = {
  id: string;
  template_key: string;
  occasion: string | null;
  subject: string;
  body_html: string;
  enabled: boolean;
};

async function loadTemplate(
  key: TemplateKey,
  occasion?: string | null,
): Promise<TemplateRow | null> {
  // Prefer per-occasion override, fall back to default (occasion IS NULL).
  if (occasion && occasion.trim()) {
    const { data } = await supabaseAdmin
      .from("email_templates")
      .select("*")
      .eq("template_key", key)
      .eq("occasion", occasion)
      .maybeSingle();
    if (data) return data as TemplateRow;
  }
  const { data } = await supabaseAdmin
    .from("email_templates")
    .select("*")
    .eq("template_key", key)
    .is("occasion", null)
    .maybeSingle();
  return (data as TemplateRow) ?? null;
}

/** Build the variable map that placeholder replacement uses. */
export function buildTemplateVars(
  r: Reservation,
  opts: { restaurant: string; cancelUrl?: string | null; feeCharged?: boolean } = { restaurant: "Balkaneros" },
): Record<string, string> {
  const restaurant = opts.restaurant || "Balkaneros";
  const datum = fmtDate(r.reservation_date);
  const uhrzeit = hasTime(r.reservation_time) ? r.reservation_time : "";
  const anlass = r.occasion ?? "";
  const cancelUrl = opts.cancelUrl ?? "";

  const stornoBlock = cancelUrl
    ? `<div style="margin-top:28px;padding-top:24px;border-top:1px solid #262626;">
         <div style="color:#d4af37;font-size:10px;letter-spacing:0.3em;text-transform:uppercase;margin-bottom:12px;">Stornierung</div>
         <p style="font-size:13px;color:#a8a29a;line-height:1.65;margin:0 0 14px;">Falls Sie nicht kommen können, stornieren Sie bitte über den folgenden Link:</p>
         <p style="margin:0 0 14px;"><a href="${cancelUrl}" style="display:inline-block;padding:11px 24px;border:1px solid #d4af37;color:#d4af37;text-decoration:none;font-size:11px;letter-spacing:0.25em;text-transform:uppercase;">Reservation stornieren</a></p>
         <p style="font-size:11px;color:#7a736a;line-height:1.6;margin:0;">Kostenlose Stornierung bis 7 Tage vor dem Anlass. Bei späterer Stornierung eines kostenpflichtigen Anlasses oder bei No-Show können CHF 50 belastet werden.</p>
       </div>`
    : "";

  const notesBlock = r.notes
    ? `<div style="margin-top:20px;padding:16px 18px;background:#1a1a1a;border-left:2px solid #d4af37;color:#c8c2b6;font-size:14px;line-height:1.6;">
         <div style="color:#d4af37;font-size:10px;letter-spacing:0.25em;text-transform:uppercase;margin-bottom:8px;">Notiz vom Gast</div>${r.notes}</div>`
    : "";

  const feeBlock = opts.feeCharged
    ? `<div style="margin-top:20px;padding:14px 18px;background:#2a1810;border-left:2px solid #d4af37;color:#e8b96a;font-size:13px;letter-spacing:0.02em;">Storno-Gebühr von <strong style="color:#f5d78c;">CHF 50</strong> wurde belastet.</div>`
    : "";

  return {
    name: r.guest_name ?? "",
    email: r.guest_email ?? "",
    telefon: r.guest_phone ?? "",
    telefon_or_dash: r.guest_phone || "—",
    personen: String(r.party_size ?? ""),
    datum,
    datum_or_offen: datum || "Kein Datum",
    uhrzeit,
    uhrzeit_or_dash: uhrzeit || "—",
    uhrzeit_prefix: uhrzeit ? ` um ${uhrzeit}` : "",
    uhrzeit_strong_prefix: uhrzeit ? ` um <strong>${uhrzeit}</strong>` : "",
    anlass,
    anlass_or_dash: anlass || "—",
    anlass_suffix: anlass ? ` · ${anlass}` : "",
    datum_or_anlass_suffix: datum ? ` (${datum})` : anlass ? ` (${anlass})` : "",
    restaurant,
    storno_link: cancelUrl,
    storno_block: stornoBlock,
    notes: r.notes ?? "",
    notes_block: notesBlock,
    fee_block: feeBlock,
  };
}

export function renderTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (_, k) =>
    Object.prototype.hasOwnProperty.call(vars, k) ? vars[k] : `{${k}}`,
  );
}

async function sendEmail(payload: { to: string; subject: string; html: string }) {
  const s = await getSmtpSettings();
  if (!s || !s.enabled) {
    console.log("[email skipped — versand deaktiviert]", payload.subject, "→", payload.to);
    return;
  }
  if (!s.smtp_host || !s.smtp_port || !s.from_email) {
    console.log("[email skipped — SMTP unvollständig konfiguriert]", payload.subject, "→", payload.to);
    return;
  }
  try {
    const transporter = nodemailer.createTransport({
      host: s.smtp_host,
      port: s.smtp_port,
      secure: !!s.smtp_secure && s.smtp_port === 465,
      requireTLS: !!s.smtp_secure && s.smtp_port !== 465,
      auth: s.smtp_username ? { user: s.smtp_username, pass: s.smtp_password ?? "" } : undefined,
    });
    const info = await transporter.sendMail({
      from: s.from_name ? `"${s.from_name}" <${s.from_email}>` : s.from_email,
      to: payload.to,
      replyTo: s.reply_to || undefined,
      subject: payload.subject,
      html: payload.html,
    });
    console.log("[email sent]", payload.subject, "→", payload.to, {
      messageId: info.messageId,
      accepted: info.accepted,
      rejected: info.rejected,
      response: info.response,
    });
  } catch (err) {
    console.error("[email error]", err);
    throw err;
  }
}

async function renderAndSend(
  key: TemplateKey,
  to: string,
  r: Reservation,
  extras: { restaurant: string; cancelUrl?: string | null; feeCharged?: boolean; fallback: { subject: string; html: string } },
) {
  const tpl = await loadTemplate(key, r.occasion);
  const vars = buildTemplateVars(r, extras);
  if (!tpl) {
    await sendEmail({ to, subject: renderTemplate(extras.fallback.subject, vars), html: renderTemplate(extras.fallback.html, vars) });
    return;
  }
  if (!tpl.enabled) {
    console.log(`[email skipped — template '${key}' disabled]`);
    return;
  }
  await sendEmail({
    to,
    subject: renderTemplate(tpl.subject || extras.fallback.subject, vars),
    html: renderTemplate(tpl.body_html || extras.fallback.html, vars),
  });
}

// ---------------------------------------------------------------------------
// Public API — same names as before so callers don't need to change.
// ---------------------------------------------------------------------------

export async function sendReservationConfirmation(r: Reservation) {
  const contact = await getContact();
  const restaurant = contact?.restaurant_name ?? "Balkaneros";
  const cancelUrl = r.cancellation_token
    ? `${getSiteBaseUrl()}/reservation-cancel/${r.cancellation_token}`
    : null;
  await renderAndSend("reservation_request", r.guest_email, r, {
    restaurant,
    cancelUrl,
    fallback: {
      subject: "Reservierungsanfrage bei {restaurant} erhalten",
      html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;padding:24px;">
        <h2>Hvala – wir haben Ihre Anfrage erhalten</h2>
        <p>Liebe/r {name}, danke für Ihre Anfrage bei {restaurant}.</p>
        <p>{datum_or_offen}{uhrzeit_prefix} · {personen} Personen</p>
        {storno_block}
      </div>`,
    },
  });
}

export async function sendAdminNotification(r: Reservation, overrideTo?: string) {
  const contact = await getContact();
  const to = overrideTo || contact?.notification_email || contact?.email;
  if (!to) return;
  const restaurant = contact?.restaurant_name ?? "Balkaneros";
  await renderAndSend("admin_notification", to, r, {
    restaurant,
    fallback: {
      subject: "Neue Reservierung: {name}{datum_or_anlass_suffix}",
      html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;padding:16px;">
        <h2>Neue Reservierungsanfrage</h2>
        <p><strong>{name}</strong> &lt;{email}&gt;</p>
        <p>Telefon: {telefon_or_dash}</p>
        <p>{datum_or_offen}{uhrzeit_prefix} · {personen} Personen{anlass_suffix}</p>
        {notes_block}
      </div>`,
    },
  });
}

export async function sendAdminCancellationNotification(r: Reservation, feeCharged?: boolean) {
  const contact = await getContact();
  const to = contact?.notification_email || contact?.email;
  if (!to) return;
  const restaurant = contact?.restaurant_name ?? "Balkaneros";
  await renderAndSend("admin_cancellation", to, r, {
    restaurant,
    feeCharged,
    fallback: {
      subject: "Stornierung: {name}{datum_or_anlass_suffix}",
      html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;padding:16px;">
        <h2>Reservierung storniert</h2>
        <p><strong>{name}</strong> &lt;{email}&gt;</p>
        <p>{datum_or_offen}{uhrzeit_prefix} · {personen} Personen{anlass_suffix}</p>
        {fee_block}
        {notes_block}
      </div>`,
    },
  });
}

export async function sendReservationStatusUpdate(r: Reservation) {
  const contact = await getContact();
  const restaurant = contact?.restaurant_name ?? "Balkaneros";
  const cancelUrl = r.cancellation_token
    ? `${getSiteBaseUrl()}/reservation-cancel/${r.cancellation_token}`
    : null;
  const key: TemplateKey =
    r.status === "cancelled"
      ? "reservation_cancelled"
      : r.status === "confirmed"
        ? "reservation_confirmed"
        : "reservation_declined";
  await renderAndSend(key, r.guest_email, r, {
    restaurant,
    cancelUrl,
    fallback: {
      subject:
        r.status === "cancelled"
          ? "Ihre Reservierung bei {restaurant} wurde storniert"
          : r.status === "confirmed"
            ? "Ihre Reservierung bei {restaurant} ist bestätigt"
            : "Ihre Reservierungsanfrage bei {restaurant}",
      html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;padding:24px;">
        <p>Liebe/r {name},</p>
        <p>Status: ${r.status}</p>
        <p>{datum_or_offen}{uhrzeit_prefix} · {personen} Personen</p>
      </div>`,
    },
  });
}
