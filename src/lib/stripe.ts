import { loadStripe, type Stripe } from "@stripe/stripe-js";

const clientToken = import.meta.env.VITE_PAYMENTS_CLIENT_TOKEN as string | undefined;

export type StripeEnv = "sandbox" | "live";

export function getStripeEnvironment(): StripeEnv {
  if (clientToken?.startsWith("pk_test_")) return "sandbox";
  if (clientToken?.startsWith("pk_live_")) return "live";
  throw new Error(
    "Stripe payments are not configured for this build. Complete Stripe go-live in your Lovable project to enable production checkout.",
  );
}

let stripePromise: Promise<Stripe | null> | null = null;
export function getStripe(): Promise<Stripe | null> {
  if (!stripePromise) {
    getStripeEnvironment();
    stripePromise = loadStripe(clientToken as string);
  }
  return stripePromise;
}

/** Kostenpflichtige Anlässe verlangen eine hinterlegte Zahlungsmethode. */
export function isPaidOccasion(
  occasion: string | null | undefined,
  paidList?: string[] | null,
): boolean {
  if (!occasion) return false;
  if (paidList && paidList.length > 0) {
    return paidList.some((p) => p.trim().toLowerCase() === occasion.trim().toLowerCase());
  }
  // Fallback (falls Admin-Liste leer): heuristisch
  const s = occasion.toLowerCase();
  return s.includes("99.- pro person") || s.includes("dinner & dance");
}
