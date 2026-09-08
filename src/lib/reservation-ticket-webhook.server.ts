// Wird vom Stripe-Webhook aufgerufen, sobald ein Ticket bezahlt wurde.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sendReservationStatusUpdate, sendAdminNotification } from "./email.server";

export async function handleReservationTicketPaid(
  reservationId: string,
  sessionId: string,
  paymentIntentId: string | null,
) {
  const { data: r, error } = await supabaseAdmin
    .from("reservations")
    .select("*")
    .eq("id", reservationId)
    .single();
  if (error || !r) {
    console.error("[reservation-ticket-webhook] reservation not found", reservationId, error);
    return;
  }
  if (r.ticket_payment_status === "paid" && r.status === "confirmed") return; // idempotent

  const { data: updated } = await supabaseAdmin
    .from("reservations")
    .update({
      status: "confirmed",
      ticket_payment_status: "paid",
      ticket_paid_at: new Date().toISOString(),
      stripe_checkout_session_id: sessionId,
      stripe_payment_intent_id: paymentIntentId,
    })
    .eq("id", r.id)
    .select()
    .single();

  const row = updated ?? r;
  try {
    await sendReservationStatusUpdate(row);
  } catch (e) {
    console.error("[reservation-ticket-webhook] guest mail failed", e);
  }
  try {
    await sendAdminNotification(row);
  } catch (e) {
    console.error("[reservation-ticket-webhook] admin mail failed", e);
  }
}
