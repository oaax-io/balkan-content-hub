// Sends the voucher purchase confirmation email to the buyer with PDF attachment.
import nodemailer from "nodemailer";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export interface VoucherEmailData {
  buyerName: string;
  buyerEmail: string;
  recipientName: string;
  amountChf: number;
  voucherCode: string;
  expiresAt: Date;
  pdfBytes: Uint8Array;
}

async function getSmtpSettings() {
  const { data } = await supabaseAdmin.from("email_settings").select("*").eq("id", 1).maybeSingle();
  return data;
}

function fmtDate(d: Date) {
  return d.toLocaleDateString("de-CH", { day: "2-digit", month: "long", year: "numeric", timeZone: "Europe/Zurich" });
}

function fmtAmount(n: number) {
  return `CHF ${n.toFixed(2)}`;
}

export async function sendVoucherEmail(data: VoucherEmailData): Promise<{ sent: boolean; reason?: string }> {
  const s = await getSmtpSettings();
  if (!s || !s.enabled) return { sent: false, reason: "email disabled" };
  if (!s.smtp_host || !s.smtp_port || !s.from_email) return { sent: false, reason: "smtp incomplete" };

  const html = `
<div style="font-family:Georgia,serif;max-width:600px;margin:auto;background:#140f08;color:#f5eeda;padding:40px 32px;">
  <div style="text-align:center;border:1px solid #d4af37;padding:36px 24px;">
    <div style="color:#d4af37;font-size:11px;letter-spacing:0.4em;">BALKANEROS</div>
    <h1 style="font-size:32px;margin:24px 0 8px;color:#f5eeda;font-weight:normal;">Vielen Dank!</h1>
    <p style="color:#b3ab9a;font-size:14px;margin:0 0 24px;">Ihr Gutschein wurde erfolgreich gekauft.</p>

    <div style="background:#1e170d;padding:20px;margin:20px 0;text-align:left;">
      <div style="color:#d4af37;font-size:10px;letter-spacing:0.3em;text-transform:uppercase;">Übersicht</div>
      <table style="width:100%;margin-top:12px;font-size:14px;color:#f5eeda;">
        <tr><td style="padding:6px 0;color:#8a8272;">Für</td><td style="padding:6px 0;text-align:right;">${data.recipientName}</td></tr>
        <tr><td style="padding:6px 0;color:#8a8272;">Betrag</td><td style="padding:6px 0;text-align:right;color:#d4af37;font-size:18px;">${fmtAmount(data.amountChf)}</td></tr>
        <tr><td style="padding:6px 0;color:#8a8272;">Gutschein-Nr.</td><td style="padding:6px 0;text-align:right;font-family:monospace;color:#d4af37;">${data.voucherCode}</td></tr>
        <tr><td style="padding:6px 0;color:#8a8272;">Gültig bis</td><td style="padding:6px 0;text-align:right;">${fmtDate(data.expiresAt)}</td></tr>
      </table>
    </div>

    <p style="color:#b3ab9a;font-size:13px;line-height:1.7;">Der Gutschein liegt als PDF im Anhang. Sie können ihn direkt ausdrucken oder digital weitergeben.</p>
    <p style="color:#8a8272;font-size:12px;margin-top:24px;">Bei Fragen erreichen Sie uns unter <a href="mailto:info@balkaneros.ch" style="color:#d4af37;">info@balkaneros.ch</a>.</p>
  </div>
  <p style="text-align:center;color:#6b6355;font-size:11px;margin-top:24px;">balkaneros.ch</p>
</div>`.trim();

  try {
    const transporter = nodemailer.createTransport({
      host: s.smtp_host,
      port: s.smtp_port,
      secure: !!s.smtp_secure && s.smtp_port === 465,
      requireTLS: !!s.smtp_secure && s.smtp_port !== 465,
      auth: s.smtp_username ? { user: s.smtp_username, pass: s.smtp_password ?? "" } : undefined,
    });
    await transporter.sendMail({
      from: s.from_name ? `"${s.from_name}" <${s.from_email}>` : s.from_email,
      to: data.buyerEmail,
      replyTo: s.reply_to || undefined,
      subject: `Ihr Balkaneros Gutschein · ${data.voucherCode}`,
      html,
      attachments: [
        {
          filename: `Balkaneros-Gutschein-${data.voucherCode}.pdf`,
          content: Buffer.from(data.pdfBytes),
          contentType: "application/pdf",
        },
      ],
    });
    return { sent: true };
  } catch (err) {
    console.error("[voucher-email] error", err);
    return { sent: false, reason: err instanceof Error ? err.message : "send failed" };
  }
}
