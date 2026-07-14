import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireAdmin } from "./admin.server";
import { createStripeClient, getStripeErrorMessage, type StripeEnv } from "./stripe.server";

const VOUCHER_PRESETS: Record<number, string> = {
  100: "gutschein_100_chf",
  200: "gutschein_200_chf",
  300: "gutschein_300_chf",
};

// ============================================================================
// PUBLIC: create checkout session for a voucher purchase
// ============================================================================
export const createVoucherCheckout = createServerFn({ method: "POST" })
  .inputValidator(
    (data: {
      amountChf: number;
      recipientFirstName: string;
      recipientLastName: string;
      personalMessage?: string;
      buyerName: string;
      buyerEmail: string;
      returnUrl: string;
      environment: StripeEnv;
    }) => {
      const schema = z.object({
        amountChf: z.number().int().min(10).max(1000),
        recipientFirstName: z.string().trim().min(1).max(60),
        recipientLastName: z.string().trim().min(1).max(60),
        personalMessage: z.string().trim().max(400).optional(),
        buyerName: z.string().trim().min(2).max(80),
        buyerEmail: z.string().trim().email().max(200),
        returnUrl: z.string().url(),
        environment: z.enum(["sandbox", "live"]),
      });
      return schema.parse(data);
    },
  )
  .handler(async ({ data }): Promise<{ clientSecret?: string; error?: string }> => {
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { generateVoucherCode } = await import("./voucher-pdf.server");

      // Unique code
      let voucherCode = generateVoucherCode();
      for (let i = 0; i < 5; i++) {
        const { data: existing } = await supabaseAdmin
          .from("vouchers").select("id").eq("voucher_code", voucherCode).maybeSingle();
        if (!existing) break;
        voucherCode = generateVoucherCode();
      }

      // Create pending voucher first
      const { data: voucher, error: insErr } = await supabaseAdmin
        .from("vouchers")
        .insert({
          voucher_code: voucherCode,
          amount_chf: data.amountChf,
          recipient_first_name: data.recipientFirstName,
          recipient_last_name: data.recipientLastName,
          personal_message: data.personalMessage || null,
          buyer_name: data.buyerName,
          buyer_email: data.buyerEmail,
          status: "pending",
        })
        .select()
        .single();
      if (insErr || !voucher) throw new Error(insErr?.message || "insert failed");

      const stripe = createStripeClient(data.environment);

      // Use preset lookup_key when it matches; else use price_data
      const presetKey = VOUCHER_PRESETS[data.amountChf];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let lineItem: any;
      if (presetKey) {
        const prices = await stripe.prices.list({ lookup_keys: [presetKey] });
        if (!prices.data.length) throw new Error("Price not found");
        lineItem = { price: prices.data[0].id, quantity: 1 };
      } else {
        lineItem = {
          price_data: {
            currency: "chf",
            product_data: {
              name: `Balkaneros Gutschein CHF ${data.amountChf}`,
              tax_code: "txcd_10501000",
            },
            unit_amount: data.amountChf * 100,
            tax_behavior: "inclusive",
          },
          quantity: 1,
        };
      }

      const session = await stripe.checkout.sessions.create({
        line_items: [lineItem],
        mode: "payment",
        ui_mode: "embedded_page",
        return_url: data.returnUrl,
        customer_email: data.buyerEmail,
        payment_intent_data: {
          description: `Balkaneros Gutschein ${voucherCode}`,
        },
        metadata: {
          voucher_id: voucher.id,
          voucher_code: voucherCode,
          purpose: "voucher_purchase",
        },
      });

      await supabaseAdmin
        .from("vouchers")
        .update({ stripe_session_id: session.id })
        .eq("id", voucher.id);

      return { clientSecret: session.client_secret ?? "" };
    } catch (error) {
      console.error("[vouchers.createCheckout]", error);
      return { error: getStripeErrorMessage(error) };
    }
  });

// ============================================================================
// PUBLIC: read voucher result by session id (return page)
// ============================================================================
export const getVoucherBySessionId = createServerFn({ method: "POST" })
  .inputValidator((data: { sessionId: string }) => {
    return z.object({ sessionId: z.string().min(3).max(200) }).parse(data);
  })
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: v } = await supabaseAdmin
      .from("vouchers")
      .select("voucher_code, amount_chf, status, buyer_email, recipient_first_name, recipient_last_name, expires_at, email_sent_at")
      .eq("stripe_session_id", data.sessionId)
      .maybeSingle();
    if (!v) return { found: false as const };
    return { found: true as const, voucher: v };
  });

// ============================================================================
// ADMIN: list all vouchers
// ============================================================================
export const listVouchers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("vouchers")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

