import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { attemptFeeCharge } from "@/lib/fee-charge.server";
import type { StripeEnv } from "@/lib/stripe.server";

/**
 * Wird täglich per Zeitplan aufgerufen und versucht offene Storno- bzw.
 * No-Show-Gebühren erneut zu belasten (an unterschiedlichen Tagen), bis die
 * Zahlung durchgeht oder die maximale Anzahl Versuche erreicht ist.
 */
async function run(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const token = url.searchParams.get("token") ?? request.headers.get("x-cron-token");
  const expected = process.env["FEE_RETRY_CRON_TOKEN"];
  if (!expected || token !== expected) {
    return new Response("Unauthorized", { status: 401 });
  }

  const environment = (url.searchParams.get("env") === "sandbox" ? "sandbox" : "live") as StripeEnv;

  const { data: rows, error } = await supabaseAdmin
    .from("reservations")
    .select("*")
    .eq("fee_retry_enabled", true)
    .is("cancellation_fee_charged_at", null)
    .lte("fee_retry_next_at", new Date().toISOString())
    .limit(25);

  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 });

  const results: Array<{ id: string; guest: string; ok: boolean; error?: string }> = [];
  for (const r of rows ?? []) {
    const perPerson = r.no_show_fee_amount ?? r.cancellation_fee_amount ?? 5000;
    const kind = r.fee_charge_kind === "no_show" ? "no_show" : "cancellation";
    const res = await attemptFeeCharge({
      reservation: r as any,
      environment,
      perPersonRappen: perPerson,
      kind,
    });
    results.push({
      id: r.id,
      guest: r.guest_name,
      ok: res.ok,
      error: res.ok ? undefined : res.error,
    });
  }

  return new Response(JSON.stringify({ processed: results.length, results }), {
    headers: { "Content-Type": "application/json" },
  });
}

export const Route = createFileRoute("/api/public/retry-fees")({
  server: {
    handlers: {
      GET: ({ request }) => run(request),
      POST: ({ request }) => run(request),
    },
  },
});
