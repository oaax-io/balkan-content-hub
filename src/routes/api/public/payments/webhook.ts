// Stripe webhook handler for voucher purchases.
// On `checkout.session.completed` with metadata.purpose = 'voucher_purchase':
//   1. Mark voucher paid, set issued_at + expires_at (+2y).
//   2. Generate PDF, upload to storage.
//   3. Send confirmation email to buyer with PDF attached.
import { createFileRoute } from "@tanstack/react-router";
import { verifyWebhookHelper } from "@/lib/stripe-webhook.server";

export const Route = createFileRoute("/api/public/payments/webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const rawEnv = new URL(request.url).searchParams.get("env");
        const env: "sandbox" | "live" = rawEnv === "live" ? "live" : "sandbox";
        try {
          const event = await verifyWebhookHelper(request, env);
          if (event.type === "checkout.session.completed") {
            const session = event.data.object as {
              id: string;
              metadata?: Record<string, string> | null;
              payment_intent?: string | null;
            };
            const purpose = session.metadata?.purpose;
            if (purpose === "voucher_purchase" && session.metadata?.voucher_id) {
              const { handleVoucherPaid } = await import("@/lib/vouchers-webhook.server");
              await handleVoucherPaid(session.metadata.voucher_id, session.id, session.payment_intent ?? null);
            }
          }
          return Response.json({ received: true });
        } catch (e) {
          console.error("[stripe-webhook] error", e);
          return new Response("Webhook error", { status: 400 });
        }
      },
    },
  },
});
