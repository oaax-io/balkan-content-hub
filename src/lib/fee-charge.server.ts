import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { createStripeClient, getStripeErrorMessage, type StripeEnv } from "./stripe.server";
import { sendAdminNoShowChargeNotification } from "./email.server";

export type FeeKind = "cancellation" | "no_show";

// Abstände (in Tagen) zwischen den automatischen Wiederholungsversuchen
export const RETRY_DELAYS_DAYS = [1, 2, 3, 5, 7, 10, 14, 21, 30];
export const MAX_RETRY_ATTEMPTS = RETRY_DELAYS_DAYS.length;

export function nextRetryDate(attempts: number): string | null {
  if (attempts >= MAX_RETRY_ATTEMPTS) return null;
  const days = RETRY_DELAYS_DAYS[attempts] ?? 30;
  const d = new Date();
  d.setDate(d.getDate() + days);
  // immer morgens versuchen
  d.setHours(9, 0, 0, 0);
  return d.toISOString();
}

export type ChargeResult =
  | { ok: true; payment_intent_id: string }
  | { ok: false; error: string };

/**
 * Belastet die hinterlegte Zahlungsmethode einer Reservation.
 * Bei Ablehnung wird ein automatischer Wiederholungsversuch an einem
 * späteren Tag eingeplant (retry = true).
 */
export async function attemptFeeCharge(opts: {
  reservation: Record<string, any>;
  environment: StripeEnv;
  perPersonRappen: number;
  kind: FeeKind;
  retry?: boolean;
  notify?: boolean;
}): Promise<ChargeResult> {
  const { reservation: r, environment, perPersonRappen, kind } = opts;
  const retry = opts.retry !== false;
  const shouldNotify = opts.notify !== false;

  if (!r.stripe_customer_id || !r.stripe_payment_method_id) {
    return { ok: false, error: "Keine hinterlegte Zahlungsmethode gefunden." };
  }

  const partySize = Math.max(1, r.party_size ?? 1);
  const amount = perPersonRappen * partySize;
  const currency = (r.cancellation_fee_currency ?? "chf").toLowerCase();
  const attempts = (r.fee_retry_attempts ?? 0) + 1;
  const label = kind === "cancellation" ? "Stornogebühr" : "No-Show Gebühr";

  const notify = async (ok: boolean, err?: string | null, pi?: string | null) => {
    if (!shouldNotify) return;
    try {
      await sendAdminNoShowChargeNotification({
        reservation: r as any,
        ok,
        perPersonRappen,
        partySize,
        totalRappen: amount,
        error: err ?? null,
        paymentIntentId: pi ?? null,
      });
    } catch (e) {
      console.error("[fee notify failed]", e);
    }
  };

  const markFailure = async (message: string, pi?: string | null) => {
    const next = retry ? nextRetryDate(attempts) : null;
    await supabaseAdmin
      .from("reservations")
      .update({
        cancellation_fee_charge_status: `failed: ${message.slice(0, 200)}`,
        cancellation_fee_payment_intent_id: pi ?? r.cancellation_fee_payment_intent_id ?? null,
        fee_charge_kind: kind,
        fee_retry_attempts: attempts,
        fee_retry_enabled: !!next,
        fee_retry_next_at: next,
        fee_retry_last_error: message.slice(0, 400),
        no_show_fee_amount: perPersonRappen,
        cancellation_fee_amount: perPersonRappen,
      })
      .eq("id", r.id);
  };

  try {
    const stripe = createStripeClient(environment);
    const paymentIntent = await stripe.paymentIntents.create({
      amount,
      currency,
      customer: r.stripe_customer_id,
      payment_method: r.stripe_payment_method_id,
      off_session: true,
      confirm: true,
      description: `Balkaneros ${label} — ${r.occasion} (${r.guest_name})`,
      metadata: {
        reservation_id: r.id,
        type: kind === "cancellation" ? "cancellation_fee" : "no_show_fee",
        occasion: r.occasion ?? "",
        attempt: String(attempts),
      },
    });

    if (paymentIntent.status !== "succeeded" && paymentIntent.status !== "processing") {
      await markFailure(paymentIntent.status, paymentIntent.id);
      await notify(false, `Zahlung fehlgeschlagen (Status: ${paymentIntent.status})`, paymentIntent.id);
      return { ok: false, error: `Zahlung fehlgeschlagen (Status: ${paymentIntent.status}).` };
    }

    const { error: updErr } = await supabaseAdmin
      .from("reservations")
      .update({
        cancellation_fee_charged_at: new Date().toISOString(),
        cancellation_fee_payment_intent_id: paymentIntent.id,
        cancellation_fee_charge_status: paymentIntent.status,
        no_show_fee_amount: perPersonRappen,
        cancellation_fee_amount: perPersonRappen,
        fee_charge_kind: kind,
        fee_retry_enabled: false,
        fee_retry_next_at: null,
        fee_retry_attempts: attempts,
        fee_retry_last_error: null,
      })
      .eq("id", r.id);
    if (updErr) return { ok: false, error: updErr.message };

    await notify(true, null, paymentIntent.id);
    return { ok: true, payment_intent_id: paymentIntent.id };
  } catch (error) {
    const message = getStripeErrorMessage(error);
    await markFailure(message);
    await notify(false, message);
    return { ok: false, error: `Stripe-Belastung fehlgeschlagen: ${message}` };
  }
}
