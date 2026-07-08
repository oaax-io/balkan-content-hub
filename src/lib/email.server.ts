// Email helpers. Sends via SMTP using credentials stored in `email_settings`.
// If SMTP settings are missing or `enabled` is false, sends are skipped.
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
  // Sentinel für "Datum offen" (nur Anfrage / kein Event-Datum ausgewählt)
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
      auth: s.smtp_username
        ? { user: s.smtp_username, pass: s.smtp_password ?? "" }
        : undefined,
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

export async function sendReservationConfirmation(r: Reservation) {
  const contact = await getContact();
  const restaurant = contact?.restaurant_name ?? "Balkaneros";
  const cancelUrl = r.cancellation_token
    ? `${getSiteBaseUrl()}/reservation-cancel/${r.cancellation_token}`
    : null;
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;padding:24px;background:#0f0f0f;color:#f5f5f5;">
      <h2 style="color:#d4af37;font-family:Georgia,serif;">Hvala – wir haben Ihre Anfrage erhalten</h2>
      <p>Liebe/r ${r.guest_name},</p>
      <p>danke für Ihre Reservierungsanfrage bei <strong>${restaurant}</strong>. Wir melden uns in Kürze mit einer Bestätigung.</p>
      <table style="margin:16px 0;border-collapse:collapse;">
        ${fmtDate(r.reservation_date) ? `<tr><td style="padding:4px 12px 4px 0;color:#aaa;">Datum</td><td>${fmtDate(r.reservation_date)}</td></tr>` : `<tr><td style="padding:4px 12px 4px 0;color:#aaa;">Datum</td><td>nach Absprache</td></tr>`}
        ${hasTime(r.reservation_time) ? `<tr><td style="padding:4px 12px 4px 0;color:#aaa;">Uhrzeit</td><td>${r.reservation_time}</td></tr>` : ""}
        <tr><td style="padding:4px 12px 4px 0;color:#aaa;">Personen</td><td>${r.party_size}</td></tr>
        ${r.occasion ? `<tr><td style="padding:4px 12px 4px 0;color:#aaa;">Anlass</td><td>${r.occasion}</td></tr>` : ""}

      </table>
      <p style="color:#aaa;font-size:13px;">Bei Fragen einfach auf diese E-Mail antworten.</p>
      ${cancelUrl ? `
      <hr style="border:none;border-top:1px solid #333;margin:24px 0;" />
      <p style="font-size:12px;color:#aaa;line-height:1.5;">
        Müssen Sie Ihre Reservation absagen? Nutzen Sie den folgenden Link:
      </p>
      <p style="margin:12px 0;">
        <a href="${cancelUrl}" style="display:inline-block;padding:8px 16px;background:transparent;border:1px solid #d4af37;color:#d4af37;text-decoration:none;font-size:12px;letter-spacing:0.05em;border-radius:4px;">
          Reservation stornieren
        </a>
      </p>
      <p style="font-size:11px;color:#888;line-height:1.5;margin-top:12px;">
        Kostenlose Stornierung ist bis 7 Tage vor dem Anlass möglich. Bei späterer Stornierung eines kostenpflichtigen Anlasses oder bei No-Show können CHF 50 belastet werden.
      </p>
      ` : ""}
      <p style="margin-top:24px;color:#d4af37;font-family:Georgia,serif;">— ${restaurant}</p>
    </div>`;
  await sendEmail({ to: r.guest_email, subject: `Reservierungsanfrage bei ${restaurant} erhalten`, html });
}

export async function sendAdminNotification(r: Reservation) {
  const contact = await getContact();
  const to = contact?.notification_email || contact?.email;
  if (!to) return;
  const dateStr = fmtDate(r.reservation_date) || "nach Absprache";
  const timeStr = hasTime(r.reservation_time) ? ` um ${r.reservation_time}` : "";
  const html = `
    <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;padding:16px;">
      <h2 style="color:#111;">Neue Reservierungsanfrage</h2>
      <p><strong>${r.guest_name}</strong> &lt;${r.guest_email}&gt;</p>
      <p>Telefon: ${r.guest_phone || "—"}</p>
      <p>${dateStr}${timeStr} · ${r.party_size} Personen${r.occasion ? ` · ${r.occasion}` : ""}</p>

      ${r.notes ? `<p style="background:#f6f6f6;padding:10px;border-radius:6px;">${r.notes}</p>` : ""}
      <p><a href="/admin">Im Admin öffnen →</a></p>
    </div>`;
  const subjectDate = fmtDate(r.reservation_date);
  await sendEmail({ to, subject: `Neue Reservierung: ${r.guest_name}${subjectDate ? ` (${subjectDate})` : r.occasion ? ` (${r.occasion})` : ""}`, html });
}

export async function sendReservationStatusUpdate(r: Reservation) {
  const contact = await getContact();
  const restaurant = contact?.restaurant_name ?? "Balkaneros";
  const confirmed = r.status === "confirmed";
  const subject = confirmed
    ? `Ihre Reservierung bei ${restaurant} ist bestätigt`
    : `Ihre Reservierungsanfrage bei ${restaurant}`;
  const dateStr = fmtDate(r.reservation_date) || "nach Absprache";
  const timeStr = hasTime(r.reservation_time) ? ` um <strong>${r.reservation_time}</strong>` : "";
  const timeStrPlain = hasTime(r.reservation_time) ? ` um ${r.reservation_time}` : "";
  const body = confirmed
    ? `Wir freuen uns auf Sie am <strong>${dateStr}</strong>${timeStr} (${r.party_size} Personen).`
    : `leider können wir Ihre Anfrage für ${dateStr}${timeStrPlain} nicht annehmen. Wir würden uns trotzdem freuen, Sie an einem anderen Tag bei uns begrüssen zu dürfen.`;

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;padding:24px;background:#0f0f0f;color:#f5f5f5;">
      <h2 style="color:#d4af37;font-family:Georgia,serif;">${confirmed ? "Reservierung bestätigt" : "Reservierungsanfrage"}</h2>
      <p>Liebe/r ${r.guest_name},</p>
      <p>${body}</p>
      <p style="margin-top:24px;color:#d4af37;font-family:Georgia,serif;">— ${restaurant}</p>
    </div>`;
  await sendEmail({ to: r.guest_email, subject, html });
}
