import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
import { createVoucherCheckout } from "@/lib/vouchers.functions";
import { getStripe, getStripeEnvironment } from "@/lib/stripe";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Gift, ArrowLeft, AlertCircle } from "lucide-react";
import offerBrunch from "@/assets/offer-brunch.jpg";

const PRESETS = [100, 200, 300];


export function VoucherDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [step, setStep] = useState<"amount" | "details" | "checkout">("amount");
  const [amount, setAmount] = useState<number>(100);
  const [customAmount, setCustomAmount] = useState<string>("");
  const [recipientFirstName, setRecipientFirstName] = useState("");
  const [recipientLastName, setRecipientLastName] = useState("");
  const [personalMessage, setPersonalMessage] = useState("");
  const [buyerName, setBuyerName] = useState("");
  const [buyerEmail, setBuyerEmail] = useState("");
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const createFn = useServerFn(createVoucherCheckout);

  function reset() {
    setStep("amount");
    setAmount(100);
    setCustomAmount("");
    setRecipientFirstName("");
    setRecipientLastName("");
    setPersonalMessage("");
    setBuyerName("");
    setBuyerEmail("");
    setClientSecret(null);
    setFormError(null);
  }

  function close(o: boolean) {
    if (!o) reset();
    onOpenChange(o);
  }

  const effectiveAmount = customAmount ? Number(customAmount) : amount;
  const customValid = !customAmount || (Number(customAmount) >= 10 && Number(customAmount) <= 1000);

  async function submit() {
    setFormError(null);
    if (!recipientFirstName.trim() || !recipientLastName.trim()) {
      setFormError("Bitte Vor- und Nachname des Beschenkten eingeben.");
      return;
    }
    if (!buyerName.trim() || !buyerEmail.trim()) {
      setFormError("Bitte Ihren Namen und Ihre E-Mail eingeben.");
      return;
    }
    if (!effectiveAmount || effectiveAmount < 10 || effectiveAmount > 1000) {
      setFormError("Betrag muss zwischen CHF 10 und CHF 1000 liegen.");
      return;
    }
    setSubmitting(true);
    try {
      const returnUrl = `${window.location.origin}/gutschein-danke?session_id={CHECKOUT_SESSION_ID}`;
      const env = getStripeEnvironment();
      const result = await createFn({
        data: {
          amountChf: Math.round(effectiveAmount),
          recipientFirstName: recipientFirstName.trim(),
          recipientLastName: recipientLastName.trim(),
          personalMessage: personalMessage.trim() || undefined,
          buyerName: buyerName.trim(),
          buyerEmail: buyerEmail.trim(),
          returnUrl,
          environment: env,
        },
      });
      if (result.error || !result.clientSecret) {
        setFormError(result.error || "Fehler beim Erstellen der Zahlung.");
        return;
      }
      setClientSecret(result.clientSecret);
      setStep("checkout");
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Unerwarteter Fehler.");
    } finally {
      setSubmitting(false);
    }
  }


  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-w-2xl bg-background border-gold/40 p-0 overflow-hidden max-h-[95vh] overflow-y-auto">
        <div className="relative">
          {/* Header */}
          <div className="relative px-6 sm:px-8 pt-8 pb-6 border-b border-gold/20 bg-gradient-to-b from-black/60 to-transparent">
            <DialogTitle className="text-center font-display text-2xl sm:text-3xl text-cream">
              <span className="text-gold tracking-[0.3em] uppercase text-[10px] block mb-2">Balkaneros</span>
              Gutschein verschenken
            </DialogTitle>
            <DialogDescription className="text-center text-muted-foreground text-sm mt-2">
              {step === "amount" && "Wählen Sie den Betrag aus."}
              {step === "details" && "Für wen ist dieser Gutschein?"}
              {step === "checkout" && "Sichere Zahlung mit Stripe."}
            </DialogDescription>
          </div>

          <div className="px-6 sm:px-8 py-6">
            {step === "amount" && (
              <div className="space-y-6">
                <div className="grid grid-cols-3 gap-2 sm:gap-3">
                  {PRESETS.map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => { setAmount(v); setCustomAmount(""); }}
                      className={`group relative overflow-hidden rounded-sm border-2 aspect-[3/4] sm:aspect-[4/5] transition-all ${
                        amount === v && !customAmount
                          ? "border-gold shadow-[0_0_30px_-8px_rgba(212,175,55,0.6)]"
                          : "border-gold/25 hover:border-gold/60"
                      }`}
                      style={{
                        backgroundImage: `linear-gradient(rgba(20,15,10,0.86), rgba(12,10,8,0.92)), url(${offerBrunch})`,
                        backgroundSize: "cover",
                        backgroundPosition: "center",
                      }}

                    >
                      {/* Bestseller badge */}
                      {v === 200 && (
                        <span className="absolute top-1.5 inset-x-0 z-10 mx-auto w-fit rounded-full bg-gold px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-black shadow">
                          Bestseller
                        </span>
                      )}
                      {/* Ornament corners */}
                      <span className="absolute top-2 left-2 w-4 h-4 sm:w-6 sm:h-6 border-l-2 border-t-2 border-gold/60" />
                      <span className="absolute top-2 right-2 w-4 h-4 sm:w-6 sm:h-6 border-r-2 border-t-2 border-gold/60" />
                      <span className="absolute bottom-2 left-2 w-4 h-4 sm:w-6 sm:h-6 border-l-2 border-b-2 border-gold/60" />
                      <span className="absolute bottom-2 right-2 w-4 h-4 sm:w-6 sm:h-6 border-r-2 border-b-2 border-gold/60" />
                      <div className="relative h-full flex flex-col items-center justify-center">
                        <div className="text-gold text-[8px] sm:text-[9px] tracking-[0.4em] mb-1 sm:mb-2">CHF</div>
                        <div className="font-display text-3xl sm:text-4xl md:text-5xl text-cream">{v}</div>
                        <div className="mt-2 sm:mt-3 w-8 sm:w-10 h-px bg-gold/60" />
                        <div className="text-[9px] sm:text-[10px] tracking-[0.3em] uppercase text-muted-foreground mt-2 sm:mt-3">Gutschein</div>
                      </div>
                    </button>
                  ))}
                </div>

                <div>
                  <label className="block text-[10px] tracking-[0.3em] uppercase text-gold mb-2">Individueller Betrag</label>
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground text-sm">CHF</span>
                    <input
                      type="number"
                      min={10}
                      max={1000}
                      value={customAmount}
                      onChange={(e) => setCustomAmount(e.target.value)}
                      placeholder="CHF 10 - 1000"
                      className="flex-1 bg-black/30 border border-gold/30 rounded-sm px-3 py-2.5 text-cream focus:border-gold focus:outline-none"
                    />
                  </div>
                  {!customValid && <p className="text-[11px] text-red-400 mt-1">Betrag muss zwischen 10 und 1000 liegen.</p>}
                  <p className="text-[10px] text-muted-foreground/80 mt-2 leading-relaxed">
                    Der Gutschein ist nicht rückzahlbar und kann nicht gegen Bargeld eingelöst werden. Er ist ausschliesslich bei Balkaneros Events gültig. Die Gültigkeitsdauer beträgt 2 Jahre ab Kaufdatum.
                  </p>
                </div>

                <button
                  type="button"
                  disabled={!customValid || !effectiveAmount || effectiveAmount < 10}
                  onClick={() => setStep("details")}
                  className="w-full rounded-full bg-gold text-gold-foreground py-3 uppercase tracking-[0.25em] text-xs disabled:opacity-40 hover:bg-gold/90 transition"
                >
                  Weiter · CHF {effectiveAmount || 0}
                </button>
              </div>
            )}

            {step === "details" && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] tracking-[0.3em] uppercase text-gold mb-1.5">Vorname *</label>
                    <input value={recipientFirstName} onChange={(e) => setRecipientFirstName(e.target.value)}
                      className="w-full bg-black/30 border border-gold/30 rounded-sm px-3 py-2 text-cream focus:border-gold focus:outline-none" />
                  </div>
                  <div>
                    <label className="block text-[10px] tracking-[0.3em] uppercase text-gold mb-1.5">Nachname *</label>
                    <input value={recipientLastName} onChange={(e) => setRecipientLastName(e.target.value)}
                      className="w-full bg-black/30 border border-gold/30 rounded-sm px-3 py-2 text-cream focus:border-gold focus:outline-none" />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] tracking-[0.3em] uppercase text-gold mb-1.5">Persönliche Nachricht (optional)</label>
                  <textarea value={personalMessage} onChange={(e) => setPersonalMessage(e.target.value.slice(0, 400))}
                    rows={3} placeholder="z.B. Alles Gute zum Geburtstag ..."
                    className="w-full bg-black/30 border border-gold/30 rounded-sm px-3 py-2 text-cream focus:border-gold focus:outline-none resize-none" />
                  <p className="text-[10px] text-muted-foreground mt-1">Erscheint auf dem Gutschein · {personalMessage.length}/400</p>
                </div>
                <div className="border-t border-gold/20 pt-4">
                  <p className="text-[10px] tracking-[0.3em] uppercase text-gold mb-3">Ihre Angaben</p>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-[10px] uppercase text-muted-foreground mb-1">Ihr Name *</label>
                      <input value={buyerName} onChange={(e) => setBuyerName(e.target.value)}
                        className="w-full bg-black/30 border border-gold/30 rounded-sm px-3 py-2 text-cream focus:border-gold focus:outline-none" />
                    </div>
                    <div>
                      <label className="block text-[10px] uppercase text-muted-foreground mb-1">Ihre E-Mail (für PDF) *</label>
                      <input type="email" value={buyerEmail} onChange={(e) => setBuyerEmail(e.target.value)}
                        className="w-full bg-black/30 border border-gold/30 rounded-sm px-3 py-2 text-cream focus:border-gold focus:outline-none" />
                    </div>
                  </div>
                </div>

                {formError && (
                  <div role="alert" className="flex items-start gap-2 rounded-sm border border-red-500/40 bg-red-500/10 px-3 py-2.5 text-[12px] text-red-300">
                    <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                    <span>{formError}</span>
                  </div>
                )}

                <div className="flex gap-3 pt-2">
                  <button type="button" onClick={() => setStep("amount")}
                    className="flex-1 rounded-full border border-gold/40 text-cream py-3 uppercase tracking-[0.25em] text-xs hover:bg-gold/10">
                    <ArrowLeft className="w-3 h-3 inline mr-2" /> Zurück
                  </button>
                  <button type="button" onClick={submit} disabled={submitting}
                    className="flex-[2] rounded-full bg-gold text-gold-foreground py-3 uppercase tracking-[0.25em] text-xs disabled:opacity-40 hover:bg-gold/90">
                    {submitting ? "…" : `Zur Zahlung · CHF ${effectiveAmount}`}
                  </button>
                </div>
              </div>
            )}


            {step === "checkout" && clientSecret && (
              <div className="min-h-[500px]">
                <EmbeddedCheckoutProvider stripe={getStripe()} options={{ fetchClientSecret: async () => clientSecret }}>
                  <EmbeddedCheckout />
                </EmbeddedCheckoutProvider>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function VoucherBadge({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group relative flex items-center justify-center w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gradient-to-br from-gold via-yellow-500 to-amber-700 shadow-[0_10px_40px_-8px_rgba(212,175,55,0.6)] hover:scale-105 transition-transform animate-pulse-slow"
      aria-label="Gutscheine kaufen"
    >
      <span className="absolute inset-1 rounded-full border border-black/30" />
      <span className="absolute inset-0 rounded-full ring-2 ring-gold/40 animate-ping opacity-40" />
      <div className="relative text-center leading-tight text-black">
        <Gift className="w-4 h-4 sm:w-5 sm:h-5 mx-auto mb-0.5" strokeWidth={2.2} />
        <div className="text-[8px] sm:text-[9px] font-bold tracking-widest uppercase">Gutscheine</div>
      </div>
    </button>
  );
}
