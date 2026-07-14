import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getVoucherBySessionId } from "@/lib/vouchers.functions";
import { SiteHeader } from "@/components/site/SiteHeader";
import { CheckCircle2, Mail, Gift } from "lucide-react";

export const Route = createFileRoute("/gutschein-danke")({
  head: () => ({ meta: [{ title: "Gutschein — Danke · Balkaneros" }] }),
  validateSearch: (search: Record<string, unknown>): { session_id?: string } => ({
    session_id: typeof search.session_id === "string" ? search.session_id : undefined,
  }),
  component: Page,
});

function Page() {
  const { session_id } = Route.useSearch();
  const fn = useServerFn(getVoucherBySessionId);
  const { data, isLoading } = useQuery({
    queryKey: ["voucher-return", session_id],
    queryFn: () => (session_id ? fn({ data: { sessionId: session_id } }) : Promise.resolve({ found: false as const })),
    refetchInterval: (q) => (q.state.data && "found" in q.state.data && q.state.data.found && q.state.data.voucher?.status === "paid" ? false : 3000),
    enabled: !!session_id,
  });

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <SiteHeader />
      <main className="flex-1 flex items-center justify-center px-4 pt-32 pb-20">
        <div className="max-w-lg w-full text-center border border-gold/30 rounded-sm p-10 bg-card/50 backdrop-blur">
          <div className="w-16 h-16 rounded-full bg-gold/15 flex items-center justify-center mx-auto mb-6">
            {data?.found && data.voucher?.status === "paid" ? (
              <CheckCircle2 className="w-8 h-8 text-gold" />
            ) : (
              <Gift className="w-8 h-8 text-gold animate-pulse" />
            )}
          </div>
          <p className="text-gold tracking-[0.3em] uppercase text-[10px] mb-3">Balkaneros Gutschein</p>
          <h1 className="font-display text-3xl sm:text-4xl mb-4">
            {isLoading || !data?.found ? "Zahlung wird verarbeitet …" :
              data.voucher?.status === "paid" ? "Herzlichen Dank!" : "Bestellung erhalten"}
          </h1>
          {data?.found && data.voucher && (
            <div className="space-y-3 text-muted-foreground">
              {data.voucher.status === "paid" ? (
                <>
                  <p className="text-cream">
                    Ihr Gutschein über <span className="text-gold">CHF {Number(data.voucher.amount_chf).toFixed(0)}</span> für{" "}
                    <span className="text-cream">{data.voucher.recipient_first_name} {data.voucher.recipient_last_name}</span> wurde erstellt.
                  </p>
                  <p className="text-sm inline-flex items-center gap-2 justify-center">
                    <Mail className="w-4 h-4 text-gold" />
                    Bestätigung mit PDF an <span className="text-cream">{data.voucher.buyer_email}</span>
                  </p>
                  <div className="pt-3">
                    <p className="text-xs text-muted-foreground">Gutschein-Nummer</p>
                    <p className="font-mono text-gold text-sm">{data.voucher.voucher_code}</p>
                  </div>
                </>
              ) : (
                <p>Wir bereiten Ihren Gutschein vor. Sie erhalten in Kürze eine E-Mail mit dem PDF.</p>
              )}
            </div>
          )}
          <Link to="/" className="mt-8 inline-block rounded-full border border-gold/40 text-gold px-8 py-2.5 text-xs uppercase tracking-[0.25em] hover:bg-gold/10">
            Zur Startseite
          </Link>
        </div>
      </main>
    </div>
  );
}