// ============================================================================
// ADMIN: update voucher (amount, recipient, status, note, expires_at)
// ============================================================================
export const updateVoucher = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: {
    id: string;
    amount_chf?: number;
    recipient_first_name?: string;
    recipient_last_name?: string;
    personal_message?: string | null;
    buyer_name?: string;
    buyer_email?: string;
    status?: "pending" | "paid" | "redeemed" | "cancelled";
    expires_at?: string | null;
    redeemed_note?: string | null;
    internal_note?: string | null;
  }) => {
    const schema = z.object({
      id: z.string().uuid(),
      amount_chf: z.number().min(1).max(5000).optional(),
      recipient_first_name: z.string().min(1).max(60).optional(),
      recipient_last_name: z.string().min(1).max(60).optional(),
      personal_message: z.string().max(400).nullable().optional(),
      buyer_name: z.string().min(1).max(80).optional(),
      buyer_email: z.string().email().max(200).optional(),
      status: z.enum(["pending", "paid", "redeemed", "cancelled"]).optional(),
      expires_at: z.string().nullable().optional(),
      redeemed_note: z.string().max(500).nullable().optional(),
      internal_note: z.string().max(1000).nullable().optional(),
    });
    return schema.parse(data);
  })
  .handler(async ({ data, context }) => {
    await requireAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { id, ...patch } = data;
    // If setting status=redeemed and no redeemed_at, set it now
    const extra: Record<string, unknown> = {};
    if (patch.status === "redeemed") extra.redeemed_at = new Date().toISOString();
    const { error } = await supabaseAdmin
      .from("vouchers")
      .update({ ...patch, ...extra })
      .eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============================================================================
// ADMIN: get signed URL for PDF
// ============================================================================
export const getVoucherPdfUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    await requireAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: v } = await supabaseAdmin.from("vouchers").select("pdf_path").eq("id", data.id).maybeSingle();
    if (!v?.pdf_path) return { url: null as string | null };
    const { data: sig } = await supabaseAdmin.storage.from("vouchers").createSignedUrl(v.pdf_path, 3600);
    return { url: sig?.signedUrl ?? null };
  });

// ============================================================================
// ADMIN: regenerate PDF for a voucher
// ============================================================================
export const regenerateVoucherPdf = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    await requireAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { generateVoucherPdf } = await import("./voucher-pdf.server");

    const { data: v, error } = await supabaseAdmin.from("vouchers").select("*").eq("id", data.id).single();
    if (error || !v) throw new Error(error?.message || "not found");

    const { data: content } = await supabaseAdmin
      .from("site_content")
      .select("key,value")
      .in("key", ["voucher_pdf_footer", "voucher_pdf_terms"]);
    const kv = new Map((content || []).map((c: { key: string; value: string }) => [c.key, c.value]));

    const pdf = await generateVoucherPdf({
      voucherCode: v.voucher_code,
      amountChf: Number(v.amount_chf),
      recipientFirstName: v.recipient_first_name,
      recipientLastName: v.recipient_last_name,
      personalMessage: v.personal_message,
      buyerName: v.buyer_name,
      issuedAt: v.issued_at ? new Date(v.issued_at) : new Date(),
      expiresAt: v.expires_at ? new Date(v.expires_at) : new Date(Date.now() + 2 * 365 * 86400 * 1000),
      footerText: kv.get("voucher_pdf_footer") || undefined,
      termsText: kv.get("voucher_pdf_terms") || undefined,
    });

    const path = `${v.id}/${v.voucher_code}.pdf`;
    const { error: upErr } = await supabaseAdmin.storage
      .from("vouchers")
      .upload(path, pdf, { contentType: "application/pdf", upsert: true });
    if (upErr) throw new Error(upErr.message);

    await supabaseAdmin.from("vouchers").update({ pdf_path: path }).eq("id", v.id);
    return { ok: true, path };
  });

// ============================================================================
// ADMIN: render preview PDF with sample data (returns base64)
// ============================================================================
export const previewVoucherPdf = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { generateVoucherPdf, generateVoucherCode } = await import("./voucher-pdf.server");

    const { data: content } = await supabaseAdmin
      .from("site_content")
      .select("key,value")
      .in("key", ["voucher_pdf_footer", "voucher_pdf_terms"]);
    const kv = new Map((content || []).map((c: { key: string; value: string }) => [c.key, c.value]));

    const pdf = await generateVoucherPdf({
      voucherCode: generateVoucherCode(),
      amountChf: 150,
      recipientFirstName: "Maria",
      recipientLastName: "Musterfrau",
      personalMessage: "Alles Gute zum Geburtstag – geniess einen wunderschönen Abend bei den Balkaneros!",
      buyerName: "Andreas Beispiel",
      issuedAt: new Date(),
      expiresAt: new Date(Date.now() + 2 * 365 * 86400 * 1000),
      footerText: kv.get("voucher_pdf_footer") || undefined,
      termsText: kv.get("voucher_pdf_terms") || undefined,
    });
    // Base64 encode manually (Buffer safe on Worker with nodejs_compat)
    const b64 = Buffer.from(pdf).toString("base64");
    return { pdfBase64: b64 };
  });
