// Server-only handler invoked from the Stripe webhook after a voucher session completes.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { generateVoucherPdf } from "./voucher-pdf.server";
import { sendVoucherEmail } from "./voucher-email.server";

export async function handleVoucherPaid(voucherId: string, sessionId: string, paymentIntentId: string | null) {
  const { data: v, error } = await supabaseAdmin.from("vouchers").select("*").eq("id", voucherId).single();
  if (error || !v) {
    console.error("[voucher-webhook] voucher not found", voucherId, error);
    return;
  }
  if (v.status === "paid" && v.pdf_path && v.email_sent_at) {
    // idempotent: already processed
    return;
  }

  const now = new Date();
  const expires = new Date(now);
  expires.setFullYear(expires.getFullYear() + 2);

  const { data: content } = await supabaseAdmin
    .from("site_content").select("key,value")
    .in("key", ["voucher_pdf_footer", "voucher_pdf_terms"]);
  const kv = new Map((content || []).map((c: { key: string; value: string }) => [c.key, c.value]));

  // 1. Mark paid
  await supabaseAdmin.from("vouchers").update({
    status: "paid",
    issued_at: v.issued_at || now.toISOString(),
    expires_at: v.expires_at || expires.toISOString(),
    stripe_session_id: sessionId,
    stripe_payment_intent_id: paymentIntentId,
  }).eq("id", v.id);

  // 2. Generate PDF
  const pdf = await generateVoucherPdf({
    voucherCode: v.voucher_code,
    amountChf: Number(v.amount_chf),
    recipientFirstName: v.recipient_first_name,
    recipientLastName: v.recipient_last_name,
    personalMessage: v.personal_message,
    buyerName: v.buyer_name,
    issuedAt: v.issued_at ? new Date(v.issued_at) : now,
    expiresAt: v.expires_at ? new Date(v.expires_at) : expires,
    footerText: kv.get("voucher_pdf_footer") || undefined,
    termsText: kv.get("voucher_pdf_terms") || undefined,
  });

  const path = `${v.id}/${v.voucher_code}.pdf`;
  const { error: upErr } = await supabaseAdmin.storage
    .from("vouchers")
    .upload(path, pdf, { contentType: "application/pdf", upsert: true });
  if (upErr) {
    console.error("[voucher-webhook] pdf upload failed", upErr);
  } else {
    await supabaseAdmin.from("vouchers").update({ pdf_path: path }).eq("id", v.id);
  }

  // 3. Email buyer
  try {
    const result = await sendVoucherEmail({
      buyerName: v.buyer_name,
      buyerEmail: v.buyer_email,
      recipientName: `${v.recipient_first_name} ${v.recipient_last_name}`,
      amountChf: Number(v.amount_chf),
      voucherCode: v.voucher_code,
      expiresAt: v.expires_at ? new Date(v.expires_at) : expires,
      pdfBytes: pdf,
    });
    if (result.sent) {
      await supabaseAdmin.from("vouchers").update({ email_sent_at: new Date().toISOString() }).eq("id", v.id);
    }
  } catch (e) {
    console.error("[voucher-webhook] email send failed", e);
  }
}
