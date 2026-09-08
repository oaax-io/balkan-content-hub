import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { checkNewsletterToken, unsubscribeNewsletter } from "@/lib/newsletter.functions";

export const Route = createFileRoute("/newsletter-abmelden")({
  head: () => ({
    meta: [
      { title: "Newsletter abmelden – Balkaneros Events" },
      { name: "description", content: "Melde dich hier vom Balkaneros Events Newsletter ab. Ein Klick genügt." },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Newsletter abmelden – Balkaneros Events" },
      { property: "og:description", content: "Melde dich hier vom Balkaneros Events Newsletter ab." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: NewsletterUnsubscribePage,
});

function NewsletterUnsubscribePage() {
  const check = useServerFn(checkNewsletterToken);
  const unsub = useServerFn(unsubscribeNewsletter);
  const [state, setState] = useState<"loading" | "confirm" | "already" | "invalid" | "done">("loading");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [token, setToken] = useState("");

  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get("token") ?? "";
    setToken(t);
    if (!t) {
      setState("invalid");
      return;
    }
    check({ data: { token: t } })
      .then((r) => {
        if (!r.found) return setState("invalid");
        setEmail(r.email);
        setState(r.subscribed ? "confirm" : "already");
      })
      .catch(() => setState("invalid"));
  }, [check]);

  const handleUnsubscribe = async () => {
    setBusy(true);
    try {
      const r = await unsub({ data: { token } });
      setState(r.ok ? "done" : "invalid");
    } catch {
      setState("invalid");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="min-h-screen bg-background flex items-center justify-center px-6 py-20">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 text-center space-y-5">
        <div>
          <div className="tracking-[0.4em] text-sm font-semibold text-gold">BALKANEROS</div>
          <div className="tracking-[0.25em] text-[10px] text-muted-foreground mt-1">EVENTS</div>
        </div>

        {state === "loading" && <p className="text-sm text-muted-foreground">Einen Moment …</p>}

        {state === "confirm" && (
          <>
            <h1 className="font-display text-2xl text-foreground">Newsletter abmelden</h1>
            <p className="text-sm text-muted-foreground">
              Möchtest du <span className="text-foreground">{email}</span> wirklich vom Newsletter abmelden?
            </p>
            <Button onClick={handleUnsubscribe} disabled={busy} className="bg-gold text-gold-foreground hover:bg-gold/90 w-full">
              {busy ? "Wird abgemeldet …" : "Jetzt abmelden"}
            </Button>
            <a href="/" className="block text-xs text-muted-foreground hover:text-gold">Zurück zur Website</a>
          </>
        )}

        {state === "already" && (
          <>
            <h1 className="font-display text-2xl text-foreground">Bereits abgemeldet</h1>
            <p className="text-sm text-muted-foreground">{email} erhält keine Newsletter mehr von uns.</p>
            <a href="/" className="block text-xs text-muted-foreground hover:text-gold">Zurück zur Website</a>
          </>
        )}

        {state === "done" && (
          <>
            <h1 className="font-display text-2xl text-foreground">Du bist abgemeldet</h1>
            <p className="text-sm text-muted-foreground">
              Schade, dass du gehst. {email} erhält ab jetzt keine Newsletter mehr.
            </p>
            <a href="/" className="block text-xs text-muted-foreground hover:text-gold">Zurück zur Website</a>
          </>
        )}

        {state === "invalid" && (
          <>
            <h1 className="font-display text-2xl text-foreground">Link ungültig</h1>
            <p className="text-sm text-muted-foreground">
              Dieser Abmelde-Link ist nicht mehr gültig. Schreib uns kurz an{" "}
              <a href="mailto:info@balkaneros.ch" className="text-gold">info@balkaneros.ch</a> und wir melden dich manuell ab.
            </p>
            <a href="/" className="block text-xs text-muted-foreground hover:text-gold">Zurück zur Website</a>
          </>
        )}
      </div>
    </main>
  );
}
